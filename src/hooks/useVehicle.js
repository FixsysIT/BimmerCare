import { useCallback } from 'react';
import { useStorage } from './useStorage';
import { getDefaultVehicle } from '../data/defaultVehicle';
import { STORAGE_KEYS } from '../utils/constants';

/**
 * Vehicle profile + mileage management hook.
 */
export function useVehicle() {
  const [vehicle, setVehicle, loading] = useStorage(STORAGE_KEYS.VEHICLE, null);

  // Initialize with defaults if no vehicle exists
  const initVehicle = useCallback(() => {
    if (!vehicle) {
      const defaultVehicle = getDefaultVehicle();
      setVehicle(defaultVehicle);
      return defaultVehicle;
    }
    return vehicle;
  }, [vehicle, setVehicle]);

  // Update mileage
  const updateMileage = useCallback((newKm, date = new Date().toISOString().split('T')[0]) => {
    if (!vehicle) return;
    if (newKm < vehicle.currentMileage) {
      return { error: 'New mileage cannot be lower than current mileage' };
    }
    setVehicle({
      ...vehicle,
      currentMileage: newKm,
      mileageHistory: [
        ...vehicle.mileageHistory,
        { date, km: newKm },
      ],
      updatedAt: new Date().toISOString(),
    });
    return { success: true };
  }, [vehicle, setVehicle]);

  // Correct mileage (allows lower — fixes a wrong reading).
  // Drops history points above the corrected value and appends a correction point.
  const correctMileage = useCallback((newKm, date = new Date().toISOString().split('T')[0]) => {
    if (!vehicle) return;
    if (typeof newKm !== 'number' || isNaN(newKm) || newKm <= 0) {
      return { error: 'Enter a valid mileage' };
    }
    const trimmed = (vehicle.mileageHistory || []).filter((h) => h.km <= newKm);
    setVehicle({
      ...vehicle,
      currentMileage: newKm,
      mileageHistory: [
        ...trimmed,
        { date, km: newKm, corrected: true },
      ],
      updatedAt: new Date().toISOString(),
    });
    return { success: true };
  }, [vehicle, setVehicle]);

  // Update profile fields
  const updateProfile = useCallback((updates) => {
    if (!vehicle) return;
    setVehicle({
      ...vehicle,
      ...updates,
      updatedAt: new Date().toISOString(),
    });
  }, [vehicle, setVehicle]);

  return {
    vehicle,
    setVehicle,
    loading,
    initVehicle,
    updateMileage,
    correctMileage,
    updateProfile,
  };
}
