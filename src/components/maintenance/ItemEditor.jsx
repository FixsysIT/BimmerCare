import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from '../shared/Modal';
import { INTERVAL_TYPES, PRIORITIES, CATEGORIES } from '../../utils/constants';

export default function ItemEditor({ isOpen, onClose, item, onSave, onToggleDisable }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    name: item.name,
    category: item.category,
    intervalType: item.intervalType,
    intervalKm: item.intervalKm || '',
    intervalMonths: item.intervalMonths || '',
    warningKm: item.warningKm || '',
    warningDays: item.warningDays || '',
    source: item.source,
    sourceNote: item.sourceNote || '',
    priority: item.priority,
    dateBehavior: item.dateBehavior || 'hard',
  });

  const update = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      name: form.name,
      category: form.category,
      intervalType: form.intervalType,
      intervalKm: form.intervalKm ? parseInt(form.intervalKm, 10) : null,
      intervalMonths: form.intervalMonths ? parseInt(form.intervalMonths, 10) : null,
      warningKm: form.warningKm ? parseInt(form.warningKm, 10) : null,
      warningDays: form.warningDays ? parseInt(form.warningDays, 10) : null,
      source: form.source,
      sourceNote: form.sourceNote,
      priority: form.priority,
      dateBehavior: form.dateBehavior,
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`${t('maintenance.edit')} — ${item.name}`} size="large">
      <form onSubmit={handleSubmit} className="form">
        <div className="form-row">
          <div className="form-group">
            <label>{t('maintenance.name')}</label>
            <input type="text" value={form.name} onChange={(e) => update('name', e.target.value)} required />
          </div>
          <div className="form-group">
            <label>{t('maintenance.category')}</label>
            <select value={form.category} onChange={(e) => update('category', e.target.value)}>
              {Object.values(CATEGORIES).map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Interval Type</label>
            <select value={form.intervalType} onChange={(e) => update('intervalType', e.target.value)}>
              {Object.entries(INTERVAL_TYPES).map(([, v]) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Priority</label>
            <select value={form.priority} onChange={(e) => update('priority', e.target.value)}>
              {Object.entries(PRIORITIES).map(([, v]) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Interval KM</label>
            <input type="number" value={form.intervalKm} onChange={(e) => update('intervalKm', e.target.value)} />
          </div>
          <div className="form-group">
            <label>Interval Months</label>
            <input type="number" value={form.intervalMonths} onChange={(e) => update('intervalMonths', e.target.value)} />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Warning KM</label>
            <input type="number" value={form.warningKm} onChange={(e) => update('warningKm', e.target.value)} />
          </div>
          <div className="form-group">
            <label>Warning Days</label>
            <input type="number" value={form.warningDays} onChange={(e) => update('warningDays', e.target.value)} />
          </div>
        </div>

        <div className="form-group">
          <label>Source Note</label>
          <textarea value={form.sourceNote} onChange={(e) => update('sourceNote', e.target.value)} rows={2} />
        </div>

        <div className="form-actions">
          <button type="button" className="btn btn-danger btn-sm" onClick={onToggleDisable}>
            {item.isDisabled ? 'Enable' : 'Disable'}
          </button>
          <div style={{ flex: 1 }} />
          <button type="button" className="btn btn-ghost" onClick={onClose}>{t('common.cancel')}</button>
          <button type="submit" className="btn btn-primary">{t('common.save')}</button>
        </div>
      </form>
    </Modal>
  );
}
