import { differenceInMonths } from 'date-fns';
import { clusterIdOf, clusterTitle } from './bundleView';

/**
 * Budget Plan engine — appointment-based PLANNING ONLY.
 *
 * Plans repair jobs around real garage appointments like a real garage would:
 * safety / APK / diagnosis first, then smart combinations, then deferrable
 * comfort/interval work, then jobs blocked on a missing diagnosis or a
 * prerequisite. Budget is filled with a margin (never blindly to the max) and
 * every placement can be manually moved between buckets per appointment.
 * Never touches maintenance data, history, the bundle picker, or cards.
 */

export const URGENCY_RANK = { replace_needed: 5, worn: 4, inspection_needed: 3, due_soon: 2, monitor: 1, ok: 0 };
const HIGH_URGENCY = new Set(['replace_needed', 'worn', 'inspection_needed']);

export const BUCKETS = ['doen', 'combineren', 'doorschuiven', 'geblokkeerd'];

// reason types drive the chip + "why" line on a card
export const REASON = {
  SAFETY: 'safety', APK: 'apk', DIAGNOSIS: 'diagnosis', INTERVAL: 'interval',
  COMBINE: 'combine', BUDGET: 'budget', MANUAL: 'manual',
  BLOCKED_DIAGNOSIS: 'blocked_diagnosis', BLOCKED_PREREQ: 'blocked_prereq',
};

const DIAGNOSIS_GATED = new Set([
  'Piezo Fuel Injectors (×6)', 'High-Pressure Fuel Pump (HPFP)', 'NOx Catalytic Converter', 'NOx Sensor',
]);
const DIAGNOSIS_ITEMS = new Set(['General Diagnostic Scan']);
// Open suspension/steering parts that make a fresh alignment temporary — they
// WARN on the tyre card but never BLOCK safety-critical tyres.
const ALIGNMENT_AFFECTING = ['Control Arms / Ball Joints', 'Tie Rod Ends (×2)', 'Steering Rack'];
const ALIGNMENT_BLOCKERS = ['Control Arms / Ball Joints', 'Tie Rod Ends (×2)'];
const OIL_LEAK_ITEMS = new Set(['Oil Pan Gasket', 'Oil Filter Housing Gasket']);

// Items an APK actually fails / direct road-safety. High urgency here = DOEN.
const APK_SAFETY_ITEMS = new Set([
  'Brake Pads Front', 'Brake Pads Rear', 'Brake Discs Front', 'Brake Discs Rear',
  'Brake Hoses', 'Brake Fluid', 'Handbrake Shoes / Parking Brake',
  'Tires (×4)', 'Steering Rack', 'Tie Rod Ends (×2)', 'Control Arms / Ball Joints',
  'Shock Absorbers Front (×2)', 'Shock Absorbers Rear (×2)', 'Wheel Bearings',
  'Stabilizer Links Front (×2)', 'Stabilizer Links Rear (×2)', 'Strut Mounts / Top Mounts',
  'CV Boot / Axle Boot', 'Headlight Modules / Bulbs', 'Wipers',
]);
// Pure APK / visibility items (sub-label "apk" vs generic safety).
const APK_ONLY_ITEMS = new Set(['Headlight Modules / Bulbs', 'Wipers', 'Tires (×4)']);
// Leaks / cooling that cause consequential engine damage. High urgency = DOEN.
const CONSEQUENTIAL_ITEMS = new Set([
  'Oil Pan Gasket', 'Oil Filter Housing Gasket', 'Valve Cover Gasket + PCV',
  'Crankshaft Rear Main Seal', 'Water Pump (electric)', 'Thermostat',
  'Coolant Hoses', 'Radiator', 'Expansion Tank + Cap',
]);

const PORTION_FILLED = 0.9; // keep a 10% margin unless the user allows a full fill

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
const maxUrgency = (a, b) => (URGENCY_RANK[a] >= URGENCY_RANK[b] ? a : b);
const isOpenUrg = (u) => URGENCY_RANK[u] >= URGENCY_RANK.due_soon;

