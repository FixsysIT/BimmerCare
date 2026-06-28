import { differenceInCalendarMonths, addMonths } from 'date-fns';
import { clusterIdOf, clusterTitle, relatedNames } from './bundleView';

/**
 * Budget Plan engine — SAVINGS-TIMELINE planner (planning only).
 *
 * Model: you have a pot (currentBudget) that grows every month by
 * monthlyContribution. Every repair job is scheduled into the EARLIEST month
 * where the pot can pay for it while keeping the safety buffer. Highest urgency
 * first, cheapest breaks ties. The result is a forward timeline:
 *   "juni €800 → spatborden · oktober €1500 → banden + uitlijnen".
 *
 * Scope = defects + due intervals. Monitor-only → watch list. Diagnosis-gated /
 * prerequisite-blocked → blocked list (never auto-scheduled). The user can
 * exclude a job or pin it to a target month. Auto-combine = hard bundle
 * clusters + the oil-zone leak couple. Never touches maintenance data/history.
 */

export const URGENCY_RANK = { replace_needed: 5, worn: 4, inspection_needed: 3, due_soon: 2, monitor: 1, ok: 0 };
// confirmed spend that auto-fills sessions: real defects + due intervals.
// inspection_needed is NOT here — it's a check, not a confirmed replacement, so
// it never auto-books the full part cost (the user can still add it by hand).
const SCHEDULABLE = new Set(['replace_needed', 'worn', 'due_soon']);

export const REASON = {
  SAFETY: 'safety', APK: 'apk', INTERVAL: 'interval', COMBINE: 'combine',
  BLOCKED_DIAGNOSIS: 'blocked_diagnosis', BLOCKED_PREREQ: 'blocked_prereq',
  WATCH: 'watch', INSPECT: 'inspect', CUSTOM: 'custom',
};

/** A free user-added budget line (e.g. CarPlay, door panels) — not a catalog item. */
function makeCustomJob(c) {
  const name = c.name || '';
  return {
    id: `custom:${c.id}`, title: { nl: name, en: name }, members: [], memberNames: [name],
    urgency: 'due_soon', cost: Number(c.cost) || 0, reason: REASON.CUSTOM, custom: true,
    check: !!c.check, // check-only task → assess section on the work order, not "replace"
    blocked: false, blockReasons: [], diagnosisGated: false, cardWarnings: [], reasonKey: null,
  };
}

const DIAGNOSIS_GATED = new Set([
  'Piezo Fuel Injectors (×6)', 'High-Pressure Fuel Pump (HPFP)', 'NOx Catalytic Converter', 'NOx Sensor',
]);
const ALIGNMENT_AFFECTING = ['Control Arms / Ball Joints', 'Tie Rod Ends (×2)', 'Steering Rack'];
const ALIGNMENT_BLOCKERS = ['Control Arms / Ball Joints', 'Tie Rod Ends (×2)'];
const OIL_LEAK_ITEMS = new Set(['Oil Pan Gasket', 'Oil Filter Housing Gasket']);

const APK_SAFETY_ITEMS = new Set([
  'Brake Pads Front', 'Brake Pads Rear', 'Brake Discs Front', 'Brake Discs Rear',
  'Brake Hoses', 'Brake Fluid', 'Handbrake Shoes / Parking Brake',
  'Tires (×4)', 'Steering Rack', 'Tie Rod Ends (×2)', 'Control Arms / Ball Joints',
  'Shock Absorbers Front (×2)', 'Shock Absorbers Rear (×2)', 'Wheel Bearings',
  'Stabilizer Links Front (×2)', 'Stabilizer Links Rear (×2)', 'Strut Mounts / Top Mounts',
  'CV Boot / Axle Boot', 'Headlight Modules / Bulbs', 'Wipers',
]);
const APK_ONLY_ITEMS = new Set(['Headlight Modules / Bulbs', 'Wipers', 'Tires (×4)']);
const CONSEQUENTIAL_ITEMS = new Set([
  'Oil Pan Gasket', 'Oil Filter Housing Gasket', 'Valve Cover Gasket + PCV',
  'Crankshaft Rear Main Seal', 'Water Pump (electric)', 'Thermostat',
  'Coolant Hoses', 'Radiator', 'Expansion Tank + Cap',
]);

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
    urgency, cost, category: members[0]?.category,
    blocked: false, blockReasons: [], diagnosisGated: false,
    reasonKey: null, cannotWait: false, cardWarnings: [],
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

