import { useTranslation } from 'react-i18next';
import { tItem } from '../../utils/translate';

/* VISUAL grouping wrapper. Renders an optional bundle header (kopje), the
   linked member cards (passed as children — real independent MaintenanceItem
   cards), then read-only attachment rows: conditional add-ons (no checkbox),
   inspect-only hints, and operation reminders. Pure presentation — no actions,
   no logging. The do-together logic lives in the companion picker. */
export default function BundleGroup({ title, attachments = {}, children }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language?.startsWith('nl') ? 'nl' : 'en';
  const { addons = [], inspect = [], reminders = [] } = attachments;
  const hasAttachments = addons.length || inspect.length || reminders.length;

  return (
    <div className="bundle-group">
      {title && (
        <div className="bundle-group-header">
          <span className="bundle-group-title">🔗 {title[lang] || title.en}</span>
        </div>
      )}

      <div className="bundle-group-body">{children}</div>

      {hasAttachments && (
        <div className="bundle-attachments">
          {addons.length > 0 && (
            <div className="bundle-attach-block">
              <span className="bundle-attach-label bundle-label-addon">{t('register.bundleAddon')}</span>
              {addons.map((a) => (
                <div key={a.name} className="bundle-attach-row">
                  <span className="bundle-attach-tag bundle-tag-addon">Add-on</span>
                  <span className="bundle-attach-name">{tItem(t, a.name)}</span>
                  {a.estimatedTotalCost > 0 && <span className="bundle-attach-cost">~€{a.estimatedTotalCost}</span>}
                  {a.reasonI18n?.[lang] && <span className="bundle-attach-reason">{a.reasonI18n[lang]}</span>}
                </div>
              ))}
            </div>
          )}
          {inspect.length > 0 && (
            <div className="bundle-attach-block">
              <span className="bundle-attach-label bundle-label-inspect">{t('register.bundleInspect')}</span>
              {inspect.map((name) => (
                <span key={name} className="bundle-attach-row bundle-inspect-row">
                  <span className="bundle-attach-tag bundle-tag-inspect">Inspect</span>
                  <span className="bundle-attach-name">{tItem(t, name)}</span>
                </span>
              ))}
            </div>
          )}
          {reminders.length > 0 && (
            <div className="bundle-attach-block">
              <span className="bundle-attach-label bundle-label-reminder">{t('register.bundleReminder')}</span>
              {reminders.map((r, i) => (
                <span key={i} className="bundle-attach-row bundle-attach-reminder">
                  <span className="bundle-attach-tag bundle-tag-reminder">Reminder</span>
                  <span>{r[lang] || r.en}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
