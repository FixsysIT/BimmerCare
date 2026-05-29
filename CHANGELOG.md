# Changelog

## v1.0-mvp — 2026-05-29

First functional MVP. Personal maintenance tracker for a BMW F10 523i (N53),
offline-first PWA. Catalog version `2026.05.29-p2`.

### Status engine
- No false "overdue" reds. Removed the synthetic purchase-date baseline that
  made every interval item on a high-mileage car read as massively overdue.
- Six-status taxonomy: **Nu doen / Binnenkort / Inspectie nodig / Monitor /
  OK / Geen data**.
- No-history behaviour by strategy: on-failure → Monitor, condition →
  Inspectie nodig, interval → Geen data. Only a genuinely-due interval (flagged
  "nooit vervangen") goes red automatically.

### History-based maintenance log
- Service / inspection / diagnosis events are written to each item's
  `history[]` (the single source of truth) with type, result, mileage, date.
- `manualStatus` mirrors the latest event as a quick status cache/override.

### Dashboard quick actions
- Register a service, or set an inspection/diagnosis result, directly from the
  card — no need to open and scroll.
- Strategy-aware controls: interval → "Markeer als vervangen"; condition →
  OK / Monitoren / Versleten / Vervangen nodig; on-failure → Monitor / Geen
  fout / Fout aanwezig / Vervangen.
- Clickable status rings + hero status-chips deep-link to the filtered list.
- Compact garage-cockpit hero with the vehicle photo and big odometer.

### Visibility layers
- Every item is tagged **Actief onderhoud**, **Inspectiepunten** or
  **Diagnose / Monitor** (auto-derived from strategy, overridable).
- Maintenance page has layer tabs; default view is **Actief onderhoud**, so the
  dashboard stays usable as the catalog grows.

### Inspection packages
- Four ready checklists: Jaarlijkse BMW inspectie, Nulmeting 180k / onbekende
  historie, Misfire diagnose N53, Koelprobleem diagnose.

### Exports
- JSON backup + restore.
- Editable CSV round-trip (intervals + parts) with an embedded legend, merged
  back by id — never overwrites history/status.
- Maintenance items, maintenance history, and a full debug-state JSON
  (incl. catalog version, computed statuses, missing-item/metadata audit).
- Compact **garage checklist** export (markdown).

### Catalog migration (non-destructive)
- "Catalogus bijwerken" merges the latest default catalog into existing stored
  data **by name**: adds new items, fills missing metadata, syncs category —
  while keeping all history, statuses, baselines and user edits. Idempotent,
  with a preview before applying.

### Catalog
- 61-item BMW F10 523i N53 catalog: engine, cooling, brakes, transmission,
  driveline, tires, suspension, electrical, engine-electronics, A/C, exterior,
  and N53-specific diagnosis items. BMW-official vs community intervals shown
  side by side; part numbers where known.

### Known limitations / next
- Quick pills log without a free-text note (1-click by design).
- New P2 inspection/diagnosis items have no OEM part numbers yet (P3).
- Status is dual-tracked (history event + `manualStatus` mirror); a later
  cleanup will derive status purely from the latest event (P2.1).
