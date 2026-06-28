<div align="center">

# BimmerCare

**Offline-first onderhoudsapp voor een BMW F10 523i · N53 · 2010**

Houdt service, intervallen, inspecties en diagnoses bij — BMW-officiële naast
community-intervallen, met OEM-onderdelen, kostenramingen en een eigen budgetplanner.
Persoonlijk, geen account, geen server: alle data blijft lokaal.

![version](https://img.shields.io/badge/version-1.2-0066b1)
![PWA](https://img.shields.io/badge/PWA-offline--first-5a2ca0)
![React](https://img.shields.io/badge/React-19-149eca)
![Vite](https://img.shields.io/badge/Vite-8-646cff)
![data](https://img.shields.io/badge/data-100%25%20lokaal-1f9d55)

<img src="./src/assets/f10-hero.jpg" alt="BMW F10 523i" width="720" />

</div>

---

## Overzicht

BimmerCare is een Progressive Web App die het onderhoud van één specifieke auto
beheert. Geen generieke garage-tool: de catalogus is afgestemd op de **F10 523i met
N53-motor**, met per onderdeel de officiële BMW-aanbeveling, de community-/ZF-aanbeveling,
OEM-nummers en een kostenraming. De **service-historie is de enige bron van waarheid** —
status, urgentie en planning worden daaruit afgeleid, niets wordt dubbel bijgehouden.

## Functionaliteit

### Onderhoud bijhouden
- **Onderhoudslog** — service-historie per item drijft alle status-berekening aan.
- **Status-dashboard** — 6-status taxonomie (Nu doen · Binnenkort · Inspectie nodig ·
  Monitor · OK · Geen data) met klikbare status-ringen die naar de juiste lijst diepen.
- **Layers** — Actief onderhoud / Inspectiepunten / Diagnose-Monitor houden het dashboard
  schoon naarmate de catalogus groeit.
- **Quick actions** — per kaart direct registreren, een inspectie- of diagnose-resultaat
  loggen, of de timer resetten zonder een vervanging te claimen.

### Plannen & budget
- **Budgetplan** — spaar-planner met eigen inplanmomenten: geef een naam, kies een datum
  en hoeveel geld je dan hebt (getypt of geschat uit budget + maandinleg). Klussen
  verdelen zich automatisch op urgentie, of stel een moment zelf samen. Klussen/momenten
  vastzetten, verwijderen, en aanvullen met vrije posten incl. arbeid. Inspecties liften
  gratis mee met logisch gekoppeld werk.
- **Advies-export** — kopieer het hele budgetplan als leesbare markdown naar het klembord
  voor een second opinion (bijv. via ChatGPT): klopt elk bezoek, kan iets samen, wat in
  een aparte afspraak.
- **Do-together bundels** — onderdelen die samen horen (vooronderstel + uitlijning,
  oliezone) worden gegroepeerd met een companion-picker en als één klus gepland.

### Inspectie & data
- **Inspectiepakketten** — kant-en-klare checklists (jaarlijkse BMW-inspectie,
  nulmeting 180k, misfire-diagnose N53, koelprobleem-diagnose).
- **Garage checklist export** — compacte, printbare markdown-werkorder.
- **Catalogus-migratie zonder history-wipe** — nieuwe standaard-items + metadata mergen in
  een bestaande lijst zonder historie of statussen te raken.
- **CSV round-trip** — intervallen en onderdelen exporteren, bewerken (Excel / Sheets / LLM)
  en terug importeren, gekoppeld op id.

## Tech-stack

| Laag        | Keuze |
|-------------|-------|
| UI          | React 19 · react-router 7 · framer-motion |
| Build       | Vite 8 · vite-plugin-pwa |
| i18n        | react-i18next (NL primair · EN fallback) |
| Opslag      | localforage (IndexedDB / localStorage) — geen backend |
| Datum/tijd  | date-fns |

## Aan de slag

```bash
npm install
npm run dev      # dev server met HMR
npm run build    # productie-build naar dist/
npm run preview  # build lokaal previewen
npm run lint     # eslint
```

## Releases

| Tag        | Inhoud |
|------------|--------|
| `v1.0-mvp` | Eerste stabiele MVP. Blijft onaangeraakt op commit `bd563a9`. |
| `v1.1`     | History-derived status · "Defect bevestigd" (confirmed failure) actie · onderhoudsparts-data. |
| `v1.2`     | Budgetplan (sessie-spaarplanner) · do-together bundels · gehumaniseerde kaartstatus. |

## Documentatie

| Bestand | Inhoud |
|---------|--------|
| [`CLAUDE.md`](./CLAUDE.md)   | Projectbrein: architectuurregels, werkstijl, open TODO's. |
| [`PRODUCT.md`](./PRODUCT.md) | Volledige productspecificatie. |

---

<div align="center">
<sub>Persoonlijk project · alle rechten voorbehouden · niet voor herdistributie.</sub>
</div>
