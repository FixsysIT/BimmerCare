# BimmerCare — TODO

## 🔴 Technische fixes

- [ ] `sortByUrgency()` in `statusCalculator.js` — roept `calculateStatus` aan zonder `vehicle` param. Exported functie, kan breken
- [ ] "Enable" knop hardcoded Engels — `↩ Enable` in `MaintenancePage.jsx`
- [ ] Add Item modal in `SettingsPage.jsx` — labels hardcoded Engels ("Name", "Category", "Interval Type", etc.)
- [ ] Add Item modal mist nieuwe velden: `replacementStrategy`, `estimatedTotalCost`, `bmwIntervalKm/Months`, `communityIntervalKm/Months`
- [ ] `PriorityBadge.jsx` — dood bestand, nergens meer gebruikt. Verwijderen

## 🟡 Functioneel mist

- [ ] Kostenschatting overzicht — `estimatedTotalCost` per item bestaat, maar geen totaaloverzicht "wat kost het als ik alles doe"
- [ ] Km-per-jaar invoer — app kan niet voorspellen *wanneer* next service is qua datum
- [ ] Status messages zijn Engels — "Monitor — replace on failure", "X km overdue", etc. Moet vertaald via i18n
- [ ] Dashboard UrgentItems — toont message maar geen kostenindicatie of interval info
- [ ] Costs page — alleen werkelijke kosten, geen *verwachte* kostenplanning

## 🔵 Nice-to-haves

- [ ] Zoekbalk in onderhoud — 45 items, filteren op naam
- [ ] Kosten grafiek — per maand/jaar visueel (chart library nodig)
- [ ] Foto/bon upload — `receiptLink` bestaat maar is handmatig URL
- [ ] Notificatie/herinnering — PWA push als iets rood wordt
- [ ] Kilometerstand historie — alleen huidige opgeslagen, geen trend/grafiek
- [ ] PDF-export van gedane beurten — alle geregistreerde onderhoudsbeurten (datum, km, garage, kosten, onderdelen, notities) netjes opgemaakt als PDF. (CSV-schema-export bestaat al in Settings → Databeheer)