/** Couple an oil service with an open oil-zone leak repair (open the zone once). */
function coupleOilLeak(jobs) {
  const oilIdx = jobs.findIndex((j) => j.members.length === 1 && j.memberNames[0] === 'Engine Oil + Filter');
  if (oilIdx < 0) return jobs;
  const oilJob = jobs[oilIdx];
  if (!isOpenUrg(oilJob.urgency)) return jobs;

  const gasketJobs = jobs.filter((j) => j.memberNames.some((n) => OIL_LEAK_ITEMS.has(n)) && isOpenUrg(j.urgency));
  if (!gasketJobs.length) return jobs;

  const oilSevere = (oilJob.members[0].calculatedStatus?.status === 'red');
  if (oilSevere) { oilJob.cannotWait = true; return jobs; }

  const members = [...gasketJobs.flatMap((j) => j.members), ...oilJob.members];
  const combined = makeJob('combined:oil-leak', {
    nl: 'Carterpakking + motorolie + oliefilter', en: 'Oil pan gasket + oil + filter',
  }, members, { reasonKey: 'oilCombine' });
  const drop = new Set([oilJob.id, ...gasketJobs.map((j) => j.id)]);
  return [...jobs.filter((j) => !drop.has(j.id)), combined];
}

function applyBlockers(jobs, items) {
  const urgByName = new Map(items.map((i) => [i.name, itemUrgency(i)]));
  const isOpen = (name) => isOpenUrg(urgByName.get(name) ?? 'ok');

  for (const job of jobs) {
    const names = new Set(job.memberNames);
    if (job.memberNames.some((n) => DIAGNOSIS_GATED.has(n)) && job.urgency !== 'replace_needed') {
      job.diagnosisGated = true;
    }
    if (names.has('Tires (×4)')) {
      const open = ALIGNMENT_AFFECTING.filter((n) => !names.has(n) && isOpen(n));
      if (open.length) job.cardWarnings.push({ type: 'alignmentTemp', items: open });
    }
    if (names.has('Wheel Alignment') && job.members.length === 1) {
      const open = ALIGNMENT_BLOCKERS.filter((n) => isOpen(n));
      if (open.length) { job.blocked = true; job.blockReasons.push({ type: 'alignment', items: open }); }
    }
  }
}

/** Reason chip for a schedulable job (advice only, doesn't affect order). */
function jobReason(job) {
  if (job.reasonKey === 'oilCombine') return REASON.COMBINE;
  const names = job.memberNames;
  if (names.some((n) => APK_SAFETY_ITEMS.has(n))) {
    return names.some((n) => APK_ONLY_ITEMS.has(n)) ? REASON.APK : REASON.SAFETY;
  }
  if (names.some((n) => CONSEQUENTIAL_ITEMS.has(n))) return REASON.SAFETY;
  return REASON.INTERVAL;
}

// safety/APK outrank a same-urgency interval; cheaper breaks the last tie
const SAFE_REASONS = new Set([REASON.SAFETY, REASON.APK]);
function comparePriority(a, b) {
  if (URGENCY_RANK[b.urgency] !== URGENCY_RANK[a.urgency]) return URGENCY_RANK[b.urgency] - URGENCY_RANK[a.urgency];
  const sa = SAFE_REASONS.has(a.reason) ? 1 : 0;
  const sb = SAFE_REASONS.has(b.reason) ? 1 : 0;
  if (sa !== sb) return sb - sa;
  return a.cost - b.cost;
}

