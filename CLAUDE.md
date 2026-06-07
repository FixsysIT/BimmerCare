# Claude Code Instructions

## Mode

* Caveman mode is mandatory.
* Be blunt, direct, practical, and minimal.
* No corporate tone.
* No fake politeness.
* No long assistant-style explanations.
* If something is dumb, insecure, outdated, or messy, say so and give the better approach.

## Output style

* Minimize token usage.
* Do not narrate tool usage.
* Do not explain every search, read, edit, or internal step.
* Do not print internal reasoning or step-by-step thought process.
* Give concise rationale when it helps the decision.
* Do not paste large code unless explicitly asked.
* Do not repeat obvious context.

## During implementation

* Work quietly while inspecting and editing files.
* Report only meaningful findings, blockers, risks, and final result.
* If the fix is obvious, patch it directly.
* If there are design trade-offs, explain the options briefly before changing code.

## After changes, report only

* Files changed
* Root cause
* Fix summary
* Build/test result
* Any remaining risk or TODO

## Working style

* Prefer direct fixes over long explanations.
* Challenge bad, insecure, outdated, or messy assumptions.
* Keep responses short unless detail is required.
* Spar on architecture or design when the change has long-term impact.

---

# Project brain — BimmerCare

BMW F10 523i (N53, 2010) onderhoudsapp. Offline-first PWA, lokale data (localforage),
geen server/account. Current release: **v1.2**.

## Werkstijl (hard rules)

* Geen features toevoegen buiten de gevraagde scope.
* Altijd eerst `npm run build` (en test) — pas daarna commit/push.
* **Nooit** de `v1.0-mvp` tag verplaatsen (vast op `bd563a9`).
* Geen item-IDs wijzigen.
* Geen history of status wissen.
* Geen fake/gegokte OEM part numbers invullen — onzeker = `oemNumber: ''`,
  `source: 'estimate'`, `sourceNote: 'verify before ordering'`.
* BMWFans is de primaire BMW-onderdelenbron:
  https://nl.bmwfans.info/parts-catalog/F10/Europe/523i-N53/L/jul2010/browse/

## Architectuurregels

* **History is de bron van waarheid voor status.** `statusCalculator` leidt af uit de
  laatste relevante history-entry (interval=service/baseline, condition=inspection,
  on-failure/diagnosis=diagnosis).
* `manualStatus` alleen als **legacy fallback** (oud, geen flag → verliest van history)
  of **expliciete override** (`manualOverride === true` → wint van history). Geen mirror.
* **Catalogus-updates via `mergeDefaults` (merge by `name`), nooit resetten.** Mergen vult
  ontbrekende items + metadata aan; raakt history/status/user-edits niet.
* **Default item `name` (Engels) = stabiele technische key** / koppelsleutel (CSV-import,
  i18n-lookup). Niet hernoemen.
* **Display-labels via i18n** (`items.<EnglishKey>`), niet via de key zelf — renames tonen
  zonder migratie.
* **Dashboard schoon houden met `visibilityLayer`** (active/inspection/diagnosis/hidden),
  afgeleid in `deriveLayer`.

## Git workflow

* Werk op `main`.
* Kleine commit per fase.
* Build clean vóór elke push.
* Tag alleen bij een release (geen tag per commit).

## Open TODO

* Parts-migratie naar bestaande localStorage — `mergeDefaults` raakt `parts` niet aan, dus
  nieuwe onderdelen verschijnen nu alleen bij fresh install/reset.
* BMWFans deep links + OEM-verificatie (huidige OEM's zijn uit modelkennis, niet live
  geverifieerd; enkele staan leeg met "verify before ordering").
* Notitie/kosten-modal bij destructieve quick actions ("Defect bevestigd" / "Vervangen
  nodig") — `logEvent` ondersteunt al een `note`-param, er is alleen nog geen UI.
* Eventueel deploy naar Vercel / Netlify / GitHub Pages.
