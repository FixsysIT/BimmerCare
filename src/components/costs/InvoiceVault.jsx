import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { v4 as uuidv4 } from 'uuid';
import { useStorage } from '../../hooks/useStorage';
import { STORAGE_KEYS } from '../../utils/constants';

/* PDF-factuurkluis. Bestanden gaan als Blob in localforage (IndexedDB) —
   volledig lokaal, geen server. De metadata (naam/datum/size) staat in
   dezelfde records; bekijken opent een object-URL in een nieuw tabblad.
   Let op: dit leeft in de browserdata van dit apparaat. De JSON-backup
   bevat GEEN facturen (te groot) — origineel dus ook zelf bewaren. */
export default function InvoiceVault() {
  const { t, i18n } = useTranslation();
  const [invoices, setInvoices] = useStorage(STORAGE_KEYS.INVOICES, []);
  const fileRef = useRef(null);

  const addFiles = (fileList) => {
    const files = [...fileList].filter((f) => f.type === 'application/pdf');
    if (!files.length) return;
    const added = files.map((f) => ({
      id: uuidv4(),
      name: f.name,
      size: f.size,
      addedAt: new Date().toISOString(),
      blob: f,
    }));
    setInvoices((prev) => [...added, ...(prev || [])]);
    if (fileRef.current) fileRef.current.value = '';
  };

  const view = (inv) => {
    const url = URL.createObjectURL(inv.blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

  const download = (inv) => {
    const url = URL.createObjectURL(inv.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = inv.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

  const remove = (inv) => {
    if (!window.confirm(t('invoices.confirmDelete', { name: inv.name }))) return;
    setInvoices((prev) => (prev || []).filter((i) => i.id !== inv.id));
  };

  const fmtSize = (b) => (b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.round(b / 1024)} kB`);
  const fmtDate = (iso) => new Date(iso).toLocaleDateString(i18n.language?.startsWith('nl') ? 'nl-NL' : 'en-GB');

  return (
    <div className="card">
      <div className="invoice-header">
        <h3 className="section-title">{t('invoices.title')}</h3>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => fileRef.current?.click()}>
          + {t('invoices.upload')}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf"
          multiple
          style={{ display: 'none' }}
          onChange={(e) => addFiles(e.target.files)}
        />
      </div>

      {(invoices || []).length === 0 ? (
        <p className="empty-state">{t('invoices.empty')}</p>
      ) : (
        <div className="invoice-list">
          {invoices.map((inv) => (
            <div key={inv.id} className="invoice-row">
              <span className="invoice-name" title={inv.name}>📄 {inv.name}</span>
              <span className="invoice-meta">{fmtDate(inv.addedAt)} · {fmtSize(inv.size)}</span>
              <span className="invoice-actions">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => view(inv)}>{t('invoices.view')}</button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => download(inv)}>↓</button>
                <button type="button" className="btn btn-ghost btn-sm invoice-delete" onClick={() => remove(inv)}>×</button>
              </span>
            </div>
          ))}
        </div>
      )}

      <p className="invoice-note">{t('invoices.storedLocal')}</p>
    </div>
  );
}
