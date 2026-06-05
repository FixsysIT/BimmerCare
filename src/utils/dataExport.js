import { EXPORT_VERSION, APP_VERSION, CATALOG_VERSION, DIAGNOSIS_OK_VALID_MONTHS } from './constants';
import { tItem, tCategory } from './translate';
import { calculateStatus, lastOfType } from './statusCalculator';
import { getDefaultItems } from '../data/defaultItems';
import { missingDefaultNames, itemsMissingLayer } from './mergeDefaults';
import { getBundles, ROLES } from '../data/bundles';
import { bundleMemberships } from './companions';

/**
 * Generate export JSON object from app data.
 */
export function createExportData(vehicle, maintenanceItems, settings) {
  return {
    exportVersion: EXPORT_VERSION,
    exportDate: new Date().toISOString(),
    appVersion: APP_VERSION,
    vehicle,
    maintenanceItems,
    settings,
  };
}

/**
 * Trigger JSON file download.
 */
export function downloadJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `bimmercare-backup-${formatDateForFile(new Date())}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Validate imported JSON data.
 * Returns { valid: boolean, errors: string[], data: object|null }
 */
export function validateImportData(jsonString) {
  const errors = [];
  let data;

  try {
    data = JSON.parse(jsonString);
  } catch (e) {
    return { valid: false, errors: ['Invalid JSON format'], data: null };
  }

  if (!data.exportVersion) errors.push('Missing export version');

  if (!data.vehicle) {
    errors.push('Missing vehicle data');
  } else {
    if (!data.vehicle.model) errors.push('Missing vehicle model');
    if (typeof data.vehicle.currentMileage !== 'number') errors.push('Invalid mileage');
  }

  if (!Array.isArray(data.maintenanceItems)) {
    errors.push('Missing or invalid maintenance items');
  } else {
    for (const item of data.maintenanceItems) {
      if (!item.id || !item.name) {
        errors.push(`Invalid maintenance item: ${item.name || 'unknown'}`);
        break;
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    data: errors.length === 0 ? data : null,
  };
}

/**
 * Read a File object as text.
 */
export function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = (e) => reject(e);
    reader.readAsText(file);
  });
}

function formatDateForFile(date) {
  return date.toISOString().split('T')[0];
}

/* ── JSON state exports (debug / inspection) ───────────────────────
   Separate from the JSON backup: these are read-only snapshots for
   debugging or feeding to another tool. None of them mutate state. */

// Item definitions only (no history) — the "what should happen" catalog.
export function generateItemsExport(items) {
  return {
    exportType: 'maintenance-items',
    exportVersion: EXPORT_VERSION,
    exportDate: new Date().toISOString(),
    count: (items || []).length,
    items: (items || []).map(({ history, ...rest }) => rest),
  };
}

// Flat service/inspection/baseline log across all items — the "what happened".
export function generateHistoryExport(items) {
  const rows = [];
  (items || []).forEach((i) => {
    (i.history || []).forEach((h) => {
      rows.push({ itemId: i.id, itemName: i.name, ...h });
    });
  });
  return {
    exportType: 'maintenance-history',
    exportVersion: EXPORT_VERSION,
    exportDate: new Date().toISOString(),
    count: rows.length,
    history: rows,
  };
}

// Full debug snapshot: definitions + history + computed statuses + baseline
// + catalog version tracking.
export function generateDebugExport(vehicle, items, settings, statusEvents = []) {
  const currentKm = vehicle?.currentMileage ?? null;
  const list = items || [];
  const defaults = getDefaultItems(vehicle?.vehicleId || 'debug');
  const missing = missingDefaultNames(list, defaults);
  const missingMeta = itemsMissingLayer(list);
  const computedStatuses = list.map((i) => {
    const cs = calculateStatus(i, currentKm, vehicle);
    const isOnFailure = i.replacementStrategy === 'on-failure' || i.intervalType === 'diagnosis';
    let onFailure = {};
    if (isOnFailure) {
      const lastDiag = lastOfType(i, 'diagnosis');
      const lastSvc = lastOfType(i, 'service');
      const kmSinceReplacement = (lastSvc?.mileage != null && currentKm != null)
        ? currentKm - lastSvc.mileage : null;
      const replacementExpiresAtKm = (lastSvc?.mileage != null && i.replacementOkValidKm != null)
        ? lastSvc.mileage + i.replacementOkValidKm : null;
      const replacementRemainingKm = (replacementExpiresAtKm != null && currentKm != null)
        ? Math.max(0, replacementExpiresAtKm - currentKm) : null;
      const replacementExpired = (kmSinceReplacement != null && i.replacementOkValidKm != null)
        ? kmSinceReplacement >= i.replacementOkValidKm : false;
      let noFaultExpiresAt = null;
      if (lastDiag?.result === 'no_fault' && (lastDiag.date || lastDiag.createdAt)) {
        const months = i.diagnosisOkValidMonths ?? DIAGNOSIS_OK_VALID_MONTHS;
        const d = new Date(lastDiag.date || lastDiag.createdAt);
        d.setMonth(d.getMonth() + months);
        noFaultExpiresAt = d.toISOString().slice(0, 10);
      }
      onFailure = {
        lastDiagnosisEvent: lastDiag ?? null,
        lastServiceEvent: lastSvc ?? null,
        replacementOkValidKm: i.replacementOkValidKm ?? null,
        replacementOkValidMonths: i.replacementOkValidMonths ?? null,
        diagnosisOkValidMonths: i.diagnosisOkValidMonths ?? null,
        kmSinceReplacement,
        replacementRemainingKm,
        replacementExpiresAtKm,
        replacementExpired,
        noFaultExpiresAt,
      };
    }
    return {
      id: i.id, name: i.name, strategy: i.replacementStrategy, intervalType: i.intervalType,
      status: cs.status, statusReason: cs.statusReason, message: cs.message,
      source: cs.source ?? null,                       // history | manualOverride | legacyManualStatus | interval | default
      lastRelevantHistoryEvent: cs.sourceEvent ?? null,
      ...onFailure,
    };
  });
  const history = [];
  list.forEach((i) => (i.history || []).forEach((h) => history.push({ itemId: i.id, itemName: i.name, ...h })));
  const baseline = list
    .filter((i) => i.baselineState || (i.history || []).some((h) => h.type === 'baseline'))
    .map((i) => ({ id: i.id, name: i.name, baselineState: i.baselineState ?? null, hasBaselineEntry: (i.history || []).some((h) => h.type === 'baseline') }));

  return {
    exportType: 'debug-state',
    exportVersion: EXPORT_VERSION,
    appVersion: APP_VERSION,
    catalogVersion: CATALOG_VERSION,
    catalogVersionApplied: settings?.catalogVersionApplied ?? null,
    exportDate: new Date().toISOString(),
    currentKm,
    itemCount: list.length,
    defaultItemCount: defaults.length,
    missingDefaultItems: { count: missing.length, names: missing },
    itemsMissingLayerMetadata: { count: missingMeta.length, names: missingMeta },
    vehicle,
    items: list.map(({ history: _h, ...rest }) => rest),
    history,
    computedStatuses,
    baseline,
    statusEvents: statusEvents || [],
  };
}

/* ════════════════════════════════════════════════════════════════
   CSV round-trip — export the schedule + parts so they can be
   reviewed/edited (in Excel/Sheets OR by another LLM) and imported
   back. A legend (# comment lines) is embedded at the top of each
   file so an external tool knows exactly what every column and every
   allowed value means, and edits import cleanly without guessing.
   ════════════════════════════════════════════════════════════════ */

const CSV_SEP = ';';               // NL Excel default field separator
const BOM = '﻿';              // so Excel renders accents

const VALID_STRATEGY = ['interval', 'condition', 'on-failure'];
const VALID_INTERVAL_TYPE = ['km-dominant', 'time-dominant', 'condition', 'diagnosis'];

function csvCell(value) {
  const s = value === null || value === undefined ? '' : String(value);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCSV(legendLines, rows) {
  const legend = legendLines.map((l) => `# ${l}`).join('\r\n');
  const body = rows.map((row) => row.map(csvCell).join(CSV_SEP)).join('\r\n');
  return `${BOM}${legend}\r\n#\r\n${body}`;
}

