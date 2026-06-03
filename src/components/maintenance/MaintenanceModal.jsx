import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from '../shared/Modal';

export default function MaintenanceModal({ isOpen, onClose, item, currentMileage, onSave }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    mileage: currentMileage || 0,
    garage: '',
    cost: item?.estimatedTotalCost ? String(item.estimatedTotalCost) : '',
    receiptRef: '',
    receiptLink: '',
    notes: '',
  });

  const update = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      date: form.date,
      mileage: parseInt(form.mileage, 10),
      garage: form.garage,
      cost: parseFloat(form.cost) || 0,
      receiptRef: form.receiptRef,
      receiptLink: form.receiptLink,
      notes: form.notes,
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`${t('register.title')} — ${item.name}`} size="large">
      <form onSubmit={handleSubmit} className="form">
        <div className="form-row">
          <div className="form-group">
            <label>{t('register.date')}</label>
            <input type="date" value={form.date} onChange={(e) => update('date', e.target.value)} required />
          </div>
          <div className="form-group">
            <label>{t('register.mileage')}</label>
            <input type="number" value={form.mileage} onChange={(e) => update('mileage', e.target.value)} required />
          </div>
        </div>

        <div className="form-group">
          <label>{t('register.garage')}</label>
          <input type="text" value={form.garage} onChange={(e) => update('garage', e.target.value)} />
        </div>

        <div className="form-group">
          <label>{t('register.cost')}</label>
          <input type="number" step="0.01" value={form.cost} onChange={(e) => update('cost', e.target.value)} placeholder="0.00" />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>{t('register.receiptRef')}</label>
            <input type="text" value={form.receiptRef} onChange={(e) => update('receiptRef', e.target.value)} />
          </div>
          <div className="form-group">
            <label>{t('register.receiptLink')}</label>
            <input type="url" value={form.receiptLink} onChange={(e) => update('receiptLink', e.target.value)} placeholder="https://..." />
          </div>
        </div>

        <div className="form-group">
          <label>{t('register.notes')}</label>
          <textarea value={form.notes} onChange={(e) => update('notes', e.target.value)} rows={3} />
        </div>

        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>{t('register.cancel')}</button>
          <button type="submit" className="btn btn-primary">{t('register.save')}</button>
        </div>
      </form>
    </Modal>
  );
}
