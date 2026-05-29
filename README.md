# BimmerCare

Offline-first onderhoudsapp voor een **BMW F10 523i (N53, 2010)**. Houdt onderhoud,
intervallen, inspecties en diagnoses bij, en zet BMW-officiële naast community-intervallen
met OEM-onderdelen en kostenramingen. Persoonlijk, geen account, geen server — alle data
staat lokaal (localforage / IndexedDB).

**Current version: v1.1**

## Features

- **Onderhoudslog** — service-historie per item is de bron van waarheid.
- **Status-dashboard** — 6-status taxonomie (Nu doen / Binnenkort / Inspectie nodig /
  Monitor / OK / Geen data) met klikbare status-ringen.
- **Layers** — Actief onderhoud / Inspectiepunten / Diagnose-Monitor, om het dashboard
  schoon te houden naarmate de catalogus groeit (`visibilityLayer`).
- **Quick actions** — per item direct registreren of een inspectie/diagnose-resultaat
  loggen (incl. "Defect bevestigd" → rood).
- **Inspectiepakketten** — kant-en-klare checklists (Jaarlijkse BMW inspectie,
  Nulmeting 180k, Misfire diagnose N53, Koelprobleem diagnose).
- **Garage checklist export** — compacte, printbare markdown-werkorder.
- **Catalogus-migratie zonder history wipe** — nieuwe standaard-items + metadata mergen
  in een bestaande lijst zonder historie/statussen te raken.
- **CSV round-trip** — intervallen en onderdelen exporteren, bewerken (Excel/Sheets/LLM)
  en terug importeren, gekoppeld op id.

## Stack

React 19 · Vite 8 · react-router 7 · react-i18next (NL primair / EN fallback) ·
localforage · date-fns · framer-motion · vite-plugin-pwa.

## Install / start

```bash
npm install
npm run dev      # dev server (HMR)
npm run build    # production build naar dist/
npm run preview  # preview de build
npm run lint     # eslint
```

## Release tags

| Tag        | Betekenis |
|------------|-----------|
| `v1.0-mvp` | Eerste stabiele MVP. Blijft onaangeraakt op commit `bd563a9`. |
| `v1.1`     | history-derived status + "Defect bevestigd" (confirmed failure) action + top onderhoudsparts-data. |

## Documentatie

Architectuur, werkstijl en open TODO's staan in [`CLAUDE.md`](./CLAUDE.md) — het projectbrein
voor toekomstige development. Volledige productspec in [`PRODUCT.md`](./PRODUCT.md).
