import { addMonths, format } from 'date-fns';
import { clusterIdOf, clusterTitle } from './bundleView';

/**
 * Budget Plan engine — PLANNING ONLY.
 *
 * Turns maintenance items + bundles into prioritized repair JOBS, detects
 * blockers, and schedules them against an available budget + monthly savings.
 * Never touches maintenance data, history, the bundle picker, or cards.
 *
 *  - jobs   : a mustReplace bundle cluster = one job; single items = single jobs.
 *  - urgency: replace_needed > worn > inspection_needed > due_soon > monitor > ok
 *  - score  : urgency + risk (safety / engine-damage high, comfort low)
 *  - blockers: tires need suspension/steering/alignment done first; expensive
 *    diagnosis-driven parts wait for a confirmed diagnosis.
 *  - scheduler: spend (currentBudget - safetyBuffer), add monthlyContribution
 *    each month, highest-priority unblocked job first, push if it doesn't fit.
 */

export const URGENCY_RANK = { replace_needed: 5, worn: 4, inspection_needed: 3, due_soon: 2, monitor: 1, ok: 0 };

// Items whose replacement is expensive and diagnosis-driven — don't plan spend
// until the status is a confirmed replace_needed.
const DIAGNOSIS_GATED = new Set([
  'Piezo Fuel Injectors (×6)', 'High-Pressure Fuel Pump (HPFP)', 'NOx Catalytic Converter', 'NOx Sensor',
]);

// Open suspension/steering/alignment blocks tyres (geometry must be right first).
const TIRE_BLOCKERS = ['Control Arms / Ball Joints', 'Tie Rod Ends (×2)', 'Wheel Alignment', 'Steering Rack'];

// Oil service can be pulled forward when an oil-zone leak job is planned.
const OIL_LEAK_ITEMS = new Set(['Oil Pan Gasket', 'Oil Filter Housing Gasket']);

const SAFETY_CATS = new Set(['Remmen', 'Onderstel', 'Aandrijving', 'Banden', 'Stuur', 'Wielen']);
const ENGINE_CATS = new Set(['Motor', 'Koeling', 'Motorelektronica', 'Brandstof']);
const COMFORT_CATS = new Set(['Airco', 'Exterieur']);

function itemUrgency(item) {
  const cs = item.calculatedStatus || {};
  const r = cs.sourceEvent?.result;
  if (r === 'replace_needed' || r === 'confirmed_failed' || cs.status === 'red') return 'replace_needed';
  if (r === 'worn' || r === 'fault_present') return 'worn';
  if (cs.status === 'inspect') return 'inspection_needed';
  if (cs.status === 'orange') return 'due_soon';
  if (cs.status === 'monitor' || r === 'monitor') return 'monitor';
  return 'ok'; // green / grey (no data → not a spend yet)
}

function riskWeight(item) {
  const c = item.category;
  if (SAFETY_CATS.has(c) || ENGINE_CATS.has(c)) return 3;
  if (COMFORT_CATS.has(c)) return 0;
  return 1;
}

const maxUrgency = (a, b) => (URGENCY_RANK[a] >= URGENCY_RANK[b] ? a : b);

/** Group items into planning jobs (mustReplace cluster = one job). */
function buildJobs(items) {
  const byCluster = new Map(); // clusterId → [items]
  const singles = [];
  for (const it of items) {
    const cid = clusterIdOf(it.name);
    if (cid) {
      if (!byCluster.has(cid)) byCluster.set(cid, []);
      byCluster.get(cid).push(it);
    } else {
      singles.push(it);
    }
  }

  const jobs = [];
  const mkJob = (id, title, members) => {
    const urgency = members.reduce((u, m) => maxUrgency(u, itemUrgency(m)), 'ok');
    const risk = members.reduce((r, m) => Math.max(r, riskWeight(m)), 0);
    const cost = members.reduce((c, m) => c + (m.estimatedTotalCost || 0), 0);
    return {
      id, title, members,
      memberNames: members.map((m) => m.name),
      urgency,
      risk,
      cost,
      score: URGENCY_RANK[urgency] * 100 + risk * 10,
      category: members[0]?.category,
      blocked: false, blockReasons: [], diagnosisGated: false, pullForward: false,
      monthOffset: null, scheduledDate: null, unschedulable: false,
    };
  };

  for (const [cid, members] of byCluster) {
    const title = clusterTitle(cid);
    jobs.push(mkJob(`cluster:${cid}`, title, members));
  }
  for (const it of singles) {
    jobs.push(mkJob(`item:${it.name}`, null, [it]));
  }
  return jobs;
}