/* Quote-aware parser for ;-separated rows. Skips blank lines and
   legend lines (anything whose first non-space char is #). */
function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  const s = text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;

  const pushField = () => { row.push(field); field = ''; };
  const pushRow = () => { pushField(); rows.push(row); row = []; };

  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === CSV_SEP) {
      pushField();
    } else if (c === '\n') {
      pushRow();
    } else if (c === '\r') {
      // swallow; \n handles the row break
    } else {
      field += c;
    }
  }
  if (field !== '' || row.length) pushRow();

  // drop legend/comment + fully blank rows
  return rows.filter((r) => {
    const first = (r[0] ?? '').trim();
    if (first.startsWith('#')) return false;
    return r.some((c) => (c ?? '').trim() !== '');
  });
}

function toNum(v) {
  const s = (v ?? '').toString().trim();
  if (s === '') return null;
  const n = Number(s.replace(/\./g, '').replace(',', '.')); // 1.234,5 -> 1234.5 ; also "10000" -> 10000
  return Number.isNaN(n) ? null : n;
}

function headerMap(rows) {
  const map = {};
  (rows[0] || []).forEach((h, idx) => { map[h.trim()] = idx; });
  return map;
}

/* ── Intervals / schedule CSV ──────────────────────────────────── */

const INTERVAL_HEADERS = [
  'id', 'onderdeel', 'categorie', 'strategie', 'intervalType',
  'activeKm', 'activeMaanden', 'bmwKm', 'bmwMaanden',
  'communityKm', 'communityMaanden', 'kostenEUR', 'bron', 'notitie', 'bundels',
];

