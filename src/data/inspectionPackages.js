/**
 * Inspection / diagnosis checklists for BMW F10 523i N53.
 * Compact, garage-ready — NOT a dump of every part.
 * `kind`: 'inspection' | 'diagnosis' (just for grouping/labels).
 */
export const inspectionPackages = [
  {
    id: 'annual-bmw',
    kind: 'inspection',
    name: 'Jaarlijkse BMW inspectie',
    items: [
      'Remschijven, remblokken en remslangen',
      'Bandenprofiel, DOT en droogtescheuren',
      'Onderstel op speling: draagarmen, fuseekogels, stuurkogels',
      'Schokdempers op lekkage/slijtage',
      'Koelsysteem: slangen, expansievat, radiateur, lekkage',
      'Motorolie lekkage: klepdeksel, oliefilterhuis, carterpan',
      'Multiriem, spanrol en looprollen',
      'Motorsteunen en baksteun',
      'Hardyschijf/aandrijflijn op scheuren/speling',
      'Accu/laadspanning',
      'Airco werking/lekkage',
      'ISTA foutcodes uitlezen',
    ],
  },
  {
    id: 'baseline-180k',
    kind: 'inspection',
    name: 'Nulmeting 180k / onbekende historie',
    items: [
      'Motorolie + oliefilter',
      'Remvloeistof',
      'Bougies indien onbekend',
      'Luchtfilter + microfilter',
      'Koelvloeistof status/lekkage',
      'Transmissieolie historie',
      'Differentieelolie historie',
      'Remmen rondom',
      'Banden DOT/profiel',
      'Koelsysteem: waterpomp/thermostaat/slangen/expansievat',
      'Onderstel + stuurdelen',
      'ISTA scan',
    ],
  },
  {
    id: 'misfire-n53',
    kind: 'diagnosis',
    name: 'Misfire diagnose N53',
    items: [
      'ISTA foutcodes uitlezen',
      'Bougie cilinder wisselen/testen',
      'Bobine cilinder wisselen/testen',
      'Injector correctie/waarden controleren',
      'Compressie/leakdown indien nodig',
      'Pas daarna injector vervangen',
    ],
  },
  {
    id: 'cooling-diag',
    kind: 'diagnosis',
    name: 'Koelprobleem diagnose',
    items: [
      'Foutcodes waterpomp/thermostaat',
      'Koelvloeistofniveau',
      'Lekkage slangen/radiateur/expansievat',
      'Elektrische waterpomp activatietest met ISTA',
      'Thermostaat werking',
      'Ontluchten volgens BMW procedure',
    ],
  },
];
