import { useTranslation } from 'react-i18next';
import { motion, useReducedMotion } from 'framer-motion';

/* ──────────────────────────────────────────────────────────────
   Health tachometer — the cluster's rev counter, but the "revs"
   are how much maintenance load is open. Redzone = work due now.
   Sweep on mount mimics the F10 instrument self-test at ignition.
   ────────────────────────────────────────────────────────────── */

const CX = 100, CY = 100, R = 78;
const START = 225;            // 7:30 — bottom-left
const SWEEP = 270;            // up and over to 4:30
const polar = (deg, r = R) => {
  const a = (deg - 90) * Math.PI / 180;
  return [CX + r * Math.cos(a), CY + r * Math.sin(a)];
};
const arcPath = (startDeg, endDeg, r = R) => {
  const [x1, y1] = polar(startDeg, r);
  const [x2, y2] = polar(endDeg, r);
  const large = Math.abs(endDeg - startDeg) > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
};

// weighted maintenance load 0..1 — red counts full, lighter the calmer it gets
function loadFraction(counts, total) {
  if (!total) return 0;
  const w = (counts.red || 0) * 1 + (counts.orange || 0) * 0.55 + (counts.inspect || 0) * 0.25;
  return Math.min(1, w / total);
}

export default function HealthGauge({ counts = {}, onSelect }) {
  const { t } = useTranslation();
  const reduce = useReducedMotion();

  const total = ['red', 'orange', 'inspect', 'monitor', 'green', 'grey']
    .reduce((s, k) => s + (counts[k] || 0), 0);
  const load = loadFraction(counts, total);
  const loadDeg = START + SWEEP * load;

  // center readout cascades to the most severe non-empty bucket
  const cascade = [
    { key: 'red', color: 'var(--status-red)' },
    { key: 'orange', color: 'var(--status-orange)' },
    { key: 'inspect', color: 'var(--status-inspect)' },
  ];
  const top = cascade.find((c) => (counts[c.key] || 0) > 0);
  const big = top ? counts[top.key] : '✓';
  const label = top ? t(`statusLabel.${top.key}`) : t('dashboard.allClearTitle', 'Alles rustig');
  const color = top ? top.color : 'var(--status-green)';

  // tick marks — last quarter is the redzone
  const TICKS = 28;
  const ticks = Array.from({ length: TICKS + 1 }, (_, i) => {
    const deg = START + (SWEEP * i) / TICKS;
    const red = i / TICKS > 0.78;
    const big = i % 4 === 0;
    const [x1, y1] = polar(deg, R + 3);
    const [x2, y2] = polar(deg, R + (big ? 11 : 7));
    return { x1, y1, x2, y2, red, big, deg };
  });

  // satellite readouts under the gauge: actionable buckets up top, the calm
  // ones (watch / fine / no-data) on a quieter second row so they stay traceable
  const readouts = [
    { key: 'red', color: 'var(--status-red)' },
    { key: 'orange', color: 'var(--status-orange)' },
    { key: 'inspect', color: 'var(--status-inspect)' },
  ];
  const calm = [
    { key: 'green', color: 'var(--status-green)' },
    { key: 'monitor', color: 'var(--status-monitor)' },
    { key: 'grey', color: 'var(--status-grey)' },
  ];

  return (
    <div className="gauge">
      <div className="gauge-dial">
        <svg viewBox="0 0 200 200" className="gauge-svg" aria-hidden="true">
          {/* tick ring */}
          {ticks.map((tk, i) => (
            <line
              key={i} x1={tk.x1} y1={tk.y1} x2={tk.x2} y2={tk.y2}
              className={`gauge-tick ${tk.red ? 'gauge-tick-red' : ''} ${tk.big ? 'gauge-tick-big' : ''}`}
            />
          ))}
          {/* track */}
          <path d={arcPath(START, START + SWEEP)} className="gauge-track" />
          {/* load arc, drawn on mount */}
          <motion.path
            d={arcPath(START, START + SWEEP)}
            className="gauge-load"
            stroke={color}
            pathLength="100"
            strokeDasharray="100"
            initial={{ strokeDashoffset: 100 }}
            animate={{ strokeDashoffset: 100 - 100 * load }}
            transition={reduce ? { duration: 0 } : { duration: 1, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
            style={{ filter: `drop-shadow(0 0 7px ${color})` }}
          />
          {/* needle + hub — self-test sweep, then settle on the value */}
          <motion.g
            initial={{ rotate: START }}
            animate={{ rotate: reduce ? loadDeg : [START, START + SWEEP, loadDeg] }}
            transition={reduce ? { duration: 0 } : { duration: 1.25, ease: [0.4, 0, 0.2, 1], times: [0, 0.55, 1] }}
            style={{ transformBox: 'view-box', transformOrigin: '100px 100px' }}
          >
            <line x1={CX} y1={CY} x2={CX} y2={CY - R + 12} className="gauge-needle" stroke={color} />
          </motion.g>
          <circle cx={CX} cy={CY} r="7" className="gauge-hub" />
        </svg>

        <button
          type="button"
          className="gauge-center"
          onClick={() => onSelect?.(top ? top.key : 'green')}
          disabled={!top}
        >
          <span className="gauge-big" style={{ color }}>{big}</span>
          <span className="gauge-label">{label}</span>
        </button>
      </div>

      <div className="gauge-readouts">
        {readouts.map((r) => (
          <button
            key={r.key} type="button" className="gauge-readout"
            onClick={() => onSelect?.(r.key)} disabled={(counts[r.key] || 0) === 0}
          >
            <span className="gauge-readout-dot" style={{ background: r.color }} />
            <span className="gauge-readout-num">{counts[r.key] || 0}</span>
            <span className="gauge-readout-label">{t(`statusLabel.${r.key}`)}</span>
          </button>
        ))}
      </div>

      <div className="gauge-readouts gauge-readouts-calm">
        {calm.map((r) => (
          <button
            key={r.key} type="button" className="gauge-readout gauge-readout-sm"
            onClick={() => onSelect?.(r.key)} disabled={(counts[r.key] || 0) === 0}
          >
            <span className="gauge-readout-dot" style={{ background: r.color }} />
            <span className="gauge-readout-num">{counts[r.key] || 0}</span>
            <span className="gauge-readout-label">{t(`statusLabel.${r.key}`)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