const INTERVAL_LEGEND = [
  'BimmerCare onderhoudsschema — export/import legenda',
  'Regels die met # beginnen zijn uitleg en worden bij import GENEGEERD.',
  'BELANGRIJK: kolom "id" NIET wijzigen — dat is de koppelsleutel voor import.',
  'Bij import worden items gematcht op id; onderdeel/categorie zijn alleen leesbaarheid en worden genegeerd.',
  'Lege cel = geen waarde / geen aanbeveling (null). Getallen zonder duizendtal-punt: 60000, niet 60.000.',
  '',
  'KOLOMMEN:',
  '  strategie    = wanneer vervangen. Toegestaan: interval | condition | on-failure',
  '      interval   = vast km/tijd-interval (olie, filters, vloeistoffen). "scheduled" = interval.',
  '      condition  = inspecteren op km, vervangen op slijtage (remmen, banden, rubbers).',
  '      on-failure = alleen vervangen bij defect (injectoren, sensoren, pompen).',
  '  intervalType = wat het interval domineert. Toegestaan: km-dominant | time-dominant | condition | diagnosis',
  '      km-dominant   = km telt het zwaarst.',
  '      time-dominant = tijd/maanden telt het zwaarst.',
  '      condition     = op conditie/inspectie.',
  '      diagnosis     = op diagnose/foutcode.',
  '  activeKm / activeMaanden       = interval dat de APP gebruikt voor status (dit aanpassen verandert de melding).',
  '  bmwKm / bmwMaanden             = officiele BMW-aanbeveling (referentie).',
  '  communityKm / communityMaanden = community/ZF-aanbeveling (referentie).',
  '  kostenEUR  = geschatte totale klus (excl. BTW).',
  '  bron       = bmw-official | community-preventive | custom | condition-diagnosis',
  '  notitie    = vrije tekst (mag komma\'s bevatten).',
  '',
  '  bundels    = LEESBAAR (read-only): welke do-together klussen dit item raakt, "Titel(rol)".',
  '               Wordt bij import GENEGEERD. Bundels bewerk je in het aparte bundels-CSV.',
  '',
  'VOORBEELD wijziging: bougie van 60000 naar 58000 -> zet activeKm op 58000.',
  'VOORBEELD strategie: NOx-sensor van on-failure naar interval -> zet strategie op interval en vul activeKm/activeMaanden in.',
];

export function generateIntervalsCSV(items, t) {
  const rows = [INTERVAL_HEADERS];
  (items || []).forEach((i) => {
    rows.push([
      i.id,
      t ? tItem(t, i.name) : i.name,
      t ? tCategory(t, i.category) : i.category,
      i.replacementStrategy || '',
      i.intervalType || '',
      i.intervalKm ?? '',
      i.intervalMonths ?? '',
      i.bmwIntervalKm ?? '',
      i.bmwIntervalMonths ?? '',
      i.communityIntervalKm ?? '',
      i.communityIntervalMonths ?? '',
      i.estimatedTotalCost ?? '',
      i.source || '',
      i.sourceNote || '',
      bundleMemberships(i.name).map((m) => `${m.title}(${m.role})`).join(' | '),
    ]);
  });
  return toCSV(INTERVAL_LEGEND, rows);
}

