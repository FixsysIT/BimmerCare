import { EXPORT_VERSION, APP_VERSION, CATALOG_VERSION, DIAGNOSIS_OK_VALID_MONTHS } from './constants';
import { tItem, tCategory } from './translate';
import { calculateStatus, lastOfType } from './statusCalculator';
import { formatMaintenanceStatus } from './statusFormat';
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

/* ── Budget plan → readable advice report (for pasting into ChatGPT) ──────
   Turns a built budget plan (from buildBudgetPlan) into a compact markdown
   brief: what's planned per garage visit + everything still open
   (monitor/inspect/blocked/unplanned), with a question header asking for a
   second opinion on bundling vs a separate appointment. Read-only — never
   touches state. `t` resolves item labels + section text; `km`/`today` give
   per-item status context. */
export function generateBudgetReport(plan, settings, vehicle, t, today = new Date()) {
  const km = vehicle?.currentMileage ?? null;
  const eur = (n) => `€${Math.round(n || 0).toLocaleString('nl-NL')}`;
  const L = (key, opts) => t(`budget.report.${key}`, opts);
  const rawSession = (id) => (settings.budgetSessions || []).find((s) => s.id === id) || {};
  const dateLabel = (d) => (d ? new Date(d).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' }) : L('noDate'));

  const jobTitle = (job) => (job.title ? (job.title.nl || job.title.en) : tItem(t, job.memberNames[0]));
  const memberLine = (job) => (job.members?.length > 1 || job.memberNames?.length > 1
    ? job.memberNames.map((n) => tItem(t, n)).join(' · ') : null);
  const why = (job) => {
    if (job.members?.length === 1 && km != null) return formatMaintenanceStatus(job.members[0], km, today, t);
    return '';
  };
  const jobNotes = settings.budgetPrefs?.jobNote || {};
  // one bullet for a job; `note` overrides the price suffix (e.g. "€X indien vervangen")
  const bullet = (job, { priceNote, tag } = {}) => {
    const head = tag ? `${tag} ` : '';
    const price = priceNote || eur(job.cost);
    const w = why(job);
    const members = memberLine(job);
    const ext = jobNotes[job.id]; // free "+ sensor" inspection extension
    let line = `- ${head}${jobTitle(job)}${ext ? ` + ${ext}` : ''} — ${price}`;
    if (w) line += ` — ${w}`;
    if (members) line += `\n  (${members})`;
    return line;
  };

  const out = [];
  out.push(`# ${L('title')}`);
  if (vehicle) out.push(`${vehicle.model} · ${vehicle.engine} · ${vehicle.year} · ${(km || 0).toLocaleString('nl-NL')} km`);
  out.push(`${L('budgetNow')}: ${eur(plan.summary.currentBudget)} · ${L('monthly')}: ${eur(plan.summary.monthly)} · ${L('buffer')}: ${eur(plan.summary.safetyBuffer)}`);
  out.push('');
  out.push(`> ${L('question')}`);
  out.push('');

  // only finalised (locked) blocks go in the report — not draft sessions,
  // advisory buckets or ideas; the user copies what he's actually committed to
  const planned = plan.sessions.filter((s) => s.locked && s.entries.length > 0);
  if (planned.length) {
    out.push(`## ${L('plannedSessions')}`);
    for (const s of planned) {
      const raw = rawSession(s.id);
      out.push('');
      out.push(`### ${raw.name || dateLabel(s.date)}${raw.name && s.date ? ` — ${dateLabel(s.date)}` : ''}`);
      out.push(L('sessionMoney', { have: eur(s.money), spent: eur(s.cost), left: eur(s.left) }));
      const booked = s.entries.filter((e) => !e.rider);
      const riders = s.entries.filter((e) => e.rider);
      if (booked.length) {
        out.push(L('booked') + ':');
        booked.forEach((e) => out.push(bullet(e.job)));
      }
      if (riders.length) {
        out.push(L('alongChecks') + ':');
        riders.forEach((e) => out.push(bullet(e.job, { tag: '🔍', priceNote: L('ifReplaced', { amount: eur(e.job.cost) }) })));
      }
    }
    out.push('');
  }

  // advisory buckets (unplanned/blocked/inspect/monitor) and ideas are
  // intentionally left out — the report mirrors only what's locked in.

  return out.join('\n').trim() + '\n';
}

/* ── Printable A4 work order for the mechanic ────────────────────────────
   One garage visit → a clean, self-contained HTML page (own print CSS) the
   owner hands to the mechanic: "this is what I want done this appointment".
   No app branding — it reads as a personal letter. A prominent vehicle header
   (type · engine · year · plate · VIN · km) lets the garage order parts by VIN;
   NO part numbers (unverified OEM data stays in-app) and NO prices (the garage
   quotes). Booked jobs → "uit te voeren"; ride-along + check-only jobs →
   "controleren / beoordelen". Closes with: only the above is approved, extra
   work must be agreed first. */
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

export function buildWorkOrderHTML(session, rawSession, vehicle, t, tName, _today = new Date(), notes = {}) {
  const L = (k, o) => t(`budget.workorder.${k}`, o);
  const dateNL = (d) => (d ? new Date(d).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' }) : L('noDate'));

  const jobTitle = (job) => (job.title ? (job.title.nl || job.title.en) : tName(job.memberNames[0]));

  const row = (job, todoLabel, isCheckSection) => {
    const note = job.check ? notes[job.id] : null; // only inspections can have "+ sensor" extensions
    return `<tr>
      <td class="wo-check"><div class="wo-box"></div></td>
      <td class="wo-do">${esc(todoLabel)}</td>
      <td>
        <div class="wo-name">${esc(jobTitle(job))}${note ? ` <span class="wo-note">+ ${esc(note)}</span>` : ''}</div>
        ${isCheckSection ? `<div class="wo-mech-space"></div>` : ''}
      </td>
    </tr>`;
  };

  // booked replacements vs things to only assess. A custom task flagged
  // check-only (job.check) moves to the assess section even though it's booked.
  const booked = session.entries.filter((e) => !e.rider && !e.job.check);
  const checks = session.entries.filter((e) => e.rider || e.job.check);
  const todoFor = (job) => (job.urgency === 'inspection_needed' ? L('todoInspect') : L('todoReplace'));

  const doRows = booked.map((e) => row(e.job, todoFor(e.job), false)).join('');
  const checkRows = checks.map((e) => row(e.job, L('todoCheck'), true)).join('');

  const v = vehicle || {};
  const model = v.model || 'BMW';
  const sub = [v.engine, v.year].filter(Boolean).join(' · ');
  const plate = v.plate ? esc(v.plate) : '____________';
  const vin = v.vin ? esc(v.vin) : '________________________';
  const km = v.currentMileage ? `${Number(v.currentMileage).toLocaleString('nl-NL')} km` : '';
  const owner = v.owner || '';
  const phone = v.phone || '';

  return `<!doctype html><html lang="nl"><head><meta charset="utf-8">
<title>${esc(model)} — ${esc(session.date ? dateNL(session.date) : L('noDate'))}</title>
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif; color: #111; margin: 0; padding: 15mm 15mm; font-size: 13px; line-height: 1.5; }
  .wo-head { border-bottom: 3px solid #0066b1; padding-bottom: 12px; margin-bottom: 16px; }
  .wo-car { font-size: 26px; font-weight: 800; letter-spacing: -0.02em; }
  .wo-sub { font-size: 13px; color: #555; margin-top: 4px; }
  .wo-ids { display: flex; gap: 32px; margin-top: 12px; flex-wrap: wrap; }
  .wo-id { font-size: 12px; }
  .wo-id .k { display: block; text-transform: uppercase; letter-spacing: 0.05em; font-size: 10px; color: #888; margin-bottom: 2px; }
  .wo-id .v { font-family: "SFMono-Regular", Consolas, monospace; font-weight: 600; font-size: 13px; letter-spacing: 0.02em; }
  .wo-id.vin .v { font-size: 15px; color: #0066b1; }
  .wo-appt { margin: 8px 0 16px; font-size: 14px; color: #0066b1; }
  .wo-appt strong { font-weight: 700; color: #0066b1; }
  h2 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; color: #0066b1; margin: 20px 0 8px; border-bottom: 1px solid #ddd; padding-bottom: 6px; }
  table { width: 100%; border-collapse: collapse; }
  td { vertical-align: middle; padding: 6px 8px; border-bottom: 1px solid #eee; }
  .wo-check { width: 34px; padding-left: 4px; }
  .wo-box { width: 16px; height: 16px; border: 2px solid #ccc; border-radius: 4px; background: #fff; }
  .wo-do { width: 28%; font-weight: 600; color: #444; }
  .wo-name { font-weight: 600; font-size: 13px; }
  .wo-note { color: #333; font-weight: 400; font-style: italic; }
  .wo-members { color: #555; font-size: 11px; }
  .wo-mech-space { height: 40px; }
  .wo-sessnote { margin-top: 16px; font-size: 13px; background: #fdfbf7; padding: 10px 14px; border-radius: 6px; border-left: 4px solid #eab308; }
  
  .wo-footer-block { margin-top: 30px; padding-top: 16px; border-top: 2px solid #eee; display: flex; justify-content: space-between; align-items: flex-end; }
  .wo-contact-info { }
  .wo-owner { font-weight: 700; font-size: 14px; color: #0066b1; margin-bottom: 2px; }
  .wo-contact { font-size: 12px; color: #555; line-height: 1.5; }
  .wo-meta { text-align: right; font-size: 11px; color: #888; }
  .wo-meta strong { color: #555; font-weight: 600; }
  .wo-empty { color: #888; font-style: italic; padding: 12px 8px; }
</style></head>
<body onload="window.print()">
  <div class="wo-head">
    <div class="wo-car">${esc(model)}</div>
    ${sub ? `<div class="wo-sub">${esc(sub)}${km ? ` · ${esc(km)}` : ''}</div>` : (km ? `<div class="wo-sub">${esc(km)}</div>` : '')}
    <div class="wo-ids">
      <div class="wo-id"><span class="k">${esc(L('plate'))}</span><span class="v">${plate}</span></div>
      <div class="wo-id vin"><span class="k">${esc(L('vin'))}</span><span class="v">${vin}</span></div>
    </div>
  </div>

  <div class="wo-appt"><strong>${esc(L('date'))}:</strong> ${esc(session.date ? dateNL(session.date) : L('noDate'))}</div>

  <h2>${esc(L('doSection'))}</h2>
  ${doRows ? `<table>${doRows}</table>` : `<div class="wo-empty">${esc(L('emptyDo'))}</div>`}

  ${checkRows ? `<h2>${esc(L('checkSection'))}</h2><table>${checkRows}</table>` : ''}

  ${rawSession?.note ? `<div class="wo-sessnote"><strong>${esc(L('remark'))}:</strong><br> ${esc(rawSession.note)}</div>` : ''}

  <div class="wo-footer-block">
    <div class="wo-contact-info">
      ${owner ? `<div class="wo-owner">${esc(owner)}</div>` : ''}
      ${phone ? `<div class="wo-contact">${esc(phone)}<br><em>${esc(L('callApproval'))}</em></div>` : ''}
    </div>
  </div>
</body></html>`;
}

/* Copy text to the clipboard (with a textarea fallback for older browsers). */
export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      return true;
    } catch {
      return false;
    }
  }
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