/** Detect blockers + diagnosis gating, using the urgency of every item. */
function applyBlockers(jobs, items, overrides) {
  const urgencyByName = new Map(items.map((i) => [i.name, itemUrgency(i)]));
  const isOpen = (name) => URGENCY_RANK[urgencyByName.get(name) ?? 'ok'] >= URGENCY_RANK.due_soon;

  for (const job of jobs) {
    const names = new Set(job.memberNames);

    // diagnosis-gated expensive items: only plan spend when confirmed replace_needed
    if (job.memberNames.some((n) => DIAGNOSIS_GATED.has(n)) && job.urgency !== 'replace_needed') {
      job.diagnosisGated = true;
    }

    // tyres need suspension/steering/alignment sorted first (unless overridden)
    if (names.has('Tires (×4)') && !overrides?.tiresFirst) {
      const open = TIRE_BLOCKERS.filter((n) => !names.has(n) && isOpen(n));
      if (open.length) { job.blocked = true; job.blockReasons.push({ type: 'tires', items: open }); }
    }

    // standalone wheel alignment blocked by open control arms / tie rods
    if (names.has('Wheel Alignment') && job.members.length === 1) {
      const open = ['Control Arms / Ball Joints', 'Tie Rod Ends (×2)'].filter((n) => isOpen(n));
      if (open.length) { job.blocked = true; job.blockReasons.push({ type: 'alignment', items: open }); }
    }

    // oil service can be pulled forward when an oil-zone leak job is planned
    if (names.has('Engine Oil + Filter') && job.members.length === 1) {
      const leakOpen = items.some((i) => OIL_LEAK_ITEMS.has(i.name) && isOpen(i.name));
      if (leakOpen) { job.pullForward = true; job.score += 25; }
    }
  }
}

/** Greedy budget scheduler over months. */
function scheduleJobs(jobs, settings, startDate) {
  const available = (settings.currentBudget || 0) - (settings.safetyBuffer || 0);
  const monthly = settings.monthlyContribution || 0;
  const maxMonthly = settings.maxMonthlySpend || null;

  const queue = jobs
    .filter((j) => !j.blocked && !j.diagnosisGated && j.urgency !== 'monitor' && j.urgency !== 'ok')
    .sort((a, b) => b.score - a.score || a.cost - b.cost);

  let month = 0;
  let balance = available;
  let spentThisMonth = 0;

  for (const job of queue) {
    let guard = 0;
    while ((balance < job.cost || (maxMonthly && spentThisMonth + job.cost > maxMonthly)) && guard < 240) {
      month++; balance += monthly; spentThisMonth = 0; guard++;
      if (monthly <= 0 && balance < job.cost) break; // can never afford with no savings
    }
    if (balance < job.cost) { job.unschedulable = true; continue; }
    balance -= job.cost; spentThisMonth += job.cost;
    job.monthOffset = month;
    job.scheduledDate = format(addMonths(startDate, month), 'yyyy-MM-dd');
  }
}

const SECTIONS = ['nuDoen', 'binnen30', 'binnen3m', 'kanWachten', 'geblokkeerd', 'alleenDiagnose'];

function bucketOf(job) {
  if (job.blocked) return 'geblokkeerd';
  if (job.diagnosisGated || job.urgency === 'monitor') return 'alleenDiagnose';
  if (job.unschedulable) return 'kanWachten';
  if (job.monthOffset === 0 && (job.urgency === 'replace_needed' || job.urgency === 'worn')) return 'nuDoen';
  if (job.monthOffset === 0) return 'binnen30';
  if (job.monthOffset <= 3) return 'binnen3m';
  return 'kanWachten';
}

/**
 * Build the full budget plan.
 * @returns { sections: {key: job[]}, summary, jobs }
 */
export function buildBudgetPlan(itemsWithStatus, settings = {}, today = new Date(), overrides = {}) {
  const active = (itemsWithStatus || []).filter((i) => !i.isDisabled && itemUrgency(i) !== 'ok');
  const startDate = settings.planningStartDate ? new Date(settings.planningStartDate) : today;

  const jobs = buildJobs(active);
  applyBlockers(jobs, itemsWithStatus || [], overrides);
  scheduleJobs(jobs, settings, startDate);

  const sections = Object.fromEntries(SECTIONS.map((s) => [s, []]));
  for (const job of jobs) sections[bucketOf(job)].push(job);
  // keep each section ordered by score (urgency) then schedule
  for (const s of SECTIONS) sections[s].sort((a, b) => b.score - a.score || (a.monthOffset ?? 99) - (b.monthOffset ?? 99));

  const available = (settings.currentBudget || 0) - (settings.safetyBuffer || 0);
  const thisMonthSpend = jobs.filter((j) => j.monthOffset === 0).reduce((c, j) => c + j.cost, 0);

  return {
    jobs,
    sections,
    summary: {
      currentBudget: settings.currentBudget || 0,
      availableNow: available,
      safetyBuffer: settings.safetyBuffer || 0,
      monthly: settings.monthlyContribution || 0,
      maxMonthly: settings.maxMonthlySpend || null,
      thisMonthSpend,
      planningStartDate: format(startDate, 'yyyy-MM-dd'),
    },
  };
}

export { SECTIONS };
