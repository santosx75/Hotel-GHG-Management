import type { DataStatus, PropertyId } from '../types';

/**
 * Central parameter registry. `id` is the input path; `[]` matches any array index.
 * Units are canonical; percentages are stored as fractions (0–1) and displayed ×100.
 */
export interface ParamDef {
  id: string;
  name: string;
  category: string;
  subcategory: string;
  definition: string;
  unit: string;
  type: 'number' | 'percent' | 'select' | 'boolean' | 'text' | 'month12' | 'percent12';
  min?: number;
  max?: number;
  step?: number;
  options?: { value: string; label: string }[];
  appliesTo: PropertyId[] | 'all';
  sourceId: string;
  defaultOrigin: DataStatus; // how the seeded value was obtained
  confidence: 'low' | 'medium' | 'high';
  editable: boolean;
  modelLink: string;
  scopeMapping: string;
  role: 'input' | 'intermediate' | 'output';
  dependencies?: string[];
  relRange?: [number, number]; // low/high multipliers for uncertainty
}

const ALL = 'all' as const;
const P = (id: string, name: string, unit: string, type: ParamDef['type'], cat: string, sub: string, o: Partial<ParamDef> = {}): ParamDef => ({
  id, name, unit, type, category: cat, subcategory: sub, definition: o.definition ?? name, appliesTo: ALL, sourceId: 'demo', defaultOrigin: 'assumed', confidence: 'low', editable: true,
  modelLink: o.modelLink ?? cat, scopeMapping: o.scopeMapping ?? '—', role: 'input', min: type === 'percent' || type === 'percent12' ? 0 : o.min ?? 0, max: type === 'percent' || type === 'percent12' ? 1 : o.max, step: o.step ?? (type === 'percent' ? 0.01 : 1), ...o,
});

