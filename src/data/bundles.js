/**
 * Bundle policy — do-together jobs.
 *
 * Items are NEVER fused; each stays an independent catalog item. A bundle is
 * only a relationship layer: it groups linked items and drives the "samen
 * meenemen" picker shown when you register a service.
 *
 * All `name` values MUST match a real catalog item name in defaultItems.js
 * (the stable English key). No invented items, no embedded parts here —
 * embedded parts (wear sensor, ZF filter kit, drain plug) already live in an
 * item's parts[] and need no linking.
 *
 * Two shapes:
 *  - `group`  : symmetric do-together set. Every member suggests the others.
 *               All members are mustReplace (riem off → tensioner mee).
 *  - trigger + `adds` : directional. Servicing a TRIGGER item suggests the
 *               adds, each with its own role.
 *
 * Member roles (see CompanionPicker), strongest → weakest:
 *  - mustReplace     (VERPLICHT)        checkbox checked by default, true
 *                    do-together job, logs service/replaced.
 *  - mustWhenContext (STERK AANGERADEN) checkbox shown UNchecked; skipping is
 *                    bad if the condition is true (old/brittle/worn/due).
 *                    Stronger styling than a plain add-on. Logs only when ticked.
 *  - optionalAddon   (ADD-ON)           checkbox UNchecked, cheap convenience
 *                    combo. Weak styling. Logs only when ticked.
 *  - inspectOnly     (INSPECT)          hint text only, no checkbox, logs nothing.
 *
 * Only `mustReplace` links join a visual cluster (bundleView.js); context /
 * addon / inspect attach as read-only rows under the cluster.
 *
 * `reminder` is a free operation that isn't a catalog item (e.g. battery coding).
 */

export const ROLES = {
  MUST: 'mustReplace',
  CONTEXT: 'mustWhenContext',
  ADDON: 'optionalAddon',
  INSPECT: 'inspectOnly',
};

