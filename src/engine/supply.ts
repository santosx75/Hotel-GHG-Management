import type { ActivityMetrics, DataStatus, FlowSet, M12, ViewId } from '../types';
import type { Acc, Carrier, EnergyUse } from './context';
import { clamp01, map12, sum, zeros } from './util';

const S1S2_VIEWS: ViewId[] = ['corporate', 'hcmi', 'lca', 'visitor'];
const S3_VIEWS: ViewId[] = ['corporate', 'lca', 'visitor'];

const COMBUSTION: Partial<Record<Carrier, [string, string]>> = {
  natural_gas: ['gas_combustion', 'gas_upstream'],
  heating_oil: ['heating_oil_combustion', 'heating_oil_upstream'],
  diesel: ['diesel_combustion', 'diesel_upstream'],
  petrol: ['petrol_combustion', 'petrol_upstream'],
  lpg: ['lpg_combustion', 'lpg_upstream'],
  wood_pellets: ['pellet_combustion_nonco2', 'pellet_upstream'],
};
const CARRIER_UNIT: Record<Carrier, string> = { electricity: 'kWh', natural_gas: 'kWh PCS', heating_oil: 'L', diesel: 'L', petrol: 'L', lpg: 'kg', wood_pellets: 'kWh', district_heat: 'kWh' };

/** B&B business share of shared building services, by documented allocation method. */
export function bnbBusinessShare(acc: Acc, act: ActivityMetrics): number {
  const b = acc.p.bnb;
  if (!b) return 1;
  switch (b.method) {
    case 'dedicated_meter': return 1;
    case 'floor_area': return clamp01(b.businessFloorShare);
    case 'occupied_nights': {
      const gn = sum(act.guestNights);
      const hh = b.householdPersons * b.householdNightsPerYear;
      return gn + hh > 0 ? gn / (gn + hh) : 0;
    }
    case 'direct_measurement':
      if (b.measuredBusinessShare == null) {
        acc.markMissing('bnb.measuredBusinessShare');
        acc.warn('warn', 'allocation', 'Direct-measurement allocation selected but no measured share entered — falling back to floor-area share.');
        return clamp01(b.businessFloorShare);
      }
      return clamp01(b.measuredBusinessShare);
    case 'user_defined': return clamp01(b.userShare);
  }
}

const isShared = (u: EnergyUse) => u.module === 'building' || u.endUse === 'Hot-water storage & circulation losses' || /\(shared\)/i.test(u.endUse);

export interface SolarResult { generation: M12; selfConsumed: M12; exported: M12; gridImport: M12; demand: M12 }

/** PV + battery monthly balance. Self-consumption never exceeds generation or demand; imports never negative. */
export function solarBalance(demand: M12, kWp: number, yieldPerKWp: M12, simultaneity: number, batteryKWh: number, cyclesPerMonth: number, roundTrip: number): SolarResult {
  const generation = yieldPerKWp.map((y) => Math.max(0, kWp) * y);
  const selfConsumed = zeros();
  const exported = zeros();
  const gridImport = zeros();
  for (let m = 0; m < 12; m++) {
    const direct = Math.min(generation[m] * clamp01(simultaneity), demand[m]);
    const surplus = generation[m] - direct;
    const rt = clamp01(roundTrip) || 1;
    const shifted = Math.min(surplus * rt, Math.max(0, batteryKWh) * Math.max(0, cyclesPerMonth) * rt, demand[m] - direct);
    selfConsumed[m] = direct + shifted;
    exported[m] = Math.max(0, surplus - shifted / rt);
    gridImport[m] = Math.max(0, demand[m] - selfConsumed[m]);
  }
  return { generation, selfConsumed, exported, gridImport, demand };
}

