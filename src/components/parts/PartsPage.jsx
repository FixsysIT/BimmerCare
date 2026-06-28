import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { CATEGORY_ICONS, LABOUR_RATE_EXCL_BTW } from '../../utils/constants';
import { tItem, tPartName } from '../../utils/translate';
import { copyToClipboard } from '../../utils/dataExport';
import './PartsPage.css';

// Shop deep-links: prefill the search with the part number so Saddik can order himself.
// Verified June 2026: both params resolve to a real result/product page.
const shopUrl = {
  winparts: (nr) => `https://www.winparts.nl/zoekresultaten?q=${encodeURIComponent(nr)}`,
  motointegrator: (nr) => `https://www.motointegrator.nl/producten/?phrase=${encodeURIComponent(nr)}`,
};

export default function PartsPage({ maintenanceItems, settings }) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [copied, setCopied] = useState('');
  const labourRate = Number(settings?.labourRateExclBtw) > 0 ? Number(settings.labourRateExclBtw) : LABOUR_RATE_EXCL_BTW;

  const copyNumber = async (nr) => {
    if (await copyToClipboard(nr)) {
      setCopied(nr);
      setTimeout(() => setCopied((c) => (c === nr ? '' : c)), 1500);
    }
  };

  const partsData = useMemo(() => {
    const results = [];
    for (const item of maintenanceItems) {
      if (!item.parts?.length) continue;
      for (const part of item.parts) {
        results.push({ ...part, itemName: item.name, category: item.category, sourceNote: item.sourceNote, intervalKm: item.intervalKm, intervalMonths: item.intervalMonths, labourHours: item.labourHours });
      }
    }
    if (search) {
      const q = search.toLowerCase();
      return results.filter((p) =>
        p.name.toLowerCase().includes(q) ||
        p.oemNumber?.toLowerCase().includes(q) ||
        p.altBrand?.toLowerCase().includes(q) ||
        p.recommendedBrand?.toLowerCase().includes(q) ||
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
          {partsData.map((part, i) => {
            const buyNr = part.oemNumber || part.altNumber;
            const brand = part.recommendedBrand || part.altBrand;
            return (
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
                    <button
                      type="button"
                      className="part-value part-oem part-copy"
                      onClick={() => copyNumber(part.oemNumber)}
                      title={t('parts.copyHint')}
                    >
                      <span>{part.oemNumber}</span>
                      <span className="part-copy-icon">{copied === part.oemNumber ? `✓ ${t('parts.copied')}` : '📋'}</span>
                    </button>
                  </div>
                )}
                {brand && (
                  <div className="part-row">
                    <span className="part-label">{t('parts.brand')}</span>
                    {part.altNumber && !brand.includes('/') ? (
                      <button
                        type="button"
                        className="part-value part-copy"
                        onClick={() => copyNumber(part.altNumber)}
                        title={t('parts.copyHint')}
                      >
                        <span>{brand} {part.altNumber}</span>
                        <span className="part-copy-icon">{copied === part.altNumber ? `✓ ${t('parts.copied')}` : '📋'}</span>
                      </button>
                    ) : (
                      <span className="part-value">{brand}</span>
                    )}
                  </div>
                )}
                {part.estimatedPrice > 0 && (
                  <div className="part-row">
                    <span className="part-label">{t('parts.price')}</span>
                    <span className="part-value">€{part.estimatedPrice.toFixed(2)}</span>
                  </div>
                )}
                {part.labourHours > 0 && (
                  <div className="part-row">
                    <span className="part-label">{t('parts.labour')}</span>
                    <span className="part-value">{t('parts.labourValue', {
                      hours: part.labourHours.toLocaleString('nl-NL'),
                      cost: Math.round(part.labourHours * labourRate),
                    })}</span>
                  </div>
                )}
                {buyNr && (
                  <div className="part-row part-shops">
                    <span className="part-label">{t('parts.buy')}</span>
                    <a href={shopUrl.winparts(buyNr)} target="_blank" rel="noopener noreferrer" className="part-shop">Winparts</a>
                    <a href={shopUrl.motointegrator(buyNr)} target="_blank" rel="noopener noreferrer" className="part-shop">Motointegrator</a>
                    {part.bmwfansUrl && (
                      <a href={part.bmwfansUrl} target="_blank" rel="noopener noreferrer" className="part-shop part-shop-muted">BMWFans</a>
                    )}
                  </div>
                )}
              </div>
              {part.sourceNote && (
                <p className="part-note">{part.sourceNote}</p>
              )}
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