export const REGISTRY: ParamDef[] = [
  // Activity
  P('activity.roomTypes[].count', 'Rooms of this type', 'rooms', 'number', 'Activity', 'Rooms', { max: 2000, modelLink: 'engine/activity', definition: 'Number of lettable rooms of this type.' }),
  P('activity.roomTypes[].areaM2', 'Room area', 'm²', 'number', 'Activity', 'Rooms', { max: 500 }),
  P('activity.roomTypes[].beds', 'Beds per room', 'beds', 'number', 'Activity', 'Rooms', { max: 10 }),
  P('activity.roomTypes[].maxGuests', 'Maximum occupancy', 'guests', 'number', 'Activity', 'Rooms', { max: 20 }),
  P('activity.roomTypes[].guestsPerOccupiedRoom', 'Guests per occupied room', 'guests', 'number', 'Activity', 'Rooms', { max: 20, step: 0.1, relRange: [0.9, 1.1] }),
  P('activity.roomTypes[].occupancyIndex', 'Occupancy index vs reference', '×', 'number', 'Activity', 'Rooms', { max: 2, step: 0.01 }),
  P('activity.monthlyOpenDays', 'Open days per month', 'days', 'month12', 'Activity', 'Calendar', { max: 31 }),
  P('activity.monthlyOccupancy', 'Reference occupancy per month', '%', 'percent12', 'Activity', 'Calendar', { relRange: [0.85, 1.15] }),
  P('activity.avgLengthOfStayNights', 'Average length of stay', 'nights', 'number', 'Activity', 'Guests', { min: 1, max: 60, step: 0.1, definition: 'Average nights per room-stay; stays = occupied room-nights ÷ length of stay (steady-state approximation).' }),
  P('activity.outOfOrderRate', 'Out-of-order rooms', '%', 'percent', 'Activity', 'Rooms'),
  P('activity.dayUseRoomsPerYear', 'Day-use rooms', 'rooms/yr', 'number', 'Activity', 'Rooms', { max: 100000 }),
  P('activity.staffHeadcount', 'Staff headcount', 'people', 'number', 'Activity', 'Staff', { max: 5000 }),
  P('activity.staffFTE', 'Full-time equivalents', 'FTE', 'number', 'Activity', 'Staff', { max: 5000, step: 0.1 }),
  P('activity.workingDaysPerFTE', 'Working days per FTE', 'days/yr', 'number', 'Activity', 'Staff', { max: 366 }),
  P('activity.staffAccommodationBeds', 'Staff accommodation beds', 'beds', 'number', 'Activity', 'Staff', { max: 1000 }),
  P('activity.publicAreaM2', 'Public floor area', 'm²', 'number', 'Activity', 'Areas', { max: 100000 }),
  P('activity.backOfHouseM2', 'Back-of-house area', 'm²', 'number', 'Activity', 'Areas', { max: 100000 }),
  P('activity.meetingAreaM2', 'Meeting & event area', 'm²', 'number', 'Activity', 'Areas', { max: 50000, definition: 'Used for the HCMI-aligned rooms/meeting allocation.' }),
  P('activity.breakfastUptake', 'Breakfast uptake', '% of guest-nights', 'percent', 'Activity', 'F&B covers'),
  P('activity.dinnerUptake', 'Dinner/lunch uptake (in-house guests)', '% of guest-nights', 'percent', 'Activity', 'F&B covers'),
  P('activity.externalCoversPerOpenDay', 'External restaurant covers', 'covers/day', 'number', 'Activity', 'F&B covers', { max: 5000 }),
  P('activity.roomServiceOrdersPerOccRoomNight', 'Room-service orders', 'per occupied room-night', 'number', 'Activity', 'F&B covers', { max: 5, step: 0.01 }),
  P('activity.barCustomersPerOpenDay', 'Bar customers', 'per day', 'number', 'Activity', 'F&B covers', { max: 5000 }),
  P('activity.eventAttendeesPerYear', 'Event attendees', 'per year', 'number', 'Activity', 'Events', { max: 1e6 }),
  P('activity.meetingRoomHoursPerYear', 'Meeting-room hours', 'h/yr', 'number', 'Activity', 'Events', { max: 1e6 }),
  P('activity.spaDayVisitorsPerYear', 'Spa day visitors (external)', 'per year', 'number', 'Activity', 'Leisure', { max: 1e6 }),
  P('activity.poolDayVisitorsPerYear', 'Pool day visitors (external)', 'per year', 'number', 'Activity', 'Leisure', { max: 1e6 }),
  P('activity.staffMealsPerFTEDay', 'Staff meals', 'per FTE-day', 'number', 'Activity', 'Staff', { max: 3, step: 0.1 }),
  // Building
  P('building.conditionedAreaM2', 'Heated/cooled floor area', 'm²', 'number', 'Building & HVAC', 'Envelope', { max: 200000 }),
  P('building.volumeM3', 'Heated volume', 'm³', 'number', 'Building & HVAC', 'Envelope', { max: 1e6 }),
  P('building.wallAreaM2', 'External wall area', 'm²', 'number', 'Building & HVAC', 'Envelope', { max: 200000 }),
  P('building.wallU', 'Wall U-value', 'W/m²·K', 'number', 'Building & HVAC', 'Envelope', { max: 5, step: 0.05, relRange: [0.8, 1.2] }),
  P('building.roofAreaM2', 'Roof area', 'm²', 'number', 'Building & HVAC', 'Envelope', { max: 100000 }),
  P('building.roofU', 'Roof U-value', 'W/m²·K', 'number', 'Building & HVAC', 'Envelope', { max: 5, step: 0.05 }),
  P('building.floorAreaM2', 'Ground floor area', 'm²', 'number', 'Building & HVAC', 'Envelope', { max: 100000 }),
  P('building.floorU', 'Ground floor U-value', 'W/m²·K', 'number', 'Building & HVAC', 'Envelope', { max: 5, step: 0.05 }),
  P('building.windowAreaM2', 'Window area', 'm²', 'number', 'Building & HVAC', 'Envelope', { max: 50000 }),
  P('building.windowU', 'Window U-value', 'W/m²·K', 'number', 'Building & HVAC', 'Envelope', { max: 6, step: 0.1 }),
  P('building.glazingG', 'Glazing solar factor (g)', 'fraction', 'percent', 'Building & HVAC', 'Envelope'),
  P('building.shadingFactor', 'Share of solar gain admitted (shading)', 'fraction', 'percent', 'Building & HVAC', 'Envelope'),
  P('building.infiltrationACH', 'Air leakage (infiltration)', 'ach', 'number', 'Building & HVAC', 'Ventilation', { max: 5, step: 0.05 }),
  P('building.mechVentilationM3h', 'Mechanical ventilation rate', 'm³/h', 'number', 'Building & HVAC', 'Ventilation', { max: 500000, step: 100 }),
  P('building.requiredVentilationM3h', 'Required ventilation (IAQ minimum)', 'm³/h', 'number', 'Building & HVAC', 'Ventilation', { max: 500000, step: 100 }),
  P('building.heatRecoveryEff', 'Ventilation heat-recovery efficiency', '%', 'percent', 'Building & HVAC', 'Ventilation'),
  P('building.heatingSetpointC', 'Heating setpoint', '°C', 'number', 'Building & HVAC', 'Controls', { min: 5, max: 26, step: 0.5, relRange: [0.95, 1.05] }),
  P('building.coolingSetpointC', 'Cooling setpoint', '°C', 'number', 'Building & HVAC', 'Controls', { min: 18, max: 30, step: 0.5 }),
  P('building.unoccupiedSetbackK', 'Setback in unsold/unoccupied rooms', 'K', 'number', 'Building & HVAC', 'Controls', { max: 10, step: 0.5 }),
  P('building.preconditioningHours', 'Pre-conditioning before arrival', 'h', 'number', 'Building & HVAC', 'Controls', { max: 24, step: 0.5 }),
  P('building.windowOpeningExtraACH', 'Extra air change from opened windows (occupied rooms)', 'ach', 'number', 'Building & HVAC', 'Controls', { max: 3, step: 0.05 }),
  P('building.closedFrostSetpointC', 'Closed-period setpoint (frost protection)', '°C', 'number', 'Building & HVAC', 'Controls', { min: 0, max: 20, step: 0.5 }),
  P('building.heating.seasonalEfficiency', 'Boiler seasonal efficiency', 'fraction (PCS basis for gas)', 'percent', 'Building & HVAC', 'Heating system'),
  P('building.heating.scop', 'Heat-pump seasonal COP (SCOP)', '–', 'number', 'Building & HVAC', 'Heating system', { min: 1, max: 7, step: 0.1, relRange: [0.85, 1.15] }),
  P('building.heating.carnotFraction', 'Heat-pump Carnot efficiency fraction', '–', 'number', 'Building & HVAC', 'Heating system', { min: 0.2, max: 0.7, step: 0.01 }),
  P('building.heating.supplyTempC', 'Heating supply temperature', '°C', 'number', 'Building & HVAC', 'Heating system', { min: 25, max: 90 }),
  P('building.heating.backupResistanceShare', 'Electric backup share', '%', 'percent', 'Building & HVAC', 'Heating system'),
  P('building.heating.defrostAllowance', 'Defrost allowance', '%', 'percent', 'Building & HVAC', 'Heating system'),
  P('building.heating.distributionLoss', 'Distribution losses', '%', 'percent', 'Building & HVAC', 'Heating system'),
  P('building.coolingSEER', 'Cooling seasonal efficiency (SEER)', '–', 'number', 'Building & HVAC', 'Cooling', { min: 1, max: 10, step: 0.1 }),
  P('building.fanPumpPowerKW', 'Fan & pump power', 'kW', 'number', 'Building & HVAC', 'Auxiliaries', { max: 2000 }),
  P('building.fanPumpHoursPerOpenDay', 'Fan & pump hours', 'h/day', 'number', 'Building & HVAC', 'Auxiliaries', { max: 24 }),
  P('building.variableSpeedSaving', 'Variable-speed drive saving', '%', 'percent', 'Building & HVAC', 'Auxiliaries'),
  P('building.plugLoadWPerM2', 'Plug & equipment loads', 'W/m²', 'number', 'Building & HVAC', 'Electrical', { max: 100, step: 0.5 }),
  P('building.plugLoadHoursPerDay', 'Plug-load hours', 'h/day', 'number', 'Building & HVAC', 'Electrical', { max: 24 }),
  P('building.baseLoadKW', 'Continuous base load', 'kW', 'number', 'Building & HVAC', 'Electrical', { max: 5000, step: 0.05 }),
  P('building.otherElectricKWhPerOccRoomNight', 'In-room devices', 'kWh/occupied room-night', 'number', 'Building & HVAC', 'Electrical', { max: 20, step: 0.1 }),
  P('building.guestPresenceShare', 'Share of day guests are in the room', '%', 'percent', 'Building & HVAC', 'Gains'),
  // DHW
  P('dhw.storageTempC', 'Hot-water production/storage temperature', '°C', 'number', 'Hot water', 'Generation', { min: 40, max: 80, definition: '≥55 °C at production outlet (Legionella order, ERP).', sourceId: 'legionella-2010' }),
  P('dhw.loopReturnTempC', 'Loop return temperature', '°C', 'number', 'Hot water', 'Distribution', { min: 30, max: 80, sourceId: 'legionella-2010' }),
  P('dhw.showerMixTempC', 'Shower mixed temperature', '°C', 'number', 'Hot water', 'Use', { min: 30, max: 50 }),
  P('dhw.basinMixTempC', 'Basin mixed temperature', '°C', 'number', 'Hot water', 'Use', { min: 25, max: 50 }),
  P('dhw.storageLossKWhPerDay', 'Storage losses', 'kWh/day', 'number', 'Hot water', 'Losses', { max: 500, step: 0.1 }),
  P('dhw.loopLengthM', 'Recirculation loop length', 'm', 'number', 'Hot water', 'Losses', { max: 10000 }),
  P('dhw.loopLossWPerM', 'Loop heat loss', 'W/m', 'number', 'Hot water', 'Losses', { max: 50, step: 0.5 }),
  P('dhw.pipeInsulationImprovement', 'Pipe insulation improvement', '%', 'percent', 'Hot water', 'Losses'),
  P('dhw.heatRecoveryShare', 'Heat recovery share', '%', 'percent', 'Hot water', 'Generation'),
  // Bathrooms
  P('bathrooms.showerFlowLPerMin', 'Shower flow rate', 'L/min', 'number', 'Water', 'Guest bathrooms', { min: 3, max: 30, step: 0.5, relRange: [0.8, 1.2] }),
  P('bathrooms.showerMinutes', 'Shower duration', 'min', 'number', 'Water', 'Guest bathrooms', { max: 30, step: 0.5 }),
  P('bathrooms.showersPerGuestNight', 'Showers per guest-night', '–', 'number', 'Water', 'Guest bathrooms', { max: 3, step: 0.05 }),
  P('bathrooms.bathVolumeL', 'Bath volume', 'L', 'number', 'Water', 'Guest bathrooms', { max: 400 }),
  P('bathrooms.bathsPerGuestNight', 'Baths per guest-night', '–', 'number', 'Water', 'Guest bathrooms', { max: 2, step: 0.01 }),
  P('bathrooms.basinFlowLPerMin', 'Basin flow rate', 'L/min', 'number', 'Water', 'Guest bathrooms', { max: 20, step: 0.5 }),
  P('bathrooms.basinMinutesPerGuestNight', 'Basin use', 'min/guest-night', 'number', 'Water', 'Guest bathrooms', { max: 20, step: 0.5 }),
  P('bathrooms.basinHotShare', 'Basin uses with hot water', '%', 'percent', 'Water', 'Guest bathrooms'),
  P('bathrooms.toiletFullFlushL', 'Full flush volume', 'L', 'number', 'Water', 'Guest bathrooms', { max: 15, step: 0.5 }),
  P('bathrooms.toiletPartFlushL', 'Reduced flush volume', 'L', 'number', 'Water', 'Guest bathrooms', { max: 10, step: 0.5 }),
  P('bathrooms.dualFlushPartShare', 'Reduced-flush share', '%', 'percent', 'Water', 'Guest bathrooms'),
  P('bathrooms.flushesPerGuestNight', 'Flushes per guest-night', '–', 'number', 'Water', 'Guest bathrooms', { max: 15, step: 0.5 }),
  P('bathrooms.leakM3PerDay', 'Leaks', 'm³/day', 'number', 'Water', 'Infrastructure', { max: 100, step: 0.05 }),
  P('bathrooms.lowFlowUptake', 'Rooms with low-flow showers', '%', 'percent', 'Water', 'Guest bathrooms'),
  P('bathrooms.lowFlowShowerLPerMin', 'Low-flow shower rate', 'L/min', 'number', 'Water', 'Guest bathrooms', { min: 3, max: 15, step: 0.5 }),
  P('bathrooms.showerRebound', 'Rebound in shower duration (low-flow)', '%', 'percent', 'Water', 'Guest bathrooms'),
  // Laundry & textiles
  P('textiles[].lengthCm', 'Length', 'cm', 'number', 'Linen & laundry', 'Textile', { max: 400 }),
  P('textiles[].widthCm', 'Width', 'cm', 'number', 'Linen & laundry', 'Textile', { max: 400 }),
  P('textiles[].gsm', 'Fabric weight', 'g/m²', 'number', 'Linen & laundry', 'Textile', { min: 50, max: 1200, step: 10 }),
  P('textiles[].measuredMassKg', 'Measured dry mass', 'kg', 'number', 'Linen & laundry', 'Textile', { max: 10, step: 0.01 }),
  P('textiles[].stayoverIntervalNights', 'Stayover change interval', 'nights (0 = never)', 'number', 'Linen & laundry', 'Policy', { max: 30 }),
  P('textiles[].reuseParticipation', 'Realised reuse (share of stayover changes avoided)', '%', 'percent', 'Linen & laundry', 'Policy'),
  P('textiles[].lifeWashCycles', 'Life in wash cycles', 'washes', 'number', 'Linen & laundry', 'Life', { min: 1, max: 1000 }),
  P('textiles[].rewashRate', 'Rewash rate', '%', 'percent', 'Linen & laundry', 'Life'),
  P('textiles[].lossRatePerYear', 'Loss/theft rate', '%/yr of stock', 'percent', 'Linen & laundry', 'Life'),
  P('textiles[].rejectionRate', 'Rejection rate', '% of washes', 'percent', 'Linen & laundry', 'Life'),
  P('inHouseLaundry.loadFactor', 'Machine load factor', '%', 'percent', 'Linen & laundry', 'In-house'),
  P('inHouseLaundry.machineCapacityKg', 'Machine capacity', 'kg', 'number', 'Linen & laundry', 'In-house', { min: 1, max: 500 }),
  P('outsourcedLaundry.pricePerKgEUR', 'Outsourced price', 'EUR/kg', 'number', 'Linen & laundry', 'Outsourced', { max: 20, step: 0.05, sourceId: 'laundry-price-2026' }),
  P('outsourcedLaundry.factorKgPerKg', 'Supplier emission factor', 'kgCO2e/kg', 'number', 'Linen & laundry', 'Outsourced', { max: 10, step: 0.01 }),
  P('cleaning.stayoverSkipShare', 'Skipped stayover cleans (opt-out)', '%', 'percent', 'Housekeeping', 'Cleaning'),
  P('food.vegetarianUptake', 'Vegetarian dish uptake', '%', 'percent', 'Food & beverage', 'Menu'),
  P('food.overproductionShare', 'Overproduction', '%', 'percent', 'Food & beverage', 'Waste'),
  P('food.plateWasteShare', 'Plate waste', '%', 'percent', 'Food & beverage', 'Waste'),
  P('food.prepLossShare', 'Preparation losses', '%', 'percent', 'Food & beverage', 'Waste'),
  P('food.spoilageShare', 'Spoilage', '%', 'percent', 'Food & beverage', 'Waste'),
  P('food.donationShareOfOverproduction', 'Surplus donated', '%', 'percent', 'Food & beverage', 'Waste'),
  P('guestTravel.carOccupancy', 'Guest car occupancy', 'persons', 'number', 'Mobility', 'Guest travel', { min: 1, max: 9, step: 0.1 }),
  P('guestTravel.evShareOfCars', 'EV share of guest cars', '%', 'percent', 'Mobility', 'Guest travel'),
  P('guestTravel.origins[].shareOfArrivals', 'Share of arriving guests', '%', 'percent', 'Mobility', 'Guest travel'),
  P('guestTravel.multipurposeTripShare', 'Share of trip attributed to other purposes', '%', 'percent', 'Mobility', 'Guest travel'),
  P('commuting.oneWayKm', 'Average one-way commute', 'km', 'number', 'Mobility', 'Commuting', { max: 200 }),
  P('electricity.goCoveredShare', 'Consumption covered by guarantees of origin', '%', 'percent', 'Energy supply', 'Contract'),
  P('electricity.offPeakShare', 'Off-peak share of consumption', '%', 'percent', 'Energy supply', 'Contract'),
  P('electricity.priceEnergyHP', 'Energy price, peak', 'EUR/kWh', 'number', 'Energy supply', 'Contract', { max: 2, step: 0.001 }),
  P('electricity.priceEnergyHC', 'Energy price, off-peak', 'EUR/kWh', 'number', 'Energy supply', 'Contract', { max: 2, step: 0.001 }),
  P('electricity.fixedPerYear', 'Fixed charges (subscription)', 'EUR/yr', 'number', 'Energy supply', 'Contract', { max: 1e7 }),
  P('solar.kWp', 'PV capacity', 'kWp', 'number', 'Energy supply', 'Solar', { max: 5000, step: 0.5 }),
  P('solar.simultaneityShare', 'Direct self-consumption share', '%', 'percent', 'Energy supply', 'Solar'),
  P('solar.batteryKWh', 'Battery capacity', 'kWh', 'number', 'Energy supply', 'Solar', { max: 10000 }),
  P('solar.batteryRoundTrip', 'Battery round-trip efficiency', '%', 'percent', 'Energy supply', 'Solar'),
  P('refrigerants[].annualLeakRate', 'Annual leak rate (if no top-up data)', '%', 'percent', 'Refrigerants', 'Equipment'),
  P('refrigerants[].recoveryEfficiency', 'Recovery at retirement', '%', 'percent', 'Refrigerants', 'Equipment'),
  P('finance.realDiscountRate', 'Real discount rate', '%', 'percent', 'Finance', 'Framework'),
  P('finance.horizonYears', 'Analysis horizon', 'years', 'number', 'Finance', 'Framework', { min: 1, max: 40 }),
  P('bnb.businessFloorShare', 'Business floor-area share', '%', 'percent', 'Allocation', 'B&B'),
  P('bnb.userShare', 'User-defined business share', '%', 'percent', 'Allocation', 'B&B'),
];

