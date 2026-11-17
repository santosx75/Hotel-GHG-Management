import type { ActivityMetrics, GuestOrigin, Powertrain, Vehicle, ViewId } from '../types';
import type { Acc } from './context';
import { clamp01, distribute, sum } from './util';

const LEG_FACTOR: Record<string, string> = { road_truck: 'road_truck_tkm', road_van: 'road_van_tkm', rail: 'rail_tkm', sea: 'sea_tkm', ferry_freight: 'ferry_freight_tkm', air: 'air_tkm' };

/** Vehicle specs effective in the reporting year (after a scheduled replacement, if any). */
export function effectiveVehicle(v: Vehicle, year: number): { powertrain: Powertrain; fuelLPer100Km: number; kWhPer100Km: number; replaced: boolean; acquisitionYear: number; embodiedKg: number; purchaseCostEUR: number; maintenanceEURPerYear: number } {
  if (v.replacement && v.replacement.year <= year) {
    const r = v.replacement;
    return { powertrain: r.powertrain, fuelLPer100Km: r.fuelLPer100Km, kWhPer100Km: r.kWhPer100Km, replaced: true, acquisitionYear: r.year, embodiedKg: r.embodiedKg, purchaseCostEUR: r.purchaseCostEUR, maintenanceEURPerYear: r.maintenanceEURPerYear };
  }
  return { powertrain: v.powertrain, fuelLPer100Km: v.fuelLPer100Km, kWhPer100Km: v.kWhPer100Km, replaced: false, acquisitionYear: v.acquisitionYear, embodiedKg: v.embodiedKg, purchaseCostEUR: v.purchaseCostEUR, maintenanceEURPerYear: v.maintenanceEURPerYear };
}

export function runFleet(acc: Acc, act: ActivityMetrics, year: number) {
  const p = acc.p;
  for (const v of p.vehicles) {
    const e = effectiveVehicle(v, year);
    const st = acc.status(`vehicles.${v.id}`, 'assumed');
    const usage = distribute(v.kmPerYear * v.count, act.openDays);
    const name = `${v.name}${v.count > 1 ? ` ×${v.count}` : ''}`;
    if (e.powertrain === 'bev') {
      const kwh = usage.map((km) => (km * e.kWhPer100Km) / 100 * (1 + Math.max(0, v.chargingLoss)));
      acc.addEnergy({ carrier: 'electricity', endUse: `EV charging — ${name}${v.chargedOnSite ? '' : ' (off-site, hotel-paid)'}`, department: 'Fleet & Logistics', monthly: kwh, status: st, module: 'fleet', scope1Override: 'fleet', offSite: !v.chargedOnSite });
    } else {
      const carrier = e.powertrain === 'diesel' || e.powertrain === 'boat_diesel' ? 'diesel' : e.powertrain === 'lpg' ? 'lpg' : 'petrol';
      const litres = usage.map((u) => (v.usesHours ? u * e.fuelLPer100Km : (u * e.fuelLPer100Km) / 100));
      acc.addEnergy({ carrier, endUse: `Fleet fuel — ${name}`, department: v.role === 'grounds' || v.role === 'golf_cart' ? 'Grounds' : 'Fleet & Logistics', monthly: litres, status: st, module: 'fleet', scope1Override: 'fleet' });
    }
    acc.cost({ id: `fleet-maint-${v.id}`, label: `Fleet maintenance — ${name}`, category: 'fleet', department: 'Fleet & Logistics', fixed: e.maintenanceEURPerYear * v.count, variable: 0, vatRate: 0.2, monthly: new Array(12).fill((e.maintenanceEURPerYear * v.count) / 12), status: st });
    // Embodied emissions: corporate inventory recognises acquisition year (cat. 2); LCA view shows annualised indicator
    if (e.acquisitionYear === year) {
      acc.push({ id: `fleet-capital-${v.id}`, activityId: `capital-vehicle-${v.id}-${e.acquisitionYear}`, label: `Vehicle acquisition — ${name}`, module: 'fleet', department: 'Fleet & Logistics', scope: 'S3', s3cat: 2, views: ['corporate'], activity: v.count, activityUnit: 'vehicles acquired', factorValue: e.embodiedKg, factorUnit: 'kgCO2e/vehicle (input)', kg: e.embodiedKg * v.count, monthly: new Array(12).fill((e.embodiedKg * v.count) / 12), status: acc.status(`vehicles.${v.id}.embodiedKg`, 'assumed'), stages: ['manufacture'], formula: 'vehicles acquired in reporting year × embodied kg', inputs: { year: e.acquisitionYear } });
    }
    const annual = (e.embodiedKg * v.count) / Math.max(1, v.lifeYears);
    acc.push({ id: `fleet-annualised-${v.id}`, activityId: `annualised-vehicle-${v.id}`, label: `Vehicle embodied (annualised) — ${name}`, module: 'fleet', department: 'Fleet & Logistics', scope: 'OUT', views: ['lca'], activity: v.count, activityUnit: 'vehicles', kg: annual, monthly: new Array(12).fill(annual / 12), status: 'assumed', stages: ['manufacture'], formula: 'embodied kg × count ÷ life years', inputs: { life: v.lifeYears }, outsideInventoryReason: 'Annualised life-cycle decision indicator — not the corporate inventory treatment.' });
  }
}

