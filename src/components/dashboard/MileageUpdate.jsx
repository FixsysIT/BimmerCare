import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from '../shared/Modal';

export default function MileageUpdate({ isOpen, onClose, currentKm, onUpdate }) {
  const { t } = useTranslation();
  const [km, setKm] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const newKm = parseInt(km, 10);
    if (isNaN(newKm) || newKm <= 0) {
      setError('Enter a valid mileage');
      return;
    }
    if (newKm < currentKm) {
      setError(`Mileage cannot be lower than current (${currentKm.toLocaleString()} km)`);
      return;
    }
    const result = onUpdate(newKm, date);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setKm('');
    setError('');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('dashboard.updateMileage')} size="small">
      <form onSubmit={handleSubmit} className="form">
        <div className="form-group">
          <label>{t('register.mileage')}</label>
          <input
            type="number"
            value={km}
            onChange={(e) => { setKm(e.target.value); setError(''); }}
            placeholder={`Current: ${currentKm.toLocaleString()} km`}
            min={currentKm}
            autoFocus
          />
        </div>
        <div className="form-group">
          <label>{t('register.date')}</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        {error && <p className="form-error">{error}</p>}
        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>{t('common.cancel')}</button>
          <button type="submit" className="btn btn-primary">{t('common.save')}</button>
        </div>
      </form>
    </Modal>
  );
}
