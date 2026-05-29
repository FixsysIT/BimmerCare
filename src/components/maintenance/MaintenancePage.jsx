import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import MaintenanceItem from './MaintenanceItem';
import MaintenanceModal from './MaintenanceModal';
import ItemEditor from './ItemEditor';
import { CATEGORIES, CATEGORY_ICONS, STATUS_ORDER, LAYERS, deriveLayer } from '../../utils/constants';
import { tCategory, tItem } from '../../utils/translate';
import './MaintenancePage.css';

// layer tabs — default view is "active" so the dashboard stays usable
const LAYER_TABS = [
  { key: LAYERS.ACTIVE, label: 'maintenance.layerActive' },
  { key: LAYERS.INSPECTION, label: 'maintenance.layerInspection' },
  { key: LAYERS.DIAGNOSIS, label: 'maintenance.layerDiagnosis' },
  { key: 'all', label: 'maintenance.all' },
];

export default function MaintenancePage({
  itemsWithStatus,
  currentMileage,
  registerMaintenance,
  updateItem,
  setManualStatus,
  logEvent,
  toggleDisable,
  allItems,
}) {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  // a status deep-link from the dashboard should show that status across all layers
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'all');
  const [layerTab, setLayerTab] = useState(searchParams.get('status') ? 'all' : LAYERS.ACTIVE);
  useEffect(() => {
    const s = searchParams.get('status');
    if (s) { setStatusFilter(s); setLayerTab('all'); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // pill picks open a small modal (date/mileage/note); opts carries those
  const handleLog = (item, type, result, opts = {}) => logEvent(item.id, { type, result, ...opts });
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sortBy, setSortBy] = useState('urgency');
  const [registerItem, setRegisterItem] = useState(null);
  const [editItem, setEditItem] = useState(null);
  const [showDisabled, setShowDisabled] = useState(false);

  const disabledItems = useMemo(() => {
    return (allItems || []).filter((i) => i.isDisabled);
  }, [allItems]);

  const filtered = useMemo(() => {
    let list = [...itemsWithStatus];

    if (layerTab !== 'all') {
      list = list.filter((i) => deriveLayer(i) === layerTab);
    }
    if (statusFilter !== 'all') {
      list = list.filter((i) => i.calculatedStatus.status === statusFilter);
    }
    if (categoryFilter !== 'all') {
      list = list.filter((i) => i.category === categoryFilter);
    }

    // Sort
    switch (sortBy) {
      case 'urgency':
        list.sort((a, b) => (STATUS_ORDER[a.calculatedStatus.status] ?? 9) - (STATUS_ORDER[b.calculatedStatus.status] ?? 9));
        break;
      case 'name':
        list.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'category':
        list.sort((a, b) => a.category.localeCompare(b.category));
        break;
    }

    return list;
  }, [itemsWithStatus, layerTab, statusFilter, categoryFilter, sortBy]);

  // counts per layer for the tab badges
  const layerCounts = useMemo(() => {
    const c = { active: 0, inspection: 0, diagnosis: 0, all: itemsWithStatus.length };
    itemsWithStatus.forEach((i) => { c[deriveLayer(i)] = (c[deriveLayer(i)] || 0) + 1; });
    return c;
  }, [itemsWithStatus]);

  return (
    <div className="maintenance-page">
      <h1 className="page-title">{t('maintenance.title')}</h1>

      <div className="layer-tabs">
        {LAYER_TABS.map((tabItem) => (
          <button
            key={tabItem.key}
            type="button"
            className={`layer-tab ${layerTab === tabItem.key ? 'layer-tab-active' : ''}`}
            onClick={() => setLayerTab(tabItem.key)}
          >
            {t(tabItem.label)} <span className="layer-tab-count">{layerCounts[tabItem.key] ?? 0}</span>
          </button>
        ))}
      </div>

      <div className="filter-bar">
        <div className="filter-group">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">{t('maintenance.all')}</option>
            <option value="red">{t('statusLabel.red')}</option>
            <option value="orange">{t('statusLabel.orange')}</option>
            <option value="inspect">{t('statusLabel.inspect')}</option>
            <option value="monitor">{t('statusLabel.monitor')}</option>
            <option value="green">{t('statusLabel.green')}</option>
            <option value="grey">{t('statusLabel.grey')}</option>
          </select>

          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="all">{t('maintenance.all')}</option>
            {Object.values(CATEGORIES).map((cat) => (
              <option key={cat} value={cat}>{tCategory(t, cat)}</option>
            ))}
          </select>

          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="urgency">{t('maintenance.urgency')}</option>
            <option value="name">{t('maintenance.name')}</option>
            <option value="category">{t('maintenance.category')}</option>
          </select>
        </div>
      </div>

      <div className="maintenance-list">
        {filtered.length === 0 ? (
          <p className="empty-state">{t('maintenance.noItems')}</p>
        ) : (
          filtered.map((item) => (
            <MaintenanceItem
              key={item.id}
              item={item}
              onRegister={() => setRegisterItem(item)}
              onEdit={() => setEditItem(item)}
              onLog={handleLog}
              currentMileage={currentMileage}
              onSetBaseline={(state) => updateItem(item.id, { baselineState: state })}
            />
          ))
        )}
      </div>

      {disabledItems.length > 0 && (
        <div className="disabled-section">
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setShowDisabled(!showDisabled)}
            style={{ marginBottom: '0.5rem' }}
          >
            {showDisabled ? '▼' : '▶'} {t('maintenance.disabled')} ({disabledItems.length})
          </button>
          {showDisabled && (
            <div className="disabled-list">
              {disabledItems.map((item) => (
                <div key={item.id} className="card disabled-item">
                  <div className="disabled-left">
                    <span>{CATEGORY_ICONS[item.category] || '🔧'}</span>
                    <div>
                      <span className="disabled-name">{tItem(t, item.name)}</span>
                      <span className="disabled-cat">{tCategory(t, item.category)}</span>
                    </div>
                  </div>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => toggleDisable(item.id)}
                  >
                    ↩ Enable
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {registerItem && (
        <MaintenanceModal
          isOpen={!!registerItem}
          onClose={() => setRegisterItem(null)}
          item={registerItem}
          currentMileage={currentMileage}
          onSave={(entry) => {
            registerMaintenance(registerItem.id, entry);
            setRegisterItem(null);
          }}
        />
      )}

      {editItem && (
        <ItemEditor
          isOpen={!!editItem}
          onClose={() => setEditItem(null)}
          item={editItem}
          onSave={(updates) => {
            updateItem(editItem.id, updates);
            setEditItem(null);
          }}
          onToggleDisable={() => {
            toggleDisable(editItem.id);
            setEditItem(null);
          }}
        />
      )}

    </div>
  );
}
