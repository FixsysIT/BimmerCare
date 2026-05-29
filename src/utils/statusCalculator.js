import { differenceInDays, differenceInMonths, addMonths, addDays, format } from 'date-fns';
import { STATUS, STATUS_REASONS, STATUS_ORDER, INTERVAL_TYPES } from './constants';

function isOnFailure(item) {
  return item.replacementStrategy === 'on-failure' || item.intervalType === INTERVAL_TYPES.DIAGNOSIS;
}
function isCondition(item) {
  return item.replacementStrategy === 'condition' || item.intervalType === INTERVAL_TYPES.CONDITION;
}

/* Build a result with nulled numeric fields. `source` tells where the status
   came from: history | manualOverride | legacyManualStatus | interval | default. */
function mk(status, statusReason, message, source = 'default') {
  return { status, statusReason, remainingKm: null, remainingDays: null, dueByKm: null, dueByDate: null, message, source, sourceEvent: null };
}

// inspection/diagnosis result → status colour (history is the source)
const RESULT_STATUS = {
  ok: 'green', no_fault: 'green', replaced: 'green', resolved: 'green',
  monitor: 'monitor', worn: 'orange', fault_present: 'orange',
  replace_needed: 'red', confirmed_failed: 'red',
};

/* Latest history entry of a given type (inspection|diagnosis|service|baseline). */
function lastOfType(item, type) {
  const evs = (item.history || []).filter((h) => h.type === type);
  if (!evs.length) return null;
  return [...evs].sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date))[0];
}

/* Status derived from a logged inspection/diagnosis event. */
function fromEvent(e, fallbackReason) {
  const status = RESULT_STATUS[e.result] ?? STATUS.MONITOR;
  const reason = e.result === 'monitor' ? STATUS_REASONS.MONITOR
    : status === STATUS.GREEN ? null
    : fallbackReason;
  const r = mk(status, reason, `${e.result}${e.date ? ' · ' + e.date : ''}`, 'history');
  r.sourceEvent = { type: e.type, result: e.result, date: e.date ?? null, mileage: e.mileage ?? null };
  return r;
}

/* manualStatus result.
   - `legacy` true  → pre-P2.1 / fallback data carrying manualStatus without a
     matching history event. Respected so nothing changes visually, but it
     LOSES to a real history event. source = 'legacyManualStatus'.
   - `legacy` false → genuine explicit override (item.manualOverride flag set by
     setManualStatus). WINS over history. source = 'manualOverride'. */
function manualResult(item, legacy) {
  return mk(
    item.manualStatus,
    STATUS_REASONS.MANUAL,
    item.manualStatusNote || 'Manual override',
    legacy ? 'legacyManualStatus' : 'manualOverride',
  );
}

/* A genuine, explicit manual override that should beat history. */
function hasExplicitOverride(item) {
  return !!item.manualStatus && item.manualOverride === true;
}

/**
 * Calculate maintenance status for a single item.
 *
 * Source of truth:
 *   - condition  → latest history entry of type 'inspection'
 *   - on-failure → latest history entry of type 'diagnosis'
 *   - interval   → latest service/baseline history entry (km/time math)
 * Precedence (every strategy):
 *   1. explicit manual override (item.manualOverride === true) — wins over all.
 *   2. matching history event — the real source of truth.
 *   3. legacy manualStatus (set, but no override flag) — respected as fallback.
 *   4. interval math / strategy default.
 */
export function calculateStatus(item, currentMileage, vehicle = null, currentDate = new Date()) {
  // 1. genuine explicit override beats history for any strategy
  if (hasExplicitOverride(item)) return manualResult(item, false);

  // DIAGNOSIS / on-failure — latest 'diagnosis' event is the source
  if (isOnFailure(item)) {
    const e = lastOfType(item, 'diagnosis');
    if (e) return fromEvent(e, STATUS_REASONS.DIAGNOSIS);
    if (item.manualStatus) return manualResult(item, true);
    return mk(STATUS.MONITOR, STATUS_REASONS.MONITOR, 'Monitor — replace on failure', 'default');
  }

  // CONDITION — latest 'inspection' event is the source
  if (isCondition(item)) {
    const e = lastOfType(item, 'inspection');
    if (e) return fromEvent(e, STATUS_REASONS.INSPECTION_NEEDED);
    if (item.manualStatus) return manualResult(item, true);
    // No inspection logged — fall back to the km indicator if we have any
    // service/baseline entry, otherwise it simply needs a look.
    const last = getLastHistoryEntry(item);
    if (last && item.intervalKm) {
      return { ...calculateCondition(item, last, currentMileage, currentDate), source: 'interval' };
    }
    return mk(STATUS.INSPECT, STATUS_REASONS.INSPECTION_NEEDED, 'Inspection needed — condition unknown', 'default');
  }

  // INTERVAL / km-dominant / time-dominant — service history math.
  // No synthetic purchase-km baseline (that caused bogus "overdue" reds).
  const lastEntry = getLastHistoryEntry(item);
  if (!lastEntry) {
    if (item.manualStatus) return manualResult(item, true);
    if (item.baselineState === 'never') return mk(STATUS.RED, STATUS_REASONS.NEVER_REPLACED, 'Never replaced — replacement needed', 'default');
    return mk(STATUS.GREY, STATUS_REASONS.NO_DATA, 'No data — set a baseline', 'default');
  }
  return { ...calculateWithEntry(item, lastEntry, currentMileage, currentDate, false), source: 'interval' };
}

