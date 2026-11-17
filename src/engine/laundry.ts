import type { ActivityMetrics, M12, TextileItem } from '../types';
import type { Acc } from './context';
import { DAYS_IN_MONTH, clamp01, distribute, map12, rectMassKg, sum, zeros } from './util';

export interface TextileMass {
  kg: number | null;
  method: 'measured' | 'rectangle' | 'garment' | 'missing';
}

/** Measured mass preferred; rectangle approximation for flat textiles; garment model must be supplied. */
export function textileMass(t: TextileItem): TextileMass {
  if (t.massModel === 'measured' && t.measuredMassKg != null) return { kg: t.measuredMassKg, method: 'measured' };
  if (t.massModel === 'garment') return t.garmentMassKg != null ? { kg: t.garmentMassKg, method: 'garment' } : { kg: null, method: 'missing' };
  if (t.gsm != null && t.lengthCm > 0 && t.widthCm > 0) return { kg: rectMassKg(t.lengthCm, t.widthCm, t.gsm), method: 'rectangle' };
  if (t.measuredMassKg != null) return { kg: t.measuredMassKg, method: 'measured' };
  return { kg: null, method: 'missing' };
}

export interface TextileFlow {
  item: TextileItem;
  massKg: number;
  massMethod: TextileMass['method'];
  placedStock: number; // pieces in circulation (placed)
  parStock: number;
  changedMonthly: M12; // pieces collected
  washedMonthly: M12; // pieces washed (incl. rewash)
  washedKgMonthly: M12;
  purchasesPerYear: number;
  discardedPerYear: number;
  lostPerYear: number;
}

/**
 * Textile flows. Room-based items are changed on departures and every N stayover nights
 * (expected (LOS−1)/N changes per stay, i.e. stayover room-nights / N), reduced by realised reuse.
 * Distinguishes placed, collected (changed), washed (incl. rewash), discarded, lost and purchased pieces.
 */
export function textileFlows(t: TextileItem, p: Acc['p'], act: ActivityMetrics): TextileFlow | null {
  const m = textileMass(t);
  if (m.kg == null) return null;
  const rooms = act.rooms;
  const occRN = sum(act.occupiedRoomNights);
  const guestsPerRoom = occRN > 0 ? sum(act.guestNights) / occRN : 0;
  const bedsPerRoom = rooms > 0 ? act.beds / rooms : 0;
  let perRoom = 0;
  let usageMonthly: M12 = zeros();
  if (t.basis === 'per_room' || t.basis === 'per_bed' || t.basis === 'per_guest') {
    perRoom = t.placedPer * (t.basis === 'per_room' ? 1 : t.basis === 'per_bed' ? bedsPerRoom : guestsPerRoom);
    const interval = t.stayoverIntervalNights;
    usageMonthly = map12((mo) => {
      const dep = t.changeOnDeparture ? act.stays[mo] : 0;
      const stayover = interval > 0 ? (act.stayoverRoomNights[mo] / interval) * (1 - clamp01(t.reuseParticipation)) : 0;
      const req = act.stays[mo] * t.requestChangesPerStay;
      return perRoom * (dep + stayover) + req * perRoom;
    });
  } else {
    const spaVisits = distribute(p.spa.treatmentsPerYear + p.activity.spaDayVisitorsPerYear, act.openDays);
    const poolDay = distribute(p.activity.poolDayVisitorsPerYear, act.openDays);
    const fteDays = distribute(p.activity.staffFTE * p.activity.workingDaysPerFTE, act.openDays);
    usageMonthly = map12((mo) => {
      switch (t.basis) {
        case 'per_pool_visit': return t.usageRatePerBasis * (act.guestNights[mo] + poolDay[mo]);
        case 'per_cover': return t.usageRatePerBasis * (act.covers.mainMeals[mo] + act.covers.banquet[mo] + act.covers.breakfast[mo]);
        case 'per_fte_day': return t.usageRatePerBasis * fteDays[mo];
        case 'per_treatment': return t.usageRatePerBasis * spaVisits[mo];
        default: return 0;
      }
    });
  }
  const changed = usageMonthly;
  const washed = changed.map((x) => x * (1 + Math.max(0, t.rewashRate)));
  const washedKg = washed.map((x) => x * (m.kg as number));
  const totalOpen = sum(act.openDays);
  const placedStock = perRoom > 0 ? perRoom * rooms : totalOpen > 0 ? sum(usageMonthly) / totalOpen : 0;
  const parStock = placedStock * Math.max(1, t.parLevel);
  const washesPerYear = sum(washed);
  const wear = washesPerYear / Math.max(1, t.lifeWashCycles);
  const rejected = washesPerYear * clamp01(t.rejectionRate);
  const lost = parStock * clamp01(t.lossRatePerYear);
  const calendarMin = parStock / Math.max(0.5, t.calendarLifeYears);
  const discarded = Math.max(wear + rejected, calendarMin);
  return {
    item: t, massKg: m.kg, massMethod: m.method, placedStock, parStock, changedMonthly: changed, washedMonthly: washed, washedKgMonthly: washedKg,
    purchasesPerYear: discarded + lost, discardedPerYear: discarded, lostPerYear: lost,
  };
}