export function runCommuting(acc: Acc) {
  const p = acc.p;
  const c = p.commuting;
  const st = acc.status('commuting', 'assumed');
  const commuters = Math.max(0, p.activity.staffFTE - p.activity.staffAccommodationBeds);
  const pkm = commuters * c.onSiteDaysPerFTE * (1 - clamp01(c.remoteWorkShare)) * 2 * c.oneWayKm;
  const occ = Math.max(1, c.carOccupancy);
  const m = c.modes;
  const base = { module: 'commuting', department: 'Staff & Administration' as const, scope: 'S3' as const, s3cat: 7, views: ['corporate', 'lca'] as ViewId[], status: st };
  const ann = (x: number) => new Array(12).fill(x / 12);
  acc.emit({ ...base, id: 'commute-car', activityId: 'commute-car', label: 'Staff commuting — car', activityUnit: 'vehicle-km', factorId: 'car_petrol_vkm', monthlyActivity: ann((pkm * m.car) / occ), formula: 'passenger-km × share ÷ car occupancy × kg/vkm', inputs: { commuters, pkm: Math.round(pkm), share: m.car, occupancy: occ } });
  acc.emit({ ...base, id: 'commute-ev', activityId: 'commute-ev', label: 'Staff commuting — electric car', activityUnit: 'vehicle-km', factorId: 'car_bev_vkm', monthlyActivity: ann((pkm * m.car_ev) / occ), formula: 'passenger-km × share ÷ occupancy × kg/vkm', inputs: { share: m.car_ev } });
  acc.emit({ ...base, id: 'commute-train', activityId: 'commute-train', label: 'Staff commuting — train/RER', activityUnit: 'passenger-km', factorId: 'train_regional_pkm', monthlyActivity: ann(pkm * m.train), formula: 'passenger-km × share × kg/pkm (occupancy embedded)', inputs: { share: m.train } });
  acc.emit({ ...base, id: 'commute-bus', activityId: 'commute-bus', label: 'Staff commuting — bus/metro', activityUnit: 'passenger-km', factorId: 'bus_urban_pkm', monthlyActivity: ann(pkm * m.bus), formula: 'passenger-km × share × kg/pkm', inputs: { share: m.bus } });
  if (m.employer_shuttle > 0) {
    if (c.shuttleCoveredByFleet) acc.suppressed.push({ activityId: 'commute-shuttle', label: 'Staff shuttle', reason: 'Employer shuttle is a hotel-controlled vehicle already counted in Scope 1 fleet fuel.', kgAvoidedDoubleCount: 0 });
    else acc.emit({ ...base, id: 'commute-shuttle', activityId: 'commute-shuttle', label: 'Staff commuting — contracted shuttle', activityUnit: 'passenger-km', factorId: 'coach_pkm', monthlyActivity: ann(pkm * m.employer_shuttle), formula: 'passenger-km × share × kg/pkm', inputs: { share: m.employer_shuttle } });
  }
  const shareSum = m.car + m.car_ev + m.train + m.bus + m.bike_walk + m.employer_shuttle;
  if (Math.abs(shareSum - 1) > 0.01) acc.warn('error', 'commuting', `Commuting mode shares sum to ${(shareSum * 100).toFixed(0)} %, not 100 %.`);
}

