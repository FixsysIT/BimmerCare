import { BUNDLES, ROLES } from '../data/bundles';
import { getCompanions, getReminders } from './companions';

/**
 * VISUAL grouping only. Builds clusters from the bundle registry so the
 * maintenance list can show a header + the linked cards together. No data is
 * merged — this only decides rendering. Maintenance logic stays in the picker.
 *
 * A cluster = a connected component over `mustReplace` links:
 *   - group bundle  → every member linked to every other (clique)
 *   - trigger bundle → trigger items linked to each MUST add (e.g. control
 *     arms / tie rods ↔ wheel alignment)
 * conditionalAddon / inspectOnly links do NOT join a cluster — they attach as
 * read-only rows under it.
 */

// Union-find over item names that share a mustReplace link.
function buildClusters() {
  const parent = new Map();
  const find = (x) => {
    if (!parent.has(x)) parent.set(x, x);
    while (parent.get(x) !== x) {
      parent.set(x, parent.get(parent.get(x)));
      x = parent.get(x);
    }
    return x;
  };
  const union = (a, b) => { parent.set(find(a), find(b)); };

  for (const b of BUNDLES) {
    if (b.group) {
      for (let i = 1; i < b.group.length; i++) union(b.group[0], b.group[i]);
    }
    if (b.trigger) {
      (b.adds || []).forEach((a) => {
        if (a.role === ROLES.MUST) b.trigger.forEach((tname) => union(tname, a.name));
      });
    }
  }

  // root → title (first contributing bundle in array order wins; group bundles
  // are listed before trigger ones so they take precedence)
  const rootTitle = new Map();
  for (const b of BUNDLES) {
    if (!b.title) continue;
    const names = b.group || b.trigger || [];
    for (const n of names) {
      if (!parent.has(n)) continue;
      const r = find(n);
      if (!rootTitle.has(r)) rootTitle.set(r, b.title);
    }
  }

  const nameToRoot = new Map();
  for (const n of parent.keys()) nameToRoot.set(n, find(n));
  return { find, nameToRoot, rootTitle };
}

// computed once — BUNDLES is static
const CLUSTERS = buildClusters();

/** Cluster id (root) for an item name, or null if it has no mustReplace link. */
export function clusterIdOf(name) {
  return CLUSTERS.nameToRoot.get(name) || null;
}

/** Display title {nl,en} for a cluster id, or null. */
export function clusterTitle(rootId) {
  return CLUSTERS.rootTitle.get(rootId) || null;
}

/**
 * Read-only attachments to show under a cluster (or a single trigger card):
 * conditional add-ons (name + cost + reason), inspect-only hints, reminders.
 * `memberNames` are the cluster's own items (excluded from add-ons).
 */
export function clusterAttachments(memberNames, allItems, currentMileage = null) {
  const inCluster = new Set(memberNames);
  const context = new Map(); // mustWhenContext, recommended → {name, cost, reason}
  const addons = new Map();   // optionalAddon, recommended → {name, cost, reason}
  const inspect = new Map();  // name → reason
  const notNeeded = new Map(); // context/addon currently OK → full item (for remaining text)
  const reminders = [];
  const seenReminder = new Set();
  const row = (c) => ({ name: c.name, estimatedTotalCost: c.estimatedTotalCost, reasonI18n: c.reasonI18n });

  for (const name of memberNames) {
    const item = (allItems || []).find((i) => i.name === name);
    if (!item) continue;
    for (const c of getCompanions(item, allItems, currentMileage)) {
      if (inCluster.has(c.name)) continue;
      if (c.role === ROLES.INSPECT) { if (!inspect.has(c.name)) inspect.set(c.name, c.reasonI18n); continue; }
      if (c.role === ROLES.CONTEXT || c.role === ROLES.ADDON) {
        // context-aware: only advise when the companion's own status warrants it;
        // otherwise drop it to the subtle "not needed now" list.
        if (c.recommend) {
          const bucket = c.role === ROLES.CONTEXT ? context : addons;
          if (!bucket.has(c.name)) bucket.set(c.name, row(c));
        } else if (!notNeeded.has(c.name)) {
          notNeeded.set(c.name, c);
        }
      }
    }
    for (const r of getReminders(item)) {
      const key = r.nl || r.en;
      if (!seenReminder.has(key)) { seenReminder.add(key); reminders.push(r); }
    }
  }
  // a companion recommended via one member shouldn't also appear as "not needed"
  for (const n of [...context.keys(), ...addons.keys()]) notNeeded.delete(n);

  return {
    context: [...context.values()],
    addons: [...addons.values()],
    inspect: [...inspect.keys()],
    notNeeded: [...notNeeded.values()],
    reminders,
  };
}
