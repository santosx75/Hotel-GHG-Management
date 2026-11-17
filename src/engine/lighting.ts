import type { ActivityMetrics, LightingZone } from '../types';
import type { Acc } from './context';
import { DAYS_IN_MONTH, clamp01, map12, sum } from './util';

/** Lanczos log-gamma for Weibull moments. */
function gamma(z: number): number {
  const g = 7;
  const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (z < 0.5) return Math.PI / (Math.sin(Math.PI * z) * gamma(1 - z));
  z -= 1;
  let x = c[0];
  for (let i = 1; i < g + 2; i++) x += c[i] / (z + i);
  const t = z + g + 0.5;
  return Math.sqrt(2 * Math.PI) * t ** (z + 0.5) * Math.exp(-t) * x;
}

/** Weibull with median = rated life (B50) and shape k. */
export function weibullScale(ratedLife: number, k: number) {
  return ratedLife / Math.log(2) ** (1 / k);
}
export function weibullCdf(t: number, ratedLife: number, k: number) {
  const lam = weibullScale(ratedLife, k);
  return 1 - Math.exp(-((t / lam) ** k));
}
export function weibullMean(ratedLife: number, k: number) {
  return weibullScale(ratedLife, k) * gamma(1 + 1 / k);
}

/** Annual burn hours per lamp (before controls), and effective electric hours after controls. */
export function zoneBurnHours(z: LightingZone, act: ActivityMetrics) {
  return sum(map12((m) => {
    const days = z.basis === 'open_days' ? act.openDays[m] : DAYS_IN_MONTH[m];
    const occ = z.occupancyLinked ? act.occupancyRate[m] : 1;
    return z.hoursPerDay * days * occ * (1 - clamp01(z.controlSaving));
  }));
}

/**
 * Long-run expected lamp replacements per year (renewal approximation).
 *  - on_failure: lamps × burn hours / mean life (Weibull mean)
 *  - group: every interval I all lamps are replaced; failures before I are spot-replaced
 *    → lamps × (1 + F(I)) × burn / I. A longer interval does not save anything if lamps fail first.
 * A calendar-life limit forces replacement at least every calendarLifeYears.
 */
export function replacementsPerYear(z: LightingZone, burnHoursPerYear: number) {
  const lamps = z.luminaires * z.lampsPerLuminaire;
  if (lamps === 0 || burnHoursPerYear <= 0) return lamps / Math.max(1, z.calendarLifeYears);
  const k = Math.max(0.5, z.weibullShape);
  let perYear: number;
  if (z.policy === 'group') {
    const I = Math.max(100, z.groupIntervalHours);
    perYear = (lamps * (1 + weibullCdf(I, z.ratedLifeHours, k)) * burnHoursPerYear) / I;
  } else {
    perYear = (lamps * burnHoursPerYear) / weibullMean(z.ratedLifeHours, k);
  }
  return Math.max(perYear, lamps / Math.max(1, z.calendarLifeYears));
}

export function zoneElectricityMonthly(z: LightingZone, act: ActivityMetrics) {
  const wPerLum = z.lampsPerLuminaire * z.wattsPerLamp + z.driverWPerLuminaire;
  return map12((m) => {
    const days = z.basis === 'open_days' ? act.openDays[m] : DAYS_IN_MONTH[m];
    const occ = z.occupancyLinked ? act.occupancyRate[m] : 1;
    const onHours = z.hoursPerDay * days * occ * (1 - clamp01(z.controlSaving));
    const standby = z.standbyWPerLuminaire * Math.max(0, 24 * DAYS_IN_MONTH[m] - onHours);
    return (z.luminaires * (wPerLum * onHours + standby)) / 1000;
  });
}

/** Lighting electricity = luminaires × (lamps × W + driver) × hours × days × (1 − controls) / 1000 (+ standby). */
export function runLighting(acc: Acc, act: ActivityMetrics) {
  for (const z of acc.p.lighting) {
    const st = acc.status(`lighting.${z.id}`, 'modelled');
    const elec = zoneElectricityMonthly(z, act);
    const dept = /laundry/i.test(z.name) ? 'Housekeeping & Laundry' : /kitchen|restaurant|bar/i.test(z.name) ? 'Food & Beverage' : /exterior|garden|car park/i.test(z.name) ? 'Grounds' : /room|bathroom|corridor/i.test(z.name) ? 'Rooms' : 'Engineering & Building';
    acc.addEnergy({ carrier: 'electricity', endUse: `Lighting — ${z.name}`, department: dept, monthly: elec, status: st, module: 'lighting' });
    if (z.inConditionedSpace) acc.addGains(map12((m) => (elec[m] * 1000) / (DAYS_IN_MONTH[m] * 24)));
    const burn = zoneBurnHours(z, act);
    const repl = replacementsPerYear(z, burn);
    // Lamp embodied emissions are product-specific and stored on the zone (not a library factor).
    const kg = repl * z.embodiedKgPerLamp;
    acc.push({
      id: `lamps-${z.id}`, activityId: `lamp-purchase-${z.id}`, label: `Replacement lamps — ${z.name}`, module: 'lighting', department: dept, scope: 'S3', s3cat: 1,
      views: ['corporate', 'lca', 'visitor'], activity: repl, activityUnit: 'lamps/yr (long-run expected)', factorValue: z.embodiedKgPerLamp, factorUnit: 'kgCO2e/lamp (product-specific input)',
      kg, monthly: new Array(12).fill(kg / 12), status: acc.status(`lighting.${z.id}.embodiedKgPerLamp`, 'assumed'), stages: ['manufacture', 'transport'],
      formula: z.policy === 'group' ? 'lamps × (1 + F(I)) × burn h / I × kg/lamp' : 'lamps × burn h / Weibull mean life × kg/lamp', inputs: { lamps: z.luminaires * z.lampsPerLuminaire, burnHours: Math.round(burn), ratedLife: z.ratedLifeHours, policy: z.policy },
      notes: ['Long-run expected replacement rate (steady state), not actual calendar-year purchases.'],
    });
    acc.cost({ id: `lamps-cost-${z.id}`, label: `Lamp replacements — ${z.name}`, category: 'maintenance', department: dept, fixed: 0, variable: repl * (z.lampPriceEUR + z.labourPerLampEUR), vatRate: 0.2, monthly: new Array(12).fill((repl * (z.lampPriceEUR + z.labourPerLampEUR)) / 12), status: st });
    acc.derivedWaste.lampsKg += repl * 0.05;
  }
}