function makeJob(id, title, members, extra = {}) {
  const urgency = members.reduce((u, m) => maxUrgency(u, itemUrgency(m)), 'ok');
  const cost = members.reduce((c, m) => c + (m.estimatedTotalCost || 0), 0);
  return {
    id, title, members,
    memberNames: members.map((m) => m.name),
    urgency, cost,
    category: members[0]?.category,
    blocked: false, blockReasons: [], diagnosisGated: false,
    overridden: false, reasonKey: null, cannotWait: false, cardWarnings: [],
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
 * only opened once. Fires on any open leak status (worn / replace_needed /
 * inspection). If oil itself is severely overdue (red) keep it separate and
 * flag "cannot wait — oil may be needed again at the later gasket repair".
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
    // Tyres are safety/APK critical — NEVER block them on alignment prereqs.
    // Just warn on the card that the alignment may be temporary. Alignment's own
    // dependency on suspension/steering is kept (it lives in the
    // "Vooronderstel + uitlijnen" cluster, so it's done WITH those parts).
    if (names.has('Tires (×4)')) {
      const open = ALIGNMENT_AFFECTING.filter((n) => !names.has(n) && isOpen(n));
      if (open.length) job.cardWarnings.push({ type: 'alignmentTemp', items: open });
    }
    if (names.has('Wheel Alignment') && job.members.length === 1) {
      const open = ALIGNMENT_BLOCKERS.filter((n) => isOpen(n));
      if (open.length) { job.blocked = true; job.blockReasons.push({ type: 'alignment', items: open }); }
    }
    if (job.blocked && jobOverrides?.[job.id]) job.overridden = true;
  }
}

// natural bucket → budget weight (urgency dominates, bucket breaks ties)
const BUCKET_WEIGHT = { doen: 50, combineren: 40, doorschuiven: 0, geblokkeerd: -100 };

/**
 * Classify a job into its NATURAL bucket + a reason type. The budget priority
 * is urgency-first (a red oil-leak combine outranks a merely worn safety item),
 * bucket weight only breaks ties — so a tight budget pushes the least urgent
 * work out first while keeping safety/APK/diagnosis as long as possible.
 *   doen        = safety / APK / diagnosis / consequential damage
 *   combineren  = oil-zone merge (smart combine)
 *   doorschuiven= interval / comfort / deferrable (never consumes budget)
 *   geblokkeerd = missing diagnosis or open prerequisite
 */
function classify(job) {
  if (job.blocked && !job.overridden) return { bucket: 'geblokkeerd', reason: REASON.BLOCKED_PREREQ };
  if (job.diagnosisGated) return { bucket: 'geblokkeerd', reason: REASON.BLOCKED_DIAGNOSIS };
  if (job.reasonKey === 'oilCombine') return { bucket: 'combineren', reason: REASON.COMBINE };

  const names = job.memberNames;
  if (names.some((n) => DIAGNOSIS_ITEMS.has(n)) && isOpenUrg(job.urgency)) {
    return { bucket: 'doen', reason: REASON.DIAGNOSIS };
  }
  if (HIGH_URGENCY.has(job.urgency)) {
    if (names.some((n) => APK_SAFETY_ITEMS.has(n))) {
      const apk = names.some((n) => APK_ONLY_ITEMS.has(n));
      return { bucket: 'doen', reason: apk ? REASON.APK : REASON.SAFETY };
    }
    if (names.some((n) => CONSEQUENTIAL_ITEMS.has(n))) return { bucket: 'doen', reason: REASON.SAFETY };
  }
  return { bucket: 'doorschuiven', reason: REASON.INTERVAL };
}

function jobScore(job, cls) {
  return URGENCY_RANK[job.urgency] * 100 + (BUCKET_WEIGHT[cls.bucket] ?? 0);
}

/** Budget available on an appointment date (or its explicit override). */
function appointmentBudget(appt, settings, today) {
  if (appt.budgetOverride !== undefined && appt.budgetOverride !== null && appt.budgetOverride !== '') {
    return Number(appt.budgetOverride);
  }
  const monthsUntil = appt.date ? Math.max(0, differenceInMonths(new Date(appt.date), today)) : 0;
  return (settings.currentBudget || 0) + (settings.monthlyContribution || 0) * monthsUntil - (settings.safetyBuffer || 0);
}

/** A per-appointment placement view object (never mutates the shared job). */
function placement(job, cls, bucket, extra = {}) {
  return {
    id: job.id, title: job.title, members: job.members, memberNames: job.memberNames,
    urgency: job.urgency, cost: job.cost, category: job.category,
    blocked: job.blocked, blockReasons: job.blockReasons, diagnosisGated: job.diagnosisGated,
    cannotWait: job.cannotWait, cardWarnings: job.cardWarnings, reasonKey: job.reasonKey,
    reason: cls.reason,
    bucket, manual: false, warnings: [], forcedByBudget: false,
    ...extra,
  };
}

