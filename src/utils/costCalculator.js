/**
 * Cost utilities. All amounts are EXCL. BTW.
 * One cost per history entry (`entry.cost`). Legacy entries are normalized.
 */

/**
 * Normalize one history entry to a single excl-BTW cost.
 * New entries: `cost` (already excl. BTW).
 * Legacy entries: partsCost + laborCost, with VAT extracted if it was stored incl.
 */
function entryCost(entry) {
  if (entry.cost != null) return entry.cost;
  const a = (entry.partsCost || 0) + (entry.laborCost || 0);
  const vat = entry.vatPercent || 0;
  if (entry.costsInclVat && vat > 0) return a / (1 + vat / 100); // was incl → extract
  return a; // legacy stored excl
}

/**
 * Aggregate costs (excl. BTW) from all maintenance items, plus finished
 * hobby projects (`projects`, category 'Klussen') so the total reflects all
 * car spend, not just maintenance. Project entries carry `isProject: true`
 * and no `itemId`/mileage — they aren't real history entries and are edited
 * on the Projects page, not here.
 */
export function aggregateCosts(maintenanceItems, projects = []) {
  let total = 0;
  const byCategory = {};
  const allEntries = [];

  for (const item of maintenanceItems) {
    if (!item.history) continue;
    for (const entry of item.history) {
      const cost = entryCost(entry);
      if (cost <= 0) continue; // skip notes/baseline/zero-cost so totals & per-month stay accurate
      total += cost;

      const cat = item.category || 'Unknown';
      if (!byCategory[cat]) byCategory[cat] = { total: 0, count: 0 };
      byCategory[cat].total += cost;
      byCategory[cat].count += 1;

      allEntries.push({
        ...entry,
        itemId: item.id,
        itemName: item.name,
        itemCategory: item.category,
        calculatedCost: round2(cost),
      });
    }
  }

  for (const p of projects) {
    if (p.status !== 'done' || !(p.cost > 0)) continue;
    total += p.cost;

    if (!byCategory.Klussen) byCategory.Klussen = { total: 0, count: 0 };
    byCategory.Klussen.total += p.cost;
    byCategory.Klussen.count += 1;

    allEntries.push({
      id: p.id,
      date: (p.doneAt || p.addedAt || new Date().toISOString()).slice(0, 10),
      notes: p.notes,
      itemName: p.name,
      itemCategory: 'Klussen',
      isProject: true,
      calculatedCost: round2(p.cost),
    });
  }

  // Newest first
  allEntries.sort((a, b) => new Date(b.date) - new Date(a.date));

  for (const cat of Object.keys(byCategory)) {
    byCategory[cat].total = round2(byCategory[cat].total);
  }

  return { total: round2(total), byCategory, entries: allEntries };
}

/**
 * Cost per 1000 km.
 */
export function costPer1000Km(totalCost, totalKmDriven) {
  if (!totalKmDriven || totalKmDriven <= 0) return 0;
  return round2((totalCost / totalKmDriven) * 1000);
}

/**
 * Cost per month.
 */
export function costPerMonth(totalCost, firstEntryDate, lastEntryDate = new Date()) {
  if (!firstEntryDate) return 0;
  const first = new Date(firstEntryDate);
  const last = new Date(lastEntryDate);
  const months = Math.max(1, (last - first) / (1000 * 60 * 60 * 24 * 30.44));
  return round2(totalCost / months);
}

function round2(n) {
  return Math.round(n * 100) / 100;
}
