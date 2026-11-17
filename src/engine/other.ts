import type { ActivityMetrics } from '../types';
import { CPI_FR } from '../data/factors';
import type { Acc } from './context';
import { clamp01, distribute, sum } from './util';

export function gwpOf(acc: Acc, gas: string): number | null {
  const g = acc.opt.library.gwp[gas];
  if (!g) return null;
  return acc.opt.settings.gwpSet === 'AR5' ? g.AR5 : g.AR6;
}

/**
 * Refrigerants: measured top-ups (mass balance) take precedence over default leak rates —
 * never both for the same unit and period. Retirement losses = charge × (1 − recovery).
 */
export function refrigerantReleaseKg(u: { chargeKg: number; annualLeakRate: number; measuredTopUpKg: number | null; retiredThisYear: boolean; recoveryEfficiency: number }) {
  const operating = u.measuredTopUpKg != null ? u.measuredTopUpKg : u.chargeKg * clamp01(u.annualLeakRate);
  const eol = u.retiredThisYear ? u.chargeKg * (1 - clamp01(u.recoveryEfficiency)) : 0;
  return { operating, eol, total: operating + eol, method: u.measuredTopUpKg != null ? 'mass balance (measured top-ups)' : 'default leak rate × charge' };
}

export function runRefrigerants(acc: Acc) {
  const p = acc.p;
  for (const u of p.refrigerants) {
    const gwp = gwpOf(acc, u.refrigerant);
    const r = refrigerantReleaseKg(u);
    const status = u.measuredTopUpKg != null ? acc.status(`refrigerants.${u.id}.measuredTopUpKg`, 'measured') : acc.status(`refrigerants.${u.id}`, 'estimated');
    if (gwp == null) {
      acc.markMissing(`GWP for ${u.refrigerant}`);
      acc.warn('error', 'refrigerants', `No GWP for ${u.refrigerant}: emissions reported as missing.`);
    }
    const kg = gwp == null ? 0 : r.total * gwp;
    acc.push({ id: `refrig-${u.id}`, activityId: `refrigerant-${u.id}`, label: `Refrigerant release — ${u.name} (${u.refrigerant})`, module: 'refrigerants', department: 'Engineering & Building', scope: 'S1', views: ['corporate', 'hcmi', 'lca', 'visitor'], activity: r.total, activityUnit: 'kg refrigerant released', factorValue: gwp ?? undefined, factorUnit: `GWP-100 (${acc.opt.settings.gwpSet})`, factorId: `gwp:${u.refrigerant}`, kg, monthly: new Array(12).fill(kg / 12), status: gwp == null ? 'missing' : status, stages: ['use', 'end_of_life'], formula: `released kg × GWP; method: ${r.method}`, inputs: { chargeKg: u.chargeKg, leakRate: u.annualLeakRate, topUpKg: u.measuredTopUpKg ?? 'n/a', eolKg: +r.eol.toFixed(2) } });
    acc.cost({ id: `refrig-cost-${u.id}`, label: `Refrigeration service — ${u.name}`, category: 'maintenance', department: 'Engineering & Building', fixed: u.serviceCostEURPerYear, variable: 0, vatRate: 0.2, monthly: new Array(12).fill(u.serviceCostEURPerYear / 12), status: 'assumed' });
  }
  if (p.fireSuppressionReleaseKg > 0) {
    const gwp = gwpOf(acc, p.fireSuppressionAgent);
    const kg = (gwp ?? 0) * p.fireSuppressionReleaseKg;
    acc.push({ id: 'fire-suppression', activityId: 'fire-suppression', label: `Fire-suppression gas release (${p.fireSuppressionAgent})`, module: 'refrigerants', department: 'Engineering & Building', scope: 'S1', views: ['corporate', 'hcmi', 'lca', 'visitor'], activity: p.fireSuppressionReleaseKg, activityUnit: 'kg released', factorValue: gwp ?? undefined, factorUnit: 'GWP-100', kg, monthly: new Array(12).fill(kg / 12), status: gwp == null ? 'missing' : acc.status('fireSuppressionReleaseKg', 'measured'), stages: ['use'], formula: 'kg released × GWP', inputs: { kg: p.fireSuppressionReleaseKg } });
  }
}

