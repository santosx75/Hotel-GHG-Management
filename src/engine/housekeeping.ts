import type { ActivityMetrics, AmenityItem, M12 } from '../types';
import type { Acc } from './context';
import { clamp01, distribute, map12, sum } from './util';

export function amenityUnitsMonthly(a: AmenityItem, act: ActivityMetrics): M12 {
  const base = a.basis === 'guest_night' ? act.guestNights : a.basis === 'stay' ? act.stays : a.basis === 'departure' ? act.stays : act.occupiedRoomNights;
  return base.map((x) => x * a.quantityPerBasis);
}

/**
 * Per-guest-night footprint of single-use vs refillable presentation for one amenity, used for break-even.
 * Single-use: units/guest-night × kg/unit (unused product is discarded).
 * Refillable: consumed product + dispenser embodied spread over its life + refill packaging.
 */
export function amenityBreakEven(single: AmenityItem, refill: AmenityItem, guestNightsPerYear: number) {
  const singleKg = single.quantityPerBasis * single.kgCO2ePerUnit;
  const refillVar = refill.quantityPerBasis * refill.kgCO2ePerUnit;
  const dispenserPerYear = (refill.dispenserCount * refill.dispenserEmbodiedKg) / Math.max(0.5, refill.dispenserLifeYears);
  const refillPerGN = refillVar + (guestNightsPerYear > 0 ? dispenserPerYear / guestNightsPerYear : Infinity);
  const minGNForBreakEven = singleKg > refillVar ? dispenserPerYear / (singleKg - refillVar) : null;
  return { singleKgPerGN: singleKg, refillKgPerGN: refillPerGN, minGuestNightsPerYearForBreakEven: minGNForBreakEven };
}

