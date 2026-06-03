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
import { useStatusEvents } from './hooks/useStatusEvents';
import { useAutoBackup } from './hooks/useAutoBackup';
import { useStorage } from './hooks/useStorage';
import { STORAGE_KEYS } from './utils/constants';
import './i18n';

export default function App() {
  const { vehicle, setVehicle, loading: vehicleLoading, initVehicle, updateMileage, correctMileage, updateProfile } = useVehicle();
  const [settings, setSettings] = useStorage(STORAGE_KEYS.SETTINGS, { autoBackupEnabled: false });

  useEffect(() => {
    if (!vehicleLoading && !vehicle) initVehicle();
  }, [vehicleLoading, vehicle, initVehicle]);

  const {
    items, itemsWithStatus, statusCounts, urgentItems,
    loading: itemsLoading, setItems, initItems,
    registerMaintenance, updateItem, addItem, toggleDisable, resetToDefaults, startBaseline, logEvent,
    updateHistoryEntry, deleteHistoryEntry,
  } = useMaintenance(vehicle);

  useEffect(() => {
    if (!itemsLoading && !items.length && vehicle?.vehicleId) initItems();
  }, [itemsLoading, items, vehicle, initItems]);

  const { lastBackup, shouldRemind, trackChange, exportBackup } = useAutoBackup(vehicle, items, settings);
  const { events: statusEvents, acknowledgeItem } = useStatusEvents(itemsWithStatus, vehicle?.currentMileage);

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
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={
            <Dashboard
              vehicle={vehicle}
              updateMileage={handleUpdateMileage}
              statusCounts={statusCounts}
              urgentItems={urgentItems}
              itemsWithStatus={itemsWithStatus}
              statusEvents={statusEvents}
              acknowledgeItem={acknowledgeItem}
            />
          } />
          <Route path="maintenance" element={
            <MaintenancePage
              itemsWithStatus={itemsWithStatus}
              currentMileage={vehicle?.currentMileage}
              registerMaintenance={handleRegister}
              updateItem={updateItem}
              logEvent={handleLogEvent}
              updateHistoryEntry={(itemId, entryId, patch) => { updateHistoryEntry(itemId, entryId, patch); trackChange(); }}
              deleteHistoryEntry={(itemId, entryId) => { deleteHistoryEntry(itemId, entryId); trackChange(); }}
              toggleDisable={toggleDisable}
              allItems={items}
            />
          } />
          <Route path="costs" element={
            <CostsPage
              maintenanceItems={items}
              vehicle={vehicle}
              currentMileage={vehicle?.currentMileage}
              updateHistoryEntry={(itemId, entryId, patch) => { updateHistoryEntry(itemId, entryId, patch); trackChange(); }}
            />
          } />
          <Route path="parts" element={
            <PartsPage maintenanceItems={items} />
          } />
          <Route path="settings" element={
            <SettingsPage
              vehicle={vehicle}
              updateProfile={updateProfile}
              correctMileage={correctMileage}
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
              statusEvents={statusEvents}
            />
          } />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