const monthDate = (today, m) => addMonths(today, m);
const MAX_MONTHS = 120;

/** Projected pot at a future date = current budget + saved-up inleg − buffer.
   Deposits are counted from the CURRENT month up to (and including) the session
   month, so a visit one calendar month out already includes this month's + next
   month's saving (current budget is "what I have now", before this month's inleg). */
function projectedMoney(date, settings, today) {
  const start = Number(settings.currentBudget) || 0;
  const monthly = Number(settings.monthlyContribution) || 0;
  const buffer = Number(settings.safetyBuffer) || 0;
  const deposits = date ? Math.max(0, differenceInCalendarMonths(new Date(date), today) + 1) : 0;
  return { monthsUntil: deposits, money: Math.max(0, start + monthly * deposits - buffer) };
}

/**
 * Assign jobs to the user's own planning sessions (garage visits). Each session
 * has a date + a money pot (either typed by the user, or projected from the
 * savings curve at that date). Jobs are filled highest-urgency first into the
 * earliest session whose remaining cash covers them; later sessions inherit the
 * cash left after earlier ones. A job that fits no session lands in "unplanned"
 * with a hint of the month it becomes affordable. Pinned jobs are forced into a
 * chosen session (shortfall flagged). No drag — placement is automatic.
 */
function assignToSessions(jobs, settings, today, pinned) {
  const start = Number(settings.currentBudget) || 0;
  const monthly = Number(settings.monthlyContribution) || 0;
  const buffer = Number(settings.safetyBuffer) || 0;

  const sessions = (settings.budgetSessions || [])
    .slice()
    .sort((a, b) => (a.date ? new Date(a.date) : Infinity) - (b.date ? new Date(b.date) : Infinity))
    .map((s) => {
      const overridden = s.money !== '' && s.money != null && !Number.isNaN(Number(s.money));
      const proj = projectedMoney(s.date, settings, today);
      return {
        id: s.id, date: s.date, note: s.note, monthsUntil: proj.monthsUntil,
        money: overridden ? Number(s.money) : proj.money, overridden,
        locked: !!s.locked, manual: !!s.manual, entries: [], spent: 0,
      };
    });
  const byId = new Map(sessions.map((s) => [s.id, s]));

  // Typed money = exactly what the user says he has that visit (standalone).
  // Projected sessions share ONE growing savings pot, so they carry over earlier
  // projected spend among themselves; typed sessions stay out of that chain.
  const priorSpend = (i) =>
    sessions[i].overridden ? 0 : sessions.slice(0, i).filter((s) => !s.overridden).reduce((c, s) => c + s.spent, 0);
  const avail = (i) => sessions[i].money - priorSpend(i) - sessions[i].spent;
  const assign = (s, job, extra = {}) => { s.entries.push({ job, reason: job.reason, ...extra }); s.spent += job.cost; };

  // 1) pinned jobs → their chosen session (priority order, shortfall flagged)
  const pinnedJobs = jobs.filter((j) => byId.has(pinned[j.id])).sort(comparePriority);
  for (const job of pinnedJobs) {
    const s = byId.get(pinned[job.id]);
    const before = avail(sessions.indexOf(s));
    assign(s, job, { pinned: true, shortfall: before < job.cost ? Math.round(job.cost - before) : 0 });
  }
  // 2) auto jobs → earliest session that can pay. Locked (finalised) and manual
  // ("zelf kiezen") sessions are never auto-filled — they only hold what the user
  // explicitly pinned/added, so a focused "only tyres" or themed visit stays clean.
  const unplannedJobs = [];
  const autoJobs = jobs.filter((j) => !byId.has(pinned[j.id])).sort(comparePriority);
  for (const job of autoJobs) {
    let placed = false;
    for (let i = 0; i < sessions.length; i++) {
      if (sessions[i].locked || sessions[i].manual) continue;
      if (avail(i) >= job.cost) { assign(sessions[i], job); placed = true; break; }
    }
    if (!placed) unplannedJobs.push(job);
  }

  sessions.forEach((s, i) => {
    s.left = Math.round(avail(i));
    s.cost = s.spent;
    // pot SHOWN to the user = realistic money going into THIS visit: the savings
    // curve minus what earlier (projected) visits already committed. Typed sessions
    // are islands (priorSpend skips them), so their pot is exactly what was typed.
    s.pot = Math.round(s.overridden ? s.money : Math.max(0, s.money - priorSpend(i)));
    s.entries.sort((a, b) => comparePriority(a.job, b.job));
  });

  // unplanned: when would the savings curve cover it (ignoring sessions, after all committed spend)?
  const committed = sessions.reduce((c, s) => c + s.spent, 0);
  const unplanned = unplannedJobs.sort(comparePriority).map((job) => {
    let m = 0;
    while (m < MAX_MONTHS && (start + monthly * m - buffer) < job.cost + committed) m++;
    const ok = m < MAX_MONTHS;
    return {
      job, reason: job.reason,
      earliestMonth: ok ? m : null,
      earliestDate: ok ? monthDate(today, m) : null,
    };
  });

  return { sessions, unplanned, totalCost: jobs.reduce((c, j) => c + j.cost, 0) };
}