/* ── Parts CSV ─────────────────────────────────────────────────── */

const PARTS_HEADERS = ['itemId', 'onderdeel', 'part', 'oem', 'altMerk', 'altNummer', 'prijsEUR', 'bron'];

const PARTS_LEGEND = [
  'BimmerCare onderdelen — export/import legenda',
  'Regels met # zijn uitleg en worden bij import GENEGEERD.',
  'BELANGRIJK: kolom "itemId" NIET wijzigen — koppelt aan een onderhoudsitem.',
  'Bij import wordt de COMPLETE onderdelenlijst van een item vervangen door alle regels met dat itemId.',
  '  -> regel verwijderen = onderdeel verwijderen. Item zonder regels blijft ongewijzigd.',
  'Lege cel = leeg. Prijs als getal, bv 12.50 of 12,50.',
  '',
  'KOLOMMEN:',
  '  onderdeel = naam van het onderhoudsitem (alleen leesbaarheid, genegeerd bij import).',
  '  part      = naam van het onderdeel.',
  '  oem       = origineel BMW-nummer.',
  '  altMerk   = aftermarket merk (MANN, Shell, ...).',
  '  altNummer = aftermarket artikelnummer.',
  '  prijsEUR  = geschatte prijs per stuk.',
  '  bron      = BMW | aftermarket | community | ...',
];

export function generatePartsCSV(items) {
  const rows = [PARTS_HEADERS];
  (items || []).forEach((i) => {
    (i.parts || []).forEach((p) => {
      rows.push([
        i.id, i.name, p.name || '', p.oemNumber || '',
        p.altBrand || '', p.altNumber || '', p.estimatedPrice ?? '', p.source || '',
      ]);
    });
  });
  return toCSV(PARTS_LEGEND, rows);
}

/* ── Bundles (do-together) CSV — editable round-trip ────────────────
   One row per LINK. The active bundle set (default OR user-edited) is the
   relationship layer that drives the "samen meenemen" picker + visual
   grouping. Editing this CSV and importing replaces the whole bundle set,
   so bundles become DATA, not code. Item names use the stable English key
   (itemNaam); onderdeelNL is read-only readability. */

const BUNDLE_ADD_ROLES = [ROLES.MUST, ROLES.CONTEXT, ROLES.ADDON, ROLES.INSPECT];

const BUNDLE_HEADERS = ['bundleId', 'titelNL', 'titelEN', 'type', 'itemNaam', 'onderdeelNL', 'rol', 'redenNL', 'redenEN'];

const BUNDLE_LEGEND = [
  'BimmerCare do-together bundels — export/import legenda',
  'Regels met # zijn uitleg en worden bij import GENEGEERD.',
  'Elke regel = EEN koppeling. Bij import wordt de COMPLETE bundelset vervangen door wat hier staat.',
  '  -> regel verwijderen = koppeling weg. Bundel verwijderen = alle regels met die bundleId weg.',
  'BELANGRIJK: itemNaam = stabiele Engelse sleutel; moet exact matchen met een bestaand onderhoudsitem.',
  '  Onbekende itemNaam wordt overgeslagen. onderdeelNL is alleen leesbaarheid (genegeerd bij import).',
  '',
  'KOLOMMEN:',
  '  bundleId  = unieke id van de bundel (alle regels met dezelfde id horen bij elkaar).',
  '  titelNL/EN= weergavenaam van de klus (bv "Remmen voor"). Optioneel voor reminder.',
  '  type      = group | trigger | reminder',
  '      group    = symmetrische do-together set; elk lid stelt de anderen voor (alle leden verplicht).',
  '      trigger  = richting: een trigger-item stelt de adds voor, elk met eigen rol.',
  '      reminder = trigger-item geeft een gratis herinnering (bv accu coderen), geen onderdeel.',
  '  itemNaam  = Engelse sleutel van het item (zie kolom itemNaam in de intervallen-CSV).',
  '  rol       = member (group) | trigger | reminder | mustReplace | mustWhenContext | optionalAddon | inspectOnly',
  '      mustReplace     = verplicht meenemen (vormt samen 1 visuele cluster).',
  '      mustWhenContext = sterk aangeraden als het oud/versleten/aan beurt is.',
  '      optionalAddon   = goedkope combo, optioneel.',
  '      inspectOnly     = alleen inspecteren, niets loggen.',
  '  redenNL/EN= waarom samen doen (bij reminder: de herinneringstekst).',
  '',
  'VOORBEELD: schijven+blokken voor -> 2 regels, zelfde bundleId, type=group, rol=member.',
  'VOORBEELD: stuurkogels -> uitlijnen -> trigger-regel(s) rol=trigger + add-regel "Wheel Alignment" rol=mustReplace.',
];

