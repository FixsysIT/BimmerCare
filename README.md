<div align="center">

# BimmerCare

**The maintenance cockpit for the BMW F10 with the N53 engine — 523i · 525i · 528i · 530i, 2009–2011.**

Offline-first PWA. Your service history drives everything. All data stays on your device.

&nbsp;

![version](https://img.shields.io/badge/version-1.2-0066b1?style=flat-square)
![PWA](https://img.shields.io/badge/offline--first-PWA-5a2ca0?style=flat-square)
![React 19](https://img.shields.io/badge/React-19-149eca?style=flat-square)
![data](https://img.shields.io/badge/data-100%25%20on--device-1f9d55?style=flat-square)

&nbsp;

<img src="./src/assets/f10-hero-airport.jpg" alt="BMW F10 523i" width="760" />

</div>

---

BimmerCare tracks the upkeep of the **N53-engined BMW F10**, not a generic garage
fleet. Every item in the catalog carries BMW's official interval next to the
community / ZF recommendation, the OEM part number, and a cost estimate. Nothing
is tracked twice: your **service history is the single source of truth**, and
status, urgency and planning are all derived from it.

The catalog was built and tuned on a 2010 523i, but the parts and intervals
apply across the N53 range — the intervals, mileage and history you log are your
car's own.

## Check Control

The dashboard reads like the car's instrument cluster. Every item resolves to
one of six states — the way a Check Control lamp lights up when something needs
attention.

| | State | What it means |
|---|-------|---------------|
| 🔴 | **Now** | Overdue. Do it. |
| 🟠 | **Soon** | Due shortly — plan it in. |
| 🔵 | **Inspect** | Needs a look; no fixed interval. |
| 🟣 | **Monitor** | Watch it — a known symptom or on-failure part. |
| 🟢 | **OK** | Done and within interval. |
| ⚪ | **No data** | Never logged. Set a baseline to start the clock. |

Clickable status rings on the dashboard drill straight into the matching list.

## What it does

### Track

- **Maintenance log** — one history per item feeds every status calculation.
- **Quick actions** — register a service, log an inspection or diagnosis result,
  or reset an interval timer without claiming a replacement.
- **Layers** — *Active*, *Inspection* and *Diagnosis* views keep the dashboard
  readable as the catalog grows past 60 items.
- **Do-together bundles** — parts that belong to one job (front suspension +
  alignment, the oil zone, the belt drive) group together with a companion
  picker and plan as a single visit. Items stay independent; the bundle is only
  the relationship.

### Plan & budget

- **Budget planner** — create named saving sessions with a date and how much
  you'll have by then. Jobs distribute by urgency or you compose a session
  yourself; inspections ride along related work for free. Lock a session, add
  free line items (incl. labour), and pin per-job prices.
- **Parts & shops** — grouped per job, with OEM / alternative numbers as
  one-click copy chips, prefilled search links to Winparts and Motointegrator,
  a recommended brand, and indicative labour hours and cost.
- **Advice export** — copy the whole plan as readable markdown for a second
  opinion: does every visit make sense, what can go together, what needs its own
  appointment.

### Inspect & keep data safe

- **Inspection packages** — ready-made checklists: annual BMW inspection, a 180k
  baseline, N53 misfire diagnosis, cooling-system diagnosis.
- **Garage checklist export** — a compact, printable work order.
- **Non-destructive catalog upgrades** — new default items and metadata merge
  into your list without touching history, status, or anything you edited.
- **CSV round-trip** — export intervals and parts, edit them in Excel / Sheets /
  an LLM, and import them back.
- **Full JSON backup** — export and re-import everything, including projects and
  dashboard alerts.

## Which cars it fits

The catalog is built around the **N53** straight-six and its known quirks —
misfire-prone coils, walnut-blasting the intake, DISA valves, NOx sensors,
electromechanical steering (no hydraulic fluid to change). Each entry weighs
BMW's "lifetime / 25k" line against what the community actually does to keep
these engines alive.

| Group | Fits |
|-------|------|
| **Engine** parts & intervals | Pre-LCI F10 / F11 with the N53: **523i · 525i** (N53B25) and **528i · 530i** (N53B30), roughly **2009–2011**. Not the N20 520i, the N55 535i, or the diesels. |
| **Chassis** parts (suspension, brakes, driveline) | The wider F10 / F11 range. Watch two things: **xDrive** front axles differ from RWD, and **brake sizes** vary by engine and M-sport package. |

Your mileage, service history and planning stay specific to your own car.

## Run it

```bash
npm install
npm run dev       # dev server with HMR
npm run build     # production build to dist/
npm run preview   # preview the build locally
npm run lint      # eslint
```

## Data & privacy

Everything lives on your device through IndexedDB / localStorage — **no account,
no server, no telemetry.** Install it as a PWA and it works fully offline. The
only data that ever leaves is what you choose to export.

## Releases

| Tag | Highlights |
|-----|------------|
| `v1.0-mvp` | First stable MVP. Pinned to `bd563a9`, never moved. |
| `v1.1` | History-derived status · "Confirmed failure" action · parts data. |
| `v1.2` | Budget planner · do-together bundles · humanised card status. |

## Docs

| File | What's inside |
|------|---------------|
| [`ARCHITECTURE.md`](./ARCHITECTURE.md) | Data model, catalog rules, bundle roles, stack. |
| [`PRODUCT.md`](./PRODUCT.md) | Full product specification. |
| [`CHANGELOG.md`](./CHANGELOG.md) | Version history. |

---

<div align="center">
<sub>Personal project · all rights reserved · not for redistribution.</sub>
</div>