/**
 * Core calculation using a history entry (real or synthetic from purchase date).
 */
function calculateWithEntry(item, entry, currentMileage, currentDate, isSynthetic) {
  switch (item.intervalType) {
    case INTERVAL_TYPES.KM_DOMINANT:
      return calculateKmDominant(item, entry, currentMileage, currentDate);
    case INTERVAL_TYPES.TIME_DOMINANT:
      return calculateTimeDominant(item, entry, currentMileage, currentDate);
    case INTERVAL_TYPES.CONDITION:
      return calculateCondition(item, entry, currentMileage, currentDate);
    case INTERVAL_TYPES.DIAGNOSIS:
      return calculateDiagnosis(item);
    default:
      return {
        status: STATUS.GREY,
        statusReason: STATUS_REASONS.NO_DATA,
        remainingKm: null,
        remainingDays: null,
        dueByKm: null,
        dueByDate: null,
        message: 'Unknown interval type',
      };
  }
}

/**
 * KM-dominant: KM is leading. Time is advisory/warning layer only.
 */
function calculateKmDominant(item, lastEntry, currentMileage, currentDate) {
  const lastKm = lastEntry.mileage;
  const lastDate = new Date(lastEntry.date);
  const kmDriven = currentMileage - lastKm;

  // KM calculations
  const dueByKm = item.intervalKm ? lastKm + item.intervalKm : null;
  const remainingKm = dueByKm ? dueByKm - currentMileage : null;

  // Time calculations
  const dueByDate = item.intervalMonths
    ? format(addMonths(lastDate, item.intervalMonths), 'yyyy-MM-dd')
    : null;
  const dueDate = dueByDate ? new Date(dueByDate) : null;
  const remainingDays = dueDate ? differenceInDays(dueDate, currentDate) : null;

  // KM exceeded → RED
  if (item.intervalKm && kmDriven >= item.intervalKm) {
    return {
      status: STATUS.RED,
      statusReason: STATUS_REASONS.KM_EXCEEDED,
      remainingKm: remainingKm,
      remainingDays,
      dueByKm,
      dueByDate,
      message: `${Math.abs(remainingKm).toLocaleString()} km overdue`,
    };
  }

  // KM within warning → ORANGE
  if (item.intervalKm && item.warningKm && remainingKm <= item.warningKm) {
    return {
      status: STATUS.ORANGE,
      statusReason: STATUS_REASONS.KM_WARNING,
      remainingKm,
      remainingDays,
      dueByKm,
      dueByDate,
      message: `${remainingKm.toLocaleString()} km remaining`,
    };
  }

  // Time exceeded but KM still OK → ORANGE (advisory)
  if (dueDate && currentDate > dueDate) {
    const isHard = item.dateBehavior === 'hard';
    return {
      status: STATUS.ORANGE,
      statusReason: isHard ? STATUS_REASONS.DATE_EXCEEDED : STATUS_REASONS.DATE_ADVISORY,
      remainingKm,
      remainingDays,
      dueByKm,
      dueByDate,
      message: `Time interval exceeded (${Math.abs(remainingDays)} days over)`,
    };
  }

  // Time within warning → ORANGE
  if (dueDate && item.warningDays && remainingDays <= item.warningDays) {
    return {
      status: STATUS.ORANGE,
      statusReason: STATUS_REASONS.DATE_WARNING,
      remainingKm,
      remainingDays,
      dueByKm,
      dueByDate,
      message: `${remainingDays} days until time interval`,
    };
  }

  // All clear → GREEN
  return {
    status: STATUS.GREEN,
    statusReason: null,
    remainingKm,
    remainingDays,
    dueByKm,
    dueByDate,
    message: `${remainingKm ? remainingKm.toLocaleString() + ' km' : ''}${remainingKm && remainingDays ? ' / ' : ''}${remainingDays ? remainingDays + ' days' : ''} remaining`,
  };
}

/**
 * Time-dominant: Time is leading. KM is secondary.
 */
