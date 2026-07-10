import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { CATEGORY_ICONS, LABOUR_RATE_EXCL_BTW } from '../../utils/constants';
import { tItem, tPartName, tPartInfo, tItemNote } from '../../utils/translate';
import { copyToClipboard } from '../../utils/dataExport';
import './PartsPage.css';

// Shop deep-links: prefill the search with the part number so Saddik can order himself.
// Winparts uses ?zoek= (confirmed July 2026 — ?q= was ignored), Motointegrator ?phrase=.
const shopUrl = {
  winparts: (nr) => `https://www.winparts.nl/zoekresultaten?zoek=${encodeURIComponent(nr)}`,
  motointegrator: (nr) => `https://www.motointegrator.nl/producten/?phrase=${encodeURIComponent(nr)}`,
};

// Cross-item blocks: separate catalog items whose parts belong together on the
// shopping page (you order/replace them in one go). Key = block id, members =
// exact item names, title = i18n block header.
const PART_BLOCKS = [
  {
    id: 'ignition',
    members: ['Spark Plugs (×6)', 'Ignition Coils (×6)'],
    title: { nl: 'Ontsteking · bougies + bobines', en: 'Ignition · plugs + coils' },
  },
];
const blockIdOf = (itemName) => PART_BLOCKS.find((b) => b.members.includes(itemName))?.id || null;

export default function PartsPage({ maintenanceItems, settings }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language?.startsWith('en') ? 'en' : 'nl';
  const [search, setSearch] = useState('');
  const [copied, setCopied] = useState('');
  const labourRate = Number(settings?.labourRateExclBtw) > 0 ? Number(settings.labourRateExclBtw) : LABOUR_RATE_EXCL_BTW;

  const copyNumber = async (nr) => {
    if (await copyToClipboard(nr)) {
      setCopied(nr);
      setTimeout(() => setCopied((c) => (c === nr ? '' : c)), 1500);
    }
  };

  // Build ordered groups: one block per maintenance item (its parts together),
  // except items linked in a PART_BLOCK which merge into one shared block.
  const groups = useMemo(() => {
    const byKey = new Map(); // key -> group
    for (const item of maintenanceItems) {
      if (item.isDisabled || !item.parts?.length) continue;
      const blockId = blockIdOf(item.name);
      const key = blockId || item.name;
      if (!byKey.has(key)) {
        const block = blockId ? PART_BLOCKS.find((b) => b.id === blockId) : null;
        byKey.set(key, {
          key,
          block,
          category: item.category,
          // representative meta for a single-item group (interval/note); blocks skip it
          itemName: block ? null : item.name,
          intervalKm: block ? null : item.intervalKm,
          intervalMonths: block ? null : item.intervalMonths,
          bmwIntervalKm: block ? null : item.bmwIntervalKm,
          bmwIntervalMonths: block ? null : item.bmwIntervalMonths,
          communityIntervalKm: block ? null : item.communityIntervalKm,
          communityIntervalMonths: block ? null : item.communityIntervalMonths,
          strategy: item.replacementStrategy,
          multiItem: !!block,
          parts: [],
        });
      }
      const g = byKey.get(key);
      for (const part of item.parts) {
        g.parts.push({ ...part, itemName: item.name, labourHours: item.labourHours });
      }
    }

    let list = [...byKey.values()];

    if (search) {
      const q = search.toLowerCase();
      list = list
        .map((g) => {
          const parts = g.parts.filter((p) =>
            tPartName(t, p.name).toLowerCase().includes(q) ||
            p.name.toLowerCase().includes(q) ||
            p.oemNumber?.toLowerCase().includes(q) ||
            p.altBrand?.toLowerCase().includes(q) ||
            p.recommendedBrand?.toLowerCase().includes(q) ||
            tItem(t, g.itemName || '').toLowerCase().includes(q) ||
            g.parts.some((x) => x.itemName.toLowerCase().includes(q))
          );
          return { ...g, parts };
        })
        .filter((g) => g.parts.length);
    }
    return list;
  }, [maintenanceItems, search, t]);

  const groupTitle = (g) => (g.block ? (g.block.title[lang] || g.block.title.nl) : tItem(t, g.itemName));
  const totalParts = groups.reduce((n, g) => n + g.parts.length, 0);

  // "How often to replace" line, derived from item data. BMW vs community
  // interval when they differ; otherwise the single interval. Condition /
  // on-failure items have no interval → replace on wear/failure.
  const intervalStr = (km, mo) => {
    const p = [];
    if (km) p.push(`${km.toLocaleString()} km`);
    if (mo) p.push(`${mo} ${t('common.months')}`);
    return p.join(' / ');
  };
  const replaceFreq = (g) => {
    const bmw = intervalStr(g.bmwIntervalKm, g.bmwIntervalMonths);
    const comm = intervalStr(g.communityIntervalKm, g.communityIntervalMonths);
    const own = intervalStr(g.intervalKm, g.intervalMonths);
    if (bmw && comm && bmw !== comm) return `${t('parts.freqBmw')} ${bmw} · ${t('parts.freqAdvice')} ${comm}`;
    const single = comm || own || bmw;
    if (single) return single;
    if (g.strategy === 'condition') return t('parts.freqCondition');
    if (g.strategy === 'on-failure') return t('parts.freqOnFailure');
    return '';
  };

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

      {totalParts === 0 ? (
        <p className="empty-state">{t('parts.noParts')}</p>
      ) : (
        <div className="parts-groups">
          {groups.map((g) => {
            const note = g.itemName ? tItemNote(t, g.itemName) : '';
            const freq = g.multiItem ? '' : replaceFreq(g);
            return (
              <section key={g.key} className="part-group">
                <header className="part-group-head">
                  <span className="part-icon">{CATEGORY_ICONS[g.category] || '⚙️'}</span>
                  <div>
                    <span className="part-group-title">{groupTitle(g)}</span>
                    {freq && (
                      <span className="part-group-meta">
                        <span className="part-group-freq-label">{t('parts.replaceEvery')}</span> {freq}
                      </span>
                    )}
                  </div>
                </header>
                {note && <p className="part-group-note">{note}</p>}

                <div className="part-group-parts">
                  {g.parts.map((part, i) => {
                    const buyNr = part.oemNumber || part.altNumber;
                    const brand = part.recommendedBrand || part.altBrand;
                    const info = tPartInfo(t, part.name);
                    return (
                      <div key={`${part.oemNumber || part.name}-${i}`} className="card part-card">
                        <div className="part-header">
                          <span className="part-name">{tPartName(t, part.name)}</span>
                          {g.multiItem && <span className="part-for">{tItem(t, part.itemName)}</span>}
                        </div>
                        {info && <p className="part-info">{info}</p>}
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
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
