import type { PropertyInputs } from '../../types';
import { baseInputs, heat, screening, textile, zone } from './base';

const OPEN = [0, 0, 15, 30, 31, 30, 31, 31, 30, 31, 10, 10];

/** FICTIONAL owner-operated unclassified chambres d'hôtes, Saint-Léon-sur-Vézère (Dordogne). */
export function independentBnb(): PropertyInputs {
  const b = baseInputs();
  return {
    ...b,
    id: 'independent-bnb',
    mode: 'simple',
    profile: {
      name: 'Demo B&B — Vézère valley (fictional)', positioning: 'Unclassified chambres d\'hôtes, owner-operated', commune: 'Saint-Léon-sur-Vézère', inseeCode: 'not verified', department: 'Dordogne (24)', region: 'Nouvelle-Aquitaine', geoContext: 'mainland', climateProfileId: 'dordogne', rtClimateZone: 'H2c (to verify)',
      electricityContextNote: 'Shared domestic meter (owner\'s home). The regulated residential TRVE reference is used for illustration only; the owner must enter the actual contract. Five rooms is the legal ceiling for the "chambres d\'hôtes" designation (Code du tourisme D.324-13, 15 persons).',
      waterContextNote: 'Rural public drinking-water service (local syndicate tariff not researched — demonstration value). Private on-site wastewater treatment (assainissement non collectif) assumed.',
      description: 'Illustrative profile only — not a real business. Owner household activity is separated from the accommodation business.',
    },
    boundary: {
      ...b.boundary, reportingEntity: 'Owner-operator (micro-entreprise, fictional)', ownership: 'owned', includedBuildings: 'Guest wing and shared areas of the owner\'s farmhouse (business share only)', restaurantsIncluded: true,
      sharedServicesNote: 'Heating, hot-water losses, base loads and leaks are shared with the household and allocated with the method chosen in Business allocation.', outsourcedActivitiesNote: 'None.',
      scope3: screening({
        4: { status: 'not_applicable', justification: 'No supplier deliveries; owner shopping trips are in Scope 1 (business-use km of owner car).' },
        6: { status: 'not_applicable', justification: 'No business travel.' }, 8: { status: 'not_applicable', justification: 'None.' }, 9: { status: 'not_applicable', justification: 'None.' }, 10: { status: 'not_applicable', justification: 'None.' },
        11: { status: 'not_applicable', justification: 'No energy-using products sold.' }, 12: { status: 'not_applicable', justification: 'No products sold.' }, 13: { status: 'not_applicable', justification: 'None.' }, 14: { status: 'not_applicable', justification: 'None.' }, 15: { status: 'not_applicable', justification: 'None.' },
      }),
    },
    activity: {
      ...b.activity,
      roomTypes: [
        { id: 'double', name: 'Double rooms', count: 3, areaM2: 18, beds: 1, maxGuests: 2, guestsPerOccupiedRoom: 1.9, occupancyIndex: 1.0 },
        { id: 'family', name: 'Family rooms', count: 2, areaM2: 25, beds: 2, maxGuests: 4, guestsPerOccupiedRoom: 2.8, occupancyIndex: 0.95 },
      ],
      monthlyOpenDays: [...OPEN], monthlyOccupancy: [0, 0, 0.3, 0.45, 0.55, 0.65, 0.85, 0.9, 0.6, 0.4, 0.25, 0.35], avgLengthOfStayNights: 2.0, staffHeadcount: 2, staffFTE: 1.4, workingDaysPerFTE: 220, staffAccommodationBeds: 1,
      publicAreaM2: 40, backOfHouseM2: 15, breakfastUptake: 0.98, dinnerUptake: 0.2, staffMealsPerFTEDay: 0,
    },
    building: {
      ...b.building, conditionedAreaM2: 320, volumeM3: 850, buildYear: 1850, renovationYear: 2015, wallAreaM2: 380, wallU: 0.9, roofAreaM2: 180, roofU: 0.3, floorAreaM2: 180, floorU: 0.7, windowAreaM2: 45, windowU: 2.0, glazingG: 0.55,
      infiltrationACH: 0.5, mechVentilationM3h: 0, requiredVentilationM3h: 0, heatingSetpointC: 20, unoccupiedSetbackK: 3, roomControlsEnabled: false, closedFrostSetpointC: 12,
      heating: heat({ tech: 'oil_boiler', seasonalEfficiency: 0.82, distributionLoss: 0.05 }), plugLoadWPerM2: 2, plugLoadHoursPerDay: 10, baseLoadKW: 0.25, otherElectricKWhPerOccRoomNight: 0.4,
    },
    dhw: { ...b.dhw, storageTempC: 60, storageLossKWhPerDay: 2.2, loopLengthM: 0, sameAsSpaceHeating: false, system: heat({ tech: 'electric_resistance', seasonalEfficiency: 1 }) },
    bathrooms: { ...b.bathrooms, showerFlowLPerMin: 11, showerMinutes: 7, bathsPerGuestNight: 0, leakM3PerDay: 0.05 },
    otherWater: { ...b.otherWater, kitchenLPerCover: 8, staffLPerFTEDay: 5 },
    pools: [{ id: 'garden-pool', name: 'Garden pool', indoor: false, areaM2: 32, volumeM3: 45, openMonths: [0, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0], waterTempC: 26, hallAirTempC: 0, indoorEvapKgPerM2H: 0, surfaceLossWPerM2K: 6, coverUsed: true, coverHoursPerDay: 14, coverEvapReduction: 0.8, backwashM3PerWeek: 0.5, pumpKW: 0.75, pumpHoursPerDay: 8, heating: heat({ tech: 'heat_pump', scop: 5, copModel: 'seasonal', supplyTempC: 30 }), dehumidKWhPerKgEvap: 0, chemicalsKgPerYear: 60 }],
    irrigation: { ...b.irrigation, landscapedAreaM2: 400, cropCoefficient: 0.6, irrigationEfficiency: 0.7 },
    lighting: [
      zone({ id: 'rooms', name: 'Guest rooms', luminaires: 20, wattsPerLamp: 7, hoursPerDay: 4, occupancyLinked: true, tech: 'led' }),
      zone({ id: 'shared-rooms', name: 'Breakfast room & hall (shared)', luminaires: 12, wattsPerLamp: 42, hoursPerDay: 5, tech: 'halogen', lumensPerLamp: 630, ratedLifeHours: 2000, lampPriceEUR: 3, labourPerLampEUR: 0, embodiedKgPerLamp: 0.05 }),
      zone({ id: 'garden', name: 'Garden & façade (exterior)', luminaires: 8, wattsPerLamp: 10, hoursPerDay: 5, tech: 'led', inConditionedSpace: false }),
    ],
    textiles: [
      textile({ id: 'bath-towel', name: 'Bath towel', lengthCm: 130, widthCm: 70, gsm: 500, unitCostEUR: 12, stayoverIntervalNights: 3, lifeWashCycles: 200, lossRatePerYear: 0.02, tumbleDried: false, parLevel: 3 }),
      textile({ id: 'hand-towel', name: 'Hand towel', lengthCm: 90, widthCm: 50, gsm: 500, unitCostEUR: 6, stayoverIntervalNights: 3, lifeWashCycles: 200, tumbleDried: false, parLevel: 3 }),
      textile({ id: 'sheet', name: 'Fitted & flat sheets (set)', massModel: 'measured', measuredMassKg: 1.3, factorId: 'textile_cotton_percale', unitCostEUR: 45, basis: 'per_bed', stayoverIntervalNights: 0, lifeWashCycles: 300, tumbleDried: false, ironed: true, parLevel: 3 }),
      textile({ id: 'duvet-cover', name: 'Duvet cover', massModel: 'measured', measuredMassKg: 0.9, factorId: 'textile_cotton_percale', unitCostEUR: 40, basis: 'per_bed', stayoverIntervalNights: 0, lifeWashCycles: 300, tumbleDried: false, ironed: true, parLevel: 3 }),
      textile({ id: 'napkin', name: 'Breakfast napkin', lengthCm: 40, widthCm: 40, gsm: 180, factorId: 'textile_linen_flax', unitCostEUR: 3, basis: 'per_cover', usageRatePerBasis: 1, lifeWashCycles: 200, tumbleDried: false }),
    ],
    inHouseLaundry: { ...b.inHouseLaundry, machineCapacityKg: 8, loadFactor: 0.8, waterLPerCycle: 50, electricityKWhPerCycle: 1.0, thermalKWhPerCycle: 0, thermalCarrier: 'electricity', detergentGPerKg: 15, dryerTech: 'electric', ironerKWhPerKg: 0.15, standbyKWhPerDay: 0.05, labourMinutesPerKg: 4, maintenanceEURPerYear: 80 },
    cleaning: { ...b.cleaning, departureCleanMinutes: 45, stayoverCleanMinutes: 15, chemicalMlPerClean: 20, linersPerClean: 1, wipesPerClean: 0, glovesPairsPerClean: 0, labourCostEURPerHour: 15 },
    amenities: [
      { id: 'refill', name: 'Refillable soap & shampoo dispensers', basis: 'guest_night', quantityPerBasis: 1, consumedShare: 1, productMassG: 15, packagingMassG: 0.3, kgCO2ePerUnit: 0.01, unitPriceEUR: 0.05, refillable: true, dispenserCount: 10, dispenserLifeYears: 6, dispenserEmbodiedKg: 1.2, dispenserPriceEUR: 20, enabled: true },
      { id: 'toilet-paper', name: 'Toilet paper rolls', basis: 'occupied_room_night', quantityPerBasis: 0.3, consumedShare: 0.8, productMassG: 110, packagingMassG: 2, kgCO2ePerUnit: 0.12, unitPriceEUR: 0.25, refillable: false, dispenserCount: 0, dispenserLifeYears: 5, dispenserEmbodiedKg: 0, dispenserPriceEUR: 0, enabled: true },
      { id: 'welcome', name: 'Welcome treats (local biscuits)', basis: 'stay', quantityPerBasis: 1, consumedShare: 0.9, productMassG: 100, packagingMassG: 10, kgCO2ePerUnit: 0.25, unitPriceEUR: 1.5, refillable: false, dispenserCount: 0, dispenserLifeYears: 5, dispenserEmbodiedKg: 0, dispenserPriceEUR: 0, enabled: true },
    ],
    food: {
      ...b.food,
      breakfastBasket: { bread_pastry: 0.1, dairy: 0.15, eggs: 0.05, fruit: 0.15, cheese: 0.02, coffee: 0.015, tea: 0.002, oils: 0.01, soft_drinks: 0.1 },
      mainStandardBasket: { poultry: 0.08, pork: 0.03, vegetables: 0.3, fruit: 0.08, cereals: 0.06, bread_pastry: 0.06, cheese: 0.04, oils: 0.03, wine: 0.25 },
      mainVegetarianBasket: { plant_protein: 0.08, eggs: 0.05, cheese: 0.05, vegetables: 0.35, fruit: 0.1, cereals: 0.1, bread_pastry: 0.06, oils: 0.03, wine: 0.2 },
      vegetarianUptake: 0.1, overproductionShare: 0.08, prepLossShare: 0.08, spoilageShare: 0.02, plateWasteShare: 0.05, foodWasteRoute: 'biowaste',
      foodPricePerKg: { pork: 10, poultry: 12, eggs: 5, dairy: 1.8, cheese: 18, plant_protein: 4, cereals: 2.5, bread_pastry: 5, fruit: 3.5, vegetables: 3, oils: 8, coffee: 20, tea: 35, wine: 9, soft_drinks: 3 },
      cookingKWhPerCover: 0.6, cookingGasShare: 0, refrigerationKWhPerDay: 1.2, dishwasherKWhPerRack: 0.9,
    },
    vehicles: [
      { id: 'owner-car', name: 'Owner car — business-use km only (shopping, guest pick-ups)', role: 'other', count: 1, powertrain: 'petrol', kmPerYear: 3000, usesHours: false, fuelLPer100Km: 6.5, kWhPer100Km: 0, chargingLoss: 0.1, chargedOnSite: true, purchaseCostEUR: 0, embodiedKg: 0, acquisitionYear: 2017, lifeYears: 15, maintenanceEURPerYear: 0, replacement: null },
    ],
    commuting: { oneWayKm: 8, onSiteDaysPerFTE: 110, modes: { car: 1, car_ev: 0, train: 0, bus: 0, bike_walk: 0, employer_shuttle: 0 }, carOccupancy: 1, remoteWorkShare: 0, shuttleCoveredByFleet: true },
    guestTravel: {
      ...b.guestTravel, carOccupancy: 2.3, evShareOfCars: 0.07, excursionsKmPerStay: 40,
      origins: [
        { id: 'fr', label: 'France', shareOfArrivals: 0.7, oneWayKm: 550, modes: { train: 0.2, car: 0.8, plane_short: 0, plane_long: 0, coach: 0 }, ferryKm: 0, arrangement: 'independent' },
        { id: 'nw', label: 'UK, Belgium, Netherlands', shareOfArrivals: 0.25, oneWayKm: 1000, modes: { train: 0.1, car: 0.6, plane_short: 0.3, plane_long: 0, coach: 0 }, ferryKm: 0, arrangement: 'independent' },
        { id: 'lh', label: 'Long-haul', shareOfArrivals: 0.05, oneWayKm: 6000, modes: { train: 0, car: 0, plane_short: 0, plane_long: 1, coach: 0 }, ferryKm: 0, arrangement: 'independent' },
      ],
    },
    waste: [
      { id: 'residual', name: 'Residual waste (business share)', kgPerYear: null, kgPerGuestNight: 0.5, measurement: 'volume_estimate', treatment: 'incineration_energy_recovery', factorId: 'waste_residual_incineration', feePerTonneEUR: 0, liftsPerYear: 0, feePerLiftEUR: 0, linkedToFoodModule: false },
      { id: 'recycling', name: 'Dry recyclables', kgPerYear: null, kgPerGuestNight: 0.3, measurement: 'volume_estimate', treatment: 'recycling', factorId: 'waste_recycling_collection', feePerTonneEUR: 0, liftsPerYear: 0, feePerLiftEUR: 0, linkedToFoodModule: false },
      { id: 'food', name: 'Food scraps (home composting)', kgPerYear: null, kgPerGuestNight: null, measurement: 'benchmark', treatment: 'composting', factorId: 'waste_food_composting', feePerTonneEUR: 0, liftsPerYear: 0, feePerLiftEUR: 0, linkedToFoodModule: true },
    ],
    assets: [
      { id: 'beds', name: 'Guest beds & mattresses', category: 'Furniture', quantity: 7, unitEmbodiedKg: 150, unitCostEUR: 800, acquisitionYear: 2019, usefulLifeYears: 10, embodiedSource: 'Demonstration value' },
      { id: 'washer', name: 'Domestic washing machine', category: 'Appliances', quantity: 1, unitEmbodiedKg: 300, unitCostEUR: 600, acquisitionYear: 2025, usefulLifeYears: 10, embodiedSource: 'Demonstration value' },
    ],
    services: [
      { id: 'platform', name: 'Booking platform commissions', spendEUR: 4000, spendYear: 2025, factorId: 'spend_services_generic', physicallyModelledElsewhere: false },
      { id: 'insurance', name: 'Insurance & accounting', spendEUR: 1500, spendYear: 2025, factorId: 'spend_services_generic', physicallyModelledElsewhere: false },
    ],
    electricity: { ...b.electricity, supplier: 'Regulated residential tariff reference (TRVE Base) — replace with own contract', priceEnergyHP: 0.1617, priceEnergyHC: 0.1617, offPeakShare: 0, networkVariablePerKWh: 0, excisePerKWh: 0, fixedPerYear: 250, priceSourceNote: 'TRVE residential Base 6 kVA ≈0.1940 €/kWh TTC from 1 Feb 2026 (CRE deliberation 2026-06, as reported) → 0.1617 HT all-in; subscription is a demonstration value.' },
    fuels: { ...b.fuels, heatingOilPerL: 1.0 },
    water: { ...b.water, potablePerM3: 2.2, wastewaterPerM3: 0, fixedPerYear: 90, wastewaterBasis: 'private_treatment', privateTreatmentCostPerYear: 250, septicBODgPerGuestNight: 40 },
    guestEvCharging: { enabled: true, shareOfStays: 0.08, kWhPerCharge: 18, rechargedPricePerKWh: 0 },
    bnb: { method: 'floor_area', businessFloorShare: 0.55, householdPersons: 2, householdNightsPerYear: 330, userShare: 0.5, measuredBusinessShare: null, sharedServiceKeys: ['space heating', 'hot-water losses', 'base load', 'leaks'] },
    finance: { ...b.finance, horizonYears: 15, realDiscountRate: 0.04, vatRecoverable: false },
    constraints: { ...b.constraints, capexBudgetEUR: 15000, maxPaybackYears: 12, minHeatingSetpointC: 19, roofAreaM2: 60 },
    solar: { ...b.solar, roofAreaM2Available: 60 },
  };
}