/**
 * @returns { sessions[], unplanned[], blocked[], watch[], excluded[], summary }
 */
export function buildBudgetPlan(itemsWithStatus, settings = {}, today = new Date()) {
  const prefs = settings.budgetPrefs || {};
  const excludedIds = prefs.excluded || {};
  const forcedIds = prefs.forced || {}; // user said "plan it anyway" past a block/gate
  const pinnedSession = prefs.pinnedSession || {};
  const costOverride = prefs.costOverride || {}; // jobId -> user price (incl. labour)
  const sessionIds = new Set((settings.budgetSessions || []).map((s) => s.id));
  // a locked session keeps its OWN snapshot of job ids (lockedJobs) separate from
  // the user's pins, so unlocking never wipes a job the user pinned by hand (e.g.
  // a manually-added NOx). Merge the snapshot into the effective pin map.
  const lockedJobTo = new Map();
  for (const s of settings.budgetSessions || []) {
    if (s.locked) (s.lockedJobs || []).forEach((id) => lockedJobTo.set(id, s.id));
  }
  const mergedPinned = { ...pinnedSession };
  for (const [id, sid] of lockedJobTo) if (mergedPinned[id] == null) mergedPinned[id] = sid;
  const isPinned = (id) => sessionIds.has(mergedPinned[id]); // pinned to a real session

  const open = (itemsWithStatus || []).filter((i) => !i.isDisabled && itemUrgency(i) !== 'ok');
  let jobs = buildJobs(open);
  jobs = coupleOilLeak(jobs);
  applyBlockers(jobs, itemsWithStatus || []);
  // user-added free lines (CarPlay, door panels, …) plan like any chosen job
  jobs = [...jobs, ...(settings.budgetCustom || []).map(makeCustomJob)];
  for (const j of jobs) {
    j.reason = j.custom ? REASON.CUSTOM : jobReason(j);
    if (costOverride[j.id] != null && costOverride[j.id] !== '') { j.cost = Number(costOverride[j.id]); j.costEdited = true; }
  }

  const blocked = [];
  const watch = [];
  const inspect = [];
  const excluded = [];
  const schedulable = [];
  const catalog = [];      // "+ Klus toevoegen" picker — booked work (pay)
  const checkCatalog = []; // "+ Alvast checken" picker — inspection + monitor (free €0 check)
  for (const j of jobs) {
    if (excludedIds[j.id]) { excluded.push(j); continue; }
    // manually adding a job to a session (pin) or "plan anyway" forces it in
    const forced = !!forcedIds[j.id] || isPinned(j.id);
    const lite = { id: j.id, title: j.title, memberNames: j.memberNames, cost: j.cost, urgency: j.urgency };
    // booked picker = defects / due intervals / gated-blocked (force in) / custom.
    // inspection + monitor go to the separate "alvast checken" picker (€0 check).
    if (j.urgency === 'monitor' || j.urgency === 'inspection_needed') checkCatalog.push(lite);
    else catalog.push(lite);
    if ((j.diagnosisGated || j.blocked) && !forced) {
      j.reason = j.diagnosisGated ? REASON.BLOCKED_DIAGNOSIS : REASON.BLOCKED_PREREQ;
      blocked.push(j);
      continue;
    }
    if (forced) {
      j.forced = true; // bypass the gate/block, plan it anyway
      if (j.urgency === 'inspection_needed' || j.urgency === 'monitor') j.urgency = 'replace_needed';
    }
    if (forced || SCHEDULABLE.has(j.urgency)) { schedulable.push(j); continue; }
    if (j.urgency === 'inspection_needed') { j.reason = REASON.INSPECT; inspect.push(j); continue; }
    j.reason = REASON.WATCH; watch.push(j); // monitor-only
  }

  const { sessions, unplanned, totalCost } = assignToSessions(schedulable, settings, today, mergedPinned);

  // Don't lose inspections: if one logically belongs with work already booked in
  // a session (shares a bundle), let it RIDE ALONG that visit — car's already
  // open, so it's a free check (€0 booked), not a separate trip. Orphans with no
  // related session stay in the advisory inspect[] list.
  // riders the user locked into a finalised session stay there regardless of logic
  const lockedRiderTo = new Map();
  for (const s of settings.budgetSessions || []) {
    if (s.locked) (s.lockedRiders || []).forEach((id) => lockedRiderTo.set(id, s.id));
  }
  const checkSession = prefs.checkSession || {}; // jobId -> sessionId ("alvast checken")
  const sessById = new Map(sessions.map((s) => [s.id, s]));
  const addCheck = (job, sid) => { sessById.get(sid).entries.push({ job, reason: REASON.INSPECT, rider: true, check: true }); job.rider = true; };
  const placedNames = sessions.map((s) => ({ s, names: new Set(s.entries.flatMap((e) => e.job.memberNames)) }));

  const orphanInspect = [];
  for (const job of inspect) {
    const lockedSid = lockedRiderTo.get(job.id);
    if (lockedSid && sessById.has(lockedSid)) {
      sessById.get(lockedSid).entries.push({ job, reason: REASON.INSPECT, rider: true });
      job.rider = true;
      continue;
    }
    if (checkSession[job.id] && sessById.has(checkSession[job.id])) { addCheck(job, checkSession[job.id]); continue; }
    const rel = new Set(job.memberNames.flatMap((n) => [...relatedNames(n)]));
    const hit = placedNames.find(({ names }) => [...rel].some((n) => names.has(n)));
    if (hit) {
      const withEntry = hit.s.entries.find((e) => e.job.memberNames.some((n) => rel.has(n)));
      hit.s.entries.push({ job, reason: REASON.INSPECT, rider: true, withName: withEntry?.job.memberNames[0] });
      job.rider = true;
    } else {
      orphanInspect.push(job);
    }
  }
  // monitor items the user chose to "alvast checken" → free €0 rider on that session
  const remainingWatch = [];
  for (const job of watch) {
    if (checkSession[job.id] && sessById.has(checkSession[job.id])) addCheck(job, checkSession[job.id]);
    else remainingWatch.push(job);
  }

  const start = Number(settings.currentBudget) || 0;
  const buffer = Number(settings.safetyBuffer) || 0;
  return {
    sessions, unplanned, blocked, watch: remainingWatch, inspect: orphanInspect, excluded, catalog, checkCatalog,
    summary: {
      currentBudget: start,
      availableNow: start - buffer,
      safetyBuffer: buffer,
      monthly: Number(settings.monthlyContribution) || 0,
      noBuffer: buffer <= 0,
      totalCost,
      scheduledCount: schedulable.length,
      unplannedCount: unplanned.length,
    },
  };
}