export function generateBundlesCSV(items, t) {
  const nameNL = (name) => (t ? tItem(t, name) : name);
  const rows = [BUNDLE_HEADERS];
  for (const b of getBundles()) {
    const type = b.group ? 'group' : (b.reminder && !(b.adds && b.adds.length) ? 'reminder' : 'trigger');
    const tNL = b.title?.nl || '';
    const tEN = b.title?.en || '';
    const rNL = b.reason?.nl || b.reminder?.nl || '';
    const rEN = b.reason?.en || b.reminder?.en || '';
    const push = (name, role) => rows.push([b.id, tNL, tEN, type, name, nameNL(name), role, rNL, rEN]);
    if (b.group) {
      b.group.forEach((n) => push(n, 'member'));
    } else {
      (b.trigger || []).forEach((n) => push(n, 'trigger'));
      (b.adds || []).forEach((a) => push(a.name, a.role));
    }
  }
  return toCSV(BUNDLE_LEGEND, rows);
}

/* Readable do-together overview (markdown) — per bundle: members + role +
   cost + a "kernkosten" total. Read-only review of whether coupling + cost
   still make sense. */
const ROLE_LABEL = {
  member: 'verplicht', trigger: 'trigger', reminder: 'reminder',
  [ROLES.MUST]: 'verplicht', [ROLES.CONTEXT]: 'sterk aangeraden',
  [ROLES.ADDON]: 'add-on', [ROLES.INSPECT]: 'inspecteren',
};

export function generateBundlesOverview(items, t) {
  const byName = (name) => (items || []).find((i) => i.name === name);
  const nameNL = (name) => (t ? tItem(t, name) : name);
  const cost = (name) => byName(name)?.estimatedTotalCost ?? null;
  const eur = (n) => (n == null ? '—' : `€${Math.round(n)}`);
  const head = [`# BimmerCare — Do-together bundels`, `Datum: ${formatDateForFile(new Date())}`, ''];
  const blocks = getBundles().map((b) => {
    const title = b.title?.nl || b.title?.en || b.id;
    const type = b.group ? 'group' : (b.reminder && !(b.adds && b.adds.length) ? 'reminder' : 'trigger');
    const reason = b.reason?.nl || b.reminder?.nl || '';
    const lines = [`## ${title}  _(${type})_`];
    if (reason) lines.push(`> ${reason}`);
    let core = 0;
    const row = (name, role) => {
      const c = cost(name);
      if ((role === 'member' || role === 'trigger' || role === ROLES.MUST) && c != null) core += c;
      lines.push(`- ${nameNL(name)} · ${ROLE_LABEL[role] || role} · ${eur(c)}`);
    };
    if (b.group) b.group.forEach((n) => row(n, 'member'));
    else {
      (b.trigger || []).forEach((n) => row(n, 'trigger'));
      (b.adds || []).forEach((a) => row(a.name, a.role));
    }
    if (core > 0) lines.push(`\n**Kernkosten (verplicht): ${eur(core)}**`);
    return lines.join('\n');
  });
  return head.join('\n') + '\n' + blocks.join('\n\n') + '\n';
}

/* Compact garage checklist (markdown) from inspection packages.
   Max ~12-15 lines per package — a printable work order, not a parts dump. */
