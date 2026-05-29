import { differenceInDays, differenceInMonths, addMonths, addDays, format } from 'date-fns';
import { STATUS, STATUS_REASONS, STATUS_ORDER, INTERVAL_TYPES, DIAGNOSIS_OK_VALID_MONTHS } from './constants';

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
export function lastOfType(item, type) {
  const evs = (item.history || []).filter((h) => h.type === type);
  if (!evs.length) return null;
  return [...evs].sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date))[0];
}

/* Age of an event in whole months relative to `now`. null if no date. */
function eventAgeMonths(e, now) {
  const d = e.createdAt || e.date;
  if (!d) return null;
  return differenceInMonths(now, new Date(d));
}

/* Most recent of a set of events by createdAt/date. */
function newestEvent(events) {
  const list = events.filter(Boolean);
  if (!list.length) return null;
  return [...list].sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date))[0];
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

  // DIAGNOSIS / on-failure — newest of {diagnosis, service} event is the source.
  // A 'service'/replaced event is a real repair (OK); a 'diagnosis' event is
  // only a check. on-failure items never go red from km.
  if (isOnFailure(item)) {
    const diag = lastOfType(item, 'diagnosis');
    const svc = lastOfType(item, 'service');
    const newest = newestEvent([diag, svc]);
    if (newest) {
      // Real replacement → OK while inside the replacement window. A replaced
      // part eventually wears again, so past replacementOkValidKm (or optional
      // replacementOkValidMonths) it drops back to Monitor — never red from km.
      if (newest.type === 'service') {
        const lastServiceKm = newest.mileage ?? null;
        const kmSince = (currentMileage != null && lastServiceKm != null)
          ? currentMileage - lastServiceKm : null;
        const validKm = item.replacementOkValidKm ?? null;
        const expiresAtKm = (lastServiceKm != null && validKm != null) ? lastServiceKm + validKm : null;
        const remainingKm = (expiresAtKm != null && currentMileage != null) ? expiresAtKm - currentMileage : null;
        const ageM = eventAgeMonths(newest, currentDate);
        const kmExpired = validKm != null && kmSince != null && kmSince >= validKm;
        const monthsExpired = item.replacementOkValidMonths != null && ageM != null
          && ageM >= item.replacementOkValidMonths;
        const expired = kmExpired || monthsExpired;

        const r = fromEvent(newest, STATUS_REASONS.DIAGNOSIS); // green + sourceEvent
        // replacement-window metadata for the UI / debug export
        r.lastServiceKm = lastServiceKm;
        r.kmSinceReplacement = kmSince;
        r.replacementOkValidKm = validKm;
        r.replacementExpiresAtKm = expiresAtKm;
        r.replacementRemainingKm = expired ? 0 : (remainingKm != null ? Math.max(0, remainingKm) : null);
        r.replacementExpired = expired;
        // generic remaining/dueBy so any consumer can render a bar
        r.remainingKm = r.replacementRemainingKm;
        r.dueByKm = expiresAtKm;

        if (expired) {
          r.status = STATUS.MONITOR;
          r.statusReason = STATUS_REASONS.REPLACEMENT_EXPIRED;
          r.message = kmSince != null
            ? `Monitor — replaced ${kmSince.toLocaleString()} km ago`
            : 'replacement window expired — monitor';
        } else {
          r.message = remainingKm != null
            ? `${remainingKm.toLocaleString()} km until Monitor`
            : 'replaced';
        }
        return r;
      }

      // Diagnosis "no fault" is only valid for a while — a clean check goes
      // stale (it's not a repair). Past the window → back to Monitor.
      if (newest.result === 'no_fault') {
        const age = eventAgeMonths(newest, currentDate);
        const limit = item.diagnosisOkValidMonths ?? DIAGNOSIS_OK_VALID_MONTHS;
        if (age !== null && age >= limit) {
          const r = fromEvent(newest, STATUS_REASONS.DIAGNOSIS);
          r.status = STATUS.MONITOR;
          r.statusReason = STATUS_REASONS.NO_FAULT_EXPIRED;
          r.message = `no_fault recheck — older than ${limit} months`;
          return r;
        }
      }
      return fromEvent(newest, STATUS_REASONS.DIAGNOSIS);
    }
    if (item.manualStatus) return manualResult(item, true);
    return mk(STATUS.MONITOR, STATUS_REASONS.MONITOR, 'Monitor — replace on failure', 'default');
  }

  // CONDITION — newest of {inspection, service} event is the source.
  // A 'service'/replaced event resets the wear clock; an 'inspection' event
  // reports the observed condition.
  if (isCondition(item)) {
    const insp = lastOfType(item, 'inspection');
    const svc = lastOfType(item, 'service');
    const newest = newestEvent([insp, svc]);
    if (newest) {
      // a replacement resets the km indicator: count from the service entry
      if (newest.type === 'service' && item.intervalKm) {
        return { ...calculateCondition(item, newest, currentMileage, currentDate), source: 'history' };
      }
      return fromEvent(newest, STATUS_REASONS.INSPECTION_NEEDED);
    }
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
