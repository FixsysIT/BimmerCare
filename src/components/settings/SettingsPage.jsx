import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from '../shared/Modal';
import ConfirmDialog from '../shared/ConfirmDialog';
import {
  validateImportData, readFileAsText, downloadJSON,
  generateIntervalsCSV, generatePartsCSV, downloadCSV,
  parseEditableCSV, applyCSVEdits,
  generateItemsExport, generateHistoryExport, generateDebugExport,
  generateChecklist, downloadText,
} from '../../utils/dataExport';
import { inspectionPackages } from '../../data/inspectionPackages';
import { getDefaultItems } from '../../data/defaultItems';
import { mergeDefaultItems } from '../../utils/mergeDefaults';
import { CATALOG_VERSION } from '../../utils/constants';
import { INTERVAL_TYPES, CATEGORIES } from '../../utils/constants';
import './SettingsPage.css';

export default function SettingsPage({
  vehicle,
  updateProfile,
  settings,
  setSettings,
  exportBackup,
  lastBackup,
  shouldRemind,
  setVehicle,
  setItems,
  maintenanceItems,
  resetToDefaults,
  addItem,
  startBaseline,
  statusEvents = [],
}) {
  const { t, i18n } = useTranslation();
  const fileRef = useRef(null);
  const csvRef = useRef(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmBaseline, setConfirmBaseline] = useState(false);
  const [mergePreview, setMergePreview] = useState(null);
  const [importPreview, setImportPreview] = useState(null);
  const [importError, setImportError] = useState('');
  const [csvPreview, setCsvPreview] = useState(null);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [toast, setToast] = useState('');

  // Profile form
  const [profile, setProfile] = useState({
    model: vehicle?.model || '',
    engine: vehicle?.engine || '',
    year: vehicle?.year || '',
    plate: vehicle?.plate || '',
    vin: vehicle?.vin || '',
    odometerAtPurchase: vehicle?.odometerAtPurchase || '',
  });

  // New item form
  const [newItem, setNewItem] = useState({
    name: '',
    category: 'Motor',
    intervalType: 'km-dominant',
    intervalKm: '',
    intervalMonths: '',
    warningKm: '',
    warningDays: '',
    source: 'custom',
    priority: 'preventive',
  });

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const handleProfileSave = () => {
    updateProfile({
      model: profile.model,
      engine: profile.engine,
      year: parseInt(profile.year, 10) || vehicle.year,
      plate: profile.plate,
      vin: profile.vin,
      odometerAtPurchase: parseInt(profile.odometerAtPurchase, 10) || vehicle.odometerAtPurchase,
    });
    showToast('Profile saved');
  };

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await readFileAsText(file);
      const result = validateImportData(text);
      if (!result.valid) {
        setImportError(result.errors.join(', '));
        return;
      }
      setImportPreview(result.data);
      setImportError('');
    } catch {
      setImportError('Could not read file');
    }
    e.target.value = '';
  };

  const applyImport = () => {
    if (!importPreview) return;
    setVehicle(importPreview.vehicle);
    setItems(importPreview.maintenanceItems);
    if (importPreview.settings) setSettings(importPreview.settings);
    setImportPreview(null);
    showToast('Data imported');
  };

  // ── CSV round-trip ──────────────────────────────────────────
  const dateStr = new Date().toISOString().split('T')[0];

  const handleExportIntervals = () => {
    downloadCSV(generateIntervalsCSV(maintenanceItems || [], t), `bimmercare-intervals-${dateStr}.csv`);
    showToast(t('settings.csvExported', 'CSV geëxporteerd'));
  };

  const handleExportParts = () => {
    downloadCSV(generatePartsCSV(maintenanceItems || []), `bimmercare-parts-${dateStr}.csv`);
    showToast(t('settings.csvExported', 'CSV geëxporteerd'));
  };

  const handleCSVImport = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    try {
      const parsed = await Promise.all(files.map(async (f) => parseEditableCSV(await readFileAsText(f))));
      if (parsed.every((p) => p.kind === 'unknown')) {
        setImportError(t('settings.csvUnknownFiles', 'Geen geldig BimmerCare CSV-bestand herkend.'));
        return;
      }
      const result = applyCSVEdits(maintenanceItems || [], parsed);
      setImportError('');
      setCsvPreview(result);
    } catch {
      setImportError('Could not read CSV file');
    }
  };

  const handleExportItems = () => {
    downloadJSON(generateItemsExport(maintenanceItems || []), `bimmercare-items-${dateStr}.json`);
    showToast(t('settings.exported', 'Geëxporteerd'));
  };
  const handleExportHistory = () => {
    downloadJSON(generateHistoryExport(maintenanceItems || []), `bimmercare-history-${dateStr}.json`);
    showToast(t('settings.exported', 'Geëxporteerd'));
  };
  const handleExportDebug = () => {
    downloadJSON(generateDebugExport(vehicle, maintenanceItems || [], settings, statusEvents), `bimmercare-debug-${dateStr}.json`);
    showToast(t('settings.exported', 'Geëxporteerd'));
  };

  // ── Catalog merge (non-destructive upgrade) ─────────────────
  const handleMergePreview = () => {
    const defaults = getDefaultItems(vehicle?.vehicleId || 'merge');
    const res = mergeDefaultItems(maintenanceItems || [], defaults);
    setMergePreview({
      ...res,
      currentCount: (maintenanceItems || []).length,
      defaultCount: defaults.length,
    });
  };
  const applyMerge = () => {
    if (!mergePreview) return;
    setItems(mergePreview.items);
    setSettings({ ...settings, catalogVersionApplied: CATALOG_VERSION });
    setMergePreview(null);
    showToast(t('settings.catalogUpdated', 'Catalogus bijgewerkt'));
  };
  const handleExportChecklist = () => {
    downloadText(generateChecklist(inspectionPackages, vehicle), `bimmercare-checklist-${dateStr}.md`);
    showToast(t('settings.exported', 'Geëxporteerd'));
  };

  const applyCSVImport = () => {
    if (!csvPreview) return;
    setItems(csvPreview.items);
    setCsvPreview(null);
    showToast(t('settings.csvImported', 'CSV geïmporteerd'));
  };

  const handleAddItem = () => {
    addItem({
      name: newItem.name,
      category: newItem.category,
      intervalType: newItem.intervalType,
      intervalKm: newItem.intervalKm ? parseInt(newItem.intervalKm, 10) : null,
      intervalMonths: newItem.intervalMonths ? parseInt(newItem.intervalMonths, 10) : null,
      warningKm: newItem.warningKm ? parseInt(newItem.warningKm, 10) : null,
      warningDays: newItem.warningDays ? parseInt(newItem.warningDays, 10) : null,
      source: newItem.source,
      priority: newItem.priority,
      conditionBased: newItem.intervalType === 'condition',
      isRecurring: true,
      isDisabled: false,
      dateBehavior: 'hard',
      manualStatus: null,
      manualStatusNote: null,
      sourceNote: '',
    });
    setAddModalOpen(false);
    setNewItem({ name: '', category: 'Motor', intervalType: 'km-dominant', intervalKm: '', intervalMonths: '', warningKm: '', warningDays: '', source: 'custom', priority: 'preventive' });
    showToast('Item added');
  };

  const toggleLang = () => {
    const newLang = i18n.language === 'en' ? 'nl' : 'en';
    i18n.changeLanguage(newLang);
    localStorage.setItem('bimmercare_language', newLang);
  };

  return (
    <div className="settings-page">
      <h1 className="page-title">{t('settings.title')}</h1>

      {toast && <div className="toast">{toast}</div>}

      {/* Vehicle Profile */}
      <div className="card settings-section">
        <h3 className="section-title">{t('settings.profile')}</h3>
        <div className="form">
          <div className="form-row">
            <div className="form-group">
              <label>{t('settings.model')}</label>
              <input value={profile.model} onChange={(e) => setProfile({ ...profile, model: e.target.value })} />
            </div>
            <div className="form-group">
              <label>{t('settings.engine')}</label>
              <input value={profile.engine} onChange={(e) => setProfile({ ...profile, engine: e.target.value })} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>{t('settings.year')}</label>
              <input type="number" value={profile.year} onChange={(e) => setProfile({ ...profile, year: e.target.value })} />
            </div>
            <div className="form-group">
              <label>{t('settings.plate')}</label>
              <input value={profile.plate} onChange={(e) => setProfile({ ...profile, plate: e.target.value })} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>{t('settings.vin')}</label>
              <input value={profile.vin} onChange={(e) => setProfile({ ...profile, vin: e.target.value })} />
            </div>
            <div className="form-group">
              <label>{t('settings.purchaseKm')}</label>
              <input type="number" value={profile.odometerAtPurchase} onChange={(e) => setProfile({ ...profile, odometerAtPurchase: e.target.value })} />
            </div>
          </div>
          <button className="btn btn-primary" onClick={handleProfileSave}>{t('settings.save')}</button>
        </div>
      </div>

      {/* Language */}
      <div className="card settings-section">
        <h3 className="section-title">{t('settings.language')}</h3>
        <button className="btn btn-secondary" onClick={toggleLang}>
          {i18n.language === 'en' ? '🇳🇱 Switch to Nederlands' : '🇬🇧 Switch to English'}
        </button>
      </div>

      {/* Data Management */}
      <div className="card settings-section">
        <h3 className="section-title">{t('settings.data')}</h3>
        <div className={`backup-status ${shouldRemind ? 'backup-due' : ''}`}>
          <span className="backup-status-label">{t('dashboard.lastBackup')}</span>
          <span className="backup-status-date">
            {lastBackup ? new Date(lastBackup).toLocaleDateString() : t('dashboard.noBackup')}
          </span>
          {shouldRemind && <span className="backup-status-pill">{t('dashboard.backupReminder', 'Backup aanbevolen')}</span>}
        </div>
        <div className="settings-actions">
          <button className="btn btn-primary" onClick={exportBackup}>📥 {t('settings.export')}</button>
          <button className="btn btn-secondary" onClick={() => fileRef.current?.click()}>📤 {t('settings.import')}</button>
          <input ref={fileRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleImport} />
        </div>
        {importError && <p className="form-error">{importError}</p>}

        <div className="settings-toggle">
          <label className="toggle-label">
            <input
              type="checkbox"
              checked={settings?.autoBackupEnabled || false}
              onChange={(e) => setSettings({ ...settings, autoBackupEnabled: e.target.checked })}
            />
            <span>{t('settings.autoBackup')}</span>
          </label>
          <span className="toggle-desc">{t('settings.autoBackupDesc')}</span>
        </div>
      </div>

      {/* Export / Debug */}
      <div className="card settings-section">
        <h3 className="section-title">{t('settings.exportDebug', 'Export / Debug')}</h3>
        <p className="settings-hint">{t('settings.exportDebugHint', 'Read-only snapshots. Wijzigen niets. Debug JSON bevat km, items, historie, berekende statussen en baseline.')}</p>
        <div className="settings-actions">
          <button className="btn btn-secondary" onClick={handleExportItems}>🧩 {t('settings.exportItems', 'Items')}</button>
          <button className="btn btn-secondary" onClick={handleExportHistory}>📜 {t('settings.exportHistory', 'Historie')}</button>
          <button className="btn btn-secondary" onClick={handleExportDebug}>🐞 {t('settings.exportDebugBtn', 'Debug JSON')}</button>
          <button className="btn btn-secondary" onClick={handleExportChecklist}>🧾 {t('settings.exportChecklist', 'Garage checklist')}</button>
        </div>
      </div>

      {/* Catalog update (non-destructive) */}
      <div className="card settings-section">
        <h3 className="section-title">{t('settings.catalogUpdate', 'Catalogus bijwerken')}</h3>
        <p className="settings-hint">
          {t('settings.catalogHint', 'Voegt nieuwe standaard-items + ontbrekende metadata toe aan je bestaande lijst. Onderhoudshistorie, statussen en je eigen wijzigingen blijven ongemoeid.')}
        </p>
        <p className="settings-hint" style={{ margin: 0 }}>
          {t('settings.catalogVersion', 'Catalogusversie')}: <strong>{CATALOG_VERSION}</strong>
          {settings?.catalogVersionApplied ? ` · ${t('settings.catalogApplied', 'toegepast')}: ${settings.catalogVersionApplied}` : ''}
        </p>
        <div className="settings-actions">
          <button className="btn btn-secondary" onClick={handleMergePreview}>🔍 {t('settings.preview', 'Preview')}</button>
        </div>
      </div>

      {/* Edit via CSV */}
      <div className="card settings-section">
        <h3 className="section-title">{t('settings.editCsv', 'Bewerk via CSV')}</h3>
        <p className="settings-hint">
          {t('settings.csvHint', 'Exporteer als CSV, pas km/maanden/strategie/kosten aan in Excel, Sheets of een andere LLM, en importeer terug. Bovenin elk bestand staat een legenda die uitlegt wat elke kolom en waarde betekent. Items worden gekoppeld op id — die kolom niet wijzigen.')}
        </p>
        <div className="settings-actions">
          <button className="btn btn-secondary" onClick={handleExportIntervals}>📊 {t('settings.csvIntervals', 'Intervallen CSV')}</button>
          <button className="btn btn-secondary" onClick={handleExportParts}>🔩 {t('settings.csvParts', 'Onderdelen CSV')}</button>
          <button className="btn btn-primary" onClick={() => csvRef.current?.click()}>📤 {t('settings.csvImport', 'Importeer CSV')}</button>
          <input ref={csvRef} type="file" accept=".csv" multiple style={{ display: 'none' }} onChange={handleCSVImport} />
        </div>
      </div>

      {/* Maintenance Items */}
      <div className="card settings-section">
        <h3 className="section-title">{t('settings.editIntervals')}</h3>
        <p className="settings-hint">{t('settings.baselineDesc')}</p>
        <div className="settings-actions">
          <button className="btn btn-primary" onClick={() => setAddModalOpen(true)}>➕ {t('settings.addItem')}</button>
          <button className="btn btn-secondary" onClick={() => setConfirmBaseline(true)}>📍 {t('settings.baseline')}</button>
          <button className="btn btn-danger" onClick={() => setConfirmReset(true)}>🔄 {t('settings.resetDefaults')}</button>
        </div>
      </div>

      {/* JSON import preview modal */}
      {importPreview && (
        <Modal isOpen={true} onClose={() => setImportPreview(null)} title="Import Preview" size="medium">
          <p style={{ color: 'var(--text-secondary)' }}>
            Vehicle: {importPreview.vehicle?.model} — {importPreview.vehicle?.currentMileage?.toLocaleString()} km<br />
            Items: {importPreview.maintenanceItems?.length}<br />
            Export date: {importPreview.exportDate}
          </p>
          <p style={{ color: 'var(--status-orange)', fontSize: '0.875rem' }}>
            ⚠️ This will replace all current data.
          </p>
          <div className="form-actions">
            <button className="btn btn-ghost" onClick={() => setImportPreview(null)}>{t('common.cancel')}</button>
            <button className="btn btn-primary" onClick={applyImport}>{t('common.confirm')}</button>
          </div>
        </Modal>
      )}

      {/* CSV import preview modal */}
      {csvPreview && (
        <Modal isOpen={true} onClose={() => setCsvPreview(null)} title={t('settings.csvImport', 'Importeer CSV')} size="medium">
          <p style={{ color: 'var(--text-secondary)' }}>
            {t('settings.csvIntervalsUpdated', 'Intervallen bijgewerkt')}: {csvPreview.intervalsUpdated}<br />
            {t('settings.csvPartsUpdated', 'Onderdelenlijsten bijgewerkt')}: {csvPreview.partsUpdated}
          </p>
          {csvPreview.unknownFiles > 0 && (
            <p style={{ color: 'var(--status-orange)', fontSize: '0.875rem' }}>
              ⚠️ {csvPreview.unknownFiles} {t('settings.csvUnknownSkipped', 'bestand(en) niet herkend en overgeslagen.')}
            </p>
          )}
          {csvPreview.intervalsUpdated === 0 && csvPreview.partsUpdated === 0 && (
            <p style={{ color: 'var(--status-orange)', fontSize: '0.875rem' }}>
              ⚠️ {t('settings.csvNoMatch', 'Geen ID-overeenkomsten gevonden — niets om bij te werken.')}
            </p>
          )}
          <div className="form-actions">
            <button className="btn btn-ghost" onClick={() => setCsvPreview(null)}>{t('common.cancel')}</button>
            <button
              className="btn btn-primary"
              onClick={applyCSVImport}
              disabled={csvPreview.intervalsUpdated === 0 && csvPreview.partsUpdated === 0}
            >
              {t('common.confirm')}
            </button>
          </div>
        </Modal>
      )}

      {/* Catalog merge preview modal */}
      {mergePreview && (
        <Modal isOpen={true} onClose={() => setMergePreview(null)} title={t('settings.catalogUpdate', 'Catalogus bijwerken')} size="medium">
          <p style={{ color: 'var(--text-secondary)' }}>
            {t('settings.catalogCurrent', 'Huidige items')}: {mergePreview.currentCount}<br />
            {t('settings.catalogDefault', 'Standaard items')}: {mergePreview.defaultCount}<br />
            {t('settings.catalogNew', 'Nieuwe items toevoegen')}: <strong>{mergePreview.addedCount}</strong><br />
            {t('settings.catalogMeta', 'Items met aangevulde metadata')}: <strong>{mergePreview.metadataFilled}</strong>
          </p>
          {mergePreview.addedCount > 0 && (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              + {mergePreview.added.join(', ')}
            </p>
          )}
          <p style={{ color: 'var(--status-green)', fontSize: '0.85rem' }}>
            ✓ {t('settings.catalogSafe', 'Onderhoudshistorie wordt niet aangepast.')}
          </p>
          <div className="form-actions">
            <button className="btn btn-ghost" onClick={() => setMergePreview(null)}>{t('common.cancel')}</button>
            <button
              className="btn btn-primary"
              onClick={applyMerge}
              disabled={mergePreview.addedCount === 0 && mergePreview.metadataFilled === 0}
            >
              {t('settings.catalogUpdate', 'Catalogus bijwerken')}
            </button>
          </div>
        </Modal>
      )}

      {/* Add item modal */}
      <Modal isOpen={addModalOpen} onClose={() => setAddModalOpen(false)} title={t('settings.addItem')} size="medium">
        <div className="form">
          <div className="form-group">
            <label>Name</label>
            <input value={newItem.name} onChange={(e) => setNewItem({ ...newItem, name: e.target.value })} required />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Category</label>
              <select value={newItem.category} onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}>
                {Object.values(CATEGORIES).map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Interval Type</label>
              <select value={newItem.intervalType} onChange={(e) => setNewItem({ ...newItem, intervalType: e.target.value })}>
                {Object.values(INTERVAL_TYPES).map((it) => <option key={it} value={it}>{it}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Interval KM</label>
              <input type="number" value={newItem.intervalKm} onChange={(e) => setNewItem({ ...newItem, intervalKm: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Interval Months</label>
              <input type="number" value={newItem.intervalMonths} onChange={(e) => setNewItem({ ...newItem, intervalMonths: e.target.value })} />
            </div>
          </div>
          <div className="form-actions">
            <button className="btn btn-ghost" onClick={() => setAddModalOpen(false)}>{t('common.cancel')}</button>
            <button className="btn btn-primary" onClick={handleAddItem} disabled={!newItem.name}>{t('common.save')}</button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={confirmReset}
        onClose={() => setConfirmReset(false)}
        onConfirm={resetToDefaults}
        title={t('settings.resetDefaults')}
        message={t('settings.resetConfirm')}
      />

      <ConfirmDialog
        isOpen={confirmBaseline}
        onClose={() => setConfirmBaseline(false)}
        onConfirm={() => {
          const n = startBaseline?.(vehicle?.currentMileage);
          showToast(t('settings.baselineDone', { n: n ?? 0 }));
        }}
        title={t('settings.baseline')}
        message={t('settings.baselineConfirm', { km: (vehicle?.currentMileage || 0).toLocaleString() })}
      />
    </div>
  );
}
