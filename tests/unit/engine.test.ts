import { calculate, calibrationFrom } from '../../src/engine';
import { computeActivity } from '../../src/engine/activity';
import { zoneElectricityMonthly, replacementsPerYear, zoneBurnHours } from '../../src/engine/lighting';
import { textileMass } from '../../src/engine/laundry';
import { deflateSpend, refrigerantReleaseKg } from '../../src/engine/other';
import { solarBalance } from '../../src/engine/supply';
import { rectMassKg, safeDiv, sum, waterHeatKWh, deepClone } from '../../src/engine/util';
import { DEFAULT_SETTINGS, PROPERTY_IDS, SEEDS, defaultLibrary } from '../../src/data/library';
import { zone } from '../../src/data/seeds/base';
import { PRESET_MAP } from '../../src/scenarios/presets';
import { initialData, setScenarioInput, activeScenario, saveAsBaseline, undo, redo } from '../../src/state/model';
import { convertUnit, parseCSV, preview, buildPatches, type Mapping } from '../../src/lib/importer';
import { validateInputs } from '../../src/data/registry';
import { multiYear, irr } from '../../src/engine/finance';
import type { PropertyInputs } from '../../src/types';

const lib = defaultLibrary();
const S = DEFAULT_SETTINGS;
const run = (p: PropertyInputs, l = lib) => calculate(p, S, l);
const city = () => SEEDS['city-hotel']();
const close = (a: number, b: number, tol = 1e-6) => expect(Math.abs(a - b)).toBeLessThanOrEqual(tol * Math.max(1, Math.abs(b)));
const kWh = (r: ReturnType<typeof run>, carrier = 'electricity') => sum(r.energy[carrier]?.total ?? [0]);
const endUse = (r: ReturnType<typeof run>, carrier: string, name: string) => sum(r.energy[carrier]?.endUses[name] ?? [0]);

function simpleHotel(rooms = 150, occ = 0.8, guests = 1.8): PropertyInputs {
  const p = city();
  p.activity.roomTypes = [{ id: 'r', name: 'Rooms', count: rooms, areaM2: 25, beds: 1, maxGuests: 2, guestsPerOccupiedRoom: guests, occupancyIndex: 1 }];
  p.activity.monthlyOccupancy = new Array(12).fill(occ);
  p.activity.monthlyOpenDays = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  p.activity.outOfOrderRate = 0;
  return p;
}

