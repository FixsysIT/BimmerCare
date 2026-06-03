import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from '../shared/Modal';

/* Lightweight log modal for condition/diagnosis quick actions.
   Captures date (backdatable) + mileage + optional note, then logs the
   already-chosen result. Prefilled with today / current odometer. */
export default function EventLogModal({ isOpen, onClose, item, currentMileage, resultLabel, onSave, initial, noteOnly = false }) {
  const { t } = useTranslation();
  const [date, setDate] = useState(initial?.date || new Date().toISOString().split('T')[0]);
  const [mileage, setMileage] = useState(initial?.mileage ?? currentMileage ?? 0);
  const [cost, setCost] = useState(initial?.cost != null ? String(initial.cost) : '');
  const [note, setNote] = useState(initial?.notes || '');

  if (!isOpen) return null;

  const submit = (e) => {
    e.preventDefault();
    onSave({ date, mileage: parseInt(mileage, 10) || 0, cost: parseFloat(cost) || 0, note });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`${resultLabel} — ${item.name}`} size="medium">
      <form onSubmit={submit} className="form">
        <div className="form-row">
          <div className="form-group">
            <label>{t('register.date')}</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>{t('register.mileage')}</label>
            <input type="number" value={mileage} onChange={(e) => setMileage(e.target.value)} required />
          </div>
        </div>
        {!noteOnly && (
          <div className="form-group">
            <label>{t('register.cost')}</label>
            <input type="number" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="0.00" />
          </div>
        )}
        <div className="form-group">
          <label>{t('register.notes')}</label>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
        </div>
        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>{t('register.cancel')}</button>
          <button type="submit" className="btn btn-primary">{t('register.save')}</button>
        </div>
      </form>
    </Modal>
  );
}
