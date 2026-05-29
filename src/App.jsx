import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/layout/Layout';
import Dashboard from './components/dashboard/Dashboard';
import MaintenancePage from './components/maintenance/MaintenancePage';
import CostsPage from './components/costs/CostsPage';
import PartsPage from './components/parts/PartsPage';
import SettingsPage from './components/settings/SettingsPage';
import { useVehicle } from './hooks/useVehicle';
import { useMaintenance } from './hooks/useMaintenance';
import { useAutoBackup } from './hooks/useAutoBackup';
import { useStorage } from './hooks/useStorage';
import { STORAGE_KEYS } from './utils/constants';
import './i18n';

export default function App() {
  const { vehicle, setVehicle, loading: vehicleLoading, initVehicle, updateMileage, updateProfile } = useVehicle();
  const [settings, setSettings] = useStorage(STORAGE_KEYS.SETTINGS, { autoBackupEnabled: false });

  useEffect(() => {
    if (!vehicleLoading && !vehicle) initVehicle();
  }, [vehicleLoading, vehicle, initVehicle]);

  const {
    items, activeItems, itemsWithStatus, statusCounts, urgentItems,
    loading: itemsLoading, setItems, initItems,
    registerMaintenance, updateItem, setManualStatus, addItem, toggleDisable, resetToDefaults, startBaseline, logEvent,
  } = useMaintenance(vehicle);

  useEffect(() => {
    if (!itemsLoading && !items.length && vehicle?.vehicleId) initItems();
  }, [itemsLoading, items, vehicle, initItems]);

  const { lastBackup, shouldRemind, trackChange, exportBackup } = useAutoBackup(vehicle, items, settings);

  const handleRegister = (itemId, entry) => {
    registerMaintenance(itemId, entry);
    trackChange();
  };

  const handleUpdateMileage = (km, date) => {
    const result = updateMileage(km, date);
    if (result?.success) trackChange();
    return result;
  };

  const handleLogEvent = (itemId, payload) => {
    logEvent(itemId, payload);
    trackChange();
  };

  if (vehicleLoading || itemsLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--text-muted)' }}>
        Loading...
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={
            <Dashboard
              vehicle={vehicle}
              updateMileage={handleUpdateMileage}
              statusCounts={statusCounts}
              urgentItems={urgentItems}
              itemsWithStatus={itemsWithStatus}
            />
          } />
          <Route path="maintenance" element={
            <MaintenancePage
              itemsWithStatus={itemsWithStatus}
              currentMileage={vehicle?.currentMileage}
              registerMaintenance={handleRegister}
              updateItem={updateItem}
              setManualStatus={setManualStatus}
              logEvent={handleLogEvent}
              toggleDisable={toggleDisable}
              allItems={items}
            />
          } />
          <Route path="costs" element={
            <CostsPage maintenanceItems={items} vehicle={vehicle} />
          } />
          <Route path="parts" element={
            <PartsPage maintenanceItems={items} />
          } />
          <Route path="settings" element={
            <SettingsPage
              vehicle={vehicle}
              updateProfile={updateProfile}
              settings={settings}
              setSettings={setSettings}
              exportBackup={exportBackup}
              lastBackup={lastBackup}
              shouldRemind={shouldRemind}
              setVehicle={setVehicle}
              setItems={setItems}
              maintenanceItems={items}
              resetToDefaults={resetToDefaults}
              addItem={addItem}
              startBaseline={startBaseline}
            />
          } />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