describe('Required mathematical tests', () => {
  it('1. 100 lamps × 10 W × 10 h/day × 365 days = 3,650 kWh/yr', () => {
    const act = computeActivity(simpleHotel());
    const z = zone({ id: 't', name: 'Test', luminaires: 100, wattsPerLamp: 10, hoursPerDay: 10, basis: 'all_days' });
    close(sum(zoneElectricityMonthly(z, act)), 3650);
  });

  it('2. 70 × 140 cm towel at 500 GSM = 0.49 kg (rectangle approximation)', () => {
    close(rectMassKg(70, 140, 500), 0.49);
    const t = city().textiles.find((x) => x.id === 'bath-towel')!;
    close(textileMass(t).kg!, 0.49);
  });

  it('3. Heating 100 L by 40 °C ≈ 4.65 kWh thermal', () => {
    close(waterHeatKWh(100, 40), 4.6511, 1e-3);
  });

  it('4. 150 rooms × 365 days × 80 % = 43,800 occupied room-nights', () => {
    close(sum(computeActivity(simpleHotel()).occupiedRoomNights), 43800);
  });

  it('5. 43,800 × 1.8 guests = 78,840 guest-nights', () => {
    close(sum(computeActivity(simpleHotel()).guestNights), 78840);
  });

  it('6. Hotel-owned EV electricity appears once, in the electricity total', () => {
    const p = city();
    p.vehicles = [{ ...p.vehicles[1], powertrain: 'bev', kWhPer100Km: 25, chargedOnSite: true, chargingLoss: 0.1 }];
    const r = run(p);
    const ev = Object.keys(r.energy.electricity.endUses).filter((k) => k.startsWith('EV charging'));
    expect(ev).toHaveLength(1);
    close(endUse(r, 'electricity', ev[0]), 30000 * 0.25 * 1.1, 1e-9);
    expect(r.energy.diesel?.endUses['Fleet fuel — Guest shuttle van']).toBeUndefined();
    const evLines = r.lines.filter((l) => l.label.includes('EV charging') && l.scope === 'S2');
    expect(evLines).toHaveLength(1);
    expect(r.lines.some((l) => l.scope === 'S1' && l.label.includes('Guest shuttle'))).toBe(false);
  });

  it('7. Outsourcing laundry shifts allocation without eliminating its footprint', () => {
    const base = run(city());
    const s = run(PRESET_MAP['laundry-outsource'].apply(city(), 2025));
    expect(base.laundry.kgWashedInHouse).toBeGreaterThan(0);
    expect(s.laundry.kgWashedInHouse).toBe(0);
    close(s.laundry.kgWashedOutsourced, base.laundry.kgWashedOutsourced + base.laundry.kgWashedInHouse, 1e-9);
    const out = s.lines.find((l) => l.activityId === 'laundry-outsourced-service')!;
    expect(out.kg).toBeGreaterThan(base.lines.find((l) => l.activityId === 'laundry-outsourced-service')!.kg);
    expect(endUse(s, 'natural_gas', 'Tumble dryers')).toBe(0);
    // with a missing supplier factor the footprint is MISSING, not zero
    const p = PRESET_MAP['laundry-outsource'].apply(city(), 2025);
    p.outsourcedLaundry.factorKgPerKg = null;
    const m = run(p);
    expect(m.lines.find((l) => l.activityId === 'laundry-outsourced-service')!.status).toBe('missing');
    expect(m.totals.partialInventory).toBe(true);
  });

  it('8. Electricity price changes costs, not consumption or emissions', () => {
    const a = run(city());
    const p = city();
    p.electricity.priceEnergyHP *= 2;
    const b = run(p);
    close(kWh(b), kWh(a));
    close(b.totals.scope2LB, a.totals.scope2LB);
    expect(b.totals.opexEUR).toBeGreaterThan(a.totals.opexEUR);
  });

  it('9. Changing a physical emission factor does not change electricity consumption', () => {
    const a = run(city());
    const l2 = deepClone(lib);
    l2.factors.elec_fr_generation.value *= 3;
    const b = run(city(), l2);
    close(kWh(b), kWh(a));
    close(b.totals.scope2LB, a.totals.scope2LB * 3, 1e-9);
    close(b.totals.opexEUR, a.totals.opexEUR);
  });

  it('10. An extra night by an existing guest does not create another round trip', () => {
    const p = simpleHotel(150, 0.6);
    p.activity.avgLengthOfStayNights = 2;
    const a = run(p);
    const q = deepClone(p);
    q.activity.avgLengthOfStayNights = 3;
    q.activity.monthlyOccupancy = q.activity.monthlyOccupancy.map((o) => o * 1.5);
    const b = run(q);
    expect(b.totals.guestTravel).toBeGreaterThan(0);
    close(sum(b.activity.arrivingGuests), sum(a.activity.arrivingGuests), 1e-9);
    expect(sum(b.activity.guestNights)).toBeGreaterThan(sum(a.activity.guestNights));
    close(b.totals.guestTravel, a.totals.guestTravel, 1e-9);
  });

  it('11. Location-based and market-based Scope 2 are alternatives, never added', () => {
    const p = city();
    p.electricity.supplierMarketFactor = 0.08;
    const r = run(p);
    const t = r.totals;
    expect(t.scope2MB).not.toBeNull();
    close(t.corporateLB, t.scope1 + t.scope2LB + t.scope3);
    close(t.corporateMB!, t.scope1 + t.scope2MB! + t.scope3);
    expect(t.corporateLB).toBeLessThan(t.scope1 + t.scope2LB + t.scope2MB! + t.scope3);
    // without MB factor: not available
    expect(run(city()).totals.scope2MB).toBeNull();
  });

  it('12. Zero denominator → not applicable, never Infinity', () => {
    expect(safeDiv(5, 0)).toBeNull();
    const p = city();
    p.activity.monthlyOpenDays = new Array(12).fill(0);
    const r = run(p);
    expect(r.totals.perOccupiedRoomNight).toBeNull();
    expect(r.totals.perGuestNight).toBeNull();
    expect(r.lines.every((l) => Number.isFinite(l.kg))).toBe(true);
  });

  it('13. Missing data does not silently become zero', () => {
    const p = city();
    p.waste[0].kgPerYear = null;
    p.waste[0].measurement = 'missing';
    const r = run(p);
    expect(r.missing.some((m) => m.includes('waste.residual'))).toBe(true);
    expect(r.lines.find((l) => l.activityId === 'waste-residual')!.status).toBe('missing');
    expect(r.totals.partialInventory).toBe(true);
    // missing textile mass
    const q = city();
    q.textiles[0].gsm = null;
    q.textiles[0].massModel = 'rectangle';
    q.textiles[0].measuredMassKg = null;
    expect(run(q).missing.some((m) => m.includes('bath-towel'))).toBe(true);
  });

  it('14. A closed hotel keeps configured standby/base loads', () => {
    const p = city();
    p.activity.monthlyOpenDays = new Array(12).fill(0);
    const r = run(p);
    close(endUse(r, 'electricity', 'Continuous base load (IT, lifts, security, standby)'), 45 * 8760);
    expect(endUse(r, 'natural_gas', 'Space heating')).toBeGreaterThan(0); // frost protection
    expect(sum(r.activity.occupiedRoomNights)).toBe(0);
  });

  it('15. Monthly totals reconcile to annual totals', () => {
    for (const id of PROPERTY_IDS) {
      const r = run(SEEDS[id]());
      for (const l of r.lines) close(sum(l.monthly), l.kg, 1e-9);
      for (const c of r.costs) close(sum(c.monthly), c.total, 1e-6);
      for (const f of Object.values(r.energy)) close(sum(f.total), sum(Object.values(f.endUses).map(sum)), 1e-9);
    }
  });

  it('16. Scope, source and department breakdowns reconcile to inventory totals', () => {
    for (const id of PROPERTY_IDS) {
      const r = run(SEEDS[id]());
      const corp = r.lines.filter((l) => l.views.includes('corporate'));
      close(sum(corp.map((l) => l.kg)), r.totals.corporateLB, 1e-9);
      const byDept: Record<string, number> = {};
      for (const l of corp) byDept[l.department] = (byDept[l.department] ?? 0) + l.kg;
      close(sum(Object.values(byDept)), r.totals.corporateLB, 1e-9);
      close(sum(Object.values(r.totals.scope3ByCat)), r.totals.scope3, 1e-9);
      expect(corp.every((l) => l.scope !== 'OUT')).toBe(true);
    }
  });

  it('17. A product factor that includes freight prevents duplicate freight', () => {
    const p = city();
    const r = run(p);
    expect(r.lines.some((l) => l.activityId.startsWith('delivery-bev'))).toBe(false);
    expect(r.suppressed.some((s) => s.activityId === 'delivery-bev')).toBe(true);
    p.deliveries[1].includedInProductFactor = false;
    expect(run(p).lines.some((l) => l.activityId.startsWith('delivery-bev'))).toBe(true);
  });

  it('18. CAPEX does not imply carbon amortisation in the corporate inventory', () => {
    const p = city();
    p.capex = [{ id: 'x', label: 'Test retrofit', amountEUR: 100000, year: 2025, embodiedKg: 12000, lifeYears: 12, category: 'Test' }];
    const r = run(p);
    const corp = r.lines.find((l) => l.activityId === 'capital-x-2025')!;
    close(corp.kg, 12000);
    expect(corp.views).toEqual(['corporate']);
    const ann = r.lines.find((l) => l.activityId === 'annualised-x')!;
    close(ann.kg, 1000);
    expect(ann.scope).toBe('OUT');
    expect(ann.views).toEqual(['lca']);
    // a capex item without embodied data adds cost only
    const q = city();
    q.capex = [{ id: 'y', label: 'Cash only', amountEUR: 5000, year: 2025, embodiedKg: 0, lifeYears: 5, category: 'Test' }];
    close(run(q).totals.corporateLB, run(city()).totals.corporateLB);
  });

  it('19. Low-flow showers reduce both water and hot-water energy', () => {
    const a = run(city());
    const b = run(PRESET_MAP['low-flow'].apply(city(), 2025));
    expect(sum(b.water.endUses['Guest showers'])).toBeLessThan(sum(a.water.endUses['Guest showers']));
    expect(endUse(b, 'natural_gas', 'Guest showers (hot water)')).toBeLessThan(endUse(a, 'natural_gas', 'Guest showers (hot water)'));
    const ratioW = sum(b.water.endUses['Guest showers']) / sum(a.water.endUses['Guest showers']);
    const ratioE = endUse(b, 'natural_gas', 'Guest showers (hot water)') / endUse(a, 'natural_gas', 'Guest showers (hot water)');
    close(ratioW, ratioE, 1e-9); // same mixed volume drives both
  });

  it('20. Smaller towels reduce laundry kg and loads', () => {
    const a = run(city());
    const p = city();
    p.textiles[0].lengthCm = 120;
    const b = run(p);
    expect(b.laundry.massPerItemKg['Bath towel']).toBeLessThan(a.laundry.massPerItemKg['Bath towel']);
    expect(b.laundry.kgWashedInHouse).toBeLessThan(a.laundry.kgWashedInHouse);
    expect(b.laundry.loads).toBeLessThan(a.laundry.loads);
    expect(sum(b.water.endUses['In-house laundry'])).toBeLessThan(sum(a.water.endUses['In-house laundry']));
    expect(b.warnings.some((w) => w.message.includes('Bath towel: length 120 cm'))).toBe(true);
  });

  it('21. Baseline remains unchanged when editing a scenario', () => {
    const d = initialData();
    const before = JSON.stringify(d.properties['city-hotel'].baseline);
    const sc = activeScenario(d, 'city-hotel');
    const d2 = setScenarioInput(d, 'city-hotel', sc.id, 'bathrooms.showerFlowLPerMin', 7);
    expect(JSON.stringify(d2.properties['city-hotel'].baseline)).toBe(before);
    expect(activeScenario(d2, 'city-hotel').inputs.bathrooms.showerFlowLPerMin).toBe(7);
    expect(d2.audit[0]).toMatchObject({ path: 'bathrooms.showerFlowLPerMin', previous: 12, next: 7 });
    const d3 = undo(d2, 'city-hotel', sc.id);
    expect(activeScenario(d3, 'city-hotel').inputs.bathrooms.showerFlowLPerMin).toBe(12);
    expect(activeScenario(redo(d3, 'city-hotel', sc.id), 'city-hotel').inputs.bathrooms.showerFlowLPerMin).toBe(7);
    const d4 = saveAsBaseline(d2, 'city-hotel', sc.id, 'new');
    expect(d4.properties['city-hotel'].baseline.inputs.bathrooms.showerFlowLPerMin).toBe(7);
  });

  it('22. Switching hotels does not leak inputs between properties', () => {
    const d = initialData();
    const island = JSON.stringify(d.properties['island-resort']);
    const sc = activeScenario(d, 'city-hotel');
    const d2 = setScenarioInput(d, 'city-hotel', sc.id, 'activity.avgLengthOfStayNights', 5);
    expect(JSON.stringify(d2.properties['island-resort'])).toBe(island);
    expect(activeScenario(d2, 'island-resort').inputs.activity.avgLengthOfStayNights).toBe(4.5);
  });

  it('23. Imported values with incompatible units are rejected or explicitly converted', () => {
    expect(convertUnit(2, 'MWh', 'kWh')).toBe(2000);
    expect(convertUnit(5, 'm3', 'kWh')).toBeNull();
    close(convertUnit(90, 'kWh PCI', 'kWh PCS')!, 100);
    const csv = 'month;value;unit\n2025-01;12,5;MWh\n2025-02;3000;m3\n2025-01;11;MWh\n2024-03;10;MWh\n';
    const rows = parseCSV(csv);
    const m: Mapping = { target: 'electricity', hasHeader: true, dateCol: 0, dateFormat: 'YYYY-MM', keyCol: 0, valueCol: 1, unitCol: 2, fixedUnit: 'kWh', decimal: ',', year: 2025 };
    const pv = preview(rows, m, city());
    expect(pv[0]).toMatchObject({ status: 'ok', value: 12500, month: 0 });
    expect(pv[1].status).toBe('error');
    expect(pv[2].status).toBe('duplicate');
    expect(pv[3].status).toBe('warning');
    const patches = buildPatches(pv, m, city());
    const arr = patches.find((x) => x.path === 'measured.electricityKWh')!.value as (number | null)[];
    expect(arr[0]).toBe(12500);
    expect(arr[1]).toBeNull();
  });

  it('24. Percentages remain in valid ranges', () => {
    const p = city();
    p.activity.monthlyOccupancy[0] = 1.4;
    p.bathrooms.lowFlowUptake = -0.2;
    const issues = validateInputs(p);
    expect(issues.some((i) => i.path === 'activity.monthlyOccupancy')).toBe(true);
    expect(issues.some((i) => i.path === 'bathrooms.lowFlowUptake')).toBe(true);
    const r = run(p);
    expect(r.activity.occupancyRate.every((o) => o >= 0 && o <= 1)).toBe(true);
    expect(r.warnings.some((w) => w.module === 'validation')).toBe(true);
    expect(validateInputs(city())).toEqual([]);
  });

  it('25. Renewable generation is bounded by physics; no negative imports', () => {
    const demand = [100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100];
    const yieldM = [50, 60, 90, 120, 135, 140, 145, 130, 100, 70, 40, 30];
    const s = solarBalance(demand, 10, yieldM, 0.6, 20, 25, 0.9);
    for (let m = 0; m < 12; m++) {
      close(s.generation[m], 10 * yieldM[m]);
      expect(s.selfConsumed[m]).toBeLessThanOrEqual(Math.min(s.generation[m], demand[m]) + 1e-9);
      expect(s.gridImport[m]).toBeGreaterThanOrEqual(0);
      expect(s.exported[m]).toBeGreaterThanOrEqual(0);
      expect(s.selfConsumed[m] + s.exported[m]).toBeLessThanOrEqual(s.generation[m] + 1e-9);
    }
    const p = SEEDS['island-resort']();
    p.solar.kWp = 1000;
    const r = run(p);
    expect(r.warnings.some((w) => w.module === 'solar')).toBe(true);
    expect(Math.max(...r.solar.generation)).toBeLessThanOrEqual((900 / 5.5) * 160 + 1e-6);
  });

  it('26. Fixed subscription costs remain unless the contract changes', () => {
    const s = run(PRESET_MAP['heat-pump'].apply(city(), 2025));
    expect(kWh(s, 'natural_gas')).toBeGreaterThan(0); // laundry/cooking still on gas
    const p = PRESET_MAP['heat-pump'].apply(city(), 2025);
    p.food.cookingGasShare = 0;
    p.inHouseLaundry.thermalCarrier = 'electricity';
    p.inHouseLaundry.dryerTech = 'electric';
    p.inHouseLaundry.ironerCarrier = 'electricity';
    p.pools[0].heating.tech = 'heat_pump';
    const r = run(p);
    expect(r.energy.natural_gas).toBeUndefined();
    const gas = r.costs.find((c) => c.id === 'cost-gas');
    expect(gas?.fixed ?? 3000).toBe(3000);
  });

  it('27. Longer asset lifetime changes replacement frequency, not historical embodied emissions', () => {
    const a = run(city());
    const p = city();
    p.assets = p.assets.map((x) => ({ ...x, usefulLifeYears: x.usefulLifeYears + 5 }));
    const b = run(p);
    const cat2 = (r: typeof a) => r.totals.scope3ByCat[2] ?? 0;
    close(cat2(b), cat2(a));
    expect(b.totals.lca).toBeLessThan(a.totals.lca);
    // textiles: longer wash life → fewer purchases
    const q = city();
    q.textiles[0].lifeWashCycles *= 2;
    expect(run(q).laundry.purchasesPerYear['Bath towel']).toBeLessThan(a.laundry.purchasesPerYear['Bath towel']);
  });

  it('28. Spend-based factors use currency, price year and inflation adjustment', () => {
    close(deflateSpend(1081, 2025, 2022)!, 1000, 1e-9);
    expect(deflateSpend(100, 1990, 2022)).toBeNull();
    const r = run(city());
    const l = r.lines.find((x) => x.activityId === 'service-mkt')!;
    close(l.activity, 250000 * (100 / 108.1), 1e-9);
    expect(l.activityUnit).toContain('2022');
    expect(r.lines.some((x) => x.activityId === 'service-laundry-spend')).toBe(false);
  });
});

