import type { CapexItem, Library, PropertyInputs } from '../types';
import { deepClone } from '../engine/util';

export interface Preset {
  id: string;
  label: string;
  description: string;
  mechanisms: string[];
  applicable: (p: PropertyInputs) => boolean;
  apply: (p: PropertyInputs, year: number) => PropertyInputs;
}

const capex = (id: string, label: string, amountEUR: number, year: number, embodiedKg: number, lifeYears: number, category: string): CapexItem => ({ id: `${id}-${Math.random().toString(36).slice(2, 7)}`, label, amountEUR: Math.round(amountEUR), year, embodiedKg, lifeYears, category, interventionId: id });
const rooms = (p: PropertyInputs) => p.activity.roomTypes.reduce((s, r) => s + r.count, 0);

const LED_EQUIV: Record<string, (w: number) => number> = { halogen: (w) => Math.max(3, Math.round(w / 7)), incandescent: (w) => Math.max(3, Math.round(w / 8)), cfl: (w) => Math.max(3, Math.round(w * 0.6)), fluorescent_t8: (w) => Math.round(w * 0.45), led: (w) => w };

export const PRESETS: Preset[] = [
  {
    id: 'led-retrofit', label: 'LED retrofit (all non-LED zones)', description: 'Replace halogen/fluorescent lamps with LED of similar lumen output, immediately.',
    mechanisms: ['Lighting electricity', 'Internal heat gains (heating ↑ / cooling ↓)', 'Lamp purchases & maintenance', 'Upfront embodied emissions'],
    applicable: (p) => p.lighting.some((z) => z.tech !== 'led'),
    apply: (p0, year) => {
      const p = deepClone(p0);
      let lamps = 0;
      p.lighting = p.lighting.map((z) => {
        if (z.tech === 'led') return z;
        const n = z.luminaires * z.lampsPerLuminaire;
        lamps += n;
        return { ...z, tech: 'led', wattsPerLamp: LED_EQUIV[z.tech](z.wattsPerLamp), driverWPerLuminaire: z.tech === 'fluorescent_t8' ? 2 : 0, ratedLifeHours: 25000, lampPriceEUR: 6.5, embodiedKgPerLamp: 0.4 };
      });
      p.capex.push(capex('led-retrofit', `LED retrofit (${lamps} lamps)`, lamps * 9.5, year, lamps * 0.4, 12, 'Lighting'));
      return p;
    },
  },
  {
    id: 'lighting-controls', label: 'Occupancy & daylight controls', description: 'Add sensors in corridors, back-of-house, meeting rooms and offices (25 % on-time reduction — replace with site survey).',
    mechanisms: ['Lighting electricity', 'Internal gains'],
    applicable: (p) => p.lighting.some((z) => /corridor|office|meeting|back|laundry|kitchen/i.test(z.name)),
    apply: (p0, year) => {
      const p = deepClone(p0);
      let n = 0;
      p.lighting = p.lighting.map((z) => (/corridor|office|meeting|back|laundry/i.test(z.name) ? ((n += z.luminaires), { ...z, controlSaving: Math.max(z.controlSaving, 0.25) }) : z));
      p.capex.push(capex('lighting-controls', `Lighting controls (${n} luminaires)`, n * 60, year, n * 0.3, 12, 'Lighting'));
      return p;
    },
  },
  {
    id: 'towel-size', label: 'Bath towel size optimisation', description: 'Bath towel 140×70 cm → 130×65 cm and 500 → 450 g/m² when replaced (no early scrapping).',
    mechanisms: ['Towel mass', 'Laundry kg, loads, water, energy, detergent', 'Textile procurement'],
    applicable: (p) => p.textiles.some((t) => t.id === 'bath-towel'),
    apply: (p0) => {
      const p = deepClone(p0);
      p.textiles = p.textiles.map((t) => (t.id === 'bath-towel' ? { ...t, lengthCm: Math.min(t.lengthCm, 130), widthCm: Math.min(t.widthCm, 65), gsm: t.gsm != null ? Math.min(t.gsm, 450) : t.gsm, massModel: 'rectangle', unitCostEUR: t.unitCostEUR * 0.85 } : t));
      return p;
    },
  },
  {
    id: 'towel-reuse', label: 'Longer towel reuse', description: 'Towels changed every 2 nights on stayovers with a guest reuse programme (60 % realised).',
    mechanisms: ['Pieces washed', 'Laundry kg & energy', 'Textile wear'],
    applicable: (p) => p.textiles.some((t) => /towel|mat/i.test(t.name) && t.basis !== 'per_pool_visit'),
    apply: (p0) => {
      const p = deepClone(p0);
      p.textiles = p.textiles.map((t) => (/towel|mat|face/i.test(t.name) && ['per_guest', 'per_room', 'per_bed'].includes(t.basis) ? { ...t, stayoverIntervalNights: Math.max(2, t.stayoverIntervalNights), reuseParticipation: Math.max(0.6, t.reuseParticipation) } : t));
      return p;
    },
  },
  {
    id: 'bed-linen', label: 'Bed-linen change every 4 nights', description: 'Stayover bed-linen interval raised to 4 nights (departure changes unchanged).',
    mechanisms: ['Pieces washed', 'Outsourced/in-house laundry kg'],
    applicable: (p) => p.textiles.some((t) => /sheet|duvet cover|pillowcase/i.test(t.name)),
    apply: (p0) => {
      const p = deepClone(p0);
      p.textiles = p.textiles.map((t) => (/sheet|duvet cover|pillowcase/i.test(t.name) && t.stayoverIntervalNights > 0 ? { ...t, stayoverIntervalNights: Math.max(4, t.stayoverIntervalNights) } : t));
      return p;
    },
  },
  {
    id: 'low-flow', label: 'Low-flow shower heads (7.5 L/min)', description: 'Fit low-flow heads in all guest bathrooms; includes a 5 % rebound in shower duration.',
    mechanisms: ['Shower water', 'Hot-water thermal demand', 'Wastewater', 'Heating fuel/electricity'],
    applicable: (p) => p.bathrooms.lowFlowUptake < 1,
    apply: (p0, year) => {
      const p = deepClone(p0);
      p.bathrooms.lowFlowUptake = 1;
      p.bathrooms.lowFlowShowerLPerMin = 7.5;
      p.capex.push(capex('low-flow', `Low-flow shower heads (${rooms(p)})`, rooms(p) * 45, year, rooms(p) * 1.5, 8, 'Water'));
      return p;
    },
  },
  {
    id: 'leak-repair', label: 'Leak detection & repair', description: 'Repair leaks (80 % reduction of estimated leakage).',
    mechanisms: ['Water & wastewater'],
    applicable: (p) => p.bathrooms.leakM3PerDay > 0,
    apply: (p0, year) => {
      const p = deepClone(p0);
      p.bathrooms.leakM3PerDay *= 0.2;
      p.capex.push(capex('leak-repair', 'Leak survey & repairs', Math.max(500, rooms(p) * 20), year, 0, 5, 'Water'));
      return p;
    },
  },
  {
    id: 'heat-pump', label: 'Heat-pump retrofit (space heating & DHW)', description: 'Replace fossil boilers with air-to-water heat pumps (temperature-dependent COP, 5 % electric backup). Gas/oil fixed charges remain unless the contract is terminated.',
    mechanisms: ['Fuel → electricity', 'Scope 1 → Scope 2', 'Refrigerant charge', 'Upfront embodied emissions'],
    applicable: (p) => p.building.heating.tech !== 'heat_pump',
    apply: (p0, year) => {
      const p = deepClone(p0);
      const b = p.building;
      const H = b.wallU * b.wallAreaM2 + b.roofU * b.roofAreaM2 + 0.5 * b.floorU * b.floorAreaM2 + b.windowU * b.windowAreaM2 + 0.34 * (b.mechVentilationM3h * (1 - b.heatRecoveryEff) + b.infiltrationACH * b.volumeM3);
      const kW = Math.max(5, Math.round((H * (b.heatingSetpointC + 5)) / 1000 * 1.2));
      b.heating = { ...b.heating, tech: 'heat_pump', scop: 3.0, copModel: 'temperature', carnotFraction: 0.45, supplyTempC: 50, backupResistanceShare: 0.05, defrostAllowance: 0.03 };
      if (p.dhw.sameAsSpaceHeating || ['gas_boiler', 'oil_boiler', 'lpg_boiler'].includes(p.dhw.system.tech)) {
        p.dhw.sameAsSpaceHeating = false;
        p.dhw.system = { ...p.dhw.system, tech: 'heat_pump', scop: 2.6, copModel: 'temperature', carnotFraction: 0.42, supplyTempC: 62, backupResistanceShare: 0.1 };
      }
      p.refrigerants.push({ id: `hp-${year}`, name: 'New heat pumps', refrigerant: 'R-32', chargeKg: Math.round(kW * 0.25), annualLeakRate: 0.03, measuredTopUpKg: null, retiredThisYear: false, recoveryEfficiency: 0.9, serviceCostEURPerYear: Math.round(kW * 8) });
      p.capex.push(capex('heat-pump', `Heat pumps (${kW} kW thermal)`, kW * 1100, year, kW * 60, 18, 'HVAC'));
      return p;
    },
  },
  {
    id: 'heat-recovery', label: 'Ventilation & drain-water heat recovery', description: 'Raise ventilation heat recovery to 80 % (where mechanical ventilation exists) and recover 15 % of DHW demand.',
    mechanisms: ['Ventilation heat loss', 'DHW thermal demand'],
    applicable: () => true,
    apply: (p0, year) => {
      const p = deepClone(p0);
      const hasMV = p.building.mechVentilationM3h > 0;
      if (hasMV) p.building.heatRecoveryEff = Math.max(p.building.heatRecoveryEff, 0.8);
      p.dhw.heatRecoveryShare = Math.max(p.dhw.heatRecoveryShare, 0.15);
      p.capex.push(capex('heat-recovery', 'Heat recovery equipment', (hasMV ? p.building.mechVentilationM3h * 2 : 0) + rooms(p) * 120, year, (hasMV ? p.building.mechVentilationM3h * 0.05 : 0) + rooms(p) * 5, 20, 'HVAC'));
      return p;
    },
  },
  {
    id: 'pool-cover', label: 'Pool covers (12 h/day)', description: 'Use pool covers outside opening hours.',
    mechanisms: ['Evaporation', 'Pool heating', 'Make-up water', 'Dehumidification'],
    applicable: (p) => p.pools.some((x) => !x.coverUsed),
    apply: (p0, year) => {
      const p = deepClone(p0);
      let area = 0;
      p.pools = p.pools.map((x) => (x.coverUsed ? x : ((area += x.areaM2), { ...x, coverUsed: true, coverHoursPerDay: 12, coverEvapReduction: 0.8 })));
      p.capex.push(capex('pool-cover', 'Pool covers', area * 90, year, area * 8, 10, 'Pool'));
      return p;
    },
  },
  {
    id: 'laundry-optimisation', label: 'In-house laundry optimisation', description: 'Fuller loads (95 %), low-temperature chemistry (−20 % wash heat, subject to hygiene validation), 20 % heat recovery.',
    mechanisms: ['Loads', 'Wash heat', 'Water per kg'],
    applicable: (p) => p.textiles.some((t) => t.stream === 'in_house'),
    apply: (p0, year) => {
      const p = deepClone(p0);
      const L = p.inHouseLaundry;
      L.loadFactor = Math.max(L.loadFactor, 0.95);
      L.thermalKWhPerCycle *= 0.8;
      L.heatRecoveryShare = Math.max(L.heatRecoveryShare, 0.2);
      p.capex.push(capex('laundry-optimisation', 'Laundry heat recovery & dosing', p.inHouseLaundry.machineCapacityKg > 20 ? 15000 : 300, year, 200, 12, 'Laundry'));
      return p;
    },
  },
  {
    id: 'laundry-outsource', label: 'Outsource all laundry', description: 'Send all textile streams to the outsourced laundry (emissions move to Scope 3 cat. 1; they do not disappear).',
    mechanisms: ['Boundary shift: Scope 1/2 → Scope 3', 'Laundry cost', 'Collection transport'],
    applicable: (p) => p.textiles.some((t) => t.stream === 'in_house'),
    apply: (p0) => {
      const p = deepClone(p0);
      p.textiles = p.textiles.map((t) => ({ ...t, stream: 'outsourced' }));
      if (p.outsourcedLaundry.factorKgPerKg == null) p.outsourcedLaundry.factorKgPerKg = null; // stays missing — not assumed zero
      return p;
    },
  },
  {
    id: 'laundry-insource', label: 'Bring all laundry in-house', description: 'Wash every textile stream on site.',
    mechanisms: ['Boundary shift: Scope 3 → Scope 1/2', 'Water, energy, detergent on site'],
    applicable: (p) => p.textiles.some((t) => t.stream === 'outsourced'),
    apply: (p0, year) => {
      const p = deepClone(p0);
      p.textiles = p.textiles.map((t) => ({ ...t, stream: 'in_house' }));
      p.capex.push(capex('laundry-insource', 'Additional laundry equipment', 80000, year, 4000, 12, 'Laundry'));
      return p;
    },
  },
  {
    id: 'menu', label: 'Menu change (more plant-based, less beef)', description: 'Vegetarian uptake +25 points; half of beef in standard dishes replaced by poultry.',
    mechanisms: ['Food procurement (Scope 3 cat. 1)', 'Food cost'],
    applicable: (p) => p.boundary.restaurantsIncluded,
    apply: (p0) => {
      const p = deepClone(p0);
      p.food.vegetarianUptake = Math.min(1, p.food.vegetarianUptake + 0.25);
      const beef = p.food.mainStandardBasket.beef ?? 0;
      p.food.mainStandardBasket.beef = beef / 2;
      p.food.mainStandardBasket.poultry = (p.food.mainStandardBasket.poultry ?? 0) + beef / 2;
      return p;
    },
  },
  {
    id: 'food-waste', label: 'Food-waste prevention', description: 'Halve overproduction, plate waste −30 %, donate 50 % of remaining surplus.',
    mechanisms: ['Purchased food', 'Food-waste treatment'],
    applicable: (p) => p.boundary.restaurantsIncluded,
    apply: (p0, year) => {
      const p = deepClone(p0);
      p.food.overproductionShare *= 0.5;
      p.food.plateWasteShare *= 0.7;
      p.food.donationShareOfOverproduction = Math.max(0.5, p.food.donationShareOfOverproduction);
      p.capex.push(capex('food-waste', 'Waste tracking scales & training', rooms(p) > 20 ? 6000 : 100, year, 50, 5, 'F&B'));
      return p;
    },
  },
  {
    id: 'refill-amenities', label: 'Refillable amenities', description: 'Replace single-use shampoo, conditioner, gel and lotion with wall dispensers.',
    mechanisms: ['Amenity purchases', 'Packaging waste', 'Dispenser embodied (capital)'],
    applicable: (p) => p.amenities.some((a) => a.refillable && !a.enabled),
    apply: (p0, year) => {
      const p = deepClone(p0);
      let disp = 0;
      p.amenities = p.amenities.map((a) => {
        if (a.refillable) { disp += a.dispenserCount; return { ...a, enabled: true }; }
        if (/shampoo|conditioner|gel|lotion/i.test(a.name)) return { ...a, enabled: false };
        return a;
      });
      const r = p.amenities.find((a) => a.refillable);
      p.capex.push(capex('refill-amenities', `Dispensers (${disp})`, disp * (r?.dispenserPriceEUR ?? 25), year, 0, r?.dispenserLifeYears ?? 5, 'Amenities'));
      return p;
    },
  },
  {
    id: 'fleet-ev', label: 'Fleet electrification (at replacement)', description: 'Replace diesel/petrol road vehicles with battery-electric equivalents in the implementation year (manufacturing emissions counted).',
    mechanisms: ['Fuel → electricity', 'Vehicle embodied emissions (acquisition year)', 'Maintenance'],
    applicable: (p) => p.vehicles.some((v) => ['diesel', 'petrol'].includes(v.powertrain)),
    apply: (p0, year) => {
      const p = deepClone(p0);
      p.vehicles = p.vehicles.map((v) => {
        if (!['diesel', 'petrol'].includes(v.powertrain) || v.purchaseCostEUR === 0) return v;
        const van = v.role === 'guest_shuttle' || v.role === 'delivery_van' || v.role === 'grounds';
        p.capex.push(capex('fleet-ev', `Electric replacement — ${v.name}`, (van ? 70000 : 55000) * v.count, year, 0, 8, 'Fleet'));
        return { ...v, replacement: { year, powertrain: 'bev', fuelLPer100Km: 0, kWhPer100Km: van ? 24 : 18, purchaseCostEUR: van ? 70000 : 55000, embodiedKg: van ? 14000 : 11000, maintenanceEURPerYear: v.maintenanceEURPerYear * 0.7 } };
      });
      return p;
    },
  },
  {
    id: 'commuting', label: 'Staff commuting programme', description: 'Shift 30 % of car commuting to public transport/cycling (transit pass, bike scheme).',
    mechanisms: ['Scope 3 cat. 7'],
    applicable: (p) => p.commuting.modes.car > 0,
    apply: (p0) => {
      const p = deepClone(p0);
      const m = p.commuting.modes;
      const shift = m.car * 0.3;
      m.car -= shift;
      m.train += shift * 0.5;
      m.bike_walk += shift * 0.5;
      return p;
    },
  },
  {
    id: 'delivery-consolidation', label: 'Delivery consolidation', description: 'Halve the number of dedicated-vehicle deliveries (same mass, larger drops).',
    mechanisms: ['Scope 3 cat. 4 vehicle-km', 'Delivery fees'],
    applicable: (p) => p.deliveries.some((d) => d.method === 'dedicated_vehicle' || d.costPerDeliveryEUR > 0),
    apply: (p0) => {
      const p = deepClone(p0);
      p.deliveries = p.deliveries.map((d) => ({ ...d, deliveriesPerYear: Math.ceil(d.deliveriesPerYear / 2), kgPerDelivery: d.kgPerDelivery * 2 }));
      return p;
    },
  },
  {
    id: 'solar', label: 'Rooftop solar PV', description: 'Install PV on the available roof area (capped at 100 kWp; surplus sold at the purchase-obligation tariff).',
    mechanisms: ['Grid import', 'Scope 2', 'Export revenue', 'PV embodied (capital goods)'],
    applicable: (p) => (p.constraints.roofAreaM2 ?? p.solar.roofAreaM2Available) > 10,
    apply: (p0, year) => {
      const p = deepClone(p0);
      const roof = p.constraints.roofAreaM2 ?? p.solar.roofAreaM2Available;
      const add = Math.min(100 - (p.solar.enabled ? p.solar.kWp : 0), roof / p.solar.m2PerKWp - (p.solar.enabled ? p.solar.kWp : 0));
      if (add <= 0) return p;
      p.solar = { ...p.solar, enabled: true, kWp: Math.round(((p.solar.enabled ? p.solar.kWp : 0) + add) * 10) / 10 };
      p.capex.push(capex('solar', `PV ${add.toFixed(1)} kWp`, add * 1200, year, add * 700, 25, 'Energy'));
      return p;
    },
  },
  {
    id: 'refrigerant', label: 'Low-GWP refrigerant replacement', description: 'Replace R-404A / R-410A systems with CO2 (R-744) or propane (R-290) units at end of life; old charge recovered.',
    mechanisms: ['Scope 1 refrigerant leakage', 'End-of-life recovery losses'],
    applicable: (p) => p.refrigerants.some((r) => ['R-404A', 'R-410A'].includes(r.refrigerant)),
    apply: (p0, year) => {
      const p = deepClone(p0);
      const out: typeof p.refrigerants = [];
      for (const r of p.refrigerants) {
        if (!['R-404A', 'R-410A'].includes(r.refrigerant)) { out.push(r); continue; }
        out.push({ ...r, id: `${r.id}-old`, name: `${r.name} (retired ${year})`, annualLeakRate: 0, measuredTopUpKg: 0, retiredThisYear: false, retirementYear: year });
        out.push({ ...r, id: `${r.id}-new`, name: `${r.name} (new, ${r.refrigerant === 'R-404A' ? 'R-744' : 'R-290'})`, refrigerant: r.refrigerant === 'R-404A' ? 'R-744' : 'R-290', chargeKg: r.refrigerant === 'R-404A' ? r.chargeKg : r.chargeKg * 0.4, measuredTopUpKg: null, annualLeakRate: 0.08 });
        p.capex.push(capex('refrigerant', `Replace ${r.name}`, r.chargeKg * 900, year, r.chargeKg * 25, 15, 'Refrigeration'));
      }
      p.refrigerants = out;
      return p;
    },
  },
  {
    id: 'life-extension', label: 'Equipment & textile life extension', description: 'Repair/refurbishment: +3 years for furniture & electronics, +20 % wash-cycle life for textiles.',
    mechanisms: ['Replacement frequency (future purchases)', 'Annualised embodied indicator (LCA view)'],
    applicable: () => true,
    apply: (p0) => {
      const p = deepClone(p0);
      p.assets = p.assets.map((a) => (/furniture|electronics|appliances/i.test(a.category) ? { ...a, usefulLifeYears: a.usefulLifeYears + 3 } : a));
      p.textiles = p.textiles.map((t) => ({ ...t, lifeWashCycles: Math.round(t.lifeWashCycles * 1.2) }));
      return p;
    },
  },
  {
    id: 'setpoint', label: 'Heating setpoint −1 °C (within comfort limit)', description: 'Lower the heating setpoint by 1 °C, never below the comfort constraint.',
    mechanisms: ['Degree-day balance point', 'Heating energy'],
    applicable: (p) => p.building.heatingSetpointC - 1 >= p.constraints.minHeatingSetpointC,
    apply: (p0) => {
      const p = deepClone(p0);
      p.building.heatingSetpointC = Math.max(p.constraints.minHeatingSetpointC, p.building.heatingSetpointC - 1);
      return p;
    },
  },
];

export const PRESET_MAP = Object.fromEntries(PRESETS.map((x) => [x.id, x]));

export type { Library };
