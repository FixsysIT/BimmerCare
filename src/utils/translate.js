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
