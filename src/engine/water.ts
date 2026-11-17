import type { ActivityMetrics, ClimateProfile } from '../types';
import type { Acc } from './context';
import { deliverHeat } from './heat';
import { DAYS_IN_MONTH, LATENT_KWH_PER_KG, clamp01, distribute, map12, sum, waterHeatKWh } from './util';

/** Effective shower flow accounting for low-flow uptake and rebound in duration. */
export function effectiveShowerLitresPerShower(p: { showerFlowLPerMin: number; showerMinutes: number; lowFlowUptake: number; lowFlowShowerLPerMin: number; showerRebound: number }) {
  const u = clamp01(p.lowFlowUptake);
  return (1 - u) * p.showerFlowLPerMin * p.showerMinutes + u * p.lowFlowShowerLPerMin * p.showerMinutes * (1 + Math.max(0, p.showerRebound));
}

/**
 * Guest bathrooms, other water uses, spa and irrigation. Hot water is computed as the thermal energy
 * to raise the MIXED volume from cold-inlet to use temperature (equivalent to the hot fraction raised
 * to storage temperature; the full mixed volume is never heated to storage temperature).
 */
export function runWater(acc: Acc, act: ActivityMetrics, climate: ClimateProfile) {
  const p = acc.p;
  const bt = p.bathrooms;
  const ow = p.otherWater;
  const d = p.dhw;
  const st = acc.status('bathrooms', 'modelled');
  const tc = climate.coldWaterC;

  const showerL = effectiveShowerLitresPerShower(bt);
  const showerMix = act.guestNights.map((g) => g * bt.showersPerGuestNight * showerL);
  const bathMix = act.guestNights.map((g) => g * bt.bathsPerGuestNight * bt.bathVolumeL);
  const basin = act.guestNights.map((g) => g * bt.basinFlowLPerMin * bt.basinMinutesPerGuestNight);
  const flushL = clamp01(bt.dualFlushPartShare) * bt.toiletPartFlushL + (1 - clamp01(bt.dualFlushPartShare)) * bt.toiletFullFlushL;
  const toilets = act.guestNights.map((g) => g * bt.flushesPerGuestNight * flushL);
  const leaks = map12((m) => bt.leakM3PerDay * DAYS_IN_MONTH[m] * 1000);

  acc.addWater({ endUse: 'Guest showers', department: 'Rooms', monthly: showerMix.map((l) => l / 1000), discharged: true, status: st });
  acc.addWater({ endUse: 'Guest baths', department: 'Rooms', monthly: bathMix.map((l) => l / 1000), discharged: true, status: st });
  acc.addWater({ endUse: 'Guest basins', department: 'Rooms', monthly: basin.map((l) => l / 1000), discharged: true, status: st });
  acc.addWater({ endUse: 'Guest toilets', department: 'Rooms', monthly: toilets.map((l) => l / 1000), discharged: true, status: st });
  acc.addWater({ endUse: 'Leaks', department: 'Engineering & Building', monthly: leaks.map((l) => l / 1000), discharged: true, status: acc.status('bathrooms.leakM3PerDay', 'assumed') });

  acc.dhwDemands.push({ endUse: 'Guest showers (hot water)', department: 'Rooms', monthly: showerMix.map((l, m) => waterHeatKWh(l, Math.max(0, d.showerMixTempC - tc[m]))) });
  acc.dhwDemands.push({ endUse: 'Guest baths (hot water)', department: 'Rooms', monthly: bathMix.map((l, m) => waterHeatKWh(l, Math.max(0, d.showerMixTempC - tc[m]))) });
  acc.dhwDemands.push({ endUse: 'Guest basins (hot water)', department: 'Rooms', monthly: basin.map((l, m) => waterHeatKWh(l * clamp01(bt.basinHotShare), Math.max(0, d.basinMixTempC - tc[m]))) });

  // Kitchen & dishwashing
  const cv = act.covers;
  const foodCovers = map12((m) => cv.breakfast[m] + cv.mainMeals[m] + cv.roomService[m] + cv.banquet[m] + cv.staff[m]);
  const kitchenL = foodCovers.map((c) => c * ow.kitchenLPerCover);
  const dishL = foodCovers.map((c) => c * ow.racksPerCover * ow.dishwasherLPerRack);
  acc.addWater({ endUse: 'Kitchen preparation', department: 'Food & Beverage', monthly: kitchenL.map((l) => l / 1000), discharged: true, status: acc.status('otherWater', 'assumed') });
  acc.addWater({ endUse: 'Dishwashers', department: 'Food & Beverage', monthly: dishL.map((l) => l / 1000), discharged: true, status: acc.status('otherWater', 'assumed') });
  acc.dhwDemands.push({ endUse: 'Kitchen hot water', department: 'Food & Beverage', monthly: kitchenL.map((l, m) => waterHeatKWh(l * clamp01(ow.kitchenHotShare), Math.max(0, d.storageTempC - tc[m]))) });

  // Housekeeping water
  const cleans = map12((m) => act.stays[m] + act.stayoverRoomNights[m] * (1 - clamp01(p.cleaning.stayoverSkipShare)));
  const hkL = cleans.map((c) => c * ow.housekeepingLPerClean);
  acc.addWater({ endUse: 'Housekeeping cleaning', department: 'Housekeeping & Laundry', monthly: hkL.map((l) => l / 1000), discharged: true, status: acc.status('otherWater', 'assumed') });
  acc.dhwDemands.push({ endUse: 'Housekeeping hot water', department: 'Housekeeping & Laundry', monthly: hkL.map((l, m) => waterHeatKWh(l * clamp01(ow.housekeepingHotShare), Math.max(0, d.storageTempC - tc[m]))) });

  // Staff facilities
  const staffDays = distribute(p.activity.staffFTE * p.activity.workingDaysPerFTE, act.openDays);
  const staffL = staffDays.map((x) => x * ow.staffLPerFTEDay);
  acc.addWater({ endUse: 'Staff facilities', department: 'Staff & Administration', monthly: staffL.map((l) => l / 1000), discharged: true, status: acc.status('otherWater', 'assumed') });
  acc.dhwDemands.push({ endUse: 'Staff showers & washrooms', department: 'Staff & Administration', monthly: staffL.map((l, m) => waterHeatKWh(l * clamp01(ow.staffHotShare), Math.max(0, d.showerMixTempC - tc[m]))) });

  if (ow.coolingTowerM3PerYear > 0) {
    acc.addWater({ endUse: 'Cooling tower make-up', department: 'Engineering & Building', monthly: distribute(ow.coolingTowerM3PerYear, climate.meanTempC.map((t) => Math.max(0, t - 15))), discharged: false, status: acc.status('otherWater.coolingTowerM3PerYear', 'assumed') });
  }

  // Spa
  const s = p.spa;
  if (s.enabled) {
    const sst = acc.status('spa', 'assumed');
    const sauna = act.openDays.map((od) => s.saunas * s.saunaKW * s.saunaHoursPerOpenDay * od);
    const steam = act.openDays.map((od) => s.steamRooms * s.steamKW * s.steamHoursPerOpenDay * od);
    const tubs = act.openDays.map((od) => s.hotTubs * s.hotTubKWhPerDay * od);
    acc.addEnergy({ carrier: 'electricity', endUse: 'Saunas', department: 'Spa, Pool & Leisure', monthly: sauna, status: sst, module: 'spa' });
    acc.addEnergy({ carrier: 'electricity', endUse: 'Steam rooms', department: 'Spa, Pool & Leisure', monthly: steam, status: sst, module: 'spa' });
    acc.addEnergy({ carrier: 'electricity', endUse: 'Hot tubs', department: 'Spa, Pool & Leisure', monthly: tubs, status: sst, module: 'spa' });
    const visits = distribute(s.treatmentsPerYear + p.activity.spaDayVisitorsPerYear, act.openDays);
    const spaL = visits.map((v) => v * s.spaShowerLPerVisit);
    acc.addWater({ endUse: 'Spa showers', department: 'Spa, Pool & Leisure', monthly: spaL.map((l) => l / 1000), discharged: true, status: sst });
    acc.dhwDemands.push({ endUse: 'Spa showers (hot water)', department: 'Spa, Pool & Leisure', monthly: spaL.map((l, m) => waterHeatKWh(l, Math.max(0, d.showerMixTempC - tc[m]))) });
  }

  // Pools
  for (const pool of p.pools) {
    const pst = acc.status(`pools.${pool.id}`, 'modelled');
    const coverFrac = pool.coverUsed ? clamp01(pool.coverEvapReduction) * clamp01(pool.coverHoursPerDay / 24) : 0;
    const evapKg = map12((m) => {
      if (!pool.openMonths[m]) return 0;
      const days = DAYS_IN_MONTH[m];
      const raw = pool.indoor ? pool.indoorEvapKgPerM2H * pool.areaM2 * 24 * days : climate.outdoorPoolEvapLPerM2Day[m] * pool.areaM2 * days;
      return raw * (1 - coverFrac);
    });
    const backwashL = map12((m) => (pool.openMonths[m] ? pool.backwashM3PerWeek * 1000 * (DAYS_IN_MONTH[m] / 7) : 0));
    const latent = evapKg.map((e) => e * LATENT_KWH_PER_KG);
    const surface = map12((m) => {
      if (!pool.openMonths[m]) return 0;
      const ref = pool.indoor ? pool.hallAirTempC : climate.meanTempC[m];
      return (pool.surfaceLossWPerM2K * pool.areaM2 * Math.max(0, pool.waterTempC - ref) * 24 * DAYS_IN_MONTH[m] * (1 - coverFrac)) / 1000;
    });
    const makeupHeat = map12((m) => waterHeatKWh(evapKg[m] + backwashL[m], Math.max(0, pool.waterTempC - tc[m])));
    const heat = map12((m) => latent[m] + surface[m] + makeupHeat[m]);
    deliverHeat(acc, pool.heating, heat, `Pool heating — ${pool.name}`, 'Spa, Pool & Leisure', climate, pst, 'pool');
    const pump = map12((m) => (pool.openMonths[m] ? pool.pumpKW * pool.pumpHoursPerDay * DAYS_IN_MONTH[m] : 0));
    acc.addEnergy({ carrier: 'electricity', endUse: `Pool filtration pumps — ${pool.name}`, department: 'Spa, Pool & Leisure', monthly: pump, status: pst, module: 'pool' });
    if (pool.indoor) acc.addEnergy({ carrier: 'electricity', endUse: `Pool hall dehumidification — ${pool.name}`, department: 'Spa, Pool & Leisure', monthly: evapKg.map((e) => e * pool.dehumidKWhPerKgEvap), status: pst, module: 'pool' });
    acc.addWater({ endUse: `Pool evaporation make-up — ${pool.name}`, department: 'Spa, Pool & Leisure', monthly: evapKg.map((e) => e / 1000), discharged: false, status: pst });
    acc.addWater({ endUse: `Pool backwash — ${pool.name}`, department: 'Spa, Pool & Leisure', monthly: backwashL.map((l) => l / 1000), discharged: true, status: pst });
    if (pool.chemicalsKgPerYear > 0) {
      acc.emit({ id: `pool-chem-${pool.id}`, activityId: `pool-chem-${pool.id}`, label: `Pool chemicals — ${pool.name}`, module: 'pool', department: 'Spa, Pool & Leisure', scope: 'S3', s3cat: 1, views: ['corporate', 'lca', 'visitor'], activityUnit: 'kg', factorId: 'pool_chemicals', monthlyActivity: distribute(pool.chemicalsKgPerYear, pool.openMonths), status: acc.status(`pools.${pool.id}.chemicalsKgPerYear`, 'assumed'), formula: 'kg chemicals × factor', inputs: { kg: pool.chemicalsKgPerYear } });
    }
  }

  // Irrigation (FAO-56 style: Kc·ET0 − effective rain, divided by efficiency, plus leaks)
  const ir = p.irrigation;
  if (ir.landscapedAreaM2 > 0) {
    const irrM3 = map12((m) => {
      if (!ir.irrigatedMonths[m]) return 0;
      const netMm = Math.max(0, ir.cropCoefficient * climate.et0Mm[m] - clamp01(ir.effectiveRainShare) * climate.rainfallMm[m]);
      return ((netMm * ir.landscapedAreaM2) / 1000 / Math.max(0.2, ir.irrigationEfficiency)) * (1 + Math.max(0, ir.leakShare)) * (1 - clamp01(ir.reclaimedShare));
    });
    acc.addWater({ endUse: 'Irrigation', department: 'Grounds', monthly: irrM3, discharged: false, status: acc.status('irrigation', 'modelled') });
  }
}

