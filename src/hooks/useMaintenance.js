import { useCallback, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useStorage } from './useStorage';
import { getDefaultItems } from '../data/defaultItems';
import { calculateStatus } from '../utils/statusCalculator';
import { STORAGE_KEYS } from '../utils/constants';

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
    // Single cost, excl. BTW.
    const cost = entry.cost || 0;
    const now = new Date().toISOString();

    const newEntry = {
      id: uuidv4(),
      ...entry,
      cost,
      createdAt: now,
    };

    setItems((prevItems) => {
      if (!prevItems) return prevItems;
      return prevItems.map((item) => {
        if (item.id !== itemId) return item;
        return {
          ...item,
          history: [...item.history, newEntry],
          // Cost database: learn the item's cost from the actual amount paid (excl. BTW).
          estimatedTotalCost: cost > 0 ? Math.round(cost) : item.estimatedTotalCost,
          manualStatus: null, // Reset manual status on new service
          manualStatusNote: null,
          manualOverride: false, // history is the source now
          baselineState: null, // a logged service supersedes any baseline assertion
          lastResult: entry.result ?? null, // Update last result
          updatedAt: now,
        };
      });
    });

    return newEntry;
  }, [setItems]);

  // Register a service on the primary item AND mark its companions done in the
  // SAME visit, in ONE state update (separate calls would stale-close `items`
  // and overwrite each other). The primary carries the whole job cost; each
  // companion gets a service/replaced entry at the same date/km with cost 0 —
  // the work was bundled, so its wear-clock resets without double-counting cost.
  const applyService = useCallback((primaryId, primaryEntry, companionIds = [], companionNote = '') => {
    if (!items) return;
    const now = new Date().toISOString();
    const cost = primaryEntry.cost || 0;
    const pEntry = { id: uuidv4(), ...primaryEntry, cost, createdAt: now };
    const compSet = new Set(companionIds);
    setItems(items.map((item) => {
      if (item.id === primaryId) {
        return {
          ...item,
          history: [...(item.history || []), pEntry],
          estimatedTotalCost: cost > 0 ? Math.round(cost) : item.estimatedTotalCost,
          manualStatus: null,
          manualStatusNote: null,
          manualOverride: false,
          lastResult: primaryEntry.result ?? null,
          baselineState: null,
          updatedAt: now,
        };
      }
      if (compSet.has(item.id)) {
        const cEntry = {
          id: uuidv4(),
          type: 'service',
          result: 'replaced',
          date: primaryEntry.date,
          mileage: primaryEntry.mileage,
          garage: primaryEntry.garage || '',
          cost: 0, // bundled into the primary job's cost
          notes: companionNote,
          createdAt: now,
        };
        return {
          ...item,
          history: [...(item.history || []), cEntry],
          manualStatus: null,
          manualStatusNote: null,
          manualOverride: false,
          lastResult: 'replaced',
          baselineState: null,
          updatedAt: now,
        };
      }
      return item;
    }));
    return pEntry;
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

  // Reset timer — restart the interval clock for ONE item NOW without claiming a
  // replacement. Logs a baseline entry at the current odometer/today (no cost, no
  // 'replaced' result), so interval math counts fresh from here. Use this for
  // "doe maar de volgende weer" — the part wasn't replaced, the count just restarts.
  const resetTimer = useCallback((itemId, atKm) => {
    if (!items) return;
    const km = atKm ?? currentMileage ?? 0;
    const today = new Date().toISOString().split('T')[0];
    const now = new Date().toISOString();
    setItems(items.map((item) => {
      if (item.id !== itemId) return item;
      return {
        ...item,
        history: [...(item.history || []), {
          id: uuidv4(),
          type: 'baseline',
          date: today,
          mileage: km,
          notes: 'Timer reset',
          createdAt: now,
        }],
        manualStatus: null,
        manualStatusNote: null,
        manualOverride: false,
        baselineState: null,
        lastResult: null,
        updatedAt: now,
      };
    }));
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
  const logEvent = useCallback((itemId, { type, result, note = '', date, mileage, cost = 0 }) => {
    if (!items) return;
    const day = date || new Date().toISOString().split('T')[0];
    const km = mileage ?? currentMileage ?? null;
    const c = cost || 0; // excl. BTW
    const entry = {
      id: uuidv4(),
      type,                       // 'inspection' | 'diagnosis' | 'service' | 'note'
      result,                     // ok | monitor | worn | replace_needed | no_fault | fault_present | confirmed_failed | replaced | null (note)
      date: day,                  // backdatable
      mileage: km,
      cost: c,                    // excl. BTW
      notes: note,
      createdAt: new Date().toISOString(),
    };
    setItems(items.map((item) => {
      if (item.id !== itemId) return item;
      const history = [...(item.history || []), entry];
      // A 'note' is a passive logbook entry — it must not touch status/override.
      if (type === 'note') {
        return {
          ...item,
          history,
          estimatedTotalCost: c > 0 ? Math.round(c) : item.estimatedTotalCost,
          updatedAt: new Date().toISOString(),
        };
      }
      return {
        ...item,
        history,
        // Cost database: learn the item's cost from the logged amount (excl. BTW).
        estimatedTotalCost: c > 0 ? Math.round(c) : item.estimatedTotalCost,
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

  // Re-derive the learned cost + lastResult from a (possibly edited) history list.
  const rederive = (history) => {
    const withCost = [...history].reverse().find((h) => (h.cost || 0) > 0);
    // lastResult comes from the newest status-bearing entry; notes don't count.
    const lastStatus = [...history].reverse().find((h) => h.type !== 'note');
    return {
      estimatedTotalCost: withCost ? Math.round(withCost.cost) : 0,
      lastResult: lastStatus?.result ?? null,
    };
  };

  // Edit a single history entry (fix wrong cost/date/mileage/note).
  const updateHistoryEntry = useCallback((itemId, entryId, patch) => {
    if (!items) return;
    setItems(items.map((item) => {
      if (item.id !== itemId) return item;
      const history = (item.history || []).map((h) =>
        h.id === entryId ? { ...h, ...patch } : h
      );
      return { ...item, history, ...rederive(history), updatedAt: new Date().toISOString() };
    }));
  }, [items, setItems]);

  // Delete a single history entry (remove a mistaken/fake log).
  const deleteHistoryEntry = useCallback((itemId, entryId) => {
    if (!items) return;
    setItems(items.map((item) => {
      if (item.id !== itemId) return item;
      const history = (item.history || []).filter((h) => h.id !== entryId);
      return { ...item, history, ...rederive(history), updatedAt: new Date().toISOString() };
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
    applyService,
    updateItem,
    setManualStatus,
    addItem,
    toggleDisable,
    resetToDefaults,
    startBaseline,
    resetTimer,
    logEvent,
    updateHistoryEntry,
    deleteHistoryEntry,
  };
}
