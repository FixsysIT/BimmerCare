import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, useReducedMotion } from 'framer-motion';
import carPhoto from '../../assets/f10-hero.jpg';
import HealthGauge from './HealthGauge';
import MileageUpdate from './MileageUpdate';
import UrgentItems from './UrgentItems';
import { generateChecklist, downloadText } from '../../utils/dataExport';
import { inspectionPackages } from '../../data/inspectionPackages';
import './Dashboard.css';

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.04 } },
};
const item = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
};

// odometer that rolls up to its value on ignition (skipped if motion is reduced)
function Odo({ value }) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(reduce ? value : 0);
  const ref = useRef();
  useEffect(() => {
    if (reduce) return; // value rendered directly below; no animation
    cancelAnimationFrame(ref.current);
    const dur = 1100, t0 = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(Math.round(value * eased));
      if (p < 1) ref.current = requestAnimationFrame(tick);
    };
    ref.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(ref.current);
  }, [value, reduce]);
  const display = reduce ? value : shown;
  return <>{(display || 0).toLocaleString('nl-NL')}</>;
}

export default function Dashboard({
  vehicle, updateMileage, statusCounts, urgentItems, itemsWithStatus,
  statusEvents = [], acknowledgeItem,
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [mileageModalOpen, setMileageModalOpen] = useState(false);

  const goFilter = (status) => navigate(`/maintenance?status=${status}`);
  const exportChecklist = () => {
    const date = new Date().toISOString().split('T')[0];
    downloadText(generateChecklist(inspectionPackages, vehicle), `bimmercare-checklist-${date}.md`);
  };

  const changedItems = useMemo(
    () => new Set((statusEvents || []).filter((e) => !e.acknowledged).map((e) => e.itemId)),
    [statusEvents],
  );

  if (!vehicle) return null;

  return (
    <motion.div className="dashboard" variants={container} initial="hidden" animate="show">
      {/* ── Binnacle: tach + odo, framed over the real car ── */}
      <motion.div className="card binnacle" variants={item} style={{ backgroundImage: `url(${carPhoto})` }}>
        <div className="binnacle-grid">
          <HealthGauge counts={statusCounts} onSelect={goFilter} />

          <div className="odo">
            <span className="odo-eyebrow">{vehicle.engine} · {vehicle.year}{vehicle.plate ? ` · ${vehicle.plate}` : ''}</span>
            <h1 className="odo-model">{vehicle.model}</h1>
            <div className="odo-read">
              <span className="odo-km"><Odo value={vehicle.currentMileage || 0} /></span>
              <span className="odo-unit">km</span>
            </div>
            <button className="odo-action" onClick={() => setMileageModalOpen(true)}>
              {t('dashboard.updateMileage')}
            </button>
          </div>
        </div>
      </motion.div>

      {/* ── Check Control: the cluster's warning messages ── */}
      <motion.div className="card check-control" variants={item}>
        <UrgentItems
          items={itemsWithStatus || urgentItems}
          title={t('dashboard.checkControl', 'Check Control')}
          onOpen={goFilter}
          changedItems={changedItems}
          onAckItem={acknowledgeItem}
          currentMileage={vehicle?.currentMileage}
        />
      </motion.div>

      {/* ── one secondary action that isn't already in the nav ── */}
      <motion.div className="dash-foot" variants={item}>
        <button className="btn btn-secondary btn-sm" onClick={exportChecklist}>
          {t('settings.exportChecklist', 'Garage checklist')}
        </button>
      </motion.div>

      <MileageUpdate
        isOpen={mileageModalOpen}
        onClose={() => setMileageModalOpen(false)}
        currentKm={vehicle?.currentMileage || 0}
        onUpdate={updateMileage}
      />
    </motion.div>
  );
}
