import { useTranslation } from 'react-i18next';
import { tItem } from '../../utils/translate';
import { ROLES } from '../../data/bundles';

/* Do-together picker, grouped by role:
   - mustReplace      → checkbox, ticked by default, logs replacement
   - conditionalAddon → checkbox, unticked, +reason +~cost, logs only when ticked
   - inspectOnly      → hint text only, no checkbox, logs nothing
   `selected` is the array of ticked companion item ids. Reminders are free
   operations (e.g. battery coding), shown as a warning line. */
export default function CompanionPicker({ companions = [], selected, onChange, reminders = [] }) {
  const { t, i18n } = useTranslation();
  if (!companions.length && !reminders.length) return null;

  const lang = i18n.language?.startsWith('nl') ? 'nl' : 'en';
  const must = companions.filter((c) => c.role === ROLES.MUST);
  const addons = companions.filter((c) => c.role === ROLES.ADDON);
  const inspect = companions.filter((c) => c.role === ROLES.INSPECT);

  const toggle = (id) =>
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);

  const Row = ({ c }) => (
    <label className="companion-row">
      <input type="checkbox" checked={selected.includes(c.id)} onChange={() => toggle(c.id)} />
      <span className="companion-name">{tItem(t, c.name)}</span>
      {c.estimatedTotalCost > 0 && <span className="companion-cost">~€{c.estimatedTotalCost}</span>}
    </label>
  );

  return (
    <div className="companion-picker">
      <span className="companion-title">🔗 {t('register.companionsTitle')}</span>

      {must.length > 0 && (
        <div className="companion-section">
          <span className="companion-section-label companion-must">{t('register.companionMust')}</span>
          {must.map((c) => <Row key={c.id} c={c} />)}
        </div>
      )}

      {addons.length > 0 && (
        <div className="companion-section">
          <span className="companion-section-label companion-addon">{t('register.companionAddon')}</span>
          {addons.map((c) => (
            <div key={c.id} className="companion-addon-row">
              <Row c={c} />
              {c.reasonI18n?.[lang] && <span className="companion-reason">{c.reasonI18n[lang]}</span>}
            </div>
          ))}
        </div>
      )}

      {inspect.length > 0 && (
        <div className="companion-section">
          <span className="companion-section-label companion-inspect">{t('register.companionInspect')}</span>
          {inspect.map((c) => (
            <span key={c.id} className="companion-hint-line">🔍 {tItem(t, c.name)}</span>
          ))}
        </div>
      )}

      {reminders.map((r, i) => (
        <span key={i} className="companion-reminder">{r[lang] || r.en}</span>
      ))}
    </div>
  );
}
