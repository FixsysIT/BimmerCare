import { getBundles, ROLES } from '../data/bundles';
import { calculateStatus } from './statusCalculator';

/**
 * Companion (do-together) jobs, derived from the bundle registry (bundles.js).
 *
 * Items stay independent — this only resolves which OTHER items to offer when
 * you register a service on a given item, plus their role (mustReplace /
 * mustWhenContext / optionalAddon / inspectOnly) and the bundle's reason.
 *
 * Context-aware: optionalAddon / mustWhenContext are only RECOMMENDED when the
 * companion item's OWN status warrants it (due / overdue / due soon / unknown
 * baseline / worn / replace_needed / inspection_needed). A companion that is
 * comfortably OK is returned with recommend=false so the UI can hide it (or
 * show it subtly under "not needed now"). mustReplace is always recommended.
 */

const ROLE_RANK = { [ROLES.MUST]: 4, [ROLES.CONTEXT]: 3, [ROLES.ADDON]: 2, [ROLES.INSPECT]: 1 };

/* Does the companion's OWN computed status warrant recommending it now? */
function companionRecommend(role, item, cs) {
  if (role === ROLES.MUST || role === ROLES.INSPECT) return true; // must = always; inspect is a hint anyway
  const s = cs?.status;
  const r = cs?.sourceEvent?.result;
  const isOverdue = s === 'red'
    || (cs?.remainingKm != null && cs.remainingKm < 0)
    || (cs?.remainingDays != null && cs.remainingDays < 0);
  const isDueSoon = s === 'orange';
  const condBad = r === 'worn' || r === 'replace_needed' || r === 'confirmed_failed' || r === 'fault_present' || s === 'inspect';
  const unknown = s === 'grey' || item.baselineState === 'never';
  return isOverdue || isDueSoon || condBad || unknown;
}

// Collect raw {name, role, reason} suggestions for an item across all bundles.
function rawLinks(item) {
  const found = new Map(); // name -> { role, reason }
  const consider = (name, role, reason) => {
    if (name === item.name) return;
    const prev = found.get(name);
    if (!prev || ROLE_RANK[role] > ROLE_RANK[prev.role]) {
      found.set(name, { role, reason });
    }
  };
  for (const b of getBundles()) {
    if (b.group?.includes(item.name)) {
      b.group.forEach((n) => consider(n, ROLES.MUST, b.reason));
    }
    if (b.trigger?.includes(item.name)) {
      (b.adds || []).forEach((a) => consider(a.name, a.role, b.reason));
    }
  }
  return found;
}

/**
 * Resolve companions for an item to live, active stored items, augmented with
 * role / reason / defaultChecked. Sorted mustReplace → addon → inspectOnly.
 */
export function getCompanions(item, allItems, currentMileage = null) {
  if (!item) return [];
  const lang = (s) => (s ? (s.nl || s.en || '') : '');
  const links = rawLinks(item);
  const out = [];
  links.forEach(({ role, reason }, name) => {
    const found = (allItems || []).find((i) => i.name === name && !i.isDisabled);
    if (!found) return;
    // compute the companion's OWN status so add-on advice is context-aware
    const cs = calculateStatus(found, currentMileage);
    out.push({
      ...found,
      calculatedStatus: cs,
      role,
      reason: lang(reason),
      reasonI18n: reason,
      isCheckbox: role !== ROLES.INSPECT,
      defaultChecked: role === ROLES.MUST,
      recommend: companionRecommend(role, found, cs),
    });
  });
  return out.sort((a, b) => ROLE_RANK[b.role] - ROLE_RANK[a.role]);
}

/** Free operation reminders (e.g. battery coding) triggered by servicing an item. */
export function getReminders(item) {
  if (!item) return [];
  return getBundles()
    .filter((b) => b.reminder && b.trigger?.includes(item.name))
    .map((b) => b.reminder);
}

/**
 * Every bundle an item participates in, with its role there. Read-only view
 * for exports ("welke items horen bij elkaar"). Role is `member` (group),
 * `trigger`, `reminder`, or one of the add roles (mustReplace/…/inspectOnly).
 */
export function bundleMemberships(name) {
  const out = [];
  for (const b of getBundles()) {
    const title = b.title?.nl || b.title?.en || b.id;
    if (b.group?.includes(name)) out.push({ bundleId: b.id, title, role: 'member' });
    if (b.trigger?.includes(name)) out.push({ bundleId: b.id, title, role: b.reminder ? 'reminder' : 'trigger' });
    (b.adds || []).forEach((a) => { if (a.name === name) out.push({ bundleId: b.id, title, role: a.role }); });
  }
  return out;
}
