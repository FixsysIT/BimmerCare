import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import VehicleCard from './VehicleCard';
import MileageUpdate from './MileageUpdate';
import StatusOverview from './StatusOverview';
import UrgentItems from './UrgentItems';
import './Dashboard.css';

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.09, delayChildren: 0.04 } },
};
const item = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
};

export default function Dashboard({ vehicle, updateMileage, statusCounts, urgentItems, itemsWithStatus }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [mileageModalOpen, setMileageModalOpen] = useState(false);

  const goFilter = (status) => navigate(`/maintenance?status=${status}`);

  return (
    <motion.div className="dashboard" variants={container} initial="hidden" animate="show">
      <motion.h1 className="page-title" variants={item}>{t('dashboard.title')}</motion.h1>

      <motion.div variants={item}>
        <VehicleCard
          vehicle={vehicle}
          counts={statusCounts}
          onUpdateMileage={() => setMileageModalOpen(true)}
          onChip={goFilter}
          onSettings={() => navigate('/settings')}
        />
      </motion.div>

      <motion.div variants={item}>
        <StatusOverview counts={statusCounts} onSelect={goFilter} />
      </motion.div>

      <motion.div variants={item}>
        <UrgentItems items={itemsWithStatus || urgentItems} onOpen={goFilter} />
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