export function runLaundry(acc: Acc, act: ActivityMetrics) {
  const p = acc.p;
  const flows: TextileFlow[] = [];
  const result = {
    kgWashedInHouse: 0, kgWashedOutsourced: 0, loads: 0,
    piecesWashed: {} as Record<string, number>, kgByItem: {} as Record<string, number>, purchasesPerYear: {} as Record<string, number>, massPerItemKg: {} as Record<string, number>,
  };
  const c = p.constraints;
  for (const t of p.textiles) {
    const f = textileFlows(t, p, act);
    if (!f) {
      acc.markMissing(`textiles.${t.id}: mass (no measured mass, GSM or garment model)`);
      acc.warn('warn', 'laundry', `${t.name}: mass cannot be determined — laundry and procurement for this item are reported as missing, not zero.`);
      continue;
    }
    flows.push(f);
    result.piecesWashed[t.name] = sum(f.washedMonthly);
    result.kgByItem[t.name] = sum(f.washedKgMonthly);
    result.purchasesPerYear[t.name] = f.purchasesPerYear;
    result.massPerItemKg[t.name] = f.massKg;
    const st = acc.status(`textiles.${t.id}`, 'assumed');
    // procurement (cat. 1) — proportional-to-mass approximation unless product-specific factor
    const fac = acc.factor(t.factorId);
    const kgPurchased = f.purchasesPerYear * f.massKg;
    acc.emit({
      id: `textile-purchase-${t.id}`, activityId: `textile-purchase-${t.id}`, label: `Textile replacement — ${t.name}`, module: 'laundry', department: t.basis === 'per_cover' ? 'Food & Beverage' : t.basis === 'per_pool_visit' || t.basis === 'per_treatment' ? 'Spa, Pool & Leisure' : t.basis === 'per_fte_day' ? 'Staff & Administration' : 'Housekeeping & Laundry',
      scope: 'S3', s3cat: 1, views: ['corporate', 'lca', 'visitor'], activityUnit: 'kg textile', factorId: t.factorId, monthlyActivity: new Array(12).fill(kgPurchased / 12), status: st,
      formula: 'pieces purchased × mass per piece × kgCO2e/kg (mass-proportional approximation)',
      inputs: { piecesPerYear: Math.round(f.purchasesPerYear), massKg: +f.massKg.toFixed(3), massMethod: f.massMethod, lifeWashCycles: t.lifeWashCycles, lossRate: t.lossRatePerYear },
      notes: fac?.verification === 'demonstration' ? ['Textile factor is a demonstration value scaled by mass; real footprints do not scale perfectly with weight.'] : undefined,
    });
    acc.cost({ id: `textile-cost-${t.id}`, label: `Textile replacement — ${t.name}`, category: 'products', department: 'Housekeeping & Laundry', fixed: 0, variable: f.purchasesPerYear * t.unitCostEUR, vatRate: 0.2, monthly: new Array(12).fill((f.purchasesPerYear * t.unitCostEUR) / 12), status: st });
    const discardKg = f.discardedPerYear * f.massKg;
    acc.derivedWaste.textileDiscardKg += discardKg;
    acc.addWaste(t.endOfLife === 'residual' ? 'Textiles (residual)' : t.endOfLife === 'textile_recycling' ? 'Textiles (recycling)' : 'Textiles (reused as rags)', t.endOfLife === 'reuse_rags' ? 0 : discardKg);
    if (t.existingStock != null && t.existingStock < f.parStock) acc.warn('info', 'laundry', `${t.name}: existing stock (${Math.round(t.existingStock)}) is below the par requirement (${Math.round(f.parStock)}). A one-off top-up purchase is needed; it is not repeated every year.`);
    {
      // Service constraints: item-level minimums, or the property's bath-towel minimums for the bath towel item
      const isBathTowel = t.id === 'bath-towel' || /^bath towel/i.test(t.name);
      const minL = t.minLengthCm ?? (isBathTowel ? c.minTowelLengthCm : null);
      const minG = t.minGsm ?? (isBathTowel ? c.minTowelGsm : null);
      if (minL != null && t.lengthCm < minL) acc.warn('warn', 'service standard', `${t.name}: length ${t.lengthCm} cm is below the minimum service standard of ${minL} cm.`);
      if (minG != null && t.gsm != null && t.gsm < minG) acc.warn('warn', 'service standard', `${t.name}: ${t.gsm} g/m² is below the minimum of ${minG} g/m².`);
    }
  }

  // Split streams
  const inKg = zeros();
  const outKg = zeros();
  const dryKg = zeros();
  const ironKg = zeros();
  for (const f of flows) {
    const target = f.item.stream === 'in_house' ? inKg : outKg;
    for (let m = 0; m < 12; m++) {
      target[m] += f.washedKgMonthly[m];
      if (f.item.stream === 'in_house') {
        if (f.item.tumbleDried) dryKg[m] += f.washedKgMonthly[m];
        if (f.item.ironed) ironKg[m] += f.washedKgMonthly[m];
      }
    }
  }

  // In-house laundry
  const L = p.inHouseLaundry;
  if (sum(inKg) > 0) {
    const st = acc.status('inHouseLaundry', 'modelled');
    const loads = inKg.map((k) => k / Math.max(1, L.machineCapacityKg * clamp01(L.loadFactor || 1)));
    result.loads = sum(loads);
    acc.addEnergy({ carrier: 'electricity', endUse: 'Laundry washers (motors & controls)', department: 'Housekeeping & Laundry', monthly: map12((m) => loads[m] * L.electricityKWhPerCycle + L.standbyKWhPerDay * act.openDays[m]), status: st, module: 'laundry' });
    // wash heat per cycle is specified at a 60 °C programme and scales with the temperature rise above a 12 °C inlet
    const tempScale = Math.max(0, L.washTempC - 12) / (60 - 12);
    const heat = loads.map((l) => l * L.thermalKWhPerCycle * tempScale * (1 - clamp01(L.heatRecoveryShare)));
    if (L.thermalCarrier === 'dhw') acc.dhwDemands.push({ endUse: 'Laundry wash water heating', department: 'Housekeeping & Laundry', monthly: heat });
    else acc.addEnergy({ carrier: L.thermalCarrier, endUse: 'Laundry wash water heating', department: 'Housekeeping & Laundry', monthly: heat, status: st, module: 'laundry' });
    const dryer = dryKg.map((k) => k * L.residualMoisture * L.dryerKWhPerKgWater);
    acc.addEnergy({ carrier: L.dryerTech === 'gas' ? 'natural_gas' : 'electricity', endUse: 'Tumble dryers', department: 'Housekeeping & Laundry', monthly: dryer, status: st, module: 'laundry' });
    acc.addEnergy({ carrier: L.ironerCarrier, endUse: 'Ironer / calender', department: 'Housekeeping & Laundry', monthly: ironKg.map((k) => k * L.ironerKWhPerKg), status: st, module: 'laundry' });
    acc.addWater({ endUse: 'In-house laundry', department: 'Housekeeping & Laundry', monthly: loads.map((l) => (l * L.waterLPerCycle) / 1000), discharged: true, status: st });
    acc.emit({ id: 'laundry-detergent', activityId: 'laundry-detergent', label: 'Laundry detergent & chemicals', module: 'laundry', department: 'Housekeeping & Laundry', scope: 'S3', s3cat: 1, views: ['corporate', 'lca', 'visitor'], activityUnit: 'kg', factorId: L.detergentFactorId, monthlyActivity: inKg.map((k) => (k * L.detergentGPerKg) / 1000), status: acc.status('inHouseLaundry.detergentGPerKg', 'assumed'), formula: 'kg washed × g detergent/kg ÷ 1000 × factor', inputs: { gPerKg: L.detergentGPerKg } });
    acc.cost({ id: 'laundry-maintenance', label: 'In-house laundry maintenance', category: 'maintenance', department: 'Housekeeping & Laundry', fixed: L.maintenanceEURPerYear, variable: 0, vatRate: 0.2, monthly: new Array(12).fill(L.maintenanceEURPerYear / 12), status: acc.status('inHouseLaundry.maintenanceEURPerYear', 'assumed') });
    acc.cost({ id: 'laundry-detergent-cost', label: 'Laundry detergent', category: 'products', department: 'Housekeeping & Laundry', fixed: 0, variable: (sum(inKg) * L.detergentGPerKg) / 1000 * 3.5, vatRate: 0.2, monthly: inKg.map((k) => (k * L.detergentGPerKg) / 1000 * 3.5), status: 'assumed', notes: 'Detergent at a demonstration 3.5 €/kg.' });
    if (L.washTempC < 60) acc.warn('info', 'laundry hygiene', `Laundry wash temperature ${L.washTempC} °C: lower-temperature programmes require validated disinfection chemistry/process (hygiene responsibility of the operator).`);
    if (p.cleaning.includeLabourInCosts) {
      const hours = (sum(inKg) * L.labourMinutesPerKg) / 60;
      acc.cost({ id: 'laundry-labour', label: 'In-house laundry labour', category: 'labour', department: 'Housekeeping & Laundry', fixed: 0, variable: hours * p.cleaning.labourCostEURPerHour, vatRate: 0, monthly: inKg.map((k) => ((k * L.labourMinutesPerKg) / 60) * p.cleaning.labourCostEURPerHour), status: 'assumed' });
    }
  }
  result.kgWashedInHouse = sum(inKg);

  // Outsourced laundry
  const O = p.outsourcedLaundry;
  let outMonthly = outKg;
  let outStatus = acc.status('outsourcedLaundry', 'modelled');
  if (p.measured.useMeasured && p.measured.laundryKgOutsourced.some((x) => x != null) && sum(outKg) > 0) {
    outMonthly = p.measured.laundryKgOutsourced.map((x, m) => (x == null ? outKg[m] : x));
    outStatus = p.measured.laundryKgOutsourced.every((x) => x != null) ? 'measured' : 'disaggregated';
  }
  result.kgWashedOutsourced = sum(outMonthly);
  if (result.kgWashedOutsourced > 0) {
    if (O.factorKgPerKg == null) {
      acc.markMissing('outsourcedLaundry.factorKgPerKg');
      acc.warn('warn', 'laundry', 'Outsourced laundry: supplier emission factor missing — emissions are reported as MISSING (not zero). Outsourcing does not remove these emissions from the footprint.');
      acc.push({ id: 'laundry-outsourced', activityId: 'laundry-outsourced-service', label: `Outsourced laundry service — ${O.supplier}`, module: 'laundry', department: 'Housekeeping & Laundry', scope: 'S3', s3cat: 1, views: ['corporate', 'hcmi', 'lca', 'visitor'], activity: result.kgWashedOutsourced, activityUnit: 'kg washed', kg: 0, monthly: zeros(), status: 'missing', stages: [], formula: 'kg washed × supplier factor (missing)', inputs: { kg: Math.round(result.kgWashedOutsourced) } });
    } else {
      acc.push({
        id: 'laundry-outsourced', activityId: 'laundry-outsourced-service', label: `Outsourced laundry service — ${O.supplier}`, module: 'laundry', department: 'Housekeeping & Laundry', scope: 'S3', s3cat: 1,
        views: ['corporate', 'hcmi', 'lca', 'visitor'], activity: result.kgWashedOutsourced, activityUnit: 'kg washed', factorValue: O.factorKgPerKg, factorUnit: 'kgCO2e/kg (supplier-declared)', factorVersion: 'user',
        kg: result.kgWashedOutsourced * O.factorKgPerKg, monthly: outMonthly.map((k) => k * O.factorKgPerKg!), status: outStatus === 'measured' ? 'measured' : acc.status('outsourcedLaundry.factorKgPerKg', 'estimated'),
        stages: O.factorBoundaryIncludesTransport ? ['full_lifecycle', 'transport'] : ['full_lifecycle'], formula: 'kg washed × supplier kgCO2e/kg',
        inputs: { kg: Math.round(result.kgWashedOutsourced), factor: O.factorKgPerKg, boundary: O.factorBoundaryIncludesTransport ? 'incl. collection transport' : 'excl. transport' }, notes: [O.factorSourceNote],
      });
    }
    const collections = O.collectionsPerWeek * (sum(act.openDays) / 7);
    const vkm = collections * O.roundTripKm * clamp01(O.routeAllocationShare);
    if (O.factorBoundaryIncludesTransport) {
      const vf = acc.opt.library.factors[O.vehicleFactorId];
      acc.suppressed.push({ activityId: 'laundry-outsourced-transport', label: 'Outsourced laundry collection transport', reason: 'Supplier factor boundary already includes collection/delivery transport — not added again.', kgAvoidedDoubleCount: vf ? vkm * vf.value : 0 });
    } else {
      acc.emit({ id: 'laundry-transport', activityId: 'laundry-outsourced-transport', label: 'Outsourced laundry collection transport', module: 'laundry', department: 'Housekeeping & Laundry', scope: 'S3', s3cat: 4, views: ['corporate', 'lca', 'visitor'], activityUnit: 'vehicle-km (allocated)', factorId: O.vehicleFactorId, monthlyActivity: distribute(vkm, act.openDays), status: acc.status('outsourcedLaundry.roundTripKm', 'assumed'), formula: 'collections × round-trip km × route allocation × kgCO2e/vkm', inputs: { collections: Math.round(collections), roundTripKm: O.roundTripKm, allocation: O.routeAllocationShare } });
    }
    const kgPerCollection = collections > 0 ? result.kgWashedOutsourced / collections : 0;
    const perCollectionCost = Math.max(kgPerCollection * O.pricePerKgEUR, O.minChargePerCollectionEUR);
    const total = perCollectionCost * collections;
    acc.cost({ id: 'laundry-outsourced-cost', label: `Outsourced laundry (${O.supplier})`, category: 'laundry', department: 'Housekeeping & Laundry', fixed: 0, variable: total, vatRate: 0.2, monthly: outMonthly.map((k) => (result.kgWashedOutsourced > 0 ? (total * k) / result.kgWashedOutsourced : 0)), status: outStatus, notes: kgPerCollection * O.pricePerKgEUR < O.minChargePerCollectionEUR ? 'Minimum collection charge applies.' : undefined });
    acc.addWaste('Laundry packaging film', collections * O.packagingKgPerCollection);
  }
  return { result, flows };
}

export const dayCount = (act: ActivityMetrics) => sum(act.openDays) || sum(DAYS_IN_MONTH);
