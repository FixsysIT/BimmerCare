import { useCallback, useEffect } from 'react';
import { useStorage } from './useStorage';
import { createExportData, downloadJSON } from '../utils/dataExport';
import { STORAGE_KEYS, BACKUP_DEFAULTS } from '../utils/constants';

/**
 * Auto-backup hook.
 * Tracks changes, shows reminders, optionally auto-downloads.
 */
export function useAutoBackup(vehicle, maintenanceItems, settings, extra = {}) {
  const [lastBackup, setLastBackup] = useStorage(STORAGE_KEYS.LAST_BACKUP, null);
  const [changeCount, setChangeCount] = useStorage(STORAGE_KEYS.CHANGE_COUNT, 0);

  // Increment change counter
  const trackChange = useCallback(() => {
    setChangeCount((prev) => (prev || 0) + 1);
  }, [setChangeCount]);

  // Manual export
  const exportBackup = useCallback(() => {
    if (!vehicle || !maintenanceItems) return;
    const data = createExportData(vehicle, maintenanceItems, settings, extra);
    downloadJSON(data);
    setLastBackup(new Date().toISOString());
    setChangeCount(0);
  }, [vehicle, maintenanceItems, settings, extra, setLastBackup, setChangeCount]);

  // Check if backup reminder should show
  const shouldRemind = useCallback(() => {
    if (!lastBackup) return true;
    const daysSince = (Date.now() - new Date(lastBackup).getTime()) / (1000 * 60 * 60 * 24);
    const changesOver = (changeCount || 0) >= BACKUP_DEFAULTS.REMINDER_CHANGES;
    const daysOver = daysSince >= BACKUP_DEFAULTS.REMINDER_DAYS;
    return changesOver || daysOver;
  }, [lastBackup, changeCount]);

  // Auto-download if enabled
  useEffect(() => {
    if (settings?.autoBackupEnabled && vehicle && maintenanceItems && changeCount > 0) {
      const data = createExportData(vehicle, maintenanceItems, settings, extra);
      downloadJSON(data);
      setLastBackup(new Date().toISOString());
      setChangeCount(0);
    }
  }, [settings?.autoBackupEnabled]); // Only trigger on setting change, not every data change

  return {
    lastBackup,
    changeCount,
    shouldRemind: shouldRemind(),
    trackChange,
    exportBackup,
  };
}
