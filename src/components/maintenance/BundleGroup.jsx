import { useTranslation } from 'react-i18next';
import { tItem } from '../../utils/translate';
import { formatMaintenanceStatus } from '../../utils/statusFormat';

/* VISUAL grouping wrapper. Renders an optional bundle header (kopje), the
   linked member cards (passed as children — real independent MaintenanceItem
   cards), then read-only attachment rows: context-aware add-ons (no checkbox),
   inspect-only hints, operation reminders, and a subtle "not needed now" list
   for companions that are currently OK. Pure presentation — no actions, no
   logging. The do-together logic lives in the companion picker. */
export default function BundleGroup({ title, attachments = {}, currentMileage, children }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language?.startsWith('nl') ? 'nl' : 'en';
  const { context = [], addons = [], inspect = [], reminders = [], notNeeded = [] } = attachments;
  const hasAttachments = context.length > 0 || addons.length > 0 || inspect.length > 0
    || reminders.length > 0 || notNeeded.length > 0;

  const ItemRow = ({ a, tag, tagClass }) => (
    <div className="bundle-attach-row">
      <span className={`bundle-attach-tag ${tagClass}`}>{tag}</span>
      <span className="bundle-attach-name">{tItem(t, a.name)}</span>
      {a.estimatedTotalCost > 0 && <span className="bundle-attach-cost">~€{a.estimatedTotalCost}</span>}
      {a.reasonI18n?.[lang] && <span className="bundle-attach-reason">{a.reasonI18n[lang]}</span>}
    </div>
  );

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
          {context.length > 0 && (
            <div className="bundle-attach-block">
              <span className="bundle-attach-label bundle-label-context">{t('register.bundleContext')}</span>
              {context.map((a) => (
                <ItemRow key={a.name} a={a} tag={t('register.tagContext')} tagClass="bundle-tag-context" />
              ))}
            </div>
          )}
          {addons.length > 0 && (
            <div className="bundle-attach-block">
              <span className="bundle-attach-label bundle-label-addon">{t('register.bundleAddon')}</span>
              {addons.map((a) => (
                <ItemRow key={a.name} a={a} tag={t('register.tagAddon')} tagClass="bundle-tag-addon" />
              ))}
            </div>
          )}
          {inspect.length > 0 && (
            <div className="bundle-attach-block">
              <span className="bundle-attach-label bundle-label-inspect">{t('register.bundleInspect')}</span>
              {inspect.map((name) => (
                <span key={name} className="bundle-attach-row bundle-inspect-row">
                  <span className="bundle-attach-tag bundle-tag-inspect">{t('register.tagInspect')}</span>
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
                  <span className="bundle-attach-tag bundle-tag-reminder">{t('register.tagReminder')}</span>
                  <span>{r[lang] || r.en}</span>
                </span>
              ))}
            </div>
          )}
          {notNeeded.length > 0 && (
            <div className="bundle-attach-block bundle-notneeded">
              <span className="bundle-attach-label">{t('register.notNeeded')}</span>
              {notNeeded.map((c) => (
                <span key={c.name} className="bundle-notneeded-row">
                  {tItem(t, c.name)} — {formatMaintenanceStatus(c, currentMileage, new Date(), t)}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
