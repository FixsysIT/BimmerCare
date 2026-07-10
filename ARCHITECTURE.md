# Architecture

How BimmerCare is put together, and the rules that keep the data trustworthy.
Read this before changing the catalog, the status engine, or the storage layer.

## Data model

- **Local only.** Everything lives on the device through `localforage`
  (IndexedDB / localStorage). No backend, no account, no sync. A full JSON
  backup can be exported and re-imported at any time.
- **History is the single source of truth for status.** `statusCalculator`
  derives each item's state from its most recent relevant history entry:
  - `interval` → latest `service` / `baseline` event
  - `condition` → latest `inspection` event
  - `on-failure` / `diagnosis` → latest `diagnosis` event
  There is no parallel `lastDone*` field — a second copy would only drift.
- **`manualStatus` is not a mirror.** It is used only as a legacy fallback
  (old data with no flag → loses to history) or as an explicit override
  (`manualOverride === true` → wins over history).

## Catalog

- **The default item `name` (English) is the stable key.** It links i18n
  lookups, CSV import/merge, and bundle definitions. Never rename a key.
- **Display labels come from i18n** (`items.<EnglishKey>`, `partNames.<name>`,
  `partInfo.<name>`, `itemNotes.<name>`), never from the key itself — so a
  rename shows up without a data migration.
- **Catalog upgrades merge, never reset.** `mergeDefaults` adds missing items
  and fills missing metadata by matching on `name`; it never touches history,
  status, or user-edited fields. Bump `CATALOG_VERSION` to trigger the merge on
  existing installs. Targeted one-shot part corrections live in the same file,
  guarded by an obsolete-data marker so they run once.
- **The dashboard stays readable through `visibilityLayer`**
  (`active` / `inspection` / `diagnosis` / `hidden`), derived in `deriveLayer`.

## Parts data integrity

- **No guessed OEM numbers.** If a part number is uncertain, leave
  `oemNumber: ''` with `source: 'estimate'` and
  `sourceNote: 'verify before ordering'`.
- **Primary parts source:** BMWFans —
  <https://nl.bmwfans.info/parts-catalog/F10/Europe/523i-N53/L/jul2010/browse/>
- Item IDs are never changed. History and status are never wiped.

## Bundles

Items are never fused. A bundle is a relationship layer only: it groups linked
items and drives the "do together" companion picker. Member roles, strongest to
weakest: `mustReplace` → `mustWhenContext` → `optionalAddon` → `inspectOnly`,
plus free-text `reminder`. Add-on advice is context-aware — a companion is only
recommended when its own computed status warrants it.

## Stack

| Layer     | Choice |
|-----------|--------|
| UI        | React 19 · react-router 7 |
| Build     | Vite 8 · vite-plugin-pwa |
| i18n      | react-i18next (NL primary · EN fallback) |
| Storage   | localforage (IndexedDB / localStorage) |
| Dates     | date-fns |

## Working on it

- Work on `main`, one small commit per change.
- `npm run build` **and** `npm run lint` must be clean before every push.
- Tag only on a release, never per commit. The `v1.0-mvp` tag stays pinned to
  `bd563a9` and never moves.
- Keep changes inside the requested scope.
