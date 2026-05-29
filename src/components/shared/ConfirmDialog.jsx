import Modal from './Modal';
import { useTranslation } from 'react-i18next';

export default function ConfirmDialog({ isOpen, onClose, onConfirm, title, message }) {
  const { t } = useTranslation();

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="small">
      <p style={{ color: 'var(--text-secondary)', margin: '0 0 1.5rem' }}>{message}</p>
      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
        <button className="btn btn-ghost" onClick={onClose}>{t('common.cancel')}</button>
        <button className="btn btn-danger" onClick={() => { onConfirm(); onClose(); }}>
          {t('common.confirm')}
        </button>
      </div>
    </Modal>
  );
}