export function findDef(path: string): ParamDef | undefined {
  const norm = path.replace(/\.\d+\./g, '[].').replace(/\.\d+$/, '');
  return REGISTRY.find((d) => d.id === path) ?? REGISTRY.find((d) => d.id === norm);
}

export interface ValidationIssue { path: string; message: string }

/** Validate inputs against registry ranges (percentages 0–1, non-negative quantities, declared bounds). */
export function validateInputs(p: any): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const visit = (obj: any, prefix: string) => {
    if (obj == null) return;
    if (Array.isArray(obj)) {
      if (obj.every((x) => typeof x === 'number' || x == null)) { check(prefix, obj); return; }
      obj.forEach((x, i) => visit(x, `${prefix}.${i}`));
      return;
    }
    if (typeof obj === 'object') { for (const [k, v] of Object.entries(obj)) visit(v, prefix ? `${prefix}.${k}` : k); return; }
    if (typeof obj === 'number') check(prefix, obj);
  };
  const check = (path: string, v: number | (number | null)[]) => {
    const def = findDef(path);
    if (!def) return;
    const vals = Array.isArray(v) ? v : [v];
    for (const x of vals) {
      if (x == null) continue;
      if (!Number.isFinite(x)) issues.push({ path, message: `${def.name}: not a finite number.` });
      else if (def.min != null && x < def.min) issues.push({ path, message: `${def.name}: ${x} is below the minimum ${def.type.startsWith('percent') ? def.min * 100 + ' %' : def.min}.` });
      else if (def.max != null && x > def.max) issues.push({ path, message: `${def.name}: ${x} exceeds the maximum ${def.type.startsWith('percent') ? def.max * 100 + ' %' : def.max}.` });
    }
  };
  visit(p, '');
  return issues;
}