export function runBusinessTravel(acc: Acc) {
  const b = acc.p.businessTravel;
  const st = acc.status('businessTravel', 'assumed');
  const base = { module: 'business travel', department: 'Staff & Administration' as const, scope: 'S3' as const, s3cat: 6, views: ['corporate', 'lca'] as ViewId[], status: st };
  const ann = (x: number) => new Array(12).fill(x / 12);
  acc.emit({ ...base, id: 'bt-train', activityId: 'bt-train', label: 'Business travel — rail', activityUnit: 'passenger-km', factorId: 'train_hsr_pkm', monthlyActivity: ann(b.trainPkm), formula: 'pkm × factor', inputs: { pkm: b.trainPkm } });
  acc.emit({ ...base, id: 'bt-short', activityId: 'bt-short', label: 'Business travel — short-haul flights', activityUnit: 'passenger-km', factorId: 'plane_short_pkm', monthlyActivity: ann(b.shortFlightPkm), formula: 'pkm × factor (CO2 + upstream; non-CO2 disclosed separately)', inputs: { pkm: b.shortFlightPkm } });
  acc.emit({ ...base, id: 'bt-long', activityId: 'bt-long', label: 'Business travel — long-haul flights', activityUnit: 'passenger-km', factorId: 'plane_long_pkm', monthlyActivity: ann(b.longFlightPkm), formula: 'pkm × factor', inputs: { pkm: b.longFlightPkm } });
  acc.emit({ ...base, id: 'bt-car', activityId: 'bt-car', label: 'Business travel — car/rental/taxi', activityUnit: 'vehicle-km', factorId: 'car_petrol_vkm', monthlyActivity: ann(b.carKm), formula: 'vkm × factor', inputs: { vkm: b.carKm } });
  acc.emit({ ...base, id: 'bt-hotel', activityId: 'bt-hotel', label: 'Business travel — hotel nights elsewhere', activityUnit: 'nights', factorId: 'hotel_night_fr', monthlyActivity: ann(b.hotelNightsElsewhere), formula: 'nights × factor', inputs: { nights: b.hotelNightsElsewhere } });
  aviationNonCO2(acc, 'bt', 'Business travel', b.shortFlightPkm * (acc.opt.library.factors.plane_short_pkm?.value ?? 0) + b.longFlightPkm * (acc.opt.library.factors.plane_long_pkm?.value ?? 0), 'Staff & Administration');
}

function aviationNonCO2(acc: Acc, prefix: string, label: string, co2Kg: number, department: 'Staff & Administration' | 'Guest travel') {
  const s = acc.opt.settings;
  if (co2Kg <= 0 || s.aviationNonCO2 === 'excluded') return;
  const extra = co2Kg * Math.max(0, s.aviationNonCO2Multiplier - 1);
  acc.push({ id: `${prefix}-nonco2`, activityId: `${prefix}-aviation-nonco2`, label: `${label} — aviation non-CO2 effects (${s.aviationNonCO2 === 'included' ? 'included in visitor view' : 'disclosed separately'})`, module: 'travel', department, scope: 'OUT', views: s.aviationNonCO2 === 'included' && department === 'Guest travel' ? ['visitor'] : [], activity: co2Kg, activityUnit: 'kgCO2e aviation (CO2 basis)', factorValue: s.aviationNonCO2Multiplier - 1, factorUnit: 'multiplier − 1 (convention)', kg: extra, monthly: new Array(12).fill(extra / 12), status: 'estimated', stages: ['use'], formula: 'aviation CO2e × (multiplier − 1)', inputs: { multiplier: s.aviationNonCO2Multiplier }, outsideInventoryReason: 'Non-CO2 aviation effects are not GHG Protocol inventory gases; shown under the selected convention.' });
}

/**
 * Guest travel: based on ARRIVING GUESTS (not guest-nights). One round trip per stay regardless of length of stay.
 * Treatment by arrangement: independent & hotel-sold → extended visitor view (outside inventory);
 * hotel-purchased third-party transfers → Scope 3 cat. 1. Hotel-owned shuttle legs are excluded (already Scope 1).
 */
