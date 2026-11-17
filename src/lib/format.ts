/** Presentation-only formatting. Values are rounded to 3 significant figures to avoid false precision. */
const sig = (x: number, n = 3) => (x === 0 || !Number.isFinite(x) ? x : Number(x.toPrecision(n)));
const nf = (d = 0) => new Intl.NumberFormat('en-GB', { maximumFractionDigits: d, minimumFractionDigits: 0 });

export function num(x: number | null | undefined, digits = 3): string {
  if (x == null || !Number.isFinite(x)) return 'n/a';
  const s = sig(x, digits);
  const abs = Math.abs(s);
  return nf(abs >= 100 ? 0 : abs >= 10 ? 1 : abs >= 1 ? 2 : 3).format(s);
}
export const tco2e = (kg: number | null | undefined) => (kg == null ? 'n/a' : `${num(kg / 1000)} tCO2e`);
export const kgco2e = (kg: number | null | undefined) => (kg == null ? 'n/a' : `${num(kg)} kgCO2e`);
export const eur = (x: number | null | undefined) => (x == null || !Number.isFinite(x) ? 'n/a' : `€${nf(0).format(sig(x, 3))}`);
export const pct = (x: number | null | undefined, d = 0) => (x == null || !Number.isFinite(x) ? 'n/a' : `${(x * 100).toFixed(d)} %`);
export const mwh = (kwh: number) => `${num(kwh / 1000)} MWh`;
export const m3 = (x: number) => `${num(x)} m³`;
export function signed(x: number, f: (v: number) => string) {
  if (!Number.isFinite(x)) return 'n/a';
  if (Math.abs(x) < 1e-9) return '±0';
  return `${x > 0 ? '+' : '−'}${f(Math.abs(x))}`;
}
export const deltaPct = (a: number, b: number) => (a === 0 ? null : (b - a) / Math.abs(a));
