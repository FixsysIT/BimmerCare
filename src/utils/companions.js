import { BUNDLES, ROLES } from '../data/bundles';

/**
 * Companion (do-together) jobs, derived from the bundle registry (bundles.js).
 *
 * Items stay independent — this only resolves which OTHER items to offer when
 * you register a service on a given item, plus their role (mustReplace /
 * conditionalAddon / inspectOnly) and the bundle's reason.
 */

const ROLE_RANK = { [ROLES.MUST]: 4, [ROLES.CONTEXT]: 3, [ROLES.ADDON]: 2, [ROLES.INSPECT]: 1 };

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
  for (const b of BUNDLES) {
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
export function getCompanions(item, allItems) {
  if (!item) return [];
  const lang = (s) => (s ? (s.nl || s.en || '') : '');
  const links = rawLinks(item);
  const out = [];
  links.forEach(({ role, reason }, name) => {
    const found = (allItems || []).find((i) => i.name === name && !i.isDisabled);
    if (!found) return;
    out.push({
      ...found,
      role,
      reason: lang(reason),
      reasonI18n: reason,
      isCheckbox: role !== ROLES.INSPECT,
      defaultChecked: role === ROLES.MUST,
    });
  });
  return out.sort((a, b) => ROLE_RANK[b.role] - ROLE_RANK[a.role]);
}

/** Free operation reminders (e.g. battery coding) triggered by servicing an item. */
export function getReminders(item) {
  if (!item) return [];
  return BUNDLES
    .filter((b) => b.reminder && b.trigger?.includes(item.name))
    .map((b) => b.reminder);
}