/** Waste: treatment emissions only (cut-off; no avoided-emission credits). */
export function runWaste(acc: Acc, act: ActivityMetrics) {
  const p = acc.p;
  const gn = sum(act.guestNights);
  for (const w of p.waste) {
    let kg: number | null;
    let status = acc.status(`waste.${w.id}`, w.measurement === 'weighed' ? 'measured' : w.measurement === 'volume_estimate' ? 'estimated' : w.measurement === 'benchmark' ? 'estimated' : 'missing');
    if (w.linkedToFoodModule) {
      kg = acc.derivedWaste.foodWasteKg;
      status = 'modelled';
    } else if (w.kgPerYear != null) kg = w.kgPerYear;
    else if (w.kgPerGuestNight != null) kg = w.kgPerGuestNight * gn;
    else kg = null;
    if (kg == null || w.measurement === 'missing') {
      acc.markMissing(`waste.${w.id} (${w.name})`);
      acc.push({ id: `waste-${w.id}`, activityId: `waste-${w.id}`, label: `Waste — ${w.name}`, module: 'waste', department: 'Engineering & Building', scope: 'S3', s3cat: 5, views: ['corporate', 'lca', 'visitor'], activity: 0, activityUnit: 'kg', kg: 0, monthly: new Array(12).fill(0), status: 'missing', stages: ['treatment'], formula: 'mass × treatment factor (mass missing)', inputs: {} });
      continue;
    }
    const monthly = w.linkedToFoodModule ? acc.derivedWaste.foodWasteMonthly : distribute(kg, act.guestNights.map((g, m) => g + act.openDays[m]));
    acc.addWaste(w.name, kg);
    acc.emit({ id: `waste-${w.id}`, activityId: `waste-${w.id}`, label: `Waste — ${w.name} (${w.treatment.replace(/_/g, ' ')})`, module: 'waste', department: w.linkedToFoodModule ? 'Food & Beverage' : 'Engineering & Building', scope: 'S3', s3cat: 5, views: ['corporate', 'lca', 'visitor'], activityUnit: 'kg', factorId: w.factorId, monthlyActivity: monthly, status, formula: w.linkedToFoodModule ? 'food waste from F&B mass balance × treatment factor (production already in purchases)' : 'kg × treatment factor', inputs: { kg: Math.round(kg), measurement: w.measurement } });
    const fees = (kg / 1000) * w.feePerTonneEUR + w.liftsPerYear * w.feePerLiftEUR;
    acc.cost({ id: `waste-cost-${w.id}`, label: `Waste — ${w.name}`, category: 'waste', department: 'Engineering & Building', fixed: w.liftsPerYear * w.feePerLiftEUR, variable: (kg / 1000) * w.feePerTonneEUR, vatRate: 0.1, monthly: distribute(fees, act.openDays), status: 'assumed' });
  }
  // derived streams not in the waste register are counted for mass reporting only (treatment via residual factor)
  const derived = (acc.wasteKg['Residual (housekeeping disposables)'] ?? 0) + (acc.wasteKg['Residual (amenity packaging & leftovers)'] ?? 0);
  if (derived > 0 && !p.waste.some((w) => /residual/i.test(w.name) && w.measurement === 'weighed')) {
    acc.emit({ id: 'waste-derived-residual', activityId: 'waste-derived-residual', label: 'Waste — modelled disposables & amenity packaging (residual)', module: 'waste', department: 'Rooms', scope: 'S3', s3cat: 5, views: ['corporate', 'lca', 'visitor'], activityUnit: 'kg', factorId: 'waste_residual_incineration', monthlyActivity: distribute(derived, act.guestNights), status: 'modelled', formula: 'modelled kg × residual treatment factor (only when residual waste is not weighed — avoids double counting)', inputs: { kg: Math.round(derived) } });
  } else if (derived > 0) {
    acc.suppressed.push({ activityId: 'waste-derived-residual', label: 'Modelled disposables & amenity packaging', reason: 'Residual waste is weighed; modelled packaging is assumed to be inside the weighed residual stream.', kgAvoidedDoubleCount: derived * 0.36 });
  }
  const textiles = (acc.wasteKg['Textiles (residual)'] ?? 0) + (acc.wasteKg['Textiles (recycling)'] ?? 0);
  if (textiles > 0) acc.emit({ id: 'waste-textiles', activityId: 'waste-textiles', label: 'Waste — discarded textiles', module: 'waste', department: 'Housekeeping & Laundry', scope: 'S3', s3cat: 5, views: ['corporate', 'lca', 'visitor'], activityUnit: 'kg', factorId: (acc.wasteKg['Textiles (residual)'] ?? 0) >= (acc.wasteKg['Textiles (recycling)'] ?? 0) ? 'waste_residual_incineration' : 'waste_recycling_collection', monthlyActivity: new Array(12).fill(textiles / 12), status: 'modelled', formula: 'discarded textile kg × treatment factor', inputs: { kg: Math.round(textiles) } });
}

