/**
 * Translate item name / category using i18n.
 * Falls back to raw value for custom items.
 */
export function tItem(t, name) {
  const translated = t(`items.${name}`, { defaultValue: '' });
  return translated || name;
}

export function tCategory(t, category) {
  const translated = t(`categories.${category}`, { defaultValue: '' });
  return translated || category;
}

export function tPartName(t, name) {
  const translated = t(`partNames.${name}`, { defaultValue: '' });
  return translated || name;
}

/** Short "what is this part" description (NL/EN). Empty when none defined. */
export function tPartInfo(t, name) {
  return t(`partInfo.${name}`, { defaultValue: '' });
}

/** Translated item note for the parts page. Empty when no NL/EN note defined
 *  (so raw English sourceNotes never leak onto the shopping page). */
export function tItemNote(t, name) {
  return t(`itemNotes.${name}`, { defaultValue: '' });
}
