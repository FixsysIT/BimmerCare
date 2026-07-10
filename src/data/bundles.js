/**
 * Bundle policy — do-together jobs.
 *
 * Items are NEVER fused; each stays an independent catalog item. A bundle is
 * only a relationship layer: it groups linked items and drives the "samen
 * meenemen" picker shown when you register a service.
 *
 * All `name` values MUST match a real catalog item name in defaultItems.js
 * (the stable English key). No invented items, no embedded parts here —
 * embedded parts (ZF filter kit, drain plug) already live in an
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

export const DEFAULT_BUNDLES = [
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
    // Decoupled: discs is its own job, pads a strongly-recommended add-on (not
    // forced into the same cluster — you can plan discs alone).
    trigger: ['Brake Discs Front'],
    adds: [{ name: 'Brake Pads Front', role: ROLES.CONTEXT }],
    reason: {
      nl: 'Nieuwe schijven met oude blokken is beun. Blokken sterk aangeraden.',
      en: 'New discs with old pads is a botch. Pads strongly recommended.',
    },
  },
  {
    id: 'front-brake-pads-sensor',
    title: { nl: 'Remblokken voor', en: 'Front brake pads' },
    // Discs ook als trigger: bij schijven gaan de blokken (en dus de sensor) vrijwel altijd mee.
    trigger: ['Brake Pads Front', 'Brake Discs Front'],
    adds: [{ name: 'Brake Wear Sensor Front', role: ROLES.CONTEXT }],
    reason: {
      nl: 'Nieuwe blokken vereisen vaak een nieuwe wear-sensor om de waarschuwing te resetten.',
      en: 'New pads usually require a new wear sensor to reset the warning.',
    },
  },
  {
    id: 'rear-brake-service',
    title: { nl: 'Remmen achter', en: 'Rear brakes' },
    trigger: ['Brake Discs Rear'],
    adds: [{ name: 'Brake Pads Rear', role: ROLES.CONTEXT }],
    reason: {
      nl: 'Zelfde verhaal achter: nieuwe schijf, oude blokken is beun. Blokken sterk aangeraden.',
      en: 'Same at the rear: new disc with old pads is a botch. Pads strongly recommended.',
    },
  },
  {
    id: 'rear-brake-pads-sensor',
    title: { nl: 'Remblokken achter', en: 'Rear brake pads' },
    trigger: ['Brake Pads Rear', 'Brake Discs Rear'],
    adds: [{ name: 'Brake Wear Sensor Rear', role: ROLES.CONTEXT }],
    reason: {
      nl: 'Nieuwe blokken vereisen vaak een nieuwe wear-sensor om de waarschuwing te resetten.',
      en: 'New pads usually require a new wear sensor to reset the warning.',
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
  {
    id: 'oilpan-engine-support',
    trigger: ['Oil Pan Gasket'],
    adds: [{ name: 'Engine Mounts (×2)', role: ROLES.INSPECT }],
    reason: {
      nl: 'Motor wordt ondersteund/subframe zakt voor de carterpan. Inspecteer de motorsteunrubbers meteen.',
      en: 'Engine is supported / subframe lowered for the oil pan. Inspect the engine mounts while you are there.',
    },
  },
  {
    id: 'belt-extra-checks',
    trigger: ['Serpentine Belt'],
    adds: [],
    reason: {
      nl: 'Riem eraf: controleer meteen de omliggende poelies en lekkage.',
      en: 'Belt off: check the surrounding pulleys and for leaks.',
    },
    reminder: {
      nl: '🔍 Controleer bij de riem: dynamopoelie (vrijloop/speling) én lekkage bóven de riem (klepdeksel/oliefilterhuis dat op de riem druppelt).',
      en: '🔍 While the belt is off: check the alternator pulley (freewheel/play) and for leaks above the belt (valve cover / oil filter housing dripping onto it).',
    },
  },
  {
    id: 'pre-alignment-inspection',
    title: { nl: 'Vóór uitlijnen controleren', en: 'Pre-alignment inspection' },
    trigger: ['Wheel Alignment'],
    adds: [
      { name: 'Tie Rod Ends (×2)', role: ROLES.INSPECT },
      { name: 'Strut Mounts / Top Mounts', role: ROLES.INSPECT },
      { name: 'Shock Absorbers Front (×2)', role: ROLES.INSPECT },
      { name: 'Shock Absorbers Rear (×2)', role: ROLES.INSPECT },
      { name: 'Rear Subframe Bushings', role: ROLES.INSPECT },
    ],
    reason: {
      nl: 'Uitlijnen op versleten onderdelen is zinloos. Check eerst op speling.',
      en: 'Aligning worn parts is pointless. Check for play first.',
    },
    reminder: {
      nl: '🔍 Ook checken vóór uitlijnen: binnenste spoorstangen op speling.',
      en: '🔍 Also check before alignment: inner tie rods for play.',
    },
  },
  {
    id: 'ignition-service',
    trigger: ['Spark Plugs (×6)'],
    adds: [{ name: 'Ignition Coils (×6)', role: ROLES.CONTEXT }],
    reason: {
      nl: 'Bougies toch eruit? Goed moment om oude bobines (veel voorkomend probleem) direct preventief mee te nemen.',
      en: 'Spark plugs are out anyway? Good time to preventively replace old ignition coils (common issue).',
    },
  },
  {
    id: 'powertrain-mounts',
    trigger: ['Engine Mounts (×2)'],
    adds: [{ name: 'Transmission Mount', role: ROLES.CONTEXT }],
    reason: {
      nl: 'Motorsteunen defect? Baksteun heeft dezelfde leeftijd en krachten te verduren. Vervang als set.',
      en: 'Engine mounts failed? Transmission mount is the same age/stress. Replace as a set.',
    },
  },
  {
    id: 'front-struts-mounts',
    trigger: ['Shock Absorbers Front (×2)'],
    adds: [{ name: 'Strut Mounts / Top Mounts', role: ROLES.CONTEXT }],
    reason: {
      nl: 'Voorste schokdempers vervangen betekent dat de veerpoot los gaat. Toplagers direct meenemen.',
      en: 'Replacing front shocks means disassembling the strut. Always replace the top mounts.',
    },
  },
  {
    id: 'rear-struts-mounts',
    trigger: ['Shock Absorbers Rear (×2)'],
    adds: [{ name: 'Strut Mounts / Top Mounts', role: ROLES.CONTEXT }],
    reason: {
      nl: 'Achterste schokdempers vervangen: rubbers / toplagers direct meenemen om bijgeluiden te voorkomen.',
      en: 'Replacing rear shocks: replace rubber top mounts to prevent rattling noises.',
    },
  },
  {
    id: 'n53-intake-gaskets',
    trigger: ['Walnut Blasting (Intake Valves)', 'DISA Valves (Large & Small)', 'Starter Motor'],
    adds: [{ name: 'Intake Manifold Gaskets', role: ROLES.CONTEXT }],
    reason: {
      nl: 'Hiervoor moet het inlaatspruitstuk gedemonteerd worden. Gebruik altijd nieuwe inlaatpakkingen om vacuümlekken te voorkomen.',
      en: 'The intake manifold must be removed for this. Always use new gaskets to prevent vacuum leaks.',
    },
  },
  {
    id: 'driveline-support',
    trigger: ['Flex Disc (Hardyschijf)'],
    adds: [{ name: 'Driveshaft Center Support Bearing', role: ROLES.CONTEXT }],
    reason: {
      nl: 'Bij het vervangen van de hardyschijf ligt de uitlaat/hitteschild al los. Mooi moment om het tussenlager te vernieuwen (vaak versleten).',
      en: 'When replacing the flex disc, the exhaust/heat shield is already out. Good time to replace the center support bearing.',
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

/* Active bundle set. Defaults to the hard-coded list above, but can be
   replaced by a user-edited set (imported via CSV, persisted in
   settings.customBundles, re-activated on app load). All consumers
   (companions.js, bundleView.js) read getBundles() so an edit takes effect
   without touching code. */
let activeBundles = DEFAULT_BUNDLES;

export function getBundles() {
  return activeBundles;
}

/** Replace the active bundle set. Empty/invalid → revert to defaults. */
export function setBundles(bundles) {
  activeBundles = Array.isArray(bundles) && bundles.length ? bundles : DEFAULT_BUNDLES;
  return activeBundles;
}