export function runHousekeeping(acc: Acc, act: ActivityMetrics) {
  const p = acc.p;
  const c = p.cleaning;
  const st = acc.status('cleaning', 'assumed');
  const departureCleans = map12((m) => act.stays[m] + (p.activity.dayUseRoomsPerYear * act.openDays[m]) / Math.max(1, sum(act.openDays)));
  const stayoverCleans = act.stayoverRoomNights.map((s) => s * (1 - clamp01(c.stayoverSkipShare)));
  const cleans = map12((m) => departureCleans[m] + stayoverCleans[m]);
  const totalCleans = sum(cleans);

  acc.addEnergy({ carrier: 'electricity', endUse: 'Housekeeping vacuum & equipment', department: 'Housekeeping & Laundry', monthly: cleans.map((x) => x * c.vacuumKWhPerClean), status: st, module: 'housekeeping' });
  acc.emit({ id: 'hk-chemicals', activityId: 'hk-chemicals', label: 'Cleaning chemicals (concentrate)', module: 'housekeeping', department: 'Housekeeping & Laundry', scope: 'S3', s3cat: 1, views: ['corporate', 'lca', 'visitor'], activityUnit: 'L concentrate', factorId: c.chemicalFactorId, monthlyActivity: cleans.map((x) => (x * c.chemicalMlPerClean) / 1000), status: st, formula: 'cleans × mL concentrate ÷ 1000 × factor', inputs: { cleans: Math.round(totalCleans), mlPerClean: c.chemicalMlPerClean } });
  const linerKg = cleans.map((x) => x * c.linersPerClean * c.linerKg + x * c.wipesPerClean * 0.008 + x * c.glovesPairsPerClean * 0.02);
  acc.emit({ id: 'hk-disposables', activityId: 'hk-disposables', label: 'Liners, wipes & gloves', module: 'housekeeping', department: 'Housekeeping & Laundry', scope: 'S3', s3cat: 1, views: ['corporate', 'lca', 'visitor'], activityUnit: 'kg plastic/nonwoven', factorId: 'ldpe_film', monthlyActivity: linerKg, status: st, formula: 'cleans × (liners × kg + wipes × 0.008 kg + glove pairs × 0.02 kg) × factor', inputs: { liners: c.linersPerClean, wipes: c.wipesPerClean, gloves: c.glovesPairsPerClean } });
  acc.addWaste('Residual (housekeeping disposables)', sum(linerKg));
  acc.cost({ id: 'hk-chem-cost', label: 'Cleaning chemicals', category: 'products', department: 'Housekeeping & Laundry', fixed: 0, variable: (totalCleans * c.chemicalMlPerClean) / 1000 * c.chemicalPricePerL, vatRate: 0.2, monthly: cleans.map((x) => (x * c.chemicalMlPerClean) / 1000 * c.chemicalPricePerL), status: st });
  acc.cost({ id: 'hk-disp-cost', label: 'Liners, wipes & gloves', category: 'products', department: 'Housekeeping & Laundry', fixed: 0, variable: totalCleans * (c.linersPerClean * 0.05 + c.wipesPerClean * 0.04 + c.glovesPairsPerClean * 0.12), vatRate: 0.2, monthly: cleans.map((x) => x * (c.linersPerClean * 0.05 + c.wipesPerClean * 0.04 + c.glovesPairsPerClean * 0.12)), status: 'assumed', notes: 'Unit prices are demonstration values.' });

  const hours = (sum(departureCleans) * c.departureCleanMinutes + sum(stayoverCleans) * c.stayoverCleanMinutes) / 60 + (c.publicAreaCleanM2PerDay / 100) * c.publicAreaMinutesPer100M2 * sum(act.openDays) / 60;
  if (c.includeLabourInCosts) acc.cost({ id: 'hk-labour', label: 'Housekeeping labour', category: 'labour', department: 'Housekeeping & Laundry', fixed: 0, variable: hours * c.labourCostEURPerHour, vatRate: 0, monthly: distribute(hours * c.labourCostEURPerHour, cleans), status: st });
  const maxH = p.constraints.maxHousekeepingHours ?? c.staffHoursCapacityPerYear;
  if (maxH && hours > maxH) acc.warn('warn', 'staff workload', `Housekeeping workload ${Math.round(hours).toLocaleString('en-GB')} h/yr exceeds the capacity/limit of ${Math.round(maxH).toLocaleString('en-GB')} h/yr.`);

  // Amenities
  for (const a of p.amenities) {
    if (!a.enabled) continue;
    const ast = acc.status(`amenities.${a.id}`, 'assumed');
    const units = amenityUnitsMonthly(a, act);
    acc.push({
      id: `amenity-${a.id}`, activityId: `amenity-${a.id}`, label: `Amenity — ${a.name}`, module: 'amenities', department: 'Rooms', scope: 'S3', s3cat: 1, views: ['corporate', 'lca', 'visitor'],
      activity: sum(units), activityUnit: a.refillable ? 'refill units' : 'units supplied', factorValue: a.kgCO2ePerUnit, factorUnit: 'kgCO2e/unit (product input)', factorVersion: 'user',
      kg: sum(units) * a.kgCO2ePerUnit, monthly: units.map((u) => u * a.kgCO2ePerUnit), status: ast, stages: ['manufacture', 'transport'],
      formula: 'units supplied × kgCO2e/unit', inputs: { basis: a.basis, perBasis: a.quantityPerBasis, refillable: a.refillable ? 'yes' : 'no' },
    });
    acc.cost({ id: `amenity-cost-${a.id}`, label: `Amenity — ${a.name}`, category: 'products', department: 'Rooms', fixed: 0, variable: sum(units) * a.unitPriceEUR, vatRate: 0.2, monthly: units.map((u) => u * a.unitPriceEUR), status: ast });
    const discardedProductKg = sum(units) * (a.productMassG / 1000) * (1 - clamp01(a.consumedShare));
    const packKg = sum(units) * (a.packagingMassG / 1000);
    acc.addWaste('Residual (amenity packaging & leftovers)', discardedProductKg + packKg);
    acc.derivedWaste.packagingKg += packKg;
    if (a.refillable && a.dispenserCount > 0) {
      const annualised = (a.dispenserCount * a.dispenserEmbodiedKg) / Math.max(0.5, a.dispenserLifeYears);
      acc.push({ id: `dispenser-${a.id}`, activityId: `dispenser-${a.id}`, label: `Dispensers (annualised) — ${a.name}`, module: 'amenities', department: 'Rooms', scope: 'OUT', views: ['lca'], activity: a.dispenserCount, activityUnit: 'dispensers', kg: annualised, monthly: new Array(12).fill(annualised / 12), status: ast, stages: ['manufacture'], formula: 'dispensers × embodied kg ÷ life (years)', inputs: { dispensers: a.dispenserCount, life: a.dispenserLifeYears }, outsideInventoryReason: 'Annualised life-cycle indicator; inventory recognises dispensers in their acquisition year (capital goods).' });
    }
  }
}
