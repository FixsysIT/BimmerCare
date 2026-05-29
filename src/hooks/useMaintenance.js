import { useCallback, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useStorage } from './useStorage';
import { getDefaultItems } from '../data/defaultItems';
import { calculateStatus } from '../utils/statusCalculator';
import { calculateTotalInclVat } from '../utils/costCalculator';
import { STORAGE_KEYS, DEFAULT_VAT_PERCENT } from '../utils/constants';

/**
 * Maintenance items management hook.
 */
export function useMaintenance(vehicle) {
  const vehicleId = vehicle?.vehicleId;
  const currentMileage = vehicle?.currentMileage;
  const [items, setItems, loading] = useStorage(STORAGE_KEYS.MAINTENANCE_ITEMS, null);

  // Initialize with defaults if none exist
  const initItems = useCallback(() => {
    if (!items && vehicleId) {
      const defaults = getDefaultItems(vehicleId);
      setItems(defaults);
      return defaults;
    }
    return items || [];
  }, [items, vehicleId, setItems]);

  // Active items (not disabled)
  const activeItems = useMemo(() => {
    if (!items) return [];
    return items.filter((i) => !i.isDisabled);
  }, [items]);

  // Calculate status for all items
  const itemsWithStatus = useMemo(() => {
    if (!activeItems.length || !currentMileage) return [];
    return activeItems.map((item) => ({
      ...item,
      calculatedStatus: calculateStatus(item, currentMileage, vehicle),
    }));
  }, [activeItems, currentMileage, vehicle]);

  // Status counts
  const statusCounts = useMemo(() => {
    const counts = { red: 0, orange: 0, inspect: 0, monitor: 0, green: 0, grey: 0 };
    for (const item of itemsWithStatus) {
      counts[item.calculatedStatus.status] = (counts[item.calculatedStatus.status] || 0) + 1;
    }
    return counts;
  }, [itemsWithStatus]);

  // Urgent items (red + orange, sorted by urgency)
  const urgentItems = useMemo(() => {
    return itemsWithStatus
      .filter((i) => i.calculatedStatus.status === 'red' || i.calculatedStatus.status === 'orange')
      .sort((a, b) => {
        const order = { red: 0, orange: 1 };
        return (order[a.calculatedStatus.status] ?? 2) - (order[b.calculatedStatus.status] ?? 2);
      });
  }, [itemsWithStatus]);

  // Register maintenance entry
  const registerMaintenance = useCallback((itemId, entry) => {
    if (!items) return;
    const costs = calculateTotalInclVat(
      entry.partsCost || 0,
      entry.laborCost || 0,
      entry.vatPercent ?? DEFAULT_VAT_PERCENT
    );

    const newEntry = {
      id: uuidv4(),
      ...entry,
      totalExclVat: costs.totalExclVat,
      totalInclVat: costs.totalInclVat,
      createdAt: new Date().toISOString(),
    };

    setItems(items.map((item) => {
      if (item.id !== itemId) return item;
      return {
        ...item,
        history: [...item.history, newEntry],
        manualStatus: null, // Reset manual status on new service
        manualStatusNote: null,
        manualOverride: false, // history is the source now
        baselineState: null, // a logged service supersedes any baseline assertion
        updatedAt: new Date().toISOString(),
      };
    }));

    return newEntry;
  }, [items, setItems]);

  // Baseline mode — for every item WITHOUT history, log a baseline entry at
  // the current odometer/today. Interval items then count from here (fresh,
  // not overdue); condition items count toward their inspection indicator;
  // on-failure items stay on monitor. Items that already have history are
  // left untouched. This is the explicit "start counting from now" action.
  const startBaseline = useCallback((atKm) => {
    if (!items) return 0;
    const km = atKm ?? currentMileage ?? 0;
    const today = new Date().toISOString().split('T')[0];
    let n = 0;
    setItems(items.map((item) => {
      if (item.history && item.history.length > 0) return item;
      n++;
      return {
        ...item,
        history: [{
          id: uuidv4(),
          type: 'baseline',
          date: today,
          mileage: km,
          notes: 'Baseline',
          createdAt: new Date().toISOString(),
        }],
        manualStatus: null,
        manualStatusNote: null,
        manualOverride: false,
        baselineState: null,
        updatedAt: new Date().toISOString(),
      };
    }));
    return n;
  }, [items, currentMileage, setItems]);

  // Update item (edit intervals, toggle, etc.)
  const updateItem = useCallback((itemId, updates) => {
    if (!items) return;
    setItems(items.map((item) => {
      if (item.id !== itemId) return item;
      return { ...item, ...updates, updatedAt: new Date().toISOString() };
    }));
  }, [items, setItems]);

  // Log an inspection/diagnosis event → real history entry. This IS the status
  // source (statusCalculator reads the latest typed event). We no longer mirror
  // onto manualStatus. `lastResult` is just a UI cache for the active pill.
  // Clearing any legacy manualStatus so history wins cleanly.
  const logEvent = useCallback((itemId, { type, result, note = '' }) => {
    if (!items) return;
    const today = new Date().toISOString().split('T')[0];
    setItems(items.map((item) => {
      if (item.id !== itemId) return item;
      return {
        ...item,
        history: [...(item.history || []), {
          id: uuidv4(),
          type,                       // 'inspection' | 'diagnosis'
          result,                     // ok | monitor | worn | replace_needed | no_fault | fault_present | replaced
          date: today,
          mileage: currentMileage ?? null,
          notes: note,
          createdAt: new Date().toISOString(),
        }],
        manualStatus: null,
        manualStatusNote: null,
        manualOverride: false, // logging an event drops any prior override; history wins
        lastResult: result,
        baselineState: null,
        updatedAt: new Date().toISOString(),
      };
    }));
  }, [items, currentMileage, setItems]);

  // Set manual status — a genuine explicit override that beats history.
  // manualOverride flags it so the engine ranks it above any history event.
  // Passing status=null clears the override back to computed/history.
  const setManualStatus = useCallback((itemId, status, note = '') => {
    if (!items) return;
    setItems(items.map((item) => {
      if (item.id !== itemId) return item;
      return {
        ...item,
        manualStatus: status,
        manualStatusNote: note,
        manualOverride: !!status,
        lastResult: status ? item.lastResult : null,  // clearing → drop highlight
        updatedAt: new Date().toISOString(),
      };
    }));
  }, [items, setItems]);

  // Add custom item
  const addItem = useCallback((newItem) => {
    if (!items) return;
    const item = {
      id: uuidv4(),
      vehicleId,
      ...newItem,
      history: [],
      parts: newItem.parts || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setItems([...items, item]);
    return item;
  }, [items, vehicleId, setItems]);

  // Toggle disable
  const toggleDisable = useCallback((itemId) => {
    if (!items) return;
    setItems(items.map((item) => {
      if (item.id !== itemId) return item;
      return { ...item, isDisabled: !item.isDisabled, updatedAt: new Date().toISOString() };
    }));
  }, [items, setItems]);

  // Reset to defaults
  const resetToDefaults = useCallback(() => {
    if (!vehicleId) return;
    const defaults = getDefaultItems(vehicleId);
    setItems(defaults);
  }, [vehicleId, setItems]);

  return {
    items: items || [],
    activeItems,
    itemsWithStatus,
    statusCounts,
    urgentItems,
    loading,
    setItems,
    initItems,
    registerMaintenance,
    updateItem,
    setManualStatus,
    addItem,
    toggleDisable,
    resetToDefaults,
    startBaseline,
    logEvent,
  };
}