/** Domestic hot water generation incl. storage & loop losses; and safety checks. */
export function runDhw(acc: Acc, act: ActivityMetrics, climate: ClimateProfile) {
  const d = acc.p.dhw;
  const st = acc.status('dhw', 'modelled');
  const losses = map12((m) => act.openDays[m] * (d.storageLossKWhPerDay + (d.loopLengthM * d.loopLossWPerM * (1 - clamp01(d.pipeInsulationImprovement)) * 24) / 1000));
  const recovered = clamp01(d.heatRecoveryShare);
  const sys = d.sameAsSpaceHeating ? acc.p.building.heating : d.system;
  const sysForDhw = { ...sys, supplyTempC: Math.max(sys.supplyTempC, d.storageTempC) };
  for (const dem of acc.dhwDemands) {
    if (sum(dem.monthly) === 0) continue;
    deliverHeat(acc, sysForDhw, dem.monthly.map((q) => q * (1 - recovered)), dem.endUse, dem.department, climate, st, 'dhw');
  }
  deliverHeat(acc, sysForDhw, losses.map((q) => q * (1 - recovered)), 'Hot-water storage & circulation losses', 'Engineering & Building', climate, st, 'dhw');

  if (d.storageTempC < 55) acc.warn('error', 'legionella', `Hot-water production at ${d.storageTempC} °C is below the 55 °C minimum at the production outlet (French ERP Legionella order of 1 Feb 2010, as summarised). No saving should be pursued by lowering it.`);
  if (d.loopReturnTempC < 50) acc.warn('error', 'legionella', `Loop return ${d.loopReturnTempC} °C is below the 50 °C minimum throughout the network (incl. loop return).`);
  if (d.showerMixTempC > 50) acc.warn('warn', 'scald risk', 'Washing-point temperature above 50 °C exceeds the anti-scald limit for rooms used for washing.');
}