export const BUNDLES = [
  // ── HARD-MUST do-together groups ──────────────────
  {
    id: 'belt-drive-service',
    title: { nl: 'Riemaandrijving', en: 'Belt drive' },
    group: ['Serpentine Belt', 'Idler Pulley / Tensioner'],
    reason: {
      nl: 'Riem eraf = spanrol/looprol meenemen. Goedkope delen, zelfde plek, anders dubbel werk.',
      en: 'Belt off = take the tensioner/idler too. Cheap parts, same spot, else double labour.',
    },
  },
  {
    id: 'cooling-pump-thermostat',
    title: { nl: 'Koelsysteem', en: 'Cooling system' },
    group: ['Water Pump (electric)', 'Thermostat', 'Coolant Flush'],
    reason: {
      nl: 'Zelfde koelsysteem: coolant eruit, daarna ontluchten. Waterpomp los doen is dom.',
      en: 'Same cooling system: coolant out, then bleed. Doing the pump alone is daft.',
    },
  },
  {
    id: 'front-brake-service',
    title: { nl: 'Remmen voor', en: 'Front brakes' },
    group: ['Brake Discs Front', 'Brake Pads Front'],
    reason: {
      nl: 'Nieuwe schijven met oude blokken is beun. Wear-sensor zit al als part bij de blokken.',
      en: 'New discs with old pads is a botch. Wear sensor is already a part on the pads.',
    },
  },
  {
    id: 'rear-brake-service',
    title: { nl: 'Remmen achter', en: 'Rear brakes' },
    group: ['Brake Discs Rear', 'Brake Pads Rear'],
    reason: {
      nl: 'Zelfde verhaal achter. Schijf = blokken mee.',
      en: 'Same story at the rear. Disc = pads with it.',
    },
  },

  // ── HARD-MUST-AFTER (geometry changed → align) ────
  {
    id: 'front-suspension-alignment',
    title: { nl: 'Vooronderstel + uitlijnen', en: 'Front suspension + alignment' },
    trigger: ['Control Arms / Ball Joints', 'Tie Rod Ends (×2)'],
    adds: [{ name: 'Wheel Alignment', role: ROLES.MUST }],
    reason: {
      nl: 'Geometrie veranderd = uitlijnen. Anders sloop je banden.',
      en: 'Geometry changed = wheel alignment. Otherwise you wreck tyres.',
    },
  },

  // ── SMART-MUST conditional add-ons ────────────────
  {
    id: 'annual-service-pack',
    trigger: ['Engine Oil + Filter'],
    adds: [
      { name: 'Air Filter', role: ROLES.ADDON },
      { name: 'Cabin Filter (×2)', role: ROLES.ADDON },
    ],
    reason: {
      nl: 'Toch een jaarbeurt? Lucht- en interieurfilter zijn goedkope add-ons (~€40).',
      en: 'Doing the annual service anyway? Air + cabin filter are cheap add-ons (~€40).',
    },
  },
  {
    id: 'ac-service-cabin-filter',
    trigger: ['A/C Service'],
    adds: [{ name: 'Cabin Filter (×2)', role: ROLES.ADDON }],
    reason: {
      nl: 'Airco toch gedaan? Microfilter is een goedkope combo.',
      en: 'A/C done anyway? Cabin filter is a cheap combo.',
    },
  },
  {
    id: 'front-end-refresh',
    trigger: ['Control Arms / Ball Joints', 'Tie Rod Ends (×2)'],
    adds: [{ name: 'Stabilizer Links Front (×2)', role: ROLES.CONTEXT }],
    reason: {
      nl: 'Voorzijde toch open. Goedkope stabilisatorstangen meenemen als ze speling/oud zijn.',
      en: 'Front end already open. Take the cheap stabiliser links if worn/old.',
    },
  },
  {
    id: 'cooling-rubber-addons',
    trigger: ['Water Pump (electric)', 'Thermostat', 'Coolant Flush'],
    adds: [
      { name: 'Coolant Hoses', role: ROLES.CONTEXT },
      { name: 'Expansion Tank + Cap', role: ROLES.CONTEXT },
    ],
    reason: {
      nl: 'Koelsysteem is toch leeg. Brosse slang of oud expansievat? Direct meenemen.',
      en: 'Cooling system is drained anyway. Brittle hose or old expansion tank? Take it now.',
    },
  },
  {
    id: 'valvecover-vacuum-lines',
    trigger: ['Valve Cover Gasket + PCV'],
    adds: [{ name: 'Vacuum Lines (N53)', role: ROLES.CONTEXT }],
    reason: {
      nl: 'Bovenop de motor bezig en vacuümlijnen bros? €40 slangkit meepakken.',
      en: 'Working on top of the engine and vacuum lines brittle? Grab the ~€40 hose kit.',
    },
  },
  {
    id: 'oil-leak-with-oil-service',
    trigger: ['Oil Pan Gasket', 'Oil Filter Housing Gasket'],
    adds: [{ name: 'Engine Oil + Filter', role: ROLES.CONTEXT }],
    reason: {
      nl: 'Oliezone wordt geopend/vervuild. Combineer met de oliebeurt als die eraan komt.',
      en: 'Oil zone gets opened/contaminated. Combine with the oil service if it is due soon.',
    },
  },
  {
    id: 'tires-protection',
    trigger: ['Tires (×4)'],
    adds: [{ name: 'Wheel Alignment', role: ROLES.CONTEXT }],
    reason: {
      nl: 'Nieuwe banden op ongelijnd onderstel = geld weggooien. Bescherm die €800.',
      en: 'New tyres on a misaligned chassis = money down the drain. Protect that €800.',
    },
  },

  // ── INSPECT-ONLY (check, do not auto-log a repair) ─
  {
    id: 'driveline-service-check',
    trigger: ['Differential Fluid', 'Flex Disc (Hardyschijf)'],
    adds: [
      { name: 'Differential Bushings', role: ROLES.INSPECT },
      { name: 'Transmission Mount', role: ROLES.INSPECT },
    ],
    reason: {
      nl: 'Auto staat toch onder/achter open. Inspectie kost bijna niks. Niet automatisch vervangen.',
      en: 'Car is up and open at the rear anyway. Inspection costs almost nothing. Do not auto-replace.',
    },
  },

  // ── Operation reminders (not a catalog item) ──────
  {
    id: 'battery-registration',
    trigger: ['Battery (AGM)'],
    adds: [],
    reminder: {
      nl: '⚠️ Nieuwe AGM-accu coderen/registreren — BMW laadmanagement moet het weten.',
      en: '⚠️ Code/register the new AGM battery — BMW charge management must know.',
    },
  },
];
