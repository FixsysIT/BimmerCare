/**
 * Verbruiksartikelen per klus — advies-only, geen catalog items.
 *
 * Keyed op de stabiele Engelse item-`name` (zelfde koppelsleutel als bundles).
 * Elke entry is een {nl, en} adviesregel inclusief hoeveelheid. Getoond als
 * hint-sectie in de CompanionPicker bij het registreren van een service:
 * niets wordt gelogd, het is een boodschappenlijstje voor de klus.
 *
 * Bewust hier in code (niet in bundles.js): de bundles-CSV-import vervangt de
 * hele bundelset en zou dit veld kwijtraken. Aanpassen = dit bestand editen.
 */

const BRAKE_CLEANER_1 = {
  nl: 'Remreiniger: 1 bus 500 ml',
  en: 'Brake cleaner: 1 can 500 ml',
};
const BRAKE_CLEANER_2 = {
  nl: 'Remreiniger: 2 bussen 500 ml (conserveringslaag nieuwe schijven verwijderen)',
  en: 'Brake cleaner: 2 cans 500 ml (strip the protective coating off new discs)',
};
const BRAKE_PASTE = {
  nl: 'Anti-piep rempasta (Plastilube/ATE): 1 tube, dun op contactpunten, nooit op wrijvingsvlak',
  en: 'Anti-squeal brake paste (Plastilube/ATE): 1 tube, thin layer on contact points, never on friction surface',
};
const DISC_SET_SCREW = {
  nl: 'Borgschroef remschijf: 1 per schijf, zit vaak vastgeroest, nieuw meebestellen',
  en: 'Disc retaining screw: 1 per disc, often seized, order new ones',
};
const DEGREASER = {
  nl: 'Motorruimtereiniger/ontvetter: 1 bus 500 ml (gelekte olie wegspoelen)',
  en: 'Engine bay cleaner/degreaser: 1 can 500 ml (wash off leaked oil)',
};
const SEAL_SURFACE_CLEANER = {
  nl: 'Remreiniger: 1 bus 500 ml (afdichtvlakken vetvrij maken)',
  en: 'Brake cleaner: 1 can 500 ml (degrease the sealing surfaces)',
};
const COOLANT_MIX = [
  {
    nl: 'BMW koelvloeistof (blauw): 3 flessen 1,5 L concentraat voor 50/50 (systeem ±8 L)',
    en: 'BMW coolant (blue): 3 bottles 1.5 L concentrate for 50/50 (system ±8 L)',
  },
  {
    nl: 'Gedemineraliseerd water: ±5 L voor de 50/50 mix',
    en: 'Demineralised water: ±5 L for the 50/50 mix',
  },
];

export const CONSUMABLES = {
  // ── Banden ──────────────────────────────────────────
  // Nieuwe banden komen zonder bouten: banden gaan op de bestaande velgen,
  // wielbouten blijven zitten. Verroeste bouten dus zelf (laten) vervangen.
  'Tires (×4)': [
    {
      nl: 'Wielbouten: check op roest bij montage, verroest = vervangen (20 stuks M14×1,25, ±€2 per stuk, zit niet bij nieuwe banden)',
      en: 'Wheel bolts: check for rust during fitting, rusted = replace (20 pcs M14×1.25, ±€2 each, not included with new tyres)',
    },
    {
      nl: 'Wielslot (slotbouten): 1 set van 4 met adapter (velgbeveiliging tegen diefstal, meebestellen bij nieuwe velgen/banden)',
      en: 'Wheel lock (locking bolt set): 1 set of 4 with key adapter (anti-theft, order with new wheels/tyres)',
    },
  ],

  // ── Remmen ──────────────────────────────────────────
  'Brake Discs Front': [BRAKE_CLEANER_2, BRAKE_PASTE, DISC_SET_SCREW],
  'Brake Discs Rear': [BRAKE_CLEANER_2, BRAKE_PASTE, DISC_SET_SCREW],
  'Brake Pads Front': [BRAKE_CLEANER_1, BRAKE_PASTE],
  'Brake Pads Rear': [BRAKE_CLEANER_1, BRAKE_PASTE],

  // ── Pakkingen / olielek ─────────────────────────────
  'Oil Pan Gasket': [SEAL_SURFACE_CLEANER, DEGREASER],
  'Valve Cover Gasket + PCV': [SEAL_SURFACE_CLEANER, DEGREASER],
  'Oil Filter Housing Gasket': [SEAL_SURFACE_CLEANER, DEGREASER],

  // ── Vloeistoffen: hoeveelheden ──────────────────────
  'Coolant Flush': COOLANT_MIX,
  'Water Pump (electric)': COOLANT_MIX,
  'Thermostat': COOLANT_MIX,
  'Transmission Fluid (ZF)': [
    {
      nl: 'ZF Lifeguard 6 ATF: 6 tot 7 L nodig bij pan-drop (ZF 6HP19)',
      en: 'ZF Lifeguard 6 ATF: 6 to 7 L needed for a pan-drop service (ZF 6HP19)',
    },
  ],
  'Differential Fluid': [
    {
      nl: 'Differentieelolie 75W-90: ±1,1 L (1 fles 1 L is nét te weinig, neem 2)',
      en: 'Differential oil 75W-90: ±1.1 L (one 1 L bottle is just short, take 2)',
    },
  ],
  'Power Steering Fluid': [
    {
      nl: 'Pentosin CHF 11S: 1 tot 1,5 L bij verversen via afzuigen reservoir',
      en: 'Pentosin CHF 11S: 1 to 1.5 L when refreshing via reservoir suction',
    },
  ],
};

/** Adviesregels ({nl,en}) voor een item, lege array als er niets te adviseren valt. */
export function getConsumables(itemName) {
  return CONSUMABLES[itemName] || [];
}
