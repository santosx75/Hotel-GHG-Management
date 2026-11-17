import type { GlobalSettings, Library, PropertyInputs, CalibrationRef } from '../types';
import { calculate } from './index';
import { deepClone } from './util';

/**
 * Sensitivity drivers act on PRIMARY inputs only; dependent quantities (guest-nights, towel mass,
 * heating demand…) are recomputed by the engine, so dependence is preserved.
 */
export interface Driver {
  id: string;
  label: string;
  low: string;
  high: string;
  kind: 'emission' | 'cost' | 'both';
  apply: (p: PropertyInputs, lib: Library, level: number) => void; // level in [-1, 1]
}

const scaleFactor = (lib: Library, id: string, level: number) => {
  const f = lib.factors[id];
  if (!f) return;
  const target = level < 0 ? f.low ?? f.value * 0.7 : f.high ?? f.value * 1.3;
  f.value = f.value + (target - f.value) * Math.abs(level);
};

export const DRIVERS: Driver[] = [
  { id: 'occupancy', label: 'Occupancy level (all months, correlated)', low: '−15 %', high: '+15 %', kind: 'both', apply: (p, _l, k) => { p.activity.monthlyOccupancy = p.activity.monthlyOccupancy.map((o) => Math.min(1, Math.max(0, o * (1 + 0.15 * k)))); } },
  { id: 'los', label: 'Average length of stay', low: '−0.5 night', high: '+0.5 night', kind: 'both', apply: (p, _l, k) => { p.activity.avgLengthOfStayNights = Math.max(1, p.activity.avgLengthOfStayNights + 0.5 * k); } },
  { id: 'weather', label: 'Outdoor temperature (all months, correlated)', low: '−1 °C', high: '+1 °C', kind: 'both', apply: (p, l, k) => { const c = l.climates[p.profile.climateProfileId]; c.meanTempC = c.meanTempC.map((t) => t + k); } },
  { id: 'setpoint', label: 'Heating setpoint', low: '−1 °C', high: '+1 °C', kind: 'both', apply: (p, _l, k) => { p.building.heatingSetpointC += k; } },
  { id: 'shower', label: 'Shower flow rate', low: '−20 %', high: '+20 %', kind: 'both', apply: (p, _l, k) => { p.bathrooms.showerFlowLPerMin *= 1 + 0.2 * k; } },
  { id: 'gsm', label: 'Towel weight (g/m², mass follows)', low: '−10 %', high: '+10 %', kind: 'both', apply: (p, _l, k) => { p.textiles.forEach((t) => { if (/towel/i.test(t.name) && t.gsm != null) t.gsm *= 1 + 0.1 * k; }); } },
  { id: 'grid', label: 'Grid electricity factor (generation)', low: 'factor low', high: 'factor high', kind: 'emission', apply: (_p, l, k) => scaleFactor(l, 'elec_fr_generation', k) },
  { id: 'gas', label: 'Natural-gas combustion factor', low: 'factor low', high: 'factor high', kind: 'emission', apply: (_p, l, k) => scaleFactor(l, 'gas_combustion', k) },
  { id: 'beef', label: 'Beef emission factor', low: 'factor low', high: 'factor high', kind: 'emission', apply: (_p, l, k) => scaleFactor(l, 'food_beef', k) },
  { id: 'textile', label: 'Cotton terry factor', low: 'factor low', high: 'factor high', kind: 'emission', apply: (_p, l, k) => scaleFactor(l, 'textile_cotton_terry', k) },
  { id: 'leak', label: 'Refrigerant leak rates (estimated units)', low: '×0.5', high: '×2', kind: 'emission', apply: (p, _l, k) => { p.refrigerants.forEach((r) => { r.annualLeakRate *= k < 0 ? 1 - 0.5 * -k : 1 + k; }); } },
  { id: 'laundryFactor', label: 'Outsourced laundry factor', low: '−50 %', high: '+50 %', kind: 'emission', apply: (p, _l, k) => { if (p.outsourcedLaundry.factorKgPerKg != null) p.outsourcedLaundry.factorKgPerKg *= 1 + 0.5 * k; } },
  { id: 'elecPrice', label: 'Electricity energy price', low: '−20 %', high: '+20 %', kind: 'cost', apply: (p, _l, k) => { p.electricity.priceEnergyHP *= 1 + 0.2 * k; p.electricity.priceEnergyHC *= 1 + 0.2 * k; } },
  { id: 'gasPrice', label: 'Gas price', low: '−20 %', high: '+20 %', kind: 'cost', apply: (p, _l, k) => { p.fuels.gasPricePerKWh *= 1 + 0.2 * k; } },
  { id: 'foodPrice', label: 'Food prices', low: '−10 %', high: '+10 %', kind: 'cost', apply: (p, _l, k) => { for (const c of Object.keys(p.food.foodPricePerKg)) (p.food.foodPricePerKg as any)[c] *= 1 + 0.1 * k; } },
];

export interface TornadoRow { id: string; label: string; low: string; high: string; dLowKg: number; dHighKg: number; dLowEUR: number; dHighEUR: number }

export function tornado(p: PropertyInputs, settings: GlobalSettings, lib: Library, calibration?: CalibrationRef) {
  const base = calculate(p, settings, lib, calibration).totals;
  const rows: TornadoRow[] = DRIVERS.map((d) => {
    const run = (k: number) => {
      const pp = deepClone(p);
      const ll = deepClone(lib);
      d.apply(pp, ll, k);
      return calculate(pp, settings, ll, calibration).totals;
    };
    const lo = run(-1);
    const hi = run(1);
    return { id: d.id, label: d.label, low: d.low, high: d.high, dLowKg: lo.corporateLB - base.corporateLB, dHighKg: hi.corporateLB - base.corporateLB, dLowEUR: lo.opexEUR - base.opexEUR, dHighEUR: hi.opexEUR - base.opexEUR };
  });
  return { base, rows };
}

/** Simple seeded PRNG (mulberry32) so runs are reproducible. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** Triangular(-1, 0, 1) sample. */
const tri = (u: number) => (u < 0.5 ? Math.sqrt(2 * u) - 1 : 1 - Math.sqrt(2 * (1 - u)));

/**
 * Monte Carlo over the driver ranges (triangular, independent between drivers; within a driver the
 * months/items move together). Output is a MODELLED UNCERTAINTY RANGE, not a statistical confidence interval.
 */
export function monteCarlo(p: PropertyInputs, settings: GlobalSettings, lib: Library, n: number, seed = 42, calibration?: CalibrationRef) {
  const r = rng(seed);
  const kg: number[] = [];
  const eur: number[] = [];
  for (let i = 0; i < n; i++) {
    const pp = deepClone(p);
    const ll = deepClone(lib);
    for (const d of DRIVERS) d.apply(pp, ll, tri(r()));
    const t = calculate(pp, settings, ll, calibration).totals;
    kg.push(t.corporateLB);
    eur.push(t.opexEUR);
  }
  const q = (arr: number[], x: number) => { const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.max(0, Math.round(x * (s.length - 1))))]; };
  return { n, kg: { p10: q(kg, 0.1), p50: q(kg, 0.5), p90: q(kg, 0.9) }, eur: { p10: q(eur, 0.1), p50: q(eur, 0.5), p90: q(eur, 0.9) }, samplesKg: kg };
}
