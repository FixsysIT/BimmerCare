// Indicatief uurtarief onafhankelijke garage, excl. BTW (voor arbeidskosten-schatting).
export const LABOUR_RATE_EXCL_BTW = 140;

// Categories for maintenance items
export const CATEGORIES = {
  MOTOR: 'Motor',
  MOTOR_ELEC: 'Motorelektronica',
  COOLING: 'Koeling',
  BRAKES: 'Remmen',
  TRANSMISSION: 'Transmissie',
  DRIVELINE: 'Aandrijving',
  TIRES: 'Banden',
  SUSPENSION: 'Onderstel',
  ELECTRICAL: 'Elektrisch',
  AC: 'Airco',
  EXTERIOR: 'Exterieur',
  N53_SPECIFIC: 'N53-Specifiek',
};

// Category icons (emoji for now)
export const CATEGORY_ICONS = {
  Motor: '⚙️',
  Motorelektronica: '🔌',
  Koeling: '🌡️',
  Remmen: '🛑',
  Transmissie: '🔧',
  Aandrijving: '⚙️',
  Banden: '🛞',
  Onderstel: '🏗️',
  Elektrisch: '⚡',
  Airco: '❄️',
  Exterieur: '🪟',
  'N53-Specifiek': '🔬',
};

// Visibility layers — keep the dashboard usable as the catalog grows.
export const LAYERS = {
  ACTIVE: 'active',          // real interval/service work
  INSPECTION: 'inspection',  // condition/wear/leak — check, don't panic
  DIAGNOSIS: 'diagnosis',    // on-failure / fault-code — monitor
  HIDDEN: 'hidden',          // rare/archive
};

// Derive the layer for items that predate the field (stored before P2).
export function deriveLayer(item) {
  if (item.visibilityLayer) return item.visibilityLayer;
  if (item.replacementStrategy === 'interval') return LAYERS.ACTIVE;
  if (item.replacementStrategy === 'on-failure' || item.intervalType === 'diagnosis') return LAYERS.DIAGNOSIS;
  return LAYERS.INSPECTION; // condition
}

// Interval types
export const INTERVAL_TYPES = {
  KM_DOMINANT: 'km-dominant',
  TIME_DOMINANT: 'time-dominant',
  CONDITION: 'condition',
  DIAGNOSIS: 'diagnosis',
};

// Sources
export const SOURCES = {
  BMW_OFFICIAL: 'bmw-official',
  COMMUNITY_PREVENTIVE: 'community-preventive',
  CUSTOM: 'custom',
  CONDITION_DIAGNOSIS: 'condition-diagnosis',
};

// Source badge config
export const SOURCE_BADGES = {
  'bmw-official': { label: 'BMW', color: '#1B69B2' },
  'community-preventive': { label: 'Community', color: '#00E676' },
  'custom': { label: 'Custom', color: '#9C27B0' },
  'condition-diagnosis': { label: 'Diagnose', color: '#FF9100' },
};

// Priority levels
export const PRIORITIES = {
  CRITICAL: 'critical',
  PREVENTIVE: 'preventive',
  COMFORT: 'comfort',
};

// Priority badge config
export const PRIORITY_BADGES = {
  critical: { label: 'Critical', color: '#FF1744', emoji: '🔴' },
  preventive: { label: 'Preventive', color: '#FF9100', emoji: '🟡' },
  comfort: { label: 'Comfort', color: '#1B69B2', emoji: '🔵' },
};

// Status values
// red=Nu doen, orange=Binnenkort, inspect=Inspectie nodig,
// monitor=Monitor (on-failure, geen fout), green=OK, grey=Geen data
export const STATUS = {
  GREEN: 'green',
  ORANGE: 'orange',
  RED: 'red',
  GREY: 'grey',
  INSPECT: 'inspect',
  MONITOR: 'monitor',
};

// Urgency order for sorting/grouping (lower = more urgent)
export const STATUS_ORDER = { red: 0, orange: 1, inspect: 2, monitor: 3, grey: 4, green: 5 };

// Status reasons
export const STATUS_REASONS = {
  KM_EXCEEDED: 'km_exceeded',
  KM_WARNING: 'km_warning',
  DATE_EXCEEDED: 'date_exceeded',
  DATE_WARNING: 'date_warning',
  DATE_ADVISORY: 'date_advisory',
  CONDITION_CHECK: 'condition_check',
  DIAGNOSIS: 'diagnosis',
  MANUAL: 'manual',
  NO_DATA: 'no_data',
  NEVER_REPLACED: 'never_replaced',
  INSPECTION_NEEDED: 'inspection_needed',
  MONITOR: 'monitor',
  REPLACEMENT_EXPIRED: 'replacement_window_expired',
  NO_FAULT_EXPIRED: 'no_fault_expired',
};

// Default VAT percentage
export const DEFAULT_VAT_PERCENT = 21;

// How long a diagnosis "no fault" result keeps an on-failure item green before
// it drops back to Monitor (a clean check goes stale; it's not a repair).
export const DIAGNOSIS_OK_VALID_MONTHS = 6;

// Follow-up guarantees — nothing should stay green forever. A green inspection
// or a replacement without an explicit window goes stale after this many months
// and nudges back to INSPECT / MONITOR so there is always a next action.
export const INSPECTION_OK_VALID_MONTHS = 12;        // condition "ok"/observed-fine
export const REPLACEMENT_OK_VALID_FALLBACK_MONTHS = 24; // on-failure replaced w/o window

// Export version
export const EXPORT_VERSION = '1.0';
export const APP_VERSION = '1.2';

// Catalog version — bump when default items/metadata change, so existing
// stored data can be merged up via Settings → "Catalogus bijwerken".
export const CATALOG_VERSION = '2026.07.08-epb';

// Storage keys
export const STORAGE_KEYS = {
  VEHICLE: 'bimmercare_vehicle',
  MAINTENANCE_ITEMS: 'bimmercare_maintenance',
  SETTINGS: 'bimmercare_settings',
  LAST_BACKUP: 'bimmercare_last_backup',
  CHANGE_COUNT: 'bimmercare_change_count',
  STATUS_EVENTS: 'bimmercare_status_events',
  STATUS_SNAPSHOT: 'bimmercare_status_snapshot',
};

// Max status-transition events kept (newest wins).
export const MAX_STATUS_EVENTS = 50;

// Backup defaults
export const BACKUP_DEFAULTS = {
  AUTO_DOWNLOAD: false,
  REMINDER_CHANGES: 10,  // remind after X changes
  REMINDER_DAYS: 7,      // remind after X days
};
