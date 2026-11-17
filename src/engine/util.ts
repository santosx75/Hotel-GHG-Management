import type { M12 } from '../types';

export const DAYS_IN_MONTH: M12 = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const zeros = (): M12 => new Array(12).fill(0);
export const fill = (v: number): M12 => new Array(12).fill(v);
export const sum = (a: readonly number[]): number => a.reduce((s, x) => s + x, 0);
export const add = (a: M12, b: M12): M12 => a.map((x, i) => x + b[i]);
export const sub = (a: M12, b: M12): M12 => a.map((x, i) => x - b[i]);
export const scale = (a: M12, k: number): M12 => a.map((x) => x * k);
export const mul = (a: M12, b: M12): M12 => a.map((x, i) => x * b[i]);
export const map12 = (f: (m: number) => number): M12 => Array.from({ length: 12 }, (_, m) => f(m));
export const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
export const clamp01 = (x: number) => clamp(x, 0, 1);

/** Divide, returning null (→ "not applicable") instead of Infinity/NaN for zero denominators. */
export function safeDiv(num: number, den: number): number | null {
  if (!Number.isFinite(num) || !Number.isFinite(den) || den === 0) return null;
  return num / den;
}

/** Distribute an annual quantity over months proportionally to weights (falls back to equal split). */
export function distribute(annual: number, weights: M12): M12 {
  const w = sum(weights);
  if (w <= 0) return fill(annual / 12);
  return weights.map((x) => (annual * x) / w);
}

// ── Standard normal helpers ──
export function normPdf(z: number) {
  return Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI);
}
export function normCdf(z: number) {
  // Abramowitz & Stegun 7.1.26 via erf
  const t = 1 / (1 + 0.3275911 * Math.abs(z / Math.SQRT2));
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t) * Math.exp(-(z * z) / 2);
  return z >= 0 ? 0.5 * (1 + y) : 0.5 * (1 - y);
}

/**
 * Heating degree-days for a month assuming daily mean temperatures ~ Normal(meanT, sd).
 * HDD = days × E[max(0, base − T)] = days × sd × (z·Φ(z) + φ(z)), z = (base − meanT)/sd.
 * Documented approximation (normal-distribution degree-day method, cf. Erbs et al. 1983 family).
 */
export function hdd(base: number, meanT: number, sd: number, days: number) {
  if (sd <= 0.01) return days * Math.max(0, base - meanT);
  const z = (base - meanT) / sd;
  return days * sd * (z * normCdf(z) + normPdf(z));
}
/** Cooling degree-days: days × E[max(0, T − base)]. */
export function cdd(base: number, meanT: number, sd: number, days: number) {
  return hdd(-base, -meanT, sd, days);
}

// ── Physical constants ──
export const WATER_CP_KJ_PER_KG_K = 4.186;
/** kWh to heat `litres` of water by `deltaK` (1 L ≈ 1 kg). 100 L × 40 K → 4.651 kWh. */
export const waterHeatKWh = (litres: number, deltaK: number) => (litres * WATER_CP_KJ_PER_KG_K * deltaK) / 3600;
export const LATENT_KWH_PER_KG = 2450 / 3600; // ≈0.68 kWh/kg
export const AIR_WH_PER_M3K = 0.34;

/** Fuel net calorific values for energy reporting (kWh per unit). Approximate standard values. */
export const ENERGY_CONTENT: Record<string, { unit: string; kWhPerUnit: number }> = {
  electricity: { unit: 'kWh', kWhPerUnit: 1 },
  natural_gas: { unit: 'kWh PCS', kWhPerUnit: 1 },
  wood_pellets: { unit: 'kWh', kWhPerUnit: 1 },
  district_heat: { unit: 'kWh', kWhPerUnit: 1 },
  heating_oil: { unit: 'L', kWhPerUnit: 10.0 },
  diesel: { unit: 'L', kWhPerUnit: 9.96 },
  petrol: { unit: 'L', kWhPerUnit: 8.9 },
  lpg: { unit: 'kg', kWhPerUnit: 12.8 },
};

/** Mass of a flat rectangular textile: (L/100)·(W/100)·(GSM/1000) kg. 70×140 cm @500 gsm → 0.49 kg. */
export const rectMassKg = (lengthCm: number, widthCm: number, gsm: number) => (lengthCm / 100) * (widthCm / 100) * (gsm / 1000);

export const round = (x: number, d = 0) => {
  const p = 10 ** d;
  return Math.round(x * p) / p;
};

export function deepClone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x));
}

/** Get/set by dotted path (supports numeric indices). */
export function getPath(obj: any, path: string): any {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}
export function setPath<T>(obj: T, path: string, value: any): T {
  const keys = path.split('.');
  const clone: any = Array.isArray(obj) ? [...(obj as any)] : { ...(obj as any) };
  let cur = clone;
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i];
    const next = cur[k];
    cur[k] = Array.isArray(next) ? [...next] : { ...next };
    cur = cur[k];
  }
  cur[keys[keys.length - 1]] = value;
  return clone;
}
