import { useEffect, useMemo, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useStorage } from './useStorage';
import { STORAGE_KEYS, STATUS_REASONS, MAX_STATUS_EVENTS } from '../utils/constants';

/* Event kinds (label keys live under i18n `events.*`):
   new        → new catalog item appeared        (Nieuw)
   moved      → status/layer changed, neutral     (Verplaatst)
   expired    → OK window lapsed → back to Monitor (Vervallen)
   attention  → moved to inspect/orange/red        (Aandacht) */
function classify(fromStatus, toStatus, reason) {
  if (fromStatus === undefined) return 'new';
  if (reason === STATUS_REASONS.REPLACEMENT_EXPIRED || reason === STATUS_REASONS.NO_FAULT_EXPIRED) return 'expired';
  if (toStatus === 'red' || toStatus === 'orange' || toStatus === 'inspect') return 'attention';
  return 'moved';
}

/* Stable identity of a transition so we never log the same shift twice for the
   same odometer reading. */
function dedupeKey(e) {
  return `${e.itemId}|${e.fromStatus ?? ''}|${e.toStatus}|${e.reason ?? ''}|${e.mileage ?? ''}`;
}

/**
 * Watches computed item statuses and records transition events.
 * - First run after load just seeds the snapshot (no events).
 * - Then, whenever an item's computed status changes, appends one event.
 * - Dedupes by item+from+to+reason+mileage, caps at MAX_STATUS_EVENTS.
 */
export function useStatusEvents(itemsWithStatus, currentMileage) {
  const [events, setEvents, eventsLoading] = useStorage(STORAGE_KEYS.STATUS_EVENTS, []);
  const [snapshot, setSnapshot, snapLoading] = useStorage(STORAGE_KEYS.STATUS_SNAPSHOT, null);

  // signature of the current computed statuses — drives the diff effect
  const signature = useMemo(
    () => (itemsWithStatus || []).map((i) => `${i.id}:${i.calculatedStatus?.status}:${i.calculatedStatus?.statusReason ?? ''}`).join('|'),
    [itemsWithStatus],
  );

  useEffect(() => {
    if (eventsLoading || snapLoading) return;
    if (!itemsWithStatus || !itemsWithStatus.length) return;

    const next = {};
    itemsWithStatus.forEach((i) => { next[i.id] = i.calculatedStatus?.status; });

    // first time we have data → seed snapshot silently
    if (snapshot == null) { setSnapshot(next); return; }

    const fresh = [];
    itemsWithStatus.forEach((i) => {
      const from = snapshot[i.id];
      const to = i.calculatedStatus?.status;
      if (to === undefined) return;
      if (from === to) return;
      const reason = i.calculatedStatus?.statusReason ?? null;
      fresh.push({
        id: uuidv4(),
        itemId: i.id,
        itemName: i.name,
        fromStatus: from ?? null,
        toStatus: to,
        kind: classify(from, to, reason),
        reason,
        message: i.calculatedStatus?.message ?? null,
        createdAt: new Date().toISOString(),
        mileage: currentMileage ?? null,
        acknowledged: false,
      });
    });

    if (fresh.length) {
      setEvents((prev) => {
        const seen = new Set((prev || []).map(dedupeKey));
        const add = fresh.filter((e) => !seen.has(dedupeKey(e)));
        if (!add.length) return prev;
        return [...(prev || []), ...add].slice(-MAX_STATUS_EVENTS);
      });
    }
    setSnapshot(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, eventsLoading, snapLoading]);

  const acknowledge = useCallback((id) => {
    setEvents((prev) => (prev || []).map((e) => (e.id === id ? { ...e, acknowledged: true } : e)));
  }, [setEvents]);

  const acknowledgeAll = useCallback(() => {
    setEvents((prev) => (prev || []).map((e) => ({ ...e, acknowledged: true })));
  }, [setEvents]);

  // ack every event for one item (used when the user opens/handles that item)
  const acknowledgeItem = useCallback((itemId) => {
    setEvents((prev) => (prev || []).map((e) => (e.itemId === itemId ? { ...e, acknowledged: true } : e)));
  }, [setEvents]);

  // Restore both halves of the diff pair on a JSON import — the events log AND
  // the snapshot it was diffed against. Without this, importing an older/newer
  // backup left the LIVE snapshot in place, so the very next render diffed the
  // freshly-imported statuses against a snapshot from a different point in
  // time and could fire bogus transition events.
  const restoreEvents = useCallback((evts, snap) => {
    setEvents(evts || []);
    setSnapshot(snap ?? null);
  }, [setEvents, setSnapshot]);

  return { events: events || [], snapshot, acknowledge, acknowledgeAll, acknowledgeItem, restoreEvents };
}
