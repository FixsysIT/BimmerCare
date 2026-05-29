import { useState, useEffect, useCallback } from 'react';
import localforage from 'localforage';

// Configure localForage
localforage.config({
  name: 'BimmerCare',
  storeName: 'bimmercare_data',
  description: 'BimmerCare maintenance tracker data',
});

/**
 * Hook wrapping localForage for async IndexedDB storage.
 * Returns [value, setValue, loading] — similar to useState but persisted.
 */
export function useStorage(key, defaultValue) {
  const [value, setValue] = useState(defaultValue);
  const [loading, setLoading] = useState(true);

  // Load from storage on mount
  useEffect(() => {
    let mounted = true;
    localforage.getItem(key).then((stored) => {
      if (mounted) {
        if (stored !== null && stored !== undefined) {
          setValue(stored);
        }
        setLoading(false);
      }
    }).catch(() => {
      if (mounted) setLoading(false);
    });
    return () => { mounted = false; };
  }, [key]);

  // Persist on change
  const setAndPersist = useCallback((newValue) => {
    setValue((prev) => {
      const resolved = typeof newValue === 'function' ? newValue(prev) : newValue;
      localforage.setItem(key, resolved).catch(console.error);
      return resolved;
    });
  }, [key]);

  return [value, setAndPersist, loading];
}

/**
 * Direct storage access (non-hook).
 */
export const storage = {
  get: (key) => localforage.getItem(key),
  set: (key, value) => localforage.setItem(key, value),
  remove: (key) => localforage.removeItem(key),
  clear: () => localforage.clear(),
};
