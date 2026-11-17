import type { CalibrationRef, GlobalSettings, Library, PropertyInputs } from '../types';
import { calculate } from '../engine';
import { escalatedOpex, operationalKg } from '../engine/finance';
import { sum } from '../engine/util';
import { PRESETS } from './presets';

export interface PresetEvaluation {
  id: string;
  label: string;
  mechanisms: string[];
  capex: number;
  embodiedKg: number;
  annualSaving: number;
  annualAbatementKg: number;
  waterSavingM3: number;
  simplePayback: number | null;
  npvApprox: number;
  macApprox: number | null;
  carbonBreakEven: number | null;
  category: 'Quick win' | 'Low-CAPEX action' | 'High-carbon-impact action' | 'Longer-term investment' | 'Saves cost but increases emissions' | 'Not beneficial on modelled data';
  warnings: string[];
}

const annuity = (r: number, n: number) => (r === 0 ? n : (1 - (1 + r) ** -n) / r);

/** Evaluate each applicable preset in isolation against the baseline (constant-saving NPV approximation). */
export function evaluatePresets(baseline: PropertyInputs, settings: GlobalSettings, lib: Library, calibration?: CalibrationRef): PresetEvaluation[] {
  // Implement in the reporting year; evaluate steady state in the following year so that one-off events
  // (acquisitions, refrigerant recovery at retirement) do not distort annual savings.
  const year = baseline.boundary.reportingYear;
  const evalYear = year + 1;
  const atYear = (p: PropertyInputs) => ({ ...p, boundary: { ...p.boundary, reportingYear: evalYear } });
  const base = calculate(atYear(baseline), settings, lib, calibration);
  const baseOpex = escalatedOpex(base, baseline, 0);
  const baseKg = operationalKg(base);
  const f = baseline.finance;
  const out: PresetEvaluation[] = [];
  for (const pr of PRESETS) {
    if (!pr.applicable(baseline)) continue;
    const s = pr.apply({ ...baseline, capex: [] }, year);
    const r = calculate(atYear(s), settings, lib, calibration);
    const capex = sum(s.capex.map((c) => c.amountEUR));
    const embodied = sum(s.capex.map((c) => c.embodiedKg)) + sum(s.vehicles.map((v) => (v.replacement?.year === year ? v.replacement.embodiedKg * v.count : 0)));
    const saving = baseOpex - escalatedOpex(r, s, 0);
    const abatement = baseKg - operationalKg(r);
    const npv = -capex + saving * annuity(f.realDiscountRate, f.horizonYears);
    const lifetimeAbatementT = (abatement * f.horizonYears) / 1000 - embodied / 1000;
    const payback = saving > 0 && capex > 0 ? capex / saving : saving > 0 ? 0 : null;
    let category: PresetEvaluation['category'];
    if (abatement <= 0 && saving <= 0) category = 'Not beneficial on modelled data';
    else if (abatement <= 0) category = 'Saves cost but increases emissions';
    else if (capex <= 5000 && saving >= 0 && abatement > 0) category = 'Quick win';
    else if (capex <= 25000 && abatement > 0) category = 'Low-CAPEX action';
    else if (payback != null && payback <= 5) category = 'High-carbon-impact action';
    else category = abatement > 0.03 * baseKg ? 'High-carbon-impact action' : 'Longer-term investment';
    out.push({
      id: pr.id, label: pr.label, mechanisms: pr.mechanisms, capex, embodiedKg: embodied, annualSaving: saving, annualAbatementKg: abatement,
      waterSavingM3: base.totals.waterM3 - r.totals.waterM3, simplePayback: payback, npvApprox: npv, macApprox: lifetimeAbatementT > 0 ? -npv / lifetimeAbatementT : null,
      carbonBreakEven: embodied > 0 && abatement > 0 ? embodied / abatement : embodied === 0 && abatement > 0 ? 0 : null, category,
      warnings: r.warnings.filter((w) => w.level !== 'info' && !base.warnings.some((b) => b.message === w.message)).map((w) => w.message),
    });
  }
  return out;
}

/**
 * Heuristic package builder — NOT an optimiser. Objective: maximise annual abatement.
 * Greedy by abatement per euro of CAPEX, subject to CAPEX budget and maximum payback;
 * the selected package is then recalculated as one integrated system (savings are not summed).
 */
export function greedyPackage(baseline: PropertyInputs, evals: PresetEvaluation[], settings: GlobalSettings, lib: Library, calibration?: CalibrationRef) {
  const budget = baseline.constraints.capexBudgetEUR ?? Infinity;
  const maxPb = baseline.constraints.maxPaybackYears ?? Infinity;
  const exclusive = [['laundry-outsource', 'laundry-insource']];
  const ranked = evals.filter((e) => e.annualAbatementKg > 0 && e.warnings.length === 0).sort((a, b) => b.annualAbatementKg / Math.max(1, b.capex) - a.annualAbatementKg / Math.max(1, a.capex));
  const chosen: PresetEvaluation[] = [];
  let spent = 0;
  for (const e of ranked) {
    if (spent + e.capex > budget) continue;
    if (e.capex > 0 && (e.simplePayback == null || e.simplePayback > maxPb)) continue;
    if (exclusive.some((g) => g.includes(e.id) && chosen.some((c) => g.includes(c.id)))) continue;
    chosen.push(e);
    spent += e.capex;
  }
  let p = { ...baseline, capex: [] as PropertyInputs['capex'] };
  const year = baseline.boundary.reportingYear;
  for (const c of chosen) p = PRESETS.find((x) => x.id === c.id)!.apply(p, year);
  const atNext = (q: PropertyInputs) => ({ ...q, boundary: { ...q.boundary, reportingYear: year + 1 } });
  const base = calculate(atNext(baseline), settings, lib, calibration);
  const integrated = calculate(atNext(p), settings, lib, calibration);
  return {
    chosen,
    package: p,
    capex: spent,
    isolatedSumAbatementKg: sum(chosen.map((c) => c.annualAbatementKg)),
    integratedAbatementKg: operationalKg(base) - operationalKg(integrated),
    method: 'Greedy heuristic: rank by annual abatement per € CAPEX; accept if within CAPEX budget and maximum payback; exclude mutually exclusive options; then recalculate the package as an integrated system. This is a ranked heuristic, not an optimal solution.',
  };
}
