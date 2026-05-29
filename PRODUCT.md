# BimmerCare — Productsamenvatting

## Wat is het?

BimmerCare is een persoonlijke onderhoudstracker voor een BMW F10 523i met N53 motor. Een Progressive Web App (PWA) die lokaal draait in de browser, zonder account, zonder server — alle data blijft op je eigen apparaat.

## Waarom bestaat het?

De N53 motor is een van BMW's meest complexe en onderhoudsgevoelige motoren (direct injection + lean burn + NOx opslag katalysator). BMW's eigen onderhoudsschema (CBS) is onvoldoende:

- **BMW zegt 25.000 km voor olie** — community weet dat 10.000 km beter is voor N53 levensduur
- **BMW zegt "lifetime" voor transmissieolie** — ZF zelf zegt 80-100k km
- **BMW heeft geen interval voor waterpomp** — community doet het preventief op 120k km (kapot = motor oververhit = koppakking)
- **N53-specifieke onderdelen** (piëzo verstuivers, NOx sensor, HPFP) worden door BMW niet preventief onderhouden maar kosten duizenden euro's bij falen

Er bestond geen tool die BMW-officieel EN community-advies naast elkaar toont, met echte OEM-nummers en geschatte kosten.

## Voor wie?

Primair: Saddik, eigenaar van de F10 523i N53. Secundair: andere BMW-eigenaren die serieus hun auto willen onderhouden op basis van community-kennis ipv alleen dealer-advies.

## Kernprobleem dat het oplost

> "Ik wil in 1 oogopslag zien wat er aan mijn auto gedaan moet worden, wat het kost, en wanneer — gebaseerd op echte kennis, niet op BMW's minimale schema."

## Kernfuncties

### 1. Onderhoudsoverzicht met statusberekening
- **45 onderhoudsitems** met echte OEM-nummers, alternatieve merken, richtprijzen
- **Statusberekening** (groen/oranje/rood) op basis van km-stand en tijd
- **Vier interval-types**: km-dominant, tijd-dominant, op conditie, diagnose
- **Drie vervangingsstrategieen**: periodiek (vast interval), op conditie (slijtage), bij storing (alleen als kapot)
- **Koopmoment als baseline**: als je nog nooit een beurt hebt geregistreerd, rekent de app vanaf je aankoopdatum — niet "geen data"

### 2. Duaal interval-advies
Elk item toont TWEE intervallen:
- **BMW officieel**: wat de dealer zegt
- **Community**: wat ervaren eigenaren/specialisten adviseren

Dit is de kern van BimmerCare — de gap tussen dealer-advies en realiteit zichtbaar maken.

### 3. Kostenoverzicht
- Geschatte kosten per item (onderdelen + arbeid incl. BTW)
- Werkelijke kosten bijhouden na elke beurt
- Totaal per maand, per 1.000 km, per categorie

### 4. Onderdelencatalogus
- OEM-nummers voor elk onderdeel
- Alternatieve merken (MANN, TRW, Bilstein, etc.)
- Richtprijzen
- BMWFans links

### 5. Data-eigenaarschap
- Alles in localStorage/IndexedDB — geen cloud
- JSON export/import voor backup
- Auto-backup herinnering na X wijzigingen

## Technische keuzes

| Keuze | Waarom |
|-------|--------|
| React + Vite | Snel, modern, goede DX |
| PWA | Offline werken, installeerbaar, geen app store |
| localStorage (localForage) | Geen server nodig, privacy, eenvoud |
| i18n (NL/EN) | Nederlands als hoofdtaal, Engels als fallback |
| BMW dark theme | Past bij het merk, prettig voor de ogen |
| Geen account/server | Geen hosting kosten, geen privacy issues, geen afhankelijkheid |

## Datavelden per onderhoudsitem

- `name` — naam van het onderhoudsitem
- `category` — Motor, Koeling, Remmen, Transmissie, Banden, Onderstel, Elektrisch, N53-Specifiek
- `intervalType` — km-dominant, time-dominant, condition, diagnosis
- `replacementStrategy` — interval (periodiek), condition (op slijtage), on-failure (alleen bij defect)
- `intervalKm` / `intervalMonths` — actief interval voor statusberekening
- `bmwIntervalKm` / `bmwIntervalMonths` — BMW officieel advies
- `communityIntervalKm` / `communityIntervalMonths` — community advies
- `estimatedTotalCost` — geschatte totaalkosten (onderdelen + arbeid incl. BTW)
- `warningKm` / `warningDays` — drempel voor oranje status
- `parts[]` — onderdelen met OEM-nummer, alternatief merk, richtprijs
- `history[]` — geregistreerde beurten met datum, km, kosten, garage, notities

## Oorsprong

Het idee ontstond uit frustratie met:
1. BMW dealer-advies dat te optimistisch is voor de N53
2. Forum-kennis die verspreid zit over tientallen threads
3. Geen enkel bestaand tool dat BMW + community advies combineert
4. Excel-lijstjes die onoverzichtelijk worden

BimmerCare bundelt al die kennis in een visuele, makkelijk bij te houden app.

## Richting / visie

BimmerCare is bewust een **persoonlijk hulpmiddel**, geen SaaS-product. Kernprincipes:

- **Offline-first** — werkt zonder internet
- **Data van de gebruiker** — geen cloud lock-in
- **Eerlijk advies** — community-kennis boven dealer-marketing
- **Praktisch** — wat kost het, wanneer moet het, welk onderdeelnummer heb ik nodig
- **Simpel** — geen overbodige features, geen analytics, geen tracking
