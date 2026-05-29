import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import VehicleCard from './VehicleCard';
import MileageUpdate from './MileageUpdate';
import StatusOverview from './StatusOverview';
import UrgentItems from './UrgentItems';
import AlertsPanel from './AlertsPanel';
import { generateChecklist, downloadText } from '../../utils/dataExport';
import { inspectionPackages } from '../../data/inspectionPackages';
import './Dashboard.css';

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.03 } },
};
const item = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
};

export default function Dashboard({
  vehicle, updateMileage, statusCounts, urgentItems, itemsWithStatus,
  statusEvents = [], acknowledge, acknowledgeAll,
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [mileageModalOpen, setMileageModalOpen] = useState(false);

  const goFilter = (status) => navigate(`/maintenance?status=${status}`);
  const exportChecklist = () => {
    const date = new Date().toISOString().split('T')[0];
    downloadText(generateChecklist(inspectionPackages, vehicle), `bimmercare-checklist-${date}.md`);
  };

  return (
    <motion.div className="dashboard cockpit" variants={container} initial="hidden" animate="show">
      <motion.div className="dash-hero" variants={item}>
        <VehicleCard
          vehicle={vehicle}
          counts={statusCounts}
          onUpdateMileage={() => setMileageModalOpen(true)}
          onChip={goFilter}
          onSettings={() => navigate('/settings')}
        />
      </motion.div>

      <motion.div className="dash-rings" variants={item}>
        <StatusOverview counts={statusCounts} onSelect={goFilter} />
      </motion.div>

      <motion.div className="dash-alerts" variants={item}>
        <AlertsPanel events={statusEvents} onAck={acknowledge} onAckAll={acknowledgeAll} max={5} />
      </motion.div>

      <motion.div className="dash-urgent" variants={item}>
        <UrgentItems items={itemsWithStatus || urgentItems} onOpen={goFilter} max={3} />
      </motion.div>

      <motion.div className="dash-actions" variants={item}>
        <button className="btn btn-primary btn-sm" onClick={() => navigate('/maintenance')}>
          {t('dashboard.openMaintenance', 'Onderhoud openen')}
        </button>
        <button className="btn btn-secondary btn-sm" onClick={exportChecklist}>
          {t('settings.exportChecklist', 'Garage checklist')}
        </button>
        <button className="btn btn-secondary btn-sm" onClick={() => navigate('/settings')}>
          {t('dashboard.settingsExport', 'Instellingen / Export')}
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