/**
 * Capital goods: corporate inventory recognises cradle-to-gate emissions in the ACQUISITION YEAR (cat. 2).
 * A separately labelled annualised indicator (embodied ÷ useful life) is shown only in the LCA view.
 * Changing useful life never alters historical embodied emissions of assets already owned.
 */
export function runAssets(acc: Acc) {
  const p = acc.p;
  const year = p.boundary.reportingYear;
  const items = [
    ...p.assets.map((a) => ({ ...a, fromCapex: false })),
    ...p.capex.filter((c) => c.embodiedKg > 0).map((c) => ({ id: c.id, name: c.label, category: c.category, quantity: 1, unitEmbodiedKg: c.embodiedKg, unitCostEUR: c.amountEUR, acquisitionYear: c.year, usefulLifeYears: c.lifeYears, embodiedSource: 'scenario intervention', fromCapex: true })),
  ];
  for (const a of items) {
    if (a.unitEmbodiedKg == null) {
      acc.markMissing(`assets.${a.id}.unitEmbodiedKg (${a.name})`);
      continue;
    }
    const total = a.quantity * a.unitEmbodiedKg;
    if (a.acquisitionYear === year) {
      acc.push({ id: `capital-${a.id}`, activityId: `capital-${a.id}-${a.acquisitionYear}`, label: `Capital goods acquired — ${a.name}`, module: 'assets', department: 'Engineering & Building', scope: 'S3', s3cat: 2, views: ['corporate'], activity: a.quantity, activityUnit: 'units acquired', factorValue: a.unitEmbodiedKg, factorUnit: 'kgCO2e/unit (input)', kg: total, monthly: new Array(12).fill(total / 12), status: a.fromCapex ? 'estimated' : acc.status(`assets.${a.id}`, 'assumed'), stages: ['manufacture', 'transport'], formula: 'quantity acquired in reporting year × embodied kg/unit', inputs: { year: a.acquisitionYear, source: a.embodiedSource } });
    }
    const annual = total / Math.max(1, a.usefulLifeYears);
    const inService = a.acquisitionYear <= year && year < a.acquisitionYear + a.usefulLifeYears;
    if (inService) acc.push({ id: `capital-ann-${a.id}`, activityId: `annualised-${a.id}`, label: `Embodied (annualised) — ${a.name}`, module: 'assets', department: 'Engineering & Building', scope: 'OUT', views: ['lca'], activity: a.quantity, activityUnit: 'units in service', kg: annual, monthly: new Array(12).fill(annual / 12), status: 'estimated', stages: ['manufacture'], formula: 'embodied kg ÷ useful life', inputs: { life: a.usefulLifeYears }, outsideInventoryReason: 'Annualised life-cycle decision indicator — never mixed into the corporate inventory.' });
  }
}

/** Spend-based fallback with currency/price-year normalisation: spend × CPI(factor year)/CPI(spend year). */
export function deflateSpend(spendEUR: number, spendYear: number, factorPriceYear: number) {
  const a = CPI_FR[spendYear];
  const b = CPI_FR[factorPriceYear];
  if (!a || !b) return null;
  return spendEUR * (b / a);
}

export function runServices(acc: Acc) {
  for (const s of acc.p.services) {
    if (s.physicallyModelledElsewhere) {
      acc.suppressed.push({ activityId: `service-${s.id}`, label: s.name, reason: 'Already modelled with physical data elsewhere — spend-based estimate not added.', kgAvoidedDoubleCount: 0 });
      continue;
    }
    const f = acc.factor(s.factorId);
    const priceYear = Number(f?.observationYear ?? NaN);
    const deflated = Number.isFinite(priceYear) ? deflateSpend(s.spendEUR, s.spendYear, priceYear) : null;
    if (deflated == null) {
      acc.markMissing(`services.${s.id}: price-year normalisation`);
      acc.warn('warn', 'services', `${s.name}: cannot normalise spend to the factor price year — reported as missing.`);
      continue;
    }
    acc.emit({ id: `service-${s.id}`, activityId: `service-${s.id}`, label: `Purchased service (spend-based) — ${s.name}`, module: 'services', department: 'Staff & Administration', scope: 'S3', s3cat: s.factorId === 'spend_franchise_fees' ? 1 : 1, views: ['corporate', 'lca'], activityUnit: `EUR ${priceYear} prices`, factorId: s.factorId, monthlyActivity: new Array(12).fill(deflated / 12), status: 'estimated', formula: 'spend × CPI(factor year)/CPI(spend year) × kgCO2e/EUR (disclosed fallback)', inputs: { spend: s.spendEUR, spendYear: s.spendYear, factorYear: priceYear, deflated: Math.round(deflated) } });
    acc.cost({ id: `service-cost-${s.id}`, label: s.name, category: 'services', department: 'Staff & Administration', fixed: s.spendEUR, variable: 0, vatRate: 0.2, monthly: new Array(12).fill(s.spendEUR / 12), status: 'assumed' });
  }
}