export function generateChecklist(packages, vehicle) {
  const head = [
    `# BimmerCare — Garage checklist`,
    vehicle ? `${vehicle.model} · ${vehicle.engine} · ${vehicle.year} · ${(vehicle.currentMileage || 0).toLocaleString()} km` : '',
    `Datum: ${formatDateForFile(new Date())}`,
    '',
  ].filter(Boolean);
  const body = (packages || []).map((p) => {
    const lines = p.items.map((it, i) => `${i + 1}. [ ] ${it}`);
    return `## ${p.name}\n${lines.join('\n')}`;
  });
  return head.join('\n') + '\n' + body.join('\n\n') + '\n';
}

export function downloadText(text, filename, mime = 'text/markdown;charset=utf-8') {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadCSV(text, filename) {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* Detect kind + parse a CSV file's text. Returns
   { kind: 'intervals'|'parts'|'unknown', byId | byItemId }. */
export function parseEditableCSV(text) {
  const rows = parseCSV(text);
  if (rows.length < 2) return { kind: 'unknown' };
  const h = headerMap(rows);
  const body = rows.slice(1);

  if ('activeKm' in h && 'id' in h) {
    const byId = {};
    body.forEach((r) => {
      const id = (r[h.id] || '').trim();
      if (!id) return;
      const strat = (r[h.strategie] ?? '').trim();
      const itype = (r[h.intervalType] ?? '').trim();
      const src = (r[h.bron] ?? '').trim();
      byId[id] = {
        intervalKm: toNum(r[h.activeKm]),
        intervalMonths: toNum(r[h.activeMaanden]),
        bmwIntervalKm: toNum(r[h.bmwKm]),
        bmwIntervalMonths: toNum(r[h.bmwMaanden]),
        communityIntervalKm: toNum(r[h.communityKm]),
        communityIntervalMonths: toNum(r[h.communityMaanden]),
        estimatedTotalCost: toNum(r[h.kostenEUR]),
        sourceNote: (r[h.notitie] ?? '').trim(),
        replacementStrategy: VALID_STRATEGY.includes(strat) ? strat : undefined,
        intervalType: VALID_INTERVAL_TYPE.includes(itype) ? itype : undefined,
        source: src || undefined,
      };
    });
    return { kind: 'intervals', byId };
  }

  if ('oem' in h && 'itemId' in h) {
    const byItemId = {};
    body.forEach((r) => {
      const itemId = (r[h.itemId] || '').trim();
      if (!itemId) return;
      (byItemId[itemId] ||= []).push({
        name: (r[h.part] ?? '').trim(),
        oemNumber: (r[h.oem] ?? '').trim(),
        altBrand: (r[h.altMerk] ?? '').trim(),
        altNumber: (r[h.altNummer] ?? '').trim(),
        estimatedPrice: toNum(r[h.prijsEUR]),
        source: (r[h.bron] ?? '').trim(),
      });
    });
    return { kind: 'parts', byItemId };
  }

  if ('bundleId' in h && 'itemNaam' in h) {
    const groups = new Map(); // bundleId -> parsed rows (order preserved)
    body.forEach((r) => {
      const id = (r[h.bundleId] || '').trim();
      if (!id) return;
      if (!groups.has(id)) groups.set(id, []);
      groups.get(id).push({
        titleNL: (r[h.titelNL] ?? '').trim(),
        titleEN: (r[h.titelEN] ?? '').trim(),
        type: (r[h.type] ?? '').trim(),
        name: (r[h.itemNaam] ?? '').trim(),
        role: (r[h.rol] ?? '').trim(),
        reasonNL: (r[h.redenNL] ?? '').trim(),
        reasonEN: (r[h.redenEN] ?? '').trim(),
      });
    });
    const bundles = [];
    for (const [id, rs] of groups) {
      const first = rs[0];
      const type = first.type;
      const title = (first.titleNL || first.titleEN) ? { nl: first.titleNL, en: first.titleEN } : undefined;
      const reason = { nl: first.reasonNL, en: first.reasonEN };
      const hasReason = !!(first.reasonNL || first.reasonEN);
      if (type === 'group') {
        const group = rs.map((x) => x.name).filter(Boolean);
        bundles.push({ id, ...(title ? { title } : {}), group, ...(hasReason ? { reason } : {}) });
      } else if (type === 'reminder') {
        const trigger = rs.filter((x) => x.role === 'trigger' || x.role === 'reminder').map((x) => x.name).filter(Boolean);
        bundles.push({ id, ...(title ? { title } : {}), trigger, adds: [], reminder: { nl: first.reasonNL, en: first.reasonEN } });
      } else {
        const trigger = rs.filter((x) => x.role === 'trigger').map((x) => x.name).filter(Boolean);
        const adds = rs.filter((x) => BUNDLE_ADD_ROLES.includes(x.role)).map((x) => ({ name: x.name, role: x.role })).filter((a) => a.name);
        bundles.push({ id, ...(title ? { title } : {}), trigger, adds, ...(hasReason ? { reason } : {}) });
      }
    }
    return { kind: 'bundles', bundles };
  }

  return { kind: 'unknown' };
}

/* Validate parsed bundles against the live catalog names: drop unknown item
   names, drop bundles that no longer have enough members to be meaningful.
   Returns { bundles, dropped: [{bundleId, names[]}] }. */
function validateBundles(parsedBundles, items) {
  const names = new Set((items || []).map((i) => i.name));
  const known = (n) => names.has(n);
  const bundles = [];
  const dropped = [];
  for (const b of parsedBundles) {
    const lostNames = [];
    if (b.group) {
      const group = b.group.filter((n) => known(n) || (lostNames.push(n), false));
      if (group.length >= 2) bundles.push({ ...b, group });
    } else {
      const trigger = (b.trigger || []).filter((n) => known(n) || (lostNames.push(n), false));
      const adds = (b.adds || []).filter((a) => known(a.name) || (lostNames.push(a.name), false));
      const ok = trigger.length > 0 && (adds.length > 0 || !!b.reminder);
      if (ok) bundles.push({ ...b, trigger, adds });
    }
    if (lostNames.length) dropped.push({ bundleId: b.id, names: lostNames });
  }
  return { bundles, dropped };
}

/* Merge parsed CSV edits into existing items by id.
   Returns { items, intervalsUpdated, partsUpdated, unknownFiles }. */
export function applyCSVEdits(items, parsedFiles) {
  let intervalEdits = null, partEdits = null, bundleEdits = null;
  let unknownFiles = 0;
  parsedFiles.forEach((p) => {
    if (p.kind === 'intervals') intervalEdits = { ...(intervalEdits || {}), ...p.byId };
    else if (p.kind === 'parts') partEdits = { ...(partEdits || {}), ...p.byItemId };
    else if (p.kind === 'bundles') bundleEdits = [...(bundleEdits || []), ...p.bundles];
    else unknownFiles++;
  });

  let intervalsUpdated = 0, partsUpdated = 0;
  const now = new Date().toISOString();

  const merged = (items || []).map((item) => {
    let next = item;

    if (intervalEdits && intervalEdits[item.id]) {
      const e = intervalEdits[item.id];
      next = {
        ...next,
        intervalKm: e.intervalKm,
        intervalMonths: e.intervalMonths,
        bmwIntervalKm: e.bmwIntervalKm,
        bmwIntervalMonths: e.bmwIntervalMonths,
        communityIntervalKm: e.communityIntervalKm,
        communityIntervalMonths: e.communityIntervalMonths,
        estimatedTotalCost: e.estimatedTotalCost,
        sourceNote: e.sourceNote,
        ...(e.replacementStrategy ? { replacementStrategy: e.replacementStrategy } : {}),
        ...(e.intervalType ? { intervalType: e.intervalType } : {}),
        ...(e.source ? { source: e.source } : {}),
        updatedAt: now,
      };
      intervalsUpdated++;
    }

    if (partEdits && partEdits[item.id]) {
      next = { ...next, parts: partEdits[item.id], updatedAt: now };
      partsUpdated++;
    }

    return next;
  });

  // Bundles validate against the (possibly merged) catalog names. Importing a
  // bundles CSV REPLACES the whole bundle set with what was parsed.
  let bundles = null, bundlesUpdated = 0, droppedBundleNames = [];
  if (bundleEdits) {
    const res = validateBundles(bundleEdits, merged);
    bundles = res.bundles;
    bundlesUpdated = res.bundles.length;
    droppedBundleNames = res.dropped;
  }

  return {
    items: merged, intervalsUpdated, partsUpdated, unknownFiles,
    hadBundles: !!bundleEdits, bundles, bundlesUpdated, droppedBundleNames,
  };
}
