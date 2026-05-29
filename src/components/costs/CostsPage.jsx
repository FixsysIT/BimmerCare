import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { aggregateCosts, costPer1000Km, costPerMonth } from '../../utils/costCalculator';
import { CATEGORY_ICONS } from '../../utils/constants';
import { tItem, tCategory } from '../../utils/translate';
import './CostsPage.css';

export default function CostsPage({ maintenanceItems, vehicle }) {
  const { t } = useTranslation();

  const costs = useMemo(() => aggregateCosts(maintenanceItems), [maintenanceItems]);

  const kmDriven = vehicle ? vehicle.currentMileage - (vehicle.odometerAtPurchase || 0) : 0;
  const firstDate = costs.entries.length ? costs.entries[costs.entries.length - 1].date : null;
  const perMonth = costPerMonth(costs.totalInclVat, firstDate);
  const per1000 = costPer1000Km(costs.totalInclVat, kmDriven);

  if (!costs.entries.length) {
    return (
      <div className="costs-page">
        <h1 className="page-title">{t('costs.title')}</h1>
        <p className="empty-state">{t('costs.noData')}</p>
      </div>
    );
  }

  return (
    <div className="costs-page">
      <h1 className="page-title">{t('costs.title')}</h1>

      <div className="cost-summary-grid">
        <div className="cost-card card">
          <span className="cost-label">{t('costs.totalInclVat')}</span>
          <span className="cost-value">€{costs.totalInclVat.toFixed(2)}</span>
        </div>
        <div className="cost-card card">
          <span className="cost-label">{t('costs.totalExclVat')}</span>
          <span className="cost-value">€{costs.totalExclVat.toFixed(2)}</span>
        </div>
        <div className="cost-card card">
          <span className="cost-label">{t('costs.totalVat')}</span>
          <span className="cost-value">€{costs.totalVat.toFixed(2)}</span>
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
            <div key={cat} className="category-row">
              <span className="cat-name">{CATEGORY_ICONS[cat] || '🔧'} {tCategory(t, cat)}</span>
              <span className="cat-count">{data.count}×</span>
              <span className="cat-total">€{data.totalInclVat.toFixed(2)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h3 className="section-title">{t('costs.costLog')}</h3>
        <div className="cost-log">
          {costs.entries.map((entry, i) => (
            <div key={`${entry.date}-${i}`} className="log-entry">
              <div className="log-left">
                <span className="log-item">{tItem(t, entry.itemName)}</span>
                <span className="log-detail">
                  {entry.date} — {entry.mileage?.toLocaleString()} km
                  {entry.garage ? ` — ${entry.garage}` : ''}
                </span>
              </div>
              <span className="log-amount">€{entry.calculatedInclVat.toFixed(2)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
