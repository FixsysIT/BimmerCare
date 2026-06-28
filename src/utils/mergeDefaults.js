import { deriveLayer } from './constants';

/**
 * Non-destructive catalog upgrade.
 *
 * Existing stored items and fresh defaults DON'T share ids (defaults get a
 * new uuid every load), so the stable identity is the English `name` key.
 *
 * Rules:
 *  - default name missing in existing → add the default item (new uuid).
 *  - name exists → KEEP the stored item; only fill missing P2 metadata and
 *    sync `category` (category is not user-editable in the UI, so it's safe).
 *  - never touch: history, manualStatus, manualStatusNote, baselineState,
 *    lastResult, user-edited intervals/costs/parts, createdAt.
 *
 * Returns { items, added[], addedCount, metadataFilled, filledNames[] }.
 */
const META_KEYS = ['visibilityLayer', 'inspectionGroup', 'garageChecklistGroup', 'userFacingPriority'];

export function mergeDefaultItems(existing, defaults) {
  const existingByName = new Map((existing || []).map((i) => [i.name, i]));
  const defByName = new Map((defaults || []).map((d) => [d.name, d]));

  let metadataFilled = 0;
  const filledNames = [];

  const merged = (existing || []).map((item) => {
    const def = defByName.get(item.name);
    const next = { ...item };
    let changed = false;

    META_KEYS.forEach((k) => {
      if (next[k] === undefined || next[k] === null) {
        let val = def ? def[k] : undefined;
        if (k === 'visibilityLayer') val = val ?? deriveLayer(next);
        if (val !== undefined && val !== null) { next[k] = val; changed = true; }
      }
    });

    // Safe sync: category is set by the catalog, not editable by the user.
    if (def && def.category && def.category !== next.category) {
      next.category = def.category;
      changed = true;
    }

    // Special migration: NOx Sensor to 250k (NOXEM 402)
    if (def && next.name === 'NOx Sensor' && next.replacementOkValidKm === 100000) {
      next.replacementOkValidKm = 250000;
      next.parts = def.parts;
      next.sourceNote = def.sourceNote;
      changed = true;
    }

    if (changed) { metadataFilled++; filledNames.push(item.name); next.updatedAt = new Date().toISOString(); }
    return next;
  });

  const added = [];
  (defaults || []).forEach((d) => {
    if (!existingByName.has(d.name)) { merged.push(d); added.push(d.name); }
  });

  return { items: merged, added, addedCount: added.length, metadataFilled, filledNames };
}

/** Names of default items not present in stored items (for debug/preview). */
export function missingDefaultNames(existing, defaults) {
  const have = new Set((existing || []).map((i) => i.name));
  return (defaults || []).filter((d) => !have.has(d.name)).map((d) => d.name);
}

/** Stored items lacking layer metadata (pre-P2 data). */
export function itemsMissingLayer(existing) {
  return (existing || []).filter((i) => !i.visibilityLayer).map((i) => i.name);
}
