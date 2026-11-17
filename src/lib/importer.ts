import type { FoodCategory, PropertyInputs } from '../types';
import { FOOD_CATEGORIES } from '../engine/food';

/** Unit conversion to canonical units. Returns null when units are incompatible (never guesses). */
const UNIT_TABLE: Record<string, { dim: string; toCanonical: number }> = {
  wh: { dim: 'energy', toCanonical: 0.001 }, kwh: { dim: 'energy', toCanonical: 1 }, mwh: { dim: 'energy', toCanonical: 1000 }, gwh: { dim: 'energy', toCanonical: 1e6 },
  'kwh pcs': { dim: 'energy', toCanonical: 1 }, 'mwh pcs': { dim: 'energy', toCanonical: 1000 },
  'kwh pci': { dim: 'energy_pci', toCanonical: 1 }, 'mwh pci': { dim: 'energy_pci', toCanonical: 1000 },
  l: { dim: 'volume', toCanonical: 0.001 }, litre: { dim: 'volume', toCanonical: 0.001 }, litres: { dim: 'volume', toCanonical: 0.001 }, m3: { dim: 'volume', toCanonical: 1 }, 'm³': { dim: 'volume', toCanonical: 1 },
  g: { dim: 'mass', toCanonical: 0.001 }, kg: { dim: 'mass', toCanonical: 1 }, t: { dim: 'mass', toCanonical: 1000 }, tonne: { dim: 'mass', toCanonical: 1000 }, tonnes: { dim: 'mass', toCanonical: 1000 },
  '%': { dim: 'share', toCanonical: 0.01 }, fraction: { dim: 'share', toCanonical: 1 },
};

export type Canonical = 'kWh' | 'kWh PCS' | 'm3' | 'kg' | 'L' | 'share';

/** Convert a value; gas PCI→PCS uses PCS = PCI / 0.9 (explicit, documented). */
export function convertUnit(value: number, from: string, to: Canonical): number | null {
  const f = UNIT_TABLE[from.trim().toLowerCase()];
  if (!f || !Number.isFinite(value)) return null;
  switch (to) {
    case 'kWh': return f.dim === 'energy' ? value * f.toCanonical : null;
    case 'kWh PCS': return f.dim === 'energy' ? value * f.toCanonical : f.dim === 'energy_pci' ? (value * f.toCanonical) / 0.9 : null;
    case 'm3': return f.dim === 'volume' ? value * f.toCanonical : null;
    case 'L': return f.dim === 'volume' ? value * f.toCanonical * 1000 : null;
    case 'kg': return f.dim === 'mass' ? value * f.toCanonical : null;
    case 'share': return f.dim === 'share' ? value * f.toCanonical : null;
  }
}

export function detectDelimiter(text: string): string {
  const first = text.split(/\r?\n/)[0] ?? '';
  const counts = [';', ',', '\t'].map((d) => [d, first.split(d).length] as const).sort((a, b) => b[1] - a[1]);
  return counts[0][1] > 1 ? counts[0][0] : ',';
}

export function parseCSV(text: string, delimiter = detectDelimiter(text)): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === delimiter) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

export function parseNumber(raw: string, decimal: '.' | ','): number | null {
  let s = raw.trim().replace(/\s| /g, '');
  if (!s) return null;
  if (decimal === ',') s = s.replace(/\./g, '').replace(',', '.');
  else s = s.replace(/,/g, '');
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

const MONTHS_EN = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const MONTHS_FR = ['janv', 'févr', 'mars', 'avr', 'mai', 'juin', 'juil', 'août', 'sept', 'oct', 'nov', 'déc'];
export type DateFormat = 'YYYY-MM' | 'MM/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD' | 'month-name';

export function parseMonth(raw: string, fmt: DateFormat): { year: number | null; month: number } | null {
  const s = raw.trim().toLowerCase();
  let m: RegExpMatchArray | null;
  switch (fmt) {
    case 'YYYY-MM': m = s.match(/^(\d{4})-(\d{1,2})$/); return m ? valid(+m[1], +m[2]) : null;
    case 'MM/YYYY': m = s.match(/^(\d{1,2})\/(\d{4})$/); return m ? valid(+m[2], +m[1]) : null;
    case 'DD/MM/YYYY': m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); return m ? valid(+m[3], +m[2]) : null;
    case 'YYYY-MM-DD': m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/); return m ? valid(+m[1], +m[2]) : null;
    case 'month-name': {
      const i = MONTHS_EN.findIndex((x) => s.startsWith(x));
      const j = MONTHS_FR.findIndex((x) => s.startsWith(x));
      const k = i >= 0 ? i : j;
      const y = s.match(/(\d{4})/);
      return k >= 0 ? { year: y ? +y[1] : null, month: k } : null;
    }
  }
}
const valid = (y: number, mo: number) => (mo >= 1 && mo <= 12 ? { year: y, month: mo - 1 } : null);