export function runGuestTravel(acc: Acc, act: ActivityMetrics) {
  const g = acc.p.guestTravel;
  const arrivals = sum(act.arrivingGuests);
  const trips = g.roundTrip ? 2 : 1;
  const attrib = 1 - clamp01(g.multipurposeTripShare);
  const occ = Math.max(1, g.carOccupancy);
  const ev = clamp01(g.evShareOfCars);
  const shuttleShare = clamp01(g.lastLegCoveredByHotelShuttle);
  const st = acc.status('guestTravel', 'assumed');
  const shareSum = sum(g.origins.map((o) => o.shareOfArrivals));
  if (Math.abs(shareSum - 1) > 0.01 && g.origins.length) acc.warn('error', 'guest travel', `Guest origin shares sum to ${(shareSum * 100).toFixed(0)} %, not 100 %.`);
  let planeCo2 = 0;
  for (const o of g.origins) {
    const guests = arrivals * o.shareOfArrivals;
    const kmEff = Math.max(0, o.oneWayKm - shuttleShare * g.lastLegKm);
    const views: ViewId[] = o.arrangement === 'hotel_purchased_transfer' ? ['corporate', 'lca', 'visitor'] : ['visitor'];
    const scope = o.arrangement === 'hotel_purchased_transfer' ? 'S3' : 'OUT';
    const why = o.arrangement === 'independent' ? 'Independently arranged guest travel — extended visitor-impact view only.' : o.arrangement === 'hotel_sold' ? 'Travel sold/arranged by the hotel — treatment depends on reporting framework; disclosed in the visitor view by default.' : undefined;
    const ms = o.modes;
    const msum = ms.train + ms.car + ms.plane_short + ms.plane_long + ms.coach;
    if (Math.abs(msum - 1) > 0.01) acc.warn('error', 'guest travel', `${o.label}: mode shares sum to ${(msum * 100).toFixed(0)} %.`);
    const pkm = (share: number) => guests * share * kmEff * trips * attrib;
    const common = { module: 'guest travel', department: 'Guest travel' as const, scope: scope as any, s3cat: scope === 'S3' ? 1 : undefined, views, status: st, outsideInventoryReason: why };
    const ann = (x: number) => distribute(x, act.arrivingGuests);
    acc.emit({ ...common, id: `gt-${o.id}-train`, activityId: `guest-${o.id}-train`, label: `Guest travel ${o.label} — rail`, activityUnit: 'passenger-km', factorId: 'train_hsr_pkm', monthlyActivity: ann(pkm(ms.train)), formula: 'arriving guests × share × km × trips × attribution × kg/pkm', inputs: { guests: Math.round(guests), km: kmEff, trips } });
    acc.emit({ ...common, id: `gt-${o.id}-car`, activityId: `guest-${o.id}-car`, label: `Guest travel ${o.label} — car (thermal)`, activityUnit: 'vehicle-km', factorId: 'car_petrol_vkm', monthlyActivity: ann((pkm(ms.car) * (1 - ev)) / occ), formula: 'passenger-km ÷ car occupancy × kg/vkm', inputs: { occupancy: occ } });
    acc.emit({ ...common, id: `gt-${o.id}-ev`, activityId: `guest-${o.id}-ev`, label: `Guest travel ${o.label} — car (electric)`, activityUnit: 'vehicle-km', factorId: 'car_bev_vkm', monthlyActivity: ann((pkm(ms.car) * ev) / occ), formula: 'passenger-km × EV share ÷ occupancy × kg/vkm', inputs: { evShare: ev } });
    acc.emit({ ...common, id: `gt-${o.id}-coach`, activityId: `guest-${o.id}-coach`, label: `Guest travel ${o.label} — coach`, activityUnit: 'passenger-km', factorId: 'coach_pkm', monthlyActivity: ann(pkm(ms.coach)), formula: 'pkm × kg/pkm', inputs: {} });
    const ps = acc.emit({ ...common, id: `gt-${o.id}-plane-s`, activityId: `guest-${o.id}-plane-short`, label: `Guest travel ${o.label} — short-haul flight`, activityUnit: 'passenger-km', factorId: 'plane_short_pkm', monthlyActivity: ann(pkm(ms.plane_short)), formula: 'pkm × kg/pkm (excl. non-CO2)', inputs: {} });
    const pl = acc.emit({ ...common, id: `gt-${o.id}-plane-l`, activityId: `guest-${o.id}-plane-long`, label: `Guest travel ${o.label} — long-haul flight`, activityUnit: 'passenger-km', factorId: 'plane_long_pkm', monthlyActivity: ann(pkm(ms.plane_long)), formula: 'pkm × kg/pkm (excl. non-CO2)', inputs: {} });
    planeCo2 += ps.kg + pl.kg;
    if (o.ferryKm > 0) acc.emit({ ...common, id: `gt-${o.id}-ferry`, activityId: `guest-${o.id}-ferry`, label: `Guest travel ${o.label} — ferry`, activityUnit: 'passenger-km', factorId: 'ferry_pkm', monthlyActivity: ann(guests * o.ferryKm * trips * attrib), formula: 'guests × ferry km × trips × kg/pkm', inputs: { ferryKm: o.ferryKm } });
  }
  aviationNonCO2(acc, 'gt', 'Guest travel', planeCo2, 'Guest travel');
  if (shuttleShare > 0 && g.lastLegKm > 0) acc.suppressed.push({ activityId: 'guest-last-leg-shuttle', label: 'Guest last-leg transfers by hotel-owned shuttle', reason: 'Shuttle fuel/electricity already counted in hotel Scope 1/2; these passenger-km are excluded from guest travel.', kgAvoidedDoubleCount: arrivals * shuttleShare * g.lastLegKm * trips * (acc.opt.library.factors.car_petrol_vkm?.value ?? 0) / occ });
  if (g.excursionsKmPerStay > 0) acc.emit({ id: 'gt-excursions', activityId: 'guest-excursions', label: 'Guest excursions & local transport during stay', module: 'guest travel', department: 'Guest travel', scope: 'OUT', views: ['visitor'], activityUnit: 'vehicle-km', factorId: g.excursionFactorId, monthlyActivity: act.stays.map((s) => s * g.excursionsKmPerStay), status: st, formula: 'room-stays × km per stay × factor', inputs: { kmPerStay: g.excursionsKmPerStay }, outsideInventoryReason: 'Visitor-impact view.' });
}

