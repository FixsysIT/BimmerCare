import { PRIORITY_BADGES } from '../../utils/constants';

export default function PriorityBadge({ priority }) {
  const config = PRIORITY_BADGES[priority];
  if (!config) return null;

  return (
    <span
      className="priority-badge"
      style={{
        border: `1px solid ${config.color}60`,
        color: config.color,
        padding: '0.125rem 0.5rem',
        borderRadius: '999px',
        fontSize: '0.6875rem',
        fontWeight: 600,
      }}
    >
      {config.emoji} {config.label}
    </span>
  );
}
