import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { CATEGORY_ICONS } from '../../utils/constants';
import { tItem, tPartName } from '../../utils/translate';
import './PartsPage.css';

export default function PartsPage({ maintenanceItems }) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');

  const partsData = useMemo(() => {
    const results = [];
    for (const item of maintenanceItems) {
      if (!item.parts?.length) continue;
      for (const part of item.parts) {
        results.push({ ...part, itemName: item.name, category: item.category, sourceNote: item.sourceNote, intervalKm: item.intervalKm, intervalMonths: item.intervalMonths });
      }
    }
    if (search) {
      const q = search.toLowerCase();
      return results.filter((p) =>
        p.name.toLowerCase().includes(q) ||
        p.oemNumber?.toLowerCase().includes(q) ||
        p.altBrand?.toLowerCase().includes(q) ||
        p.itemName.toLowerCase().includes(q)
      );
    }
    return results;
  }, [maintenanceItems, search]);

  return (
    <div className="parts-page">
      <h1 className="page-title">{t('parts.title')}</h1>

      <input
        type="search"
        className="parts-search"
        placeholder={t('parts.search')}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {partsData.length === 0 ? (
        <p className="empty-state">{t('parts.noParts')}</p>
      ) : (
        <div className="parts-list">
          {partsData.map((part, i) => (
            <div key={`${part.oemNumber}-${i}`} className="card part-card">
              <div className="part-header">
                <span className="part-icon">{CATEGORY_ICONS[part.category] || '⚙️'}</span>
                <div>
                  <span className="part-name">{tPartName(t, part.name)}</span>
                  <span className="part-for">
                    {tItem(t, part.itemName)}
                    {part.intervalKm ? ` · ${part.intervalKm.toLocaleString()} km` : ''}
                    {part.intervalMonths ? ` · ${part.intervalMonths} ${t('common.months')}` : ''}
                  </span>
                </div>
              </div>
              <div className="part-details">
                {part.oemNumber && (
                  <div className="part-row">
                    <span className="part-label">{t('parts.oemNumber')}</span>
                    <span className="part-value part-oem">{part.oemNumber}</span>
                  </div>
                )}
                {part.altBrand && (
                  <div className="part-row">
                    <span className="part-label">{t('parts.alternative')}</span>
                    <span className="part-value">{part.altBrand} {part.altNumber}</span>
                  </div>
                )}
                {part.estimatedPrice > 0 && (
                  <div className="part-row">
                    <span className="part-label">{t('parts.price')}</span>
                    <span className="part-value">€{part.estimatedPrice.toFixed(2)}</span>
                  </div>
                )}
                {part.bmwfansUrl && (
                  <div className="part-row">
                    <a href={part.bmwfansUrl} target="_blank" rel="noopener noreferrer" className="part-link">
                      🔗 {t('parts.bmwfansLink')}
                    </a>
                  </div>
                )}
              </div>
              {part.sourceNote && (
                <p className="part-note">{part.sourceNote}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