function riskWarnings(job, cls, targetBucket) {
  const w = [];
  if (targetBucket === 'doen' || targetBucket === 'combineren') {
    if (job.diagnosisGated) w.push('noDiagnosis');
  }
  if (targetBucket === 'doorschuiven' || targetBucket === 'geblokkeerd') {
    if (cls.bucket === 'doen' && (cls.reason === REASON.SAFETY || cls.reason === REASON.APK)) w.push('safetyRisk');
  }
  return w;
}

/** Plan one appointment: doen / combineren / doorschuiven / geblokkeerd. */
function planAppointment(appt, jobs, settings, today) {
  const monthsUntil = appt.date ? Math.max(0, differenceInMonths(new Date(appt.date), today)) : 0;
  const budget = appointmentBudget(appt, settings, today);
  const overrides = appt.overrides || {};
  const allowFull = !!appt.allowFull;
  const fillCap = allowFull ? budget : Math.max(0, budget * PORTION_FILLED);

  // classify all schedulable jobs (skip monitor/ok unless gated/blocked)
  const classified = jobs
    .filter((j) => j.diagnosisGated || (j.blocked && !j.overridden) || (j.urgency !== 'monitor' && j.urgency !== 'ok'))
    .map((j) => ({ job: j, cls: classify(j) }))
    .sort((a, b) => jobScore(b.job, b.cls) - jobScore(a.job, a.cls) || a.job.cost - b.job.cost);

  const buckets = { doen: [], combineren: [], doorschuiven: [], geblokkeerd: [] };
  let spent = 0;

  for (const { job, cls } of classified) {
    // manual override wins — drop straight into the chosen bucket
    const forced = overrides[job.id];
    if (forced && BUCKETS.includes(forced)) {
      const p = placement(job, cls, forced, { manual: true });
      p.warnings = riskWarnings(job, cls, forced);
      if (forced === 'doen' || forced === 'combineren') spent += job.cost;
      buckets[forced].push(p);
      continue;
    }

    // non-spending buckets — straight in
    if (cls.bucket === 'geblokkeerd' || cls.bucket === 'doorschuiven') {
      buckets[cls.bucket].push(placement(job, cls, cls.bucket));
      continue;
    }

    // doen / combineren consume budget; if it doesn't fit the cap → push (budget)
    if (spent + job.cost <= fillCap) {
      buckets[cls.bucket].push(placement(job, cls, cls.bucket));
      spent += job.cost;
    } else {
      buckets.doorschuiven.push(placement(job, cls, 'doorschuiven', { forcedByBudget: true, reason: REASON.BUDGET }));
    }
  }

  const noBuffer = (settings.safetyBuffer || 0) <= 0 && !(appt.budgetOverride);
  const tight = budget > 0 && spent > budget * 0.95;

  return {
    ...appt, monthsUntil, budget, spent, fillCap, allowFull,
    ...buckets, noBuffer, tight,
    hiddenCount: buckets.doorschuiven.length + buckets.geblokkeerd.length,
  };
}

/**
 * @returns { jobs, appointments[], diagnoseOnly[], summary }
 */
export function buildBudgetPlan(itemsWithStatus, settings = {}, today = new Date(), jobOverrides = {}) {
  const active = (itemsWithStatus || []).filter((i) => !i.isDisabled && itemUrgency(i) !== 'ok');

  let jobs = buildJobs(active);
  jobs = coupleOilLeak(jobs);
  applyBlockers(jobs, itemsWithStatus || [], jobOverrides);

  const appts = (settings.appointments || [])
    .slice()
    .sort((a, b) => (a.date ? new Date(a.date) : Infinity) - (b.date ? new Date(b.date) : Infinity))
    .map((a) => planAppointment(a, jobs, settings, today));

  // global "watch, don't spend yet" list: monitor-only jobs. Diagnosis-gated
  // items already surface per-appointment in GEBLOKKEERD (spec §7).
  const diagnoseOnly = jobs
    .filter((j) => j.urgency === 'monitor' && !j.diagnosisGated && !(j.blocked && !j.overridden))
    .map((j) => placement(j, classify(j), 'geblokkeerd'));

  return {
    jobs,
    appointments: appts,
    diagnoseOnly,
    summary: {
      currentBudget: settings.currentBudget || 0,
      availableNow: (settings.currentBudget || 0) - (settings.safetyBuffer || 0),
      safetyBuffer: settings.safetyBuffer || 0,
      monthly: settings.monthlyContribution || 0,
      noBuffer: (settings.safetyBuffer || 0) <= 0,
    },
  };
}
