/**
 * Cost calculation utilities with VAT support.
 */

/**
 * Calculate total including VAT from parts + labor costs.
 */
export function calculateTotalInclVat(partsCost, laborCost, vatPercent = 21) {
  const exclVat = (partsCost || 0) + (laborCost || 0);
  const vatAmount = exclVat * (vatPercent / 100);
  return {
    totalExclVat: round2(exclVat),
    vatAmount: round2(vatAmount),
    totalInclVat: round2(exclVat + vatAmount),
  };
}

/**
 * Aggregate costs from all maintenance items.
 */
export function aggregateCosts(maintenanceItems) {
  let totalInclVat = 0;
  let totalExclVat = 0;
  let totalVat = 0;
  const byCategory = {};
  const allEntries = [];

  for (const item of maintenanceItems) {
    if (!item.history) continue;
    for (const entry of item.history) {
      const exclVat = (entry.partsCost || 0) + (entry.laborCost || 0);
      const vatAmount = exclVat * ((entry.vatPercent || 0) / 100);
      const inclVat = exclVat + vatAmount;

      totalExclVat += exclVat;
      totalVat += vatAmount;
      totalInclVat += inclVat;

      // By category
      const cat = item.category || 'Unknown';
      if (!byCategory[cat]) {
        byCategory[cat] = { totalExclVat: 0, totalInclVat: 0, vatAmount: 0, count: 0 };
      }
      byCategory[cat].totalExclVat += exclVat;
      byCategory[cat].totalInclVat += inclVat;
      byCategory[cat].vatAmount += vatAmount;
      byCategory[cat].count += 1;

      allEntries.push({
        ...entry,
        itemName: item.name,
        itemCategory: item.category,
        calculatedExclVat: round2(exclVat),
        calculatedInclVat: round2(inclVat),
        calculatedVat: round2(vatAmount),
      });
    }
  }

  // Sort entries chronologically (newest first)
  allEntries.sort((a, b) => new Date(b.date) - new Date(a.date));

  // Round category totals
  for (const cat of Object.keys(byCategory)) {
    byCategory[cat].totalExclVat = round2(byCategory[cat].totalExclVat);
    byCategory[cat].totalInclVat = round2(byCategory[cat].totalInclVat);
    byCategory[cat].vatAmount = round2(byCategory[cat].vatAmount);
  }

  return {
    totalInclVat: round2(totalInclVat),
    totalExclVat: round2(totalExclVat),
    totalVat: round2(totalVat),
    byCategory,
    entries: allEntries,
  };
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
