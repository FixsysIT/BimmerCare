import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';

/* Circular RPM-gauge rings — arc length = share of total items. */
function StatusRing({ value, total, label, color, onClick }) {
  const r = 30;
  const c = 2 * Math.PI * r;
  const frac = total > 0 ? value / total : 0;

  return (
    <button type="button" className="status-ring" onClick={onClick} disabled={value === 0}>
      <div className="ring-dial">
        <svg viewBox="0 0 80 80" className="ring-svg">
          <circle cx="40" cy="40" r={r} className="ring-track" />
          <motion.circle
            cx="40" cy="40" r={r}
            className="ring-arc"
            stroke={color}
            strokeDasharray={c}
            strokeLinecap="round"
            transform="rotate(-90 40 40)"
            initial={{ strokeDashoffset: c }}
            animate={{ strokeDashoffset: c - c * frac }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
            style={{ filter: `drop-shadow(0 0 6px ${color})` }}
          />
        </svg>
        <span className="ring-value" style={{ color }}>{value}</span>
      </div>
      <span className="ring-label">{label}</span>
    </button>
  );
}

export default function StatusOverview({ counts, onSelect }) {
  const { t } = useTranslation();

  const statuses = [
    { key: 'red', label: t('statusLabel.red'), color: 'var(--status-red)' },
    { key: 'orange', label: t('statusLabel.orange'), color: 'var(--status-orange)' },
    { key: 'inspect', label: t('statusLabel.inspect'), color: 'var(--status-inspect)' },
    { key: 'monitor', label: t('statusLabel.monitor'), color: 'var(--status-monitor)' },
    { key: 'green', label: t('statusLabel.green'), color: 'var(--status-green)' },
    { key: 'grey', label: t('statusLabel.grey'), color: 'var(--status-grey)' },
  ];

  const total = statuses.reduce((sum, s) => sum + (counts[s.key] || 0), 0);

  return (
    <div className="status-overview">
      <h3 className="section-title">{t('dashboard.statusOverview')}</h3>
      <div className="status-grid">
        {statuses.map((s) => (
          <StatusRing
            key={s.key}
            value={counts[s.key] || 0}
            total={total}
            label={s.label}
            color={s.color}
            onClick={() => onSelect?.(s.key)}
          />
        ))}
      </div>
    </div>
  );
}
