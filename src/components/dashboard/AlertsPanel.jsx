import { useTranslation } from 'react-i18next';
import { tItem } from '../../utils/translate';

const KIND_COLOR = {
  expired: 'var(--status-monitor)',
  attention: 'var(--status-orange)',
  moved: 'var(--status-inspect)',
  new: 'var(--status-green)',
};

/* Recent status-transition alerts. Newest first, unacknowledged first,
   capped at `max`. Dismiss = acknowledge. */
export default function AlertsPanel({ events = [], onAck, onAckAll, max = 5 }) {
  const { t } = useTranslation();

  const sorted = [...events]
    .sort((a, b) => (a.acknowledged === b.acknowledged
      ? new Date(b.createdAt) - new Date(a.createdAt)
      : a.acknowledged - b.acknowledged))
    .slice(0, max);

  const unackCount = events.filter((e) => !e.acknowledged).length;

  return (
    <div className="alerts-panel">
      <div className="alerts-head">
        <h3 className="section-title">
          {t('dashboard.alerts', 'Recente meldingen')}
          {unackCount > 0 && <span className="alerts-badge">{unackCount}</span>}
        </h3>
        {unackCount > 0 && (
          <button type="button" className="alerts-ackall" onClick={onAckAll}>
            {t('dashboard.ackAll', 'Alles gelezen')}
          </button>
        )}
      </div>

      {sorted.length === 0 ? (
        <p className="alerts-empty">{t('dashboard.noAlerts', 'Geen recente statuswijzigingen.')}</p>
      ) : (
        <ul className="alerts-list">
          {sorted.map((e) => (
            <li key={e.id} className={`alert-row ${e.acknowledged ? 'alert-ack' : ''}`}>
              <span className="alert-dot" style={{ background: KIND_COLOR[e.kind] || 'var(--status-grey)' }} />
              <div className="alert-body">
                <span className="alert-line">
                  <span className="alert-kind">{t(`events.${e.kind}`, e.kind)}</span>
                  {' · '}{tItem(t, e.itemName)}
                </span>
                <span className="alert-sub">
                  {e.fromStatus ? `${t(`statusLabel.${e.fromStatus}`)} → ` : ''}
                  {t(`statusLabel.${e.toStatus}`)}
                  {e.mileage ? ` · ${e.mileage.toLocaleString()} km` : ''}
                </span>
              </div>
              {!e.acknowledged && (
                <button type="button" className="alert-dismiss" onClick={() => onAck?.(e.id)} aria-label="dismiss">✕</button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