export function runMisc(acc: Acc, act: ActivityMetrics) {
  const p = acc.p;
  const g = p.generator;
  if (g.enabled) {
    const litres = (g.testHoursPerYear + g.outageHoursPerYear) * g.kW * clamp01(g.loadShare) * g.litresPerKWh;
    acc.addEnergy({ carrier: 'diesel', endUse: 'Backup generator', department: 'Engineering & Building', monthly: new Array(12).fill(litres / 12), status: acc.status('generator', 'assumed'), module: 'generator', scope1Override: 'stationary' });
  }
  if (p.maintenanceFuel.dieselL > 0) acc.addEnergy({ carrier: 'diesel', endUse: 'Maintenance equipment (diesel)', department: 'Grounds', monthly: distribute(p.maintenanceFuel.dieselL, act.openDays), status: acc.status('maintenanceFuel', 'assumed'), module: 'maintenance', scope1Override: 'stationary' });
  if (p.maintenanceFuel.petrolL > 0) acc.addEnergy({ carrier: 'petrol', endUse: 'Maintenance equipment (petrol: mowers, blowers)', department: 'Grounds', monthly: distribute(p.maintenanceFuel.petrolL, act.openDays), status: acc.status('maintenanceFuel', 'assumed'), module: 'maintenance', scope1Override: 'stationary' });
  // On-site private wastewater treatment (septic): direct CH4, Scope 1 — only when enabled
  if (p.water.wastewaterBasis === 'private_treatment') {
    const ch4Gwp = gwpOf(acc, 'CH4 (biogenic)') ?? 27;
    const bodKg = act.guestNights.map((gn) => (gn * p.water.septicBODgPerGuestNight) / 1000);
    const ch4 = bodKg.map((b) => b * 0.6 * 0.5);
    acc.push({ id: 'septic-ch4', activityId: 'septic-ch4', label: 'On-site wastewater treatment (septic) — CH4', module: 'water', department: 'Engineering & Building', scope: 'S1', views: ['corporate', 'lca', 'visitor'], activity: sum(bodKg), activityUnit: 'kg BOD', factorValue: 0.3 * ch4Gwp, factorUnit: 'kgCO2e/kg BOD (Bo 0.6 × MCF 0.5 × GWP CH4)', kg: sum(ch4) * ch4Gwp, monthly: ch4.map((x) => x * ch4Gwp), status: 'estimated', stages: ['treatment'], formula: 'guest-nights × g BOD ÷ 1000 × Bo × MCF × GWP(CH4)', inputs: { bodGPerGuestNight: p.water.septicBODgPerGuestNight }, notes: ['IPCC default parameters (recalled, unverified). Business share only (guest-nights).'] });
    acc.cost({ id: 'septic-cost', label: 'Private wastewater treatment (servicing, emptying)', category: 'water', department: 'Engineering & Building', fixed: p.water.privateTreatmentCostPerYear, variable: 0, vatRate: 0.1, monthly: new Array(12).fill(p.water.privateTreatmentCostPerYear / 12), status: 'assumed' });
  }
}

/** Guest EV charging on site: electricity is in the site meter (Scope 2). In the visitor view the guest's EV travel
 * factor already contains driving electricity, so the charging line is excluded from that view to avoid overlap. */
export function runGuestEvCharging(acc: Acc, act: ActivityMetrics) {
  const g = acc.p.guestEvCharging;
  if (!g.enabled) return;
  const kwh = act.stays.map((s) => s * clamp01(g.shareOfStays) * g.kWhPerCharge);
  acc.addEnergy({ carrier: 'electricity', endUse: 'Guest EV charging', department: 'Rooms', monthly: kwh, status: acc.status('guestEvCharging', 'assumed'), module: 'ev' });
  if (g.rechargedPricePerKWh > 0) acc.cost({ id: 'ev-recharge-revenue', label: 'Guest EV charging re-invoiced', category: 'revenue_offset', department: 'Rooms', fixed: 0, variable: -sum(kwh) * g.rechargedPricePerKWh, vatRate: 0.2, monthly: kwh.map((x) => -x * g.rechargedPricePerKWh), status: 'assumed' });
}
