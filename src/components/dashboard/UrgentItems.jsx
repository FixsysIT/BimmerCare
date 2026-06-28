import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import StatusBadge from '../shared/StatusBadge';
import { CATEGORY_ICONS, STATUS_ORDER } from '../../utils/constants';
import { tItem } from '../../utils/translate';
import { formatMaintenanceStatus } from '../../utils/statusFormat';

// Priority ranking: most severe status first, then closest-to-due / most overdue.
// Within a status, lower "remaining" = higher prio (overdue is negative → top).
// Days take precedence over km when both exist; fall back to km, else last.
function priorityRank(item) {
  const cs = item.calculatedStatus || {};
  const sev = STATUS_ORDER[cs.status] ?? 9;
  let remaining = Infinity;
  if (cs.remainingDays != null) remaining = cs.remainingDays;
  else if (cs.remainingKm != null) remaining = cs.remainingKm;
  return { sev, remaining };
}

function byPriority(a, b) {
  const A = priorityRank(a);
  const B = priorityRank(b);
  if (A.sev !== B.sev) return A.sev - B.sev;
  return A.remaining - B.remaining;
}

const TABS = [
  { key: 'red', match: ['red'] },
  { key: 'inspect', match: ['inspect'] },
  { key: 'orange', match: ['orange'] },
  { key: 'all', match: ['red', 'orange', 'inspect'] },
];

export default function UrgentItems({ items, onOpen, max, changedItems, onAckItem, currentMileage, title }) {
  const { t } = useTranslation();
  const [tab, setTab] = useState('red');

  const active = TABS.find((x) => x.key === tab) || TABS[0];
  const matched = (items || [])
    .filter((i) => active.match.includes(i.calculatedStatus?.status))
    .sort(byPriority);
  const list = max ? matched.slice(0, max) : matched;
  const hiddenCount = matched.length - list.length;

  return (
    <div className="urgent-items">
      <div className="urgent-head">
        <h3 className="section-title">{title || t('dashboard.urgentItems')}</h3>
        <div className="urgent-tabs">
          {TABS.map((x) => (
            <button
              key={x.key}
              type="button"
              className={`urgent-tab ${tab === x.key ? 'urgent-tab-active' : ''}`}
              onClick={() => setTab(x.key)}
            >
              {x.key === 'all' ? t('maintenance.all') : t(`statusLabel.${x.key}`)}
            </button>
          ))}
        </div>
      </div>

      {list.length === 0 ? (
        <p className="urgent-empty">{t('dashboard.allClear', 'Niets urgent — alles rustig.')}</p>
      ) : (
        <div className="urgent-list">
          {list.map((item) => (
            <button
              key={item.id}
              type="button"
              className="urgent-item card"
              onClick={() => { onAckItem?.(item.id); onOpen?.(item.calculatedStatus.status); }}
            >
              <div className="urgent-left">
                <span className="urgent-icon">{CATEGORY_ICONS[item.category] || '🔧'}</span>
                <div>
                  <span className="urgent-name">
                    {tItem(t, item.name)}
                    {changedItems?.has(item.id) && (
                      <span className="urgent-new">✦ {t('events.new', 'Nieuw')}</span>
                    )}
                  </span>
                  <span className="urgent-message">{formatMaintenanceStatus(item, currentMileage, new Date(), t)}</span>
                </div>
              </div>
              <div className="urgent-right">
                {item.estimatedTotalCost > 0 && (
                  <span className="cost-chip">~€{item.estimatedTotalCost.toLocaleString()}</span>
                )}
                <StatusBadge status={item.calculatedStatus.status} reason={item.calculatedStatus.statusReason} compact />
              </div>
            </button>
          ))}
          {hiddenCount > 0 && (
            <button type="button" className="urgent-more" onClick={() => onOpen?.(active.match[0])}>
              +{hiddenCount} {t('dashboard.more', 'meer')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
