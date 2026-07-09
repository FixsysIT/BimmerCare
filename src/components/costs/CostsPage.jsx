import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { aggregateCosts, costPer1000Km, costPerMonth } from '../../utils/costCalculator';
import { CATEGORY_ICONS } from '../../utils/constants';
import { tItem, tCategory } from '../../utils/translate';
import EventLogModal from '../maintenance/EventLogModal';
import InvoiceVault from './InvoiceVault';
import './CostsPage.css';

export default function CostsPage({ maintenanceItems, vehicle, currentMileage, updateHistoryEntry }) {
  const { t } = useTranslation();

  const costs = useMemo(() => aggregateCosts(maintenanceItems), [maintenanceItems]);
  const [catFilter, setCatFilter] = useState(null); // clicked category → filter the log
  const [editEntry, setEditEntry] = useState(null);  // cost-log entry being edited

  const saveEdit = ({ date, mileage, cost, note }) => {
    if (editEntry && updateHistoryEntry) {
      updateHistoryEntry(editEntry.itemId, editEntry.id, { date, mileage, cost, notes: note });
    }
    setEditEntry(null);
  };

  const logEntries = catFilter
    ? costs.entries.filter((e) => (e.itemCategory || 'Unknown') === catFilter)
    : costs.entries;

  const kmDriven = vehicle ? vehicle.currentMileage - (vehicle.odometerAtPurchase || 0) : 0;
  const firstDate = costs.entries.length ? costs.entries[costs.entries.length - 1].date : null;
  const perMonth = costPerMonth(costs.total, firstDate);
  const per1000 = costPer1000Km(costs.total, kmDriven);

  if (!costs.entries.length) {
    return (
      <div className="costs-page">
        <h1 className="page-title">{t('costs.title')}</h1>
        <p className="empty-state">{t('costs.noData')}</p>
        <InvoiceVault />
      </div>
    );
  }

  return (
    <div className="costs-page">
      <h1 className="page-title">{t('costs.title')}</h1>

      <div className="cost-summary-grid">
        <div className="cost-card card">
          <span className="cost-label">{t('costs.total')}</span>
          <span className="cost-value">€{costs.total.toFixed(2)}</span>
        </div>
        <div className="cost-card card">
          <span className="cost-label">{t('costs.perMonth')}</span>
          <span className="cost-value">€{perMonth.toFixed(2)}</span>
        </div>
        <div className="cost-card card">
          <span className="cost-label">{t('costs.per1000km')}</span>
          <span className="cost-value">€{per1000.toFixed(2)}</span>
        </div>
      </div>

      <div className="card">
        <h3 className="section-title">{t('costs.byCategory')}</h3>
        <div className="category-table">
          {Object.entries(costs.byCategory).map(([cat, data]) => (
            <button
              key={cat}
              type="button"
              className={`category-row ${catFilter === cat ? 'category-row-active' : ''}`}
              onClick={() => setCatFilter(catFilter === cat ? null : cat)}
            >
              <span className="cat-name">{CATEGORY_ICONS[cat] || '🔧'} {tCategory(t, cat)}</span>
              <span className="cat-count">{data.count}×</span>
              <span className="cat-total">€{data.total.toFixed(2)}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="cost-log-header">
          <h3 className="section-title">{t('costs.costLog')}</h3>
          {catFilter && (
            <button type="button" className="cost-filter-chip" onClick={() => setCatFilter(null)}>
              {CATEGORY_ICONS[catFilter] || '🔧'} {tCategory(t, catFilter)} ✕
            </button>
          )}
        </div>
        <div className="cost-log">
          {logEntries.map((entry, i) => (
            <button
              key={entry.id || `${entry.date}-${i}`}
              type="button"
              className="log-entry log-entry-btn"
              onClick={() => entry.id && setEditEntry(entry)}
              title={t('costs.editEntry', 'Aanpassen')}
            >
              <div className="log-left">
                <span className="log-item">{tItem(t, entry.itemName)}</span>
                <span className="log-detail">
                  {entry.date} — {entry.mileage?.toLocaleString()} km
                  {entry.garage ? ` — ${entry.garage}` : ''}
                </span>
                {entry.notes && <span className="log-note">{entry.notes}</span>}
              </div>
              <span className="log-amount">€{entry.calculatedCost.toFixed(2)}</span>
            </button>
          ))}
        </div>
      </div>

      <InvoiceVault />

      {editEntry && (
        <EventLogModal
          isOpen={!!editEntry}
          onClose={() => setEditEntry(null)}
          item={{ name: editEntry.itemName }}
          currentMileage={currentMileage}
          resultLabel={t('costs.editEntry', 'Aanpassen')}
          initial={editEntry}
          onSave={saveEdit}
        />
      )}
    </div>
  );
}
