import { differenceInMonths } from 'date-fns';
import { clusterIdOf, clusterTitle } from './bundleView';

/**
 * Budget Plan engine — appointment-based PLANNING ONLY.
 *
 * Plans repair jobs around real garage appointments. For each appointment it
 * works out the budget available on that date, then advises what to DO now,
 * what is SMART to COMBINE, what to PUSH, and what is BLOCKED until a
 * prerequisite is fixed. Never touches maintenance data, history, the bundle
 * picker, or cards.
 */

export const URGENCY_RANK = { replace_needed: 5, worn: 4, inspection_needed: 3, due_soon: 2, monitor: 1, ok: 0 };
const HIGH_URGENCY = new Set(['replace_needed', 'worn', 'inspection_needed']);

const DIAGNOSIS_GATED = new Set([
  'Piezo Fuel Injectors (×6)', 'High-Pressure Fuel Pump (HPFP)', 'NOx Catalytic Converter', 'NOx Sensor',
]);
const TIRE_BLOCKERS = ['Control Arms / Ball Joints', 'Tie Rod Ends (×2)', 'Wheel Alignment', 'Steering Rack'];
const ALIGNMENT_BLOCKERS = ['Control Arms / Ball Joints', 'Tie Rod Ends (×2)'];
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
  return 'ok';
}
function riskWeight(item) {
  const c = item.category;
  if (SAFETY_CATS.has(c) || ENGINE_CATS.has(c)) return 3;
  if (COMFORT_CATS.has(c)) return 0;
  return 1;
}
const maxUrgency = (a, b) => (URGENCY_RANK[a] >= URGENCY_RANK[b] ? a : b);
const isOpenUrg = (u) => URGENCY_RANK[u] >= URGENCY_RANK.due_soon;

function makeJob(id, title, members, extra = {}) {
  const urgency = members.reduce((u, m) => maxUrgency(u, itemUrgency(m)), 'ok');
  const risk = members.reduce((r, m) => Math.max(r, riskWeight(m)), 0);
  const cost = members.reduce((c, m) => c + (m.estimatedTotalCost || 0), 0);
  return {
    id, title, members,
    memberNames: members.map((m) => m.name),
    urgency, risk, cost,
    score: URGENCY_RANK[urgency] * 100 + risk * 10,
    category: members[0]?.category,
    blocked: false, blockReasons: [], diagnosisGated: false,
    overridden: false, reasonKey: null, cannotWait: false,
    ...extra,
  };
}

function buildJobs(items) {
  const byCluster = new Map();
  const singles = [];
  for (const it of items) {
    const cid = clusterIdOf(it.name);
    if (cid) { if (!byCluster.has(cid)) byCluster.set(cid, []); byCluster.get(cid).push(it); }
    else singles.push(it);
  }
  const jobs = [];
  for (const [cid, members] of byCluster) jobs.push(makeJob(`cluster:${cid}`, clusterTitle(cid), members));
  for (const it of singles) jobs.push(makeJob(`item:${it.name}`, null, [it]));
  return jobs;
}

/**
 * Couple an oil service with an open oil-zone leak repair so the oil zone is
 * only opened once. If oil is severely overdue (red), keep it separate and flag
 * "cannot wait for the leak repair".
 */
function coupleOilLeak(jobs) {
  const oilIdx = jobs.findIndex((j) => j.members.length === 1 && j.memberNames[0] === 'Engine Oil + Filter');
  if (oilIdx < 0) return jobs;
  const oilJob = jobs[oilIdx];
  if (!isOpenUrg(oilJob.urgency)) return jobs; // oil not due → nothing to couple

  const gasketJobs = jobs.filter((j) => j.memberNames.some((n) => OIL_LEAK_ITEMS.has(n)) && isOpenUrg(j.urgency));
  if (!gasketJobs.length) return jobs;

  const oilSevere = (oilJob.members[0].calculatedStatus?.status === 'red'); // km exceeded
  if (oilSevere) { oilJob.cannotWait = true; return jobs; }

  // build one combined job; drop the separate oil + gasket jobs
  const members = [...gasketJobs.flatMap((j) => j.members), ...oilJob.members];
  const combined = makeJob('combined:oil-leak', {
    nl: 'Carterpakking + motorolie + oliefilter',
    en: 'Oil pan gasket + oil + filter',
  }, members, { reasonKey: 'oilCombine' });
  const drop = new Set([oilJob.id, ...gasketJobs.map((j) => j.id)]);
  return [...jobs.filter((j) => !drop.has(j.id)), combined];
}

