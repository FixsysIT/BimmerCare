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
    updateProfile,
  };
}
