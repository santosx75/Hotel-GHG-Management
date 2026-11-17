import type { CalculationResult, CalibrationRef, GlobalSettings, Library, PropertyInputs } from '../types';
import { computeTotals } from './accounting';
import { computeActivity } from './activity';
import { runBuilding } from './building';
import { Acc } from './context';
import { runFood } from './food';
import { runHousekeeping } from './housekeeping';
import { runLaundry } from './laundry';
import { runLighting } from './lighting';
import { runBusinessTravel, runCommuting, runFleet, runGuestTravel, runLogistics } from './mobility';
import { runAssets, runGuestEvCharging, runMisc, runRefrigerants, runServices, runWaste } from './other';
import { runSupply, runWaterAccounting } from './supply';
import { sum } from './util';
import { runDhw, runWater } from './water';

export const MODEL_VERSION = '0.1.0';

/**
 * Pure, deterministic calculation of one property. No I/O, no UI, no network.
 * Order matters for interactions: lighting gains → building; all hot-water demands → DHW; F&B → food waste.
 */
export function calculate(p: PropertyInputs, settings: GlobalSettings, library: Library, calibration?: CalibrationRef): CalculationResult {
  const climate = library.climates[p.profile.climateProfileId];
  if (!climate) throw new Error(`Unknown climate profile ${p.profile.climateProfileId}`);
  const acc = new Acc(p, { settings, library, calibration });
  const act = computeActivity(p);
  const year = p.boundary.reportingYear;

  runLighting(acc, act);
  runBuilding(acc, act, climate);
  runWater(acc, act, climate);
  const laundry = runLaundry(acc, act);
  runHousekeeping(acc, act);
  runFood(acc, act);
  runFleet(acc, act, year);
  runCommuting(acc);
  runBusinessTravel(acc);
  runGuestTravel(acc, act);
  runLogistics(acc, act);
  runMisc(acc, act);
  runGuestEvCharging(acc, act);
  runDhw(acc, act, climate);
  runRefrigerants(acc);
  runWaste(acc, act);
  runAssets(acc);
  runServices(acc);
  const supply = runSupply(acc, act);
  const water = runWaterAccounting(acc, act);

  if (p.profile.geoContext !== 'mainland' && climate.geography === 'FR-mainland') acc.warn('warn', 'geography', 'Climate profile is a mainland profile but the geographic context is not mainland — revalidate climate data.');
  for (const [k, v] of Object.entries(p.activity)) {
    if (typeof v === 'number' && /Uptake|Rate|Share/.test(k) && (v < 0 || v > 1)) acc.warn('error', 'validation', `${k} = ${v} is outside the valid 0–1 range.`);
  }
  for (const rt of p.activity.roomTypes) if (rt.guestsPerOccupiedRoom > rt.maxGuests) acc.warn('error', 'validation', `${rt.name}: ${rt.guestsPerOccupiedRoom} guests per occupied room exceeds the maximum occupancy of ${rt.maxGuests}.`);
  if (p.activity.staffFTE > p.activity.staffHeadcount && p.activity.staffHeadcount > 0) acc.warn('warn', 'validation', `Staff FTE (${p.activity.staffFTE}) exceeds headcount (${p.activity.staffHeadcount}).`);
  const areaSum = act.guestroomAreaM2 + p.activity.publicAreaM2 + p.activity.backOfHouseM2 + p.activity.meetingAreaM2;
  if (areaSum > 1.1 * p.building.conditionedAreaM2) acc.warn('warn', 'validation', `Guestroom + public + back-of-house + meeting areas (${Math.round(areaSum)} m²) exceed the conditioned floor area (${Math.round(p.building.conditionedAreaM2)} m²) by more than 10 %.`);
  p.activity.monthlyOccupancy.forEach((o, m) => { if (o < 0 || o > 1) acc.warn('error', 'validation', `Monthly occupancy for month ${m + 1} (${o}) is outside 0–100 %.`); });

  const totals = computeTotals(p, act, acc.lines, acc.costs, supply.energy, water.mainsM3, acc.wasteKg);
  return {
    propertyId: p.id,
    modelVersion: MODEL_VERSION,
    activity: act,
    lines: acc.lines,
    costs: acc.costs,
    energy: supply.energy,
    modelledEnergyBeforeCalibration: supply.modelledBefore,
    calibration: supply.calibration,
    water,
    wasteKg: acc.wasteKg,
    laundry: laundry.result,
    solar: supply.solar,
    warnings: acc.warnings,
    suppressed: acc.suppressed,
    missing: acc.missing,
    totals,
    capexTotal: sum(p.capex.map((c) => c.amountEUR)),
  };
}

/** Calibration factors from a baseline result, applied unchanged to scenarios (projection from calibrated baseline). */
export function calibrationFrom(result: CalculationResult): CalibrationRef {
  const factors: Record<string, number[] | null> = {};
  for (const [c, v] of Object.entries(result.calibration)) factors[c] = v.factors;
  return { factors };
}
