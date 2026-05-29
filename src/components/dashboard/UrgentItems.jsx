import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import StatusBadge from '../shared/StatusBadge';
import { CATEGORY_ICONS } from '../../utils/constants';
import { tItem } from '../../utils/translate';

const TABS = [
  { key: 'red', match: ['red'] },
  { key: 'inspect', match: ['inspect'] },
  { key: 'orange', match: ['orange'] },
  { key: 'all', match: ['red', 'orange', 'inspect'] },
];

export default function UrgentItems({ items, onOpen }) {
  const { t } = useTranslation();
  const [tab, setTab] = useState('red');

  const active = TABS.find((x) => x.key === tab) || TABS[0];
  const list = (items || []).filter((i) => active.match.includes(i.calculatedStatus?.status));

  return (
    <div className="urgent-items">
      <div className="urgent-head">
        <h3 className="section-title">{t('dashboard.urgentItems')}</h3>
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
              onClick={() => onOpen?.(item.calculatedStatus.status)}
            >
              <div className="urgent-left">
                <span className="urgent-icon">{CATEGORY_ICONS[item.category] || '🔧'}</span>
                <div>
                  <span className="urgent-name">{tItem(t, item.name)}</span>
                  <span className="urgent-message">{item.calculatedStatus.message}</span>
                </div>
              </div>
              <StatusBadge status={item.calculatedStatus.status} reason={item.calculatedStatus.statusReason} compact />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