describe('Additional accounting integrity checks', () => {
  it('refrigerant top-ups are never added to a default leak estimate', () => {
    const rel = refrigerantReleaseKg({ chargeKg: 25, annualLeakRate: 0.12, measuredTopUpKg: 4.5, retiredThisYear: false, recoveryEfficiency: 0.9 });
    expect(rel.total).toBe(4.5);
    const est = refrigerantReleaseKg({ chargeKg: 25, annualLeakRate: 0.12, measuredTopUpKg: null, retiredThisYear: true, recoveryEfficiency: 0.9 });
    close(est.total, 3 + 2.5);
  });

  it('group replacement with an interval longer than lamp life does not save lamps', () => {
    const act = computeActivity(simpleHotel());
    const z = zone({ id: 'g', name: 'G', luminaires: 100, hoursPerDay: 12, basis: 'all_days', ratedLifeHours: 2000, weibullShape: 3, policy: 'group', groupIntervalHours: 1500, calendarLifeYears: 50 });
    const burn = zoneBurnHours(z, act);
    const short = replacementsPerYear(z, burn);
    const long = replacementsPerYear({ ...z, groupIntervalHours: 6000 }, burn);
    const onFailure = replacementsPerYear({ ...z, policy: 'on_failure' }, burn);
    expect(long).toBeGreaterThanOrEqual(onFailure * 0.6);
    expect(short).toBeGreaterThan(onFailure);
  });

  it('food waste carries treatment only (production counted once in purchases)', () => {
    const r = run(city());
    const fw = r.lines.find((l) => l.activityId === 'waste-food')!;
    expect(fw.factorId).toBe('waste_food_ad');
    expect(fw.kg / fw.activity).toBeLessThan(0.1);
  });

  it('biomass is not zero-carbon: non-CO2 and upstream counted, biogenic CO2 reported outside scopes', () => {
    const p = SEEDS['independent-bnb']();
    p.building.heating.tech = 'wood_pellet_boiler';
    const r = run(p);
    expect(r.lines.some((l) => l.scope === 'S1' && l.factorId === 'pellet_combustion_nonco2' && l.kg > 0)).toBe(true);
    expect(r.lines.some((l) => l.scope === 'S3' && l.s3cat === 3 && l.factorId === 'pellet_upstream')).toBe(true);
    expect(r.totals.biogenicCO2).toBeGreaterThan(0);
    expect(r.lines.filter((l) => l.activityId.startsWith('biogenic')).every((l) => l.views.length === 0)).toBe(true);
  });

  it('green tariff with GOs zeroes market-based Scope 2 only; upstream remains', () => {
    const p = city();
    p.electricity.goCoveredShare = 1;
    p.electricity.greenTariff = true;
    const r = run(p);
    expect(r.totals.scope2MB).toBe(0);
    expect(r.totals.scope2LB).toBeGreaterThan(0);
    expect(r.lines.some((l) => l.s3cat === 3 && l.label.startsWith('Electricity upstream') && l.kg > 0)).toBe(true);
  });

  it('independent guest travel stays out of the corporate inventory', () => {
    const r = run(city());
    const gt = r.lines.filter((l) => l.department === 'Guest travel');
    expect(gt.every((l) => l.scope === 'OUT' && !l.views.includes('corporate'))).toBe(true);
    expect(r.totals.visitor).toBeGreaterThan(r.totals.corporateLB);
  });

  it('non-integer length of stay keeps stays, departures and stayovers consistent', () => {
    const p = simpleHotel();
    p.activity.avgLengthOfStayNights = 2.3;
    const a = computeActivity(p);
    close(sum(a.stays) + sum(a.stayoverRoomNights), sum(a.occupiedRoomNights), 1e-9);
  });

  it('Corsica requires factor revalidation (electricity reported missing, not mainland)', () => {
    const p = SEEDS['island-resort']();
    p.profile.geoContext = 'corsica';
    p.profile.climateProfileId = 'ajaccio';
    const r = run(p);
    expect(r.warnings.some((w) => w.module === 'geography' && w.level === 'error')).toBe(true);
    expect(r.lines.filter((l) => l.scope === 'S2').every((l) => l.status === 'missing' && l.kg === 0)).toBe(true);
    expect(r.totals.partialInventory).toBe(true);
  });

  it('B&B: household activity is excluded and allocation methods change the business share', () => {
    const p = SEEDS['independent-bnb']();
    const floor = run(p);
    p.bnb!.method = 'dedicated_meter';
    const meter = run(p);
    p.bnb!.method = 'occupied_nights';
    const nights = run(p);
    expect(endUse(meter, 'heating_oil', 'Space heating')).toBeGreaterThan(endUse(floor, 'heating_oil', 'Space heating'));
    const gn = sum(nights.activity.guestNights);
    const share = gn / (gn + 2 * 330);
    close(endUse(nights, 'heating_oil', 'Space heating') / endUse(meter, 'heating_oil', 'Space heating'), share, 1e-9);
    close(endUse(floor, 'heating_oil', 'Space heating') / endUse(meter, 'heating_oil', 'Space heating'), 0.55, 1e-9);
    // guest-driven loads unchanged by allocation
    close(endUse(meter, 'electricity', 'Guest showers (hot water)'), endUse(floor, 'electricity', 'Guest showers (hot water)'));
  });

  it('measured mode reconciles to bills and scenarios project from the calibrated baseline', () => {
    const p = city();
    const modelled = run(p);
    const bills = modelled.solar.gridImport.map((x) => Math.round(x * 1.1));
    p.measured.useMeasured = true;
    p.measured.electricityKWh = bills;
    const r = run(p);
    close(sum(r.solar.gridImport), sum(bills), 1e-6);
    expect(r.calibration.electricity.residual!).toBeGreaterThan(0);
    const s = PRESET_MAP['led-retrofit'].apply(p, 2025);
    const rs = calculate(s, S, lib, calibrationFrom(r));
    expect(sum(rs.solar.gridImport)).toBeLessThan(sum(bills));
  });

  it('finance: no positive payback for non-saving scenarios; IRR only when meaningful', () => {
    const b = city();
    const s = deepClone(b);
    s.capex = [{ id: 'c', label: 'Cost only', amountEUR: 10000, year: 2026, embodiedKg: 0, lifeYears: 10, category: 'x' }];
    s.finance.horizonYears = 3;
    const f = multiYear(b, s, 2026, S, lib);
    expect(f.simplePaybackYears).toBeNull();
    expect(f.macEURPerT).toBeNull();
    expect(f.npv).toBeLessThan(0);
    expect(irr([-100, 60, 60])).toBeGreaterThan(0.1);
    expect(irr([-100, 200, -150])).toBeNull();
  });

  it('property-based invariant: random operating inputs give finite, reconciled, non-negative results', () => {
    let seed = 7;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 25; i++) {
      const p = SEEDS[PROPERTY_IDS[i % 3]]();
      p.activity.monthlyOccupancy = p.activity.monthlyOccupancy.map(() => rand());
      p.activity.avgLengthOfStayNights = 1 + rand() * 6;
      p.bathrooms.showerFlowLPerMin = 4 + rand() * 12;
      p.building.heatingSetpointC = 18 + rand() * 5;
      p.textiles.forEach((t) => { if (t.gsm) t.gsm = 300 + rand() * 400; });
      const r = run(p);
      for (const l of r.lines) {
        expect(Number.isFinite(l.kg)).toBe(true);
        expect(l.kg).toBeGreaterThanOrEqual(0);
      }
      close(sum(r.lines.filter((l) => l.views.includes('corporate')).map((l) => l.kg)), r.totals.corporateLB, 1e-9);
      expect(r.solar.gridImport.every((x) => x >= 0)).toBe(true);
    }
  });
});