function applyBlockers(jobs, items, jobOverrides) {
  const urgByName = new Map(items.map((i) => [i.name, itemUrgency(i)]));
  const isOpen = (name) => isOpenUrg(urgByName.get(name) ?? 'ok');

  for (const job of jobs) {
    const names = new Set(job.memberNames);

    if (job.memberNames.some((n) => DIAGNOSIS_GATED.has(n)) && job.urgency !== 'replace_needed') {
      job.diagnosisGated = true;
    }
    if (names.has('Tires (×4)')) {
      const open = TIRE_BLOCKERS.filter((n) => !names.has(n) && isOpen(n));
      if (open.length) { job.blocked = true; job.blockReasons.push({ type: 'tires', items: open }); }
    }
    if (names.has('Wheel Alignment') && job.members.length === 1) {
      const open = ALIGNMENT_BLOCKERS.filter((n) => isOpen(n));
      if (open.length) { job.blocked = true; job.blockReasons.push({ type: 'alignment', items: open }); }
    }
    if (job.blocked && jobOverrides?.[job.id]) job.overridden = true;
  }
}

/** Budget available on an appointment date (or its explicit override). */
function appointmentBudget(appt, settings, today) {
  if (appt.budgetOverride !== undefined && appt.budgetOverride !== null && appt.budgetOverride !== '') {
    return Number(appt.budgetOverride);
  }
  const monthsUntil = appt.date ? Math.max(0, differenceInMonths(new Date(appt.date), today)) : 0;
  return (settings.currentBudget || 0) + (settings.monthlyContribution || 0) * monthsUntil - (settings.safetyBuffer || 0);
}

/** Plan one appointment: doen / combineren / doorschuiven / geblokkeerd. */
function planAppointment(appt, jobs, settings, today) {
  const monthsUntil = appt.date ? Math.max(0, differenceInMonths(new Date(appt.date), today)) : 0;
  const budget = appointmentBudget(appt, settings, today);

  const schedulable = jobs
    .filter((j) => !j.diagnosisGated && j.urgency !== 'monitor' && j.urgency !== 'ok' && (!j.blocked || j.overridden))
    .sort((a, b) => b.score - a.score || a.cost - b.cost);

  const doen = []; const combineren = []; const doorschuiven = [];
  let spent = 0;
  const placed = new Set();

  // pass 1 — high urgency that fits
  for (const j of schedulable) {
    if (!HIGH_URGENCY.has(j.urgency)) continue;
    if (spent + j.cost <= budget) { doen.push(j); spent += j.cost; placed.add(j.id); }
    else { doorschuiven.push(j); placed.add(j.id); }
  }
  // pass 2 — lower urgency that still fits → smart to combine
  for (const j of schedulable) {
    if (placed.has(j.id)) continue;
    if (spent + j.cost <= budget) { combineren.push(j); spent += j.cost; }
    else doorschuiven.push(j);
  }

  const geblokkeerd = jobs.filter((j) => j.blocked && !j.overridden);

  return { ...appt, monthsUntil, budget, spent, doen, combineren, doorschuiven, geblokkeerd };
}

/**
 * @returns { jobs, appointments[], diagnoseOnly[], summary }
 */
export function buildBudgetPlan(itemsWithStatus, settings = {}, today = new Date(), jobOverrides = {}) {
  const active = (itemsWithStatus || []).filter((i) => !i.isDisabled && itemUrgency(i) !== 'ok');

  let jobs = buildJobs(active);
  jobs = coupleOilLeak(jobs);
  applyBlockers(jobs, itemsWithStatus || [], jobOverrides);

  // plan ALL appointments (even a freshly added one without a date yet, so its
  // date field stays editable); dateless ones sort last and budget from "now".
  const appts = (settings.appointments || [])
    .slice()
    .sort((a, b) => (a.date ? new Date(a.date) : Infinity) - (b.date ? new Date(b.date) : Infinity))
    .map((a) => planAppointment(a, jobs, settings, today));

  const diagnoseOnly = jobs.filter((j) => j.diagnosisGated || j.urgency === 'monitor');

  return {
    jobs,
    appointments: appts,
    diagnoseOnly,
    summary: {
      currentBudget: settings.currentBudget || 0,
      availableNow: (settings.currentBudget || 0) - (settings.safetyBuffer || 0),
      safetyBuffer: settings.safetyBuffer || 0,
      monthly: settings.monthlyContribution || 0,
    },
  };
}