export type ImportTarget = 'electricity' | 'gas' | 'water' | 'laundry' | 'waste' | 'food' | 'fleet_fuel' | 'refrigerant' | 'guest_origin';
export const TARGETS: Record<ImportTarget, { label: string; canonical: Canonical; monthly: boolean; keyLabel?: string }> = {
  electricity: { label: 'Monthly electricity bills (grid import)', canonical: 'kWh', monthly: true },
  gas: { label: 'Monthly gas bills', canonical: 'kWh PCS', monthly: true },
  water: { label: 'Monthly water bills', canonical: 'm3', monthly: true },
  laundry: { label: 'Monthly outsourced laundry kg', canonical: 'kg', monthly: true },
  waste: { label: 'Annual waste weights by stream', canonical: 'kg', monthly: false, keyLabel: 'Waste stream id or name' },
  food: { label: 'Annual food purchases by category', canonical: 'kg', monthly: false, keyLabel: 'Food category' },
  fleet_fuel: { label: 'Annual fleet fuel by fuel type', canonical: 'L', monthly: false, keyLabel: 'Fuel (diesel/petrol)' },
  refrigerant: { label: 'Refrigerant top-ups by unit', canonical: 'kg', monthly: false, keyLabel: 'Equipment id or name' },
  guest_origin: { label: 'Guest-origin shares (aggregated, no personal data)', canonical: 'share', monthly: false, keyLabel: 'Origin id or label' },
};

export interface Mapping {
  target: ImportTarget;
  hasHeader: boolean;
  dateCol: number;
  dateFormat: DateFormat;
  keyCol: number;
  valueCol: number;
  unitCol: number | null;
  fixedUnit: string;
  decimal: '.' | ',';
  year: number;
}

export interface PreviewRow { line: number; raw: string[]; key: string; month: number | null; value: number | null; status: 'ok' | 'error' | 'duplicate' | 'warning'; message: string }

export function preview(rows: string[][], m: Mapping, p: PropertyInputs): PreviewRow[] {
  const t = TARGETS[m.target];
  const seen = new Set<string>();
  const data = m.hasHeader ? rows.slice(1) : rows;
  return data.map((raw, i) => {
    const line = i + (m.hasHeader ? 2 : 1);
    const unit = m.unitCol != null ? raw[m.unitCol] ?? '' : m.fixedUnit;
    const num = parseNumber(raw[m.valueCol] ?? '', m.decimal);
    if (num == null) return { line, raw, key: '', month: null, value: null, status: 'error', message: `Value "${raw[m.valueCol] ?? ''}" is not a number.` };
    if (num < 0) return { line, raw, key: '', month: null, value: null, status: 'error', message: 'Negative values are rejected.' };
    const conv = convertUnit(num, unit, t.canonical);
    if (conv == null) return { line, raw, key: '', month: null, value: null, status: 'error', message: `Unit "${unit}" is incompatible with ${t.canonical} — rejected (no silent conversion).` };
    let key = '';
    let month: number | null = null;
    let status: PreviewRow['status'] = 'ok';
    let message = unit.trim().toLowerCase() === t.canonical.toLowerCase() ? '' : `Converted ${num} ${unit} → ${+conv.toFixed(4)} ${t.canonical}`;
    if (t.monthly) {
      const d = parseMonth(raw[m.dateCol] ?? '', m.dateFormat);
      if (!d) return { line, raw, key, month, value: null, status: 'error', message: `Date "${raw[m.dateCol] ?? ''}" does not match format ${m.dateFormat}.` };
      if (d.year != null && d.year !== m.year) return { line, raw, key, month: d.month, value: conv, status: 'warning', message: `Year ${d.year} differs from reporting year ${m.year} — row ignored.` };
      month = d.month;
      key = String(month);
    } else {
      key = (raw[m.keyCol] ?? '').trim();
      const resolved = resolveKey(m.target, key, p);
      if (!resolved) return { line, raw, key, month, value: null, status: 'error', message: `Unknown ${t.keyLabel}: "${key}".` };
      key = resolved;
      if (m.target === 'guest_origin' && conv > 1) return { line, raw, key, month, value: null, status: 'error', message: 'Share above 100 % rejected.' };
    }
    if (seen.has(key)) { status = 'duplicate'; message = 'Duplicate of an earlier row — ignored.'; }
    seen.add(key);
    return { line, raw, key, month, value: conv, status, message };
  });
}

