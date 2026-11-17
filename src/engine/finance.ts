import type { CalculationResult, CostLine, GlobalSettings, Library, PropertyInputs, CalibrationRef } from '../types';
import { costTotal } from './accounting';
import { calculate } from './index';
import { sum } from './util';

export interface YearPoint {
  year: number;
  t: number;
  baselineKg: number;
  scenarioKg: number;
  baselineOpex: number;
  scenarioOpex: number;
  capex: number;
  residual: number;
  cashflow: number;
}

export interface FinanceResult {
  years: YearPoint[];
  capexTotal: number;
  annualSavingFirstFullYear: number;
  annualAbatementKgFirstFullYear: number;
  simplePaybackYears: number | null;
  npv: number;
  irr: number | null;
  macEURPerT: number | null;
  carbonBreakEvenYears: number | null;
  cumulativeAbatementKg: number;
  hypotheticalCarbonValueEUR: number;
  framework: string;
  notes: string[];
}

const escalationFor = (c: CostLine, f: PropertyInputs['finance']) =>
  c.category === 'energy' || c.category === 'fleet' || c.category === 'revenue_offset' ? f.energyRealEscalation : c.category === 'maintenance' || c.category === 'labour' ? f.maintenanceRealEscalation : f.productRealEscalation;

export function escalatedOpex(r: CalculationResult, p: PropertyInputs, t: number) {
  return sum(r.costs.map((c) => costTotal(c, p.finance.vatRecoverable) * (1 + escalationFor(c, p.finance)) ** t));
}

/** Operational corporate emissions excluding one-off capital-goods acquisitions (cat. 2). */
export const operationalKg = (r: CalculationResult) => sum(r.lines.filter((l) => l.views.includes('corporate') && !(l.scope === 'S3' && l.s3cat === 2)).map((l) => l.kg));
export const corporateKg = (r: CalculationResult, method: 'location' | 'market' = 'location') =>
  method === 'market' && r.totals.corporateMB != null ? r.totals.corporateMB : r.totals.corporateLB;

export function irr(cashflows: number[]): number | null {
  const npvAt = (r: number) => cashflows.reduce((s, cf, t) => s + cf / (1 + r) ** t, 0);
  let lo = -0.95;
  let hi = 2;
  let flo = npvAt(lo);
  const fhi = npvAt(hi);
  if (!Number.isFinite(flo) || !Number.isFinite(fhi) || flo * fhi > 0) return null;
  const signChanges = cashflows.slice(1).reduce((n, cf, i) => n + (Math.sign(cf) !== Math.sign(cashflows[i]) && cf !== 0 && cashflows[i] !== 0 ? 1 : 0), 0);
  if (signChanges !== 1) return null; // IRR not meaningful with multiple sign changes
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    const fm = npvAt(mid);
    if (flo * fm <= 0) hi = mid;
    else { lo = mid; flo = fm; }
  }
  return (lo + hi) / 2;
}

/**
 * Multi-year comparison in a consistent REAL framework (real discount rate, real escalation, constant-price EUR).
 * Each year is recalculated by the engine (reporting year = that year), so scheduled replacements and acquisitions
 * fall in the correct year. Interventions take effect from the scenario implementation year.
 */
export function multiYear(
  baseline: PropertyInputs,
  scenario: PropertyInputs,
  implementationYear: number,
  settings: GlobalSettings,
  library: Library,
  calibration?: CalibrationRef,
): FinanceResult {
  const f = scenario.finance;
  const y0 = baseline.boundary.reportingYear;
  const N = Math.max(1, Math.min(40, Math.round(f.horizonYears)));
  const years: YearPoint[] = [];
  const capexByYear: Record<number, number> = {};
  for (const c of scenario.capex) capexByYear[Math.max(y0, c.year)] = (capexByYear[Math.max(y0, c.year)] ?? 0) + c.amountEUR;
  let firstFull: YearPoint | null = null;
  for (let t = 0; t < N; t++) {
    const year = y0 + t;
    const b = { ...baseline, boundary: { ...baseline.boundary, reportingYear: year }, capex: [] };
    const sInputs = year >= implementationYear ? scenario : { ...baseline, capex: scenario.capex };
    const s = { ...sInputs, boundary: { ...sInputs.boundary, reportingYear: year } };
    const rb = calculate(b, settings, library, calibration);
    const rs = calculate(s, settings, library, calibration);
    const baselineOpex = escalatedOpex(rb, baseline, t);
    const scenarioOpex = escalatedOpex(rs, scenario, t);
    const capex = capexByYear[year] ?? 0;
    let residual = 0;
    if (t === N - 1) {
      for (const c of scenario.capex) {
        const age = year - Math.max(y0, c.year) + 1;
        if (age >= 0 && age < c.lifeYears) residual += c.amountEUR * (1 - age / c.lifeYears);
      }
    }
    const pt: YearPoint = { year, t, baselineKg: corporateKg(rb, settings.scope2Primary), scenarioKg: corporateKg(rs, settings.scope2Primary), baselineOpex, scenarioOpex, capex, residual, cashflow: baselineOpex - scenarioOpex - capex + residual };
    years.push(pt);
    if (!firstFull && year >= implementationYear) firstFull = { ...pt, baselineKg: operationalKg(rb), scenarioKg: operationalKg(rs) };
  }
  const r = f.realDiscountRate;
  const npv = years.reduce((s, y) => s + y.cashflow / (1 + r) ** y.t, 0);
  const capexTotal = sum(scenario.capex.map((c) => c.amountEUR));
  const saving = firstFull ? firstFull.baselineOpex - firstFull.scenarioOpex : 0;
  const abatement = firstFull ? firstFull.baselineKg - firstFull.scenarioKg : 0;
  const cumulativeAbatementKg = sum(years.map((y) => y.baselineKg - y.scenarioKg));
  const embodied = sum(scenario.capex.map((c) => c.embodiedKg));
  const notes: string[] = [];
  if (saving <= 0 && capexTotal > 0) notes.push('Annual savings are zero or negative: no finite payback.');
  if (cumulativeAbatementKg <= 0) notes.push('The scenario does not reduce cumulative emissions: abatement cost is not meaningful.');
  const cf = years.map((y) => y.cashflow);
  return {
    years,
    capexTotal,
    annualSavingFirstFullYear: saving,
    annualAbatementKgFirstFullYear: abatement,
    simplePaybackYears: saving > 0 && capexTotal > 0 ? capexTotal / saving : saving > 0 && capexTotal === 0 ? 0 : null,
    npv,
    irr: capexTotal > 0 ? irr(cf) : null,
    macEURPerT: cumulativeAbatementKg > 0 ? -npv / (cumulativeAbatementKg / 1000) : null,
    carbonBreakEvenYears: embodied > 0 && abatement > 0 ? embodied / abatement : embodied === 0 && abatement > 0 ? 0 : null,
    cumulativeAbatementKg,
    hypotheticalCarbonValueEUR: (cumulativeAbatementKg / 1000) * f.hypotheticalCarbonPricePerT,
    framework: `Real terms (constant ${y0} EUR), real discount rate ${(r * 100).toFixed(1)} %, ${f.vatRecoverable ? 'VAT recoverable (ex-VAT)' : 'VAT not recoverable (VAT included in costs)'}. Hypothetical carbon value is shown separately and is not a cash flow.`,
    notes,
  };
}
