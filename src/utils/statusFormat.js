import { STATUS_REASONS, INTERVAL_TYPES } from './constants';

/**
 * Single source of human-readable card status text. Reads the structured
 * fields the status engine already computes (calculatedStatus) and never
 * surfaces raw enum names or engine debug strings. One helper so every card —
 * brakes, cooling, A/C, oil, condition, on-failure — speaks the same language.
 *
 * Pure presentation: no data-model change, no engine change.
 */

function lastHistoryDate(item) {
  const h = item?.history;
  if (!h || !h.length) return null;
  const newest = [...h].sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date))[0];
  return newest?.date || null;
}

const nf = (n) => Math.abs(n).toLocaleString('nl-NL');
const num = (n) => n.toLocaleString('nl-NL');

export function formatMaintenanceStatus(item, currentMileage, today, t) {
  const cs = item?.calculatedStatus;
  if (!cs) return t('cardStatus.unknown');

  const ev = cs.sourceEvent;
  const since = ev?.date || lastHistoryDate(item);
  const result = ev?.result;
  const timeDom = item?.intervalType === INTERVAL_TYPES.TIME_DOMINANT;

  // 1. explicit condition/diagnosis result → human "sinds <date>" (no remaining)
  const SINCE = { worn: 'worn', replace_needed: 'replaceNeeded', confirmed_failed: 'defect', fault_present: 'fault' };
  if (result && SINCE[result] && since) return t(`cardStatus.${SINCE[result]}`, { date: since });
  if (result === 'monitor' && since) return t('cardStatus.monitorSince', { date: since });

  // 2. OK / green — only show a real next-due, never a fake remaining
  if (cs.status === 'green') {
    const okKm = (cs.dueByKm != null && cs.remainingKm != null && cs.remainingKm >= 0)
      ? t('cardStatus.okUntilKm', { km: num(cs.dueByKm), remain: num(cs.remainingKm) }) : null;
    const okDate = (cs.dueByDate && cs.remainingDays != null && cs.remainingDays >= 0)
      ? t('cardStatus.okUntilDate', { date: cs.dueByDate, days: cs.remainingDays }) : null;
    if (okKm || okDate) return timeDom ? (okDate || okKm) : (okKm || okDate);
    return t('cardStatus.ok');
  }

  // 3. no data / baseline needed
  if (cs.status === 'grey' || cs.statusReason === STATUS_REASONS.NO_DATA) return t('cardStatus.noBaseline');

  // 4. explicitly marked never replaced
  if (cs.statusReason === STATUS_REASONS.NEVER_REPLACED) return t('cardStatus.neverReplaced');

  // 5. overdue (red) — phrase along the dominant axis
  const overdueKm = (cs.remainingKm != null && cs.remainingKm < 0) ? t('cardStatus.overdueKm', { km: nf(cs.remainingKm) }) : null;
  const overdueDays = (cs.remainingDays != null && cs.remainingDays < 0) ? t('cardStatus.overdueDays', { days: Math.abs(cs.remainingDays) }) : null;
  if (overdueKm || overdueDays) return timeDom ? (overdueDays || overdueKm) : (overdueKm || overdueDays);

  // 6. due soon (orange) — phrase along the dominant axis
  const dueKm = (cs.remainingKm != null && cs.dueByKm != null && cs.remainingKm >= 0) ? t('cardStatus.dueKm', { km: num(cs.remainingKm) }) : null;
  const dueDays = (cs.remainingDays != null && cs.remainingDays >= 0) ? t('cardStatus.dueDays', { days: cs.remainingDays }) : null;
  if (dueKm || dueDays) return timeDom ? (dueDays || dueKm) : (dueKm || dueDays);

  // 7. inspection needed (condition item without a real next-due → no fake remaining)
  if (cs.status === 'inspect') return since ? t('cardStatus.inspectionNeededSince', { date: since }) : t('cardStatus.inspectionNeeded');

  // 8. monitor (on-failure default / monitor status)
  if (cs.status === 'monitor') return since ? t('cardStatus.monitorSince', { date: since }) : t('cardStatus.monitor');

  // 9. safe fallback — never a raw enum
  return t('cardStatus.ok');
}