function resolveKey(target: ImportTarget, key: string, p: PropertyInputs): string | null {
  const k = key.toLowerCase();
  switch (target) {
    case 'waste': return p.waste.find((w) => w.id.toLowerCase() === k || w.name.toLowerCase() === k)?.id ?? null;
    case 'refrigerant': return p.refrigerants.find((w) => w.id.toLowerCase() === k || w.name.toLowerCase() === k)?.id ?? null;
    case 'guest_origin': return p.guestTravel.origins.find((o) => o.id.toLowerCase() === k || o.label.toLowerCase() === k)?.id ?? null;
    case 'food': return (FOOD_CATEGORIES as string[]).includes(k.replace(/ /g, '_')) ? k.replace(/ /g, '_') : null;
    case 'fleet_fuel': return ['diesel', 'petrol'].includes(k) ? k : null;
    default: return null;
  }
}

/** Build the set of input patches from accepted preview rows. Rows with errors/duplicates/warnings are ignored. */
export function buildPatches(rows: PreviewRow[], m: Mapping, p: PropertyInputs): { path: string; value: unknown }[] {
  const ok = rows.filter((r) => r.status === 'ok' && r.value != null);
  const patches: { path: string; value: unknown }[] = [];
  const monthly = (field: keyof PropertyInputs['measured']) => {
    const arr = [...(p.measured[field] as (number | null)[])];
    for (const r of ok) arr[r.month!] = r.value;
    patches.push({ path: `measured.${field}`, value: arr }, { path: 'measured.useMeasured', value: true });
  };
  switch (m.target) {
    case 'electricity': monthly('electricityKWh'); break;
    case 'gas': monthly('gasKWhPCS'); break;
    case 'water': monthly('waterM3'); break;
    case 'laundry': monthly('laundryKgOutsourced'); break;
    case 'waste': for (const r of ok) { const i = p.waste.findIndex((w) => w.id === r.key); patches.push({ path: `waste.${i}.kgPerYear`, value: r.value }, { path: `waste.${i}.measurement`, value: 'weighed' }); } break;
    case 'refrigerant': for (const r of ok) { const i = p.refrigerants.findIndex((w) => w.id === r.key); patches.push({ path: `refrigerants.${i}.measuredTopUpKg`, value: r.value }); } break;
    case 'guest_origin': for (const r of ok) { const i = p.guestTravel.origins.findIndex((o) => o.id === r.key); patches.push({ path: `guestTravel.origins.${i}.shareOfArrivals`, value: r.value }); } break;
    case 'food': { const obj: Partial<Record<FoodCategory, number>> = { ...(p.food.measuredPurchasesKg ?? {}) }; for (const r of ok) (obj as any)[r.key] = r.value; patches.push({ path: 'food.measuredPurchasesKg', value: obj }); break; }
    case 'fleet_fuel': for (const r of ok) { patches.push({ path: r.key === 'diesel' ? 'measured.fleetDieselL' : 'measured.fleetPetrolL', value: r.value }, { path: 'measured.useMeasured', value: true }); } break;
  }
  return patches;
}