export function runLogistics(acc: Acc, act: ActivityMetrics) {
  for (const d of acc.p.deliveries) {
    const st = acc.status(`deliveries.${d.id}`, 'assumed');
    const label = `Deliveries — ${d.supplier} (${d.productGroup})`;
    acc.cost({ id: `delivery-cost-${d.id}`, label, category: 'services', department: 'Fleet & Logistics', fixed: 0, variable: d.deliveriesPerYear * d.costPerDeliveryEUR, vatRate: 0.2, monthly: distribute(d.deliveriesPerYear * d.costPerDeliveryEUR, act.openDays), status: st });
    if (d.includedInProductFactor) {
      const est = d.method === 'tonne_km' ? sum(d.legs.map((l) => (d.deliveriesPerYear * d.kgPerDelivery) / 1000 * l.km * (acc.opt.library.factors[LEG_FACTOR[l.mode]]?.value ?? 0))) : 0;
      acc.suppressed.push({ activityId: `delivery-${d.id}`, label, reason: 'Product emission factor already includes freight — transport not added again.', kgAvoidedDoubleCount: est });
      continue;
    }
    if (d.method === 'dedicated_vehicle') {
      acc.emit({ id: `delivery-${d.id}`, activityId: `delivery-${d.id}`, label, module: 'logistics', department: 'Fleet & Logistics', scope: 'S3', s3cat: 4, views: ['corporate', 'lca', 'visitor'], activityUnit: 'vehicle-km (allocated)', factorId: d.dedicatedVehicleFactorId, monthlyActivity: distribute(d.deliveriesPerYear * d.dedicatedRoundTripKm * clamp01(d.routeAllocationShare), act.openDays), status: st, formula: 'deliveries × round-trip km × route allocation × kg/vkm', inputs: { deliveries: d.deliveriesPerYear, km: d.dedicatedRoundTripKm, allocation: d.routeAllocationShare } });
    } else {
      const tonnes = (d.deliveriesPerYear * d.kgPerDelivery) / 1000;
      d.legs.forEach((leg, i) => {
        const uplift = d.refrigerated ? 1 + Math.max(0, d.refrigerationUplift) : 1;
        acc.emit({ id: `delivery-${d.id}-${i}`, activityId: `delivery-${d.id}-leg${i}`, label: `${label} — ${leg.mode.replace('_', ' ')} leg`, module: 'logistics', department: 'Fleet & Logistics', scope: 'S3', s3cat: 4, views: ['corporate', 'lca', 'visitor'], activityUnit: 'tonne-km', factorId: LEG_FACTOR[leg.mode], multiplier: uplift, monthlyActivity: distribute(tonnes * leg.km, act.openDays), status: st, formula: `tonnes × km × kg/tkm${d.refrigerated ? ' × (1 + refrigeration uplift)' : ''}`, inputs: { tonnes: +tonnes.toFixed(2), km: leg.km, uplift } });
      });
    }
  }
}

export type { GuestOrigin };
