import { SOURCE_BADGES } from '../../utils/constants';

export default function SourceBadge({ source }) {
  const config = SOURCE_BADGES[source];
  if (!config) return null;

  return (
    <span
      className="source-badge"
      style={{
        background: `${config.color}18`,
        color: config.color,
        border: `1px solid ${config.color}40`,
        padding: '0.125rem 0.5rem',
        borderRadius: '999px',
        fontSize: '0.6875rem',
        fontWeight: 600,
        letterSpacing: '0.02em',
      }}
    >
      {config.label}
    </span>
  );
}