export interface LightingStrategyResult {
  strategy: 'keep' | 'replace_now' | 'replace_at_failure';
  label: string;
  annualKWhYear1: number;
  cumulativeCostEUR: number[];
  cumulativeKg: number[];
  upfrontCostEUR: number;
  upfrontKg: number;
}

/**
 * Compare keep / replace immediately / replace at end of life for one zone over a horizon.
 * Costs in EUR (real), emissions using the supplied electricity factor (kg/kWh) and lamp embodied emissions.
 */
export function compareLightingStrategies(
  zone: LightingZone,
  newLamp: { wattsPerLamp: number; ratedLifeHours: number; lampPriceEUR: number; labourPerLampEUR: number; embodiedKgPerLamp: number; lumensPerLamp: number; driverWPerLuminaire: number },
  act: ActivityMetrics,
  elecPricePerKWh: number,
  elecKgPerKWh: number,
  horizonYears: number,
) {
  const lamps = zone.luminaires * zone.lampsPerLuminaire;
  const newZone: LightingZone = { ...zone, ...newLamp, tech: 'led' };
  const kwhOld = sum(zoneElectricityMonthly(zone, act));
  const kwhNew = sum(zoneElectricityMonthly(newZone, act));
  const burn = zoneBurnHours(zone, act);
  const replOld = replacementsPerYear(zone, burn);
  const replNew = replacementsPerYear(newZone, burn);
  const unitOld = zone.lampPriceEUR + zone.labourPerLampEUR;
  const unitNew = newLamp.lampPriceEUR + newLamp.labourPerLampEUR;
  const k = Math.max(0.5, zone.weibullShape);
  const meanOld = weibullMean(zone.ratedLifeHours, k);
  const res: LightingStrategyResult[] = [];
  const run = (strategy: LightingStrategyResult['strategy'], label: string, shareNew: (y: number) => number, upfrontLamps: number) => {
    const cumC: number[] = [];
    const cumK: number[] = [];
    let c = upfrontLamps * unitNew;
    let kg = upfrontLamps * newLamp.embodiedKgPerLamp;
    for (let y = 1; y <= horizonYears; y++) {
      const s = shareNew(y);
      const kwh = kwhOld * (1 - s) + kwhNew * s;
      // replacements: old lamps failing are replaced by new ones in "replace_at_failure"
      const failuresOld = replOld * (1 - s);
      const replacementsNewStock = replNew * s;
      const lampsBought = strategy === 'keep' ? replOld : failuresOld + replacementsNewStock;
      const unit = strategy === 'keep' ? unitOld : unitNew;
      const emb = strategy === 'keep' ? zone.embodiedKgPerLamp : newLamp.embodiedKgPerLamp;
      c += kwh * elecPricePerKWh + lampsBought * unit;
      kg += kwh * elecKgPerKWh + lampsBought * emb;
      cumC.push(c);
      cumK.push(kg);
    }
    res.push({ strategy, label, annualKWhYear1: kwhOld * (1 - shareNew(1)) + kwhNew * shareNew(1), cumulativeCostEUR: cumC, cumulativeKg: cumK, upfrontCostEUR: upfrontLamps * unitNew, upfrontKg: upfrontLamps * newLamp.embodiedKgPerLamp });
  };
  run('keep', 'Keep existing technology', () => 0, 0);
  run('replace_now', 'Replace all lamps now', () => 1, lamps);
  // fraction of original stock replaced after y years of operation, using Weibull CDF of age
  run('replace_at_failure', 'Replace with new technology at failure', (y) => Math.min(1, weibullCdf(burn * (y - 0.5), zone.ratedLifeHours, k)), 0);
  const serviceWarning = newLamp.lumensPerLamp < 0.9 * zone.lumensPerLamp
    ? `New lamp delivers ${newLamp.lumensPerLamp} lm vs ${zone.lumensPerLamp} lm existing (−${Math.round((1 - newLamp.lumensPerLamp / zone.lumensPerLamp) * 100)} %). Lighting service is not equivalent.`
    : null;
  const annualSaving = (kwhOld - kwhNew) * elecPricePerKWh + replOld * unitOld - replNew * unitNew;
  const annualKgSaving = (kwhOld - kwhNew) * elecKgPerKWh + replOld * zone.embodiedKgPerLamp - replNew * newLamp.embodiedKgPerLamp;
  return {
    results: res,
    kwhOld,
    kwhNew,
    annualSavingEUR: annualSaving,
    simplePaybackYears: annualSaving > 0 ? (lamps * unitNew) / annualSaving : null,
    carbonBreakEvenYears: annualKgSaving > 0 ? (lamps * newLamp.embodiedKgPerLamp) / annualKgSaving : null,
    serviceWarning,
    meanLifeOldHours: meanOld,
  };
}