export function runSupply(acc: Acc, act: ActivityMetrics) {
  const p = acc.p;
  const lib = acc.opt.library;
  const share = bnbBusinessShare(acc, act);
  if (p.bnb) {
    for (const u of acc.energy) if (isShared(u)) u.monthly = u.monthly.map((x) => x * share);
    for (const w of acc.water) if (w.endUse === 'Leaks') w.monthly = w.monthly.map((x) => x * share);
  }

  // ── Calibration to measured bills ──
  const modelledBefore: Record<string, M12> = {};
  const calibration: Record<string, { measured: number | null; modelled: number; residual: number | null; factors: M12 | null }> = {};
  const carriers = Array.from(new Set(acc.energy.map((u) => u.carrier)));
  for (const c of carriers) modelledBefore[c] = acc.energy.filter((u) => u.carrier === c && !u.offSite).reduce((s, u) => s.map((x, i) => x + u.monthly[i]), zeros());

  const sol = p.solar;
  let kWp = sol.enabled ? sol.kWp : 0;
  const roofLimit = p.constraints.roofAreaM2 ?? sol.roofAreaM2Available;
  if (sol.enabled && roofLimit > 0 && kWp * sol.m2PerKWp > roofLimit) {
    const cap = roofLimit / Math.max(0.1, sol.m2PerKWp);
    acc.warn('error', 'solar', `PV capacity ${kWp} kWp needs ${Math.round(kWp * sol.m2PerKWp)} m² but only ${roofLimit} m² of roof is available — capped at ${cap.toFixed(1)} kWp.`);
    kWp = cap;
  }
  const climate = lib.climates[p.profile.climateProfileId];
  const solarFor = (demand: M12) => solarBalance(demand, kWp, climate.pvYieldKWhPerKWp, sol.simultaneityShare, sol.batteryKWh, sol.batteryCyclesPerMonth, sol.batteryRoundTrip);

  const measuredFor = (c: string): (number | null)[] | null => {
    if (!p.measured.useMeasured) return null;
    if (c === 'electricity') return p.measured.electricityKWh;
    if (c === 'natural_gas') return p.measured.gasKWhPCS;
    return null;
  };
  for (const c of carriers) {
    const onsite = acc.energy.filter((u) => u.carrier === c && !u.offSite);
    const modelled = modelledBefore[c];
    const ref = acc.opt.calibration?.factors[c];
    const meas = measuredFor(c);
    let factors: M12 | null = null;
    if (ref) factors = ref;
    else if (meas && meas.some((x) => x != null)) {
      const selfc = c === 'electricity' ? solarFor(modelled).selfConsumed : zeros();
      factors = map12((m) => {
        const mv = meas[m];
        if (mv == null) return 1;
        const target = mv * (p.bnb ? share : 1) + selfc[m];
        return modelled[m] > 0 ? target / modelled[m] : 1;
      });
      for (let m = 0; m < 12; m++) {
        const mv = meas[m];
        if (mv != null && modelled[m] === 0 && mv > 0) {
          const res = zeros();
          res[m] = mv * (p.bnb ? share : 1);
          acc.energy.push({ carrier: c as Carrier, endUse: 'Unexplained residual (measured − modelled)', department: 'Engineering & Building', monthly: res, status: 'measured', module: 'calibration' });
        }
      }
    }
    if (factors) {
      const f = factors;
      for (const u of onsite) {
        u.monthly = u.monthly.map((x, m) => x * f[m]);
        u.status = 'disaggregated';
      }
    }
    const measuredTotal = meas && meas.some((x) => x != null) ? sum(meas.map((x) => (x ?? 0) * (p.bnb ? share : 1))) : null;
    calibration[c] = { measured: measuredTotal, modelled: sum(modelled), residual: measuredTotal != null ? measuredTotal - sum(modelled) : null, factors };
  }
  // Annual measured fleet fuel
  for (const [c, val] of [['diesel', p.measured.fleetDieselL], ['petrol', p.measured.fleetPetrolL]] as const) {
    if (!p.measured.useMeasured || val == null) continue;
    const fleet = acc.energy.filter((u) => u.carrier === c && u.scope1Override === 'fleet');
    const mod = sum(fleet.map((u) => sum(u.monthly)));
    if (mod > 0) for (const u of fleet) { u.monthly = u.monthly.map((x) => (x * val) / mod); u.status = 'disaggregated'; }
    calibration[`${c} (fleet)`] = { measured: val, modelled: mod, residual: val - mod, factors: null };
  }

  // ── Electricity: solar & grid import ──
  const elecOn = acc.energy.filter((u) => u.carrier === 'electricity' && !u.offSite);
  const demand = elecOn.reduce((s, u) => s.map((x, i) => x + u.monthly[i]), zeros());
  const solar = solarFor(demand);
  const importShare = map12((m) => (demand[m] > 0 ? solar.gridImport[m] / demand[m] : 0));
  const e = p.electricity;
  const geo = p.profile.geoContext;
  const genF = geo === 'mainland' ? lib.factors['elec_fr_generation'] : undefined;
  const upF = geo === 'mainland' ? lib.factors['elec_fr_upstream'] : undefined;
  if (!genF) {
    acc.markMissing('Electricity grid factor for this geography');
    acc.warn('error', 'geography', `Geographic context "${geo}" requires factor revalidation: non-interconnected zones (Corsica, overseas) have a different electricity mix, tariffs (péréquation) and freight. Electricity emissions are reported as MISSING until a validated factor is supplied.`);
  }
  // market-based factor
  const goShare = clamp01(e.goCoveredShare);
  const mbBase = e.supplierMarketFactor ?? e.residualMixFactor;
  const mbFactor = goShare >= 1 ? 0 : mbBase == null ? null : (1 - goShare) * mbBase;
  if (mbFactor == null) acc.warn('info', 'scope 2', 'Market-based Scope 2 not available: no supplier-specific or residual-mix factor entered. Location-based result is shown; the two are alternatives, never added.');
  if (e.greenTariff || goShare > 0) acc.warn('info', 'scope 2', 'Guarantees of origin / green tariff reduce market-based Scope 2 only. Upstream and infrastructure emissions remain (Scope 3 cat. 3 and LCA view); the electricity life cycle is not zero.');

  const elecUses = acc.energy.filter((u) => u.carrier === 'electricity');
  for (const u of elecUses) {
    const imp = u.offSite ? u.monthly : u.monthly.map((x, m) => x * importShare[m]);
    const kWh = sum(imp);
    if (kWh <= 0) continue;
    const slug = u.endUse.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    const lb = imp.map((x) => (genF ? x * genF.value : 0));
    const views = u.module === 'ev' ? S1S2_VIEWS.filter((v) => v !== 'visitor') : S1S2_VIEWS;
    if (u.module === 'ev') acc.suppressed.push({ activityId: `visitor-overlap-${slug}`, label: 'Guest EV charging in visitor view', reason: 'Guest EV travel factors already include driving electricity; on-site charging is kept in Scope 2 but excluded from the visitor-impact view.', kgAvoidedDoubleCount: genF ? kWh * genF.value : 0 });
    acc.push({
      id: `elec-${slug}`, activityId: `electricity-${slug}`, label: `Electricity — ${u.endUse}`, module: u.module, department: u.department, scope: 'S2', views,
      activity: kWh, activityUnit: 'kWh grid import', factorId: genF?.id, factorVersion: genF?.version, factorValue: genF?.value, factorUnit: genF?.unit, kg: sum(lb), kgMB: mbFactor == null ? null : kWh * mbFactor, monthly: lb,
      status: genF ? u.status : 'missing', stages: ['generation'], formula: u.offSite ? 'kWh charged off-site × grid factor' : 'end-use kWh × grid-import share (after PV self-consumption) × grid factor',
      inputs: { kWh: Math.round(kWh), solarSelfConsumption: sol.enabled ? 'applied' : 'none', mbFactor: mbFactor ?? 'n/a' },
    });
    if (upF) acc.push({ id: `elec-up-${slug}`, activityId: `electricity-upstream-${slug}`, label: `Electricity upstream & T&D — ${u.endUse}`, module: u.module, department: u.department, scope: 'S3', s3cat: 3, views: S3_VIEWS, activity: kWh, activityUnit: 'kWh grid import', factorId: upF.id, factorVersion: upF.version, factorValue: upF.value, factorUnit: upF.unit, kg: kWh * upF.value, monthly: imp.map((x) => x * upF.value), status: u.status, stages: upF.stages, formula: 'kWh × upstream factor', inputs: { kWh: Math.round(kWh) } });
  }
  // Electricity costs
  const totalImport = sum(solar.gridImport) + sum(elecUses.filter((u) => u.offSite).map((u) => sum(u.monthly)));
  if (totalImport > 0 || e.fixedPerYear > 0) {
    const unit = (1 - clamp01(e.offPeakShare)) * e.priceEnergyHP + clamp01(e.offPeakShare) * e.priceEnergyHC + e.networkVariablePerKWh + e.excisePerKWh;
    const importM = map12((m) => solar.gridImport[m] + sum(elecUses.filter((u) => u.offSite).map((u) => u.monthly[m])));
    acc.cost({ id: 'cost-electricity', label: `Electricity (${e.supplier})`, category: 'energy', department: 'Engineering & Building', fixed: e.fixedPerYear * (p.bnb ? share : 1), variable: totalImport * unit, vatRate: 0.2, monthly: importM.map((x) => x * unit + (e.fixedPerYear * (p.bnb ? share : 1)) / 12), status: calibration.electricity?.factors ? 'disaggregated' : 'modelled', notes: e.priceSourceNote });
  }
  if (sum(solar.exported) > 0) acc.cost({ id: 'pv-export', label: 'PV export revenue (purchase obligation)', category: 'revenue_offset', department: 'Engineering & Building', fixed: 0, variable: -sum(solar.exported) * sol.exportPricePerKWh, vatRate: 0, monthly: solar.exported.map((x) => -x * sol.exportPricePerKWh), status: 'modelled' });

  // ── Fuels & heat ──
  const f = p.fuels;
  for (const c of carriers) {
    if (c === 'electricity') continue;
    const uses = acc.energy.filter((u) => u.carrier === c);
    for (const u of uses) {
      const amt = sum(u.monthly);
      if (amt <= 0) continue;
      const slug = `${c}-${u.endUse.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`;
      if (c === 'district_heat') {
        const df = lib.factors['district_heat_demo'];
        acc.push({ id: `dh-${slug}`, activityId: `heat-${slug}`, label: `Purchased heat — ${u.endUse}`, module: u.module, department: u.department, scope: 'S2', views: S1S2_VIEWS, activity: amt, activityUnit: 'kWh', factorId: df.id, factorValue: df.value, factorUnit: df.unit, factorVersion: df.version, kg: amt * df.value, kgMB: amt * df.value, monthly: u.monthly.map((x) => x * df.value), status: u.status, stages: df.stages, formula: 'kWh × network factor', inputs: { kWh: Math.round(amt) } });
        continue;
      }
      const [comb, up] = COMBUSTION[c]!;
      const cf = acc.factor(comb);
      const uf = acc.factor(up);
      if (cf) {
        acc.push({ id: `s1-${slug}`, activityId: `fuel-${slug}`, label: `${c === 'natural_gas' ? 'Natural gas' : c.replace('_', ' ')} — ${u.endUse}`, module: u.module, department: u.department, scope: 'S1', views: S1S2_VIEWS, activity: amt, activityUnit: CARRIER_UNIT[c], factorId: cf.id, factorVersion: cf.version, factorValue: cf.value, factorUnit: cf.unit, kg: amt * cf.value, monthly: u.monthly.map((x) => x * cf.value), status: u.status, stages: cf.stages, formula: `${CARRIER_UNIT[c]} × combustion factor`, inputs: { amount: Math.round(amt) } });
        if (cf.biogenicCO2) acc.push({ id: `bio-${slug}`, activityId: `biogenic-${slug}`, label: `Biogenic CO2 (reported separately) — ${u.endUse}`, module: u.module, department: u.department, scope: 'OUT', views: [], activity: amt, activityUnit: CARRIER_UNIT[c], factorValue: cf.biogenicCO2, factorUnit: 'kg CO2 (biogenic)/kWh', kg: amt * cf.biogenicCO2, monthly: u.monthly.map((x) => x * cf.biogenicCO2!), status: u.status, stages: ['combustion'], formula: 'kWh × biogenic CO2 factor', inputs: {}, outsideInventoryReason: 'Biogenic CO2 from biomass combustion is reported outside the scopes (GHG Protocol).' });
      }
      if (uf) acc.push({ id: `up-${slug}`, activityId: `fuel-upstream-${slug}`, label: `Fuel upstream — ${u.endUse}`, module: u.module, department: u.department, scope: 'S3', s3cat: 3, views: S3_VIEWS, activity: amt, activityUnit: CARRIER_UNIT[c], factorId: uf.id, factorVersion: uf.version, factorValue: uf.value, factorUnit: uf.unit, kg: amt * uf.value, monthly: u.monthly.map((x) => x * uf.value), status: u.status, stages: uf.stages, formula: `${CARRIER_UNIT[c]} × upstream factor`, inputs: {} });
    }
    const total = map12((m) => sum(uses.map((u) => u.monthly[m])));
    const t = sum(total);
    const vstatus: DataStatus = calibration[c]?.factors ? 'disaggregated' : 'modelled';
    if (c === 'natural_gas') acc.cost({ id: 'cost-gas', label: 'Natural gas', category: 'energy', department: 'Engineering & Building', fixed: f.gasFixedPerYear * (p.bnb ? share : 1), variable: t * (f.gasPricePerKWh + f.gasExcisePerKWh), vatRate: 0.2, monthly: total.map((x) => x * (f.gasPricePerKWh + f.gasExcisePerKWh) + (f.gasFixedPerYear * (p.bnb ? share : 1)) / 12), status: vstatus });
    if (c === 'diesel') acc.cost({ id: 'cost-diesel', label: 'Diesel', category: 'fleet', department: 'Fleet & Logistics', fixed: 0, variable: t * f.dieselPerL, vatRate: 0.2, monthly: total.map((x) => x * f.dieselPerL), status: vstatus });
    if (c === 'petrol') acc.cost({ id: 'cost-petrol', label: 'Petrol', category: 'fleet', department: 'Fleet & Logistics', fixed: 0, variable: t * f.petrolPerL, vatRate: 0.2, monthly: total.map((x) => x * f.petrolPerL), status: vstatus });
    if (c === 'heating_oil') acc.cost({ id: 'cost-oil', label: 'Heating oil', category: 'energy', department: 'Engineering & Building', fixed: 0, variable: t * f.heatingOilPerL, vatRate: 0.2, monthly: total.map((x) => x * f.heatingOilPerL), status: vstatus });
    if (c === 'lpg') acc.cost({ id: 'cost-lpg', label: 'LPG', category: 'energy', department: 'Engineering & Building', fixed: 0, variable: t * f.lpgPerKg, vatRate: 0.2, monthly: total.map((x) => x * f.lpgPerKg), status: vstatus });
    if (c === 'wood_pellets') acc.cost({ id: 'cost-pellets', label: 'Wood pellets', category: 'energy', department: 'Engineering & Building', fixed: 0, variable: (t / 4800) * f.pelletsPerTonne, vatRate: 0.055, monthly: total.map((x) => (x / 4800) * f.pelletsPerTonne), status: vstatus });
    if (c === 'district_heat') acc.cost({ id: 'cost-dh', label: 'District heat', category: 'energy', department: 'Engineering & Building', fixed: 0, variable: t * f.districtHeatPerKWh, vatRate: 0.055, monthly: total.map((x) => x * f.districtHeatPerKWh), status: vstatus });
  }

  // ── Energy flow sets ──
  const energy: Record<string, FlowSet> = {};
  for (const c of new Set(acc.energy.map((u) => u.carrier))) {
    const uses = acc.energy.filter((u) => u.carrier === c);
    const endUses: Record<string, M12> = {};
    for (const u of uses) endUses[u.endUse] = (endUses[u.endUse] ?? zeros()).map((x, i) => x + u.monthly[i]);
    const total = map12((m) => sum(uses.map((u) => u.monthly[m])));
    energy[c] = { endUses, total, status: calibration[c]?.factors ? 'disaggregated' : 'modelled' };
  }
  return { energy, calibration, modelledBefore, solar };
}

