import { useTranslation } from 'react-i18next';
import './StatusBadge.css';

export default function StatusBadge({ status, reason, compact = false }) {
  const { t } = useTranslation();

  const labels = {
    red: t('statusLabel.red'),
    orange: t('statusLabel.orange'),
    inspect: t('statusLabel.inspect'),
    monitor: t('statusLabel.monitor'),
    green: t('statusLabel.green'),
    grey: t('statusLabel.grey'),
  };

  return (
    <span className={`status-badge status-${status} ${compact ? 'status-compact' : ''}`}>
      <span className="status-dot" />
      {!compact && <span className="status-label">{labels[status]}</span>}
      {reason && !compact && (
        <span className="status-reason">{t(`status.${reason}`)}</span>
      )}
    </span>
  );
}
