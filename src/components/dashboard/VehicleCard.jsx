import { useTranslation } from 'react-i18next';
import carPhoto from '../../assets/f10-hero.jpg';

// chips shown in the hero summary, in urgency order
const CHIPS = [
  { key: 'red', color: 'var(--status-red)' },
  { key: 'inspect', color: 'var(--status-inspect)' },
  { key: 'monitor', color: 'var(--status-monitor)' },
  { key: 'grey', color: 'var(--status-grey)' },
];

export default function VehicleCard({ vehicle, counts = {}, onUpdateMileage, onChip, onSettings }) {
  const { t } = useTranslation();
  if (!vehicle) return null;

  return (
    <div className="card hero-card" style={{ backgroundImage: `url(${carPhoto})` }}>
      <div className="hero-info">
        <div className="hero-head">
          <div className="hero-odo">
            <span className="mileage-value">{vehicle.currentMileage?.toLocaleString()}<span className="hero-unit">km</span></span>
          </div>
          <h2 className="hero-model">{vehicle.model}</h2>
          <span className="hero-eyebrow">
            {vehicle.engine} · {vehicle.year}{vehicle.plate ? ` · ${vehicle.plate}` : ''}
          </span>
        </div>

        <div className="hero-chips">
          {CHIPS.map((c) => (counts[c.key] > 0 ? (
            <button key={c.key} type="button" className="hero-chip" onClick={() => onChip?.(c.key)}>
              <span className="hero-chip-dot" style={{ background: c.color }} />
              {t(`statusLabel.${c.key}`)} <strong>{counts[c.key]}</strong>
            </button>
          ) : null))}
        </div>

        <div className="hero-actions">
          <button className="btn btn-primary btn-sm" onClick={onUpdateMileage}>{t('dashboard.updateMileage')}</button>
          <button className="btn btn-secondary btn-sm" onClick={onSettings}>{t('nav.settings')}</button>
        </div>
      </div>
    </div>
  );
}