/** Water: mains supply, rainwater substitution, wastewater billing basis and emissions. */
export function runWaterAccounting(acc: Acc, act: ActivityMetrics) {
  const p = acc.p;
  const w = p.water;
  // measured calibration
  const meas = p.measured.useMeasured ? p.measured.waterM3 : null;
  const modelled = acc.water.reduce((s, u) => s.map((x, i) => x + u.monthly[i]), zeros());
  if (meas && meas.some((x) => x != null)) {
    const f = map12((m) => (meas[m] == null || modelled[m] === 0 ? 1 : (meas[m] as number) / modelled[m]));
    for (const u of acc.water) { u.monthly = u.monthly.map((x, m) => x * f[m]); u.status = 'disaggregated'; }
  }
  const lossShare = Math.max(0, p.otherWater.waterTreatmentLossShare);
  const demand = acc.water.reduce((s, u) => s.map((x, i) => x + u.monthly[i]), zeros());
  const rainAvail = p.otherWater.rainwaterM3PerYear;
  const substitutable = acc.water.filter((u) => u.endUse === 'Irrigation' || u.endUse === 'Guest toilets');
  const subM = substitutable.reduce((s, u) => s.map((x, i) => x + u.monthly[i]), zeros());
  const rainUsed = map12((m) => (sum(subM) > 0 ? Math.min(subM[m], (rainAvail * subM[m]) / sum(subM)) : 0));
  const mains = map12((m) => Math.max(0, demand[m] - rainUsed[m]) * (1 + lossShare));
  const discharged = map12((m) => sum(acc.water.filter((u) => u.discharged).map((u) => u.monthly[m])));
  const irrigation = map12((m) => sum(acc.water.filter((u) => u.endUse === 'Irrigation').map((u) => u.monthly[m])));
  const billableWW = w.wastewaterBasis === 'all_metered' ? mains : w.wastewaterBasis === 'excluding_irrigation_submeter' ? map12((m) => Math.max(0, mains[m] - irrigation[m])) : zeros();
  const lib = acc.opt.library;
  const ws = lib.factors['water_supply'];
  const wt = lib.factors['wastewater_treatment'];
  const totalDemand = sum(demand);
  for (const u of acc.water) {
    const t = sum(u.monthly);
    if (t <= 0) continue;
    const mainsShare = map12((m) => (demand[m] > 0 ? mains[m] / demand[m] : 0));
    const um = u.monthly.map((x, m) => x * mainsShare[m]);
    const slug = u.endUse.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    acc.push({ id: `water-${slug}`, activityId: `water-supply-${slug}`, label: `Mains water — ${u.endUse}`, module: 'water', department: u.department, scope: 'S3', s3cat: 1, views: S3_VIEWS, activity: sum(um), activityUnit: 'm³', factorId: ws.id, factorVersion: ws.version, factorValue: ws.value, factorUnit: ws.unit, kg: sum(um) * ws.value, monthly: um.map((x) => x * ws.value), status: u.status, stages: ws.stages, formula: 'm³ mains × supply factor', inputs: { m3: Math.round(sum(um)) } });
    if (u.discharged && w.wastewaterBasis !== 'private_treatment') acc.push({ id: `ww-${slug}`, activityId: `wastewater-${slug}`, label: `Wastewater treatment — ${u.endUse}`, module: 'water', department: u.department, scope: 'S3', s3cat: 5, views: S3_VIEWS, activity: t, activityUnit: 'm³ discharged', factorId: wt.id, factorVersion: wt.version, factorValue: wt.value, factorUnit: wt.unit, kg: t * wt.value, monthly: u.monthly.map((x) => x * wt.value), status: u.status, stages: wt.stages, formula: 'm³ discharged × treatment factor', inputs: { m3: Math.round(t) } });
  }
  const potable = sum(mains) * w.potablePerM3;
  const ww = sum(billableWW) * w.wastewaterPerM3;
  if (totalDemand > 0) acc.cost({ id: 'cost-water', label: 'Water & wastewater', category: 'water', department: 'Engineering & Building', fixed: w.fixedPerYear, variable: potable + ww, vatRate: 0.075, monthly: map12((m) => mains[m] * w.potablePerM3 + billableWW[m] * w.wastewaterPerM3 + w.fixedPerYear / 12), status: meas ? 'disaggregated' : 'modelled', notes: `Wastewater billing basis: ${w.wastewaterBasis.replace(/_/g, ' ')}` });
  if (p.constraints.waterAvailabilityM3 != null && sum(mains) > p.constraints.waterAvailabilityM3) acc.warn('warn', 'water availability', `Mains water ${Math.round(sum(mains))} m³ exceeds the declared availability limit of ${p.constraints.waterAvailabilityM3} m³.`);
  const endUses: Record<string, M12> = {};
  for (const u of acc.water) endUses[u.endUse] = (endUses[u.endUse] ?? zeros()).map((x, i) => x + u.monthly[i]);
  return { endUses, total: demand, status: (meas ? 'disaggregated' : 'modelled') as DataStatus, dischargedToSewer: discharged, mainsM3: mains };
}