function calculateTimeDominant(item, lastEntry, currentMileage, currentDate) {
  const lastDate = new Date(lastEntry.date);

  // Time calculations
  const dueByDate = item.intervalMonths
    ? format(addMonths(lastDate, item.intervalMonths), 'yyyy-MM-dd')
    : null;
  const dueDate = dueByDate ? new Date(dueByDate) : null;
  const remainingDays = dueDate ? differenceInDays(dueDate, currentDate) : null;

  // KM calculations (secondary)
  const lastKm = lastEntry.mileage;
  const dueByKm = item.intervalKm ? lastKm + item.intervalKm : null;
  const remainingKm = dueByKm ? dueByKm - currentMileage : null;

  // Date exceeded → RED
  if (dueDate && currentDate > dueDate) {
    return {
      status: STATUS.RED,
      statusReason: STATUS_REASONS.DATE_EXCEEDED,
      remainingKm,
      remainingDays,
      dueByKm,
      dueByDate,
      message: `${Math.abs(remainingDays)} days overdue`,
    };
  }

  // Date within warning → ORANGE
  if (dueDate && item.warningDays && remainingDays <= item.warningDays) {
    return {
      status: STATUS.ORANGE,
      statusReason: STATUS_REASONS.DATE_WARNING,
      remainingKm,
      remainingDays,
      dueByKm,
      dueByDate,
      message: `${remainingDays} days remaining`,
    };
  }

  // GREEN
  return {
    status: STATUS.GREEN,
    statusReason: null,
    remainingKm,
    remainingDays,
    dueByKm,
    dueByDate,
    message: remainingDays ? `${remainingDays} days remaining` : 'OK',
  };
}

/**
 * Condition-based: No hard interval. Inspection/diagnosis item.
 * KM is inspection indicator, not replacement requirement.
 */
function calculateCondition(item, lastEntry, currentMileage, currentDate) {
  const lastKm = lastEntry.mileage;
  const kmDriven = currentMileage - lastKm;

  const dueByKm = item.intervalKm ? lastKm + item.intervalKm : null;
  const remainingKm = dueByKm ? dueByKm - currentMileage : null;

  // KM past inspection indicator → INSPECT (needs a look, not "overdue")
  if (item.intervalKm && kmDriven >= item.intervalKm) {
    return {
      status: STATUS.INSPECT,
      statusReason: STATUS_REASONS.INSPECTION_NEEDED,
      remainingKm,
      remainingDays: null,
      dueByKm,
      dueByDate: null,
      message: `Inspection due (${Math.abs(remainingKm).toLocaleString()} km over indicator)`,
    };
  }

  // KM approaching indicator → INSPECT (soon)
  if (item.intervalKm && item.warningKm && remainingKm <= item.warningKm) {
    return {
      status: STATUS.INSPECT,
      statusReason: STATUS_REASONS.INSPECTION_NEEDED,
      remainingKm,
      remainingDays: null,
      dueByKm,
      dueByDate: null,
      message: `${remainingKm.toLocaleString()} km until inspection indicator`,
    };
  }

  return {
    status: STATUS.GREEN,
    statusReason: null,
    remainingKm,
    remainingDays: null,
    dueByKm,
    dueByDate: null,
    message: remainingKm ? `${remainingKm.toLocaleString()} km until next check` : 'OK',
  };
}

/**
 * Diagnosis: Fault/problem items. No preventive interval.
 */
function calculateDiagnosis(item) {
  // Diagnosis/on-failure items never go red from km. Without a logged fault
  // they sit at MONITOR, not GREEN — green implies "checked & fine".
  const status = item.manualStatus || STATUS.MONITOR;
  const msg = item.manualStatusNote
    || (status === STATUS.MONITOR ? 'Monitor — replace on failure'
      : status === STATUS.GREEN ? 'No fault found'
      : status === STATUS.ORANGE ? 'Fault present' : 'Confirmed failed');
  return mk(status, STATUS_REASONS.DIAGNOSIS, msg);
}

/**
 * Get the most recent history entry for an item.
 */
function getLastHistoryEntry(item) {
  if (!item.history || item.history.length === 0) return null;
  return [...item.history].sort((a, b) => new Date(b.date) - new Date(a.date))[0];
}

/**
 * Sort items by urgency: red → orange → grey → green
 */
export function sortByUrgency(items, currentMileage, vehicle, currentDate) {
  return [...items].sort((a, b) => {
    const statusA = calculateStatus(a, currentMileage, vehicle, currentDate);
    const statusB = calculateStatus(b, currentMileage, vehicle, currentDate);
    return (STATUS_ORDER[statusA.status] ?? 9) - (STATUS_ORDER[statusB.status] ?? 9);
  });
}
