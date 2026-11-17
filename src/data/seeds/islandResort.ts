import type { PropertyInputs } from '../../types';
import { baseInputs, heat, screening, textile, zone } from './base';

const SEASON = [0, 0, 0, 30, 31, 30, 31, 31, 30, 31, 0, 0];

/** FICTIONAL seasonal resort on Belle-Île-en-Mer (commune of Bangor, Morbihan). */
export function islandResort(): PropertyInputs {
  const b = baseInputs();
  return {
    ...b,
    id: 'island-resort',
    profile: {
      name: 'Demo Island Resort — Belle-Île-en-Mer (fictional)', positioning: 'Four-star seasonal resort with villas', commune: 'Bangor (Belle-Île-en-Mer)', inseeCode: '56009', department: 'Morbihan (56)', region: 'Bretagne', geoContext: 'mainland', climateProfileId: 'belle-ile', rtClimateZone: 'H2a',
      electricityContextNote: 'Belle-Île is reported to be supplied by a submarine cable from Quiberon (laid 2015, replaced c. 2020); generator sets were used until 2018. The island is therefore treated as part of the mainland interconnected system and the mainland mix applies. Corsica or overseas territories require revalidation.',
      waterContextNote: 'Drinking water and sanitation by Eau du Morbihan (2024 prices as reported by SISPEA). A seawater desalination module was commissioned in 2006 after a 2005 shortage; its current operation is unknown, so no desalination energy uplift is applied by default. Irrigation is assumed sub-metered and excluded from sanitation billing.',
      description: 'Illustrative profile only — not a real business. Commune and utility context are researched; operations are demonstration assumptions.',
    },
    boundary: {
      ...b.boundary, reportingEntity: 'Demo Island Resort SAS (fictional)', ownership: 'owned', includedBuildings: 'Main building, 4 villas, staff house, pool house', restaurantsIncluded: true,
      outsourcedActivitiesNote: 'All laundry in-house because of island logistics. Excursion boat operated by the resort (Scope 1).', openingsClosuresNote: 'Seasonal opening April–October; winter closure with frost protection and base loads.',
      scope3: screening({
        8: { status: 'not_applicable', justification: 'No leased assets.' }, 9: { status: 'not_applicable', justification: 'No sold products shipped.' }, 10: { status: 'not_applicable', justification: 'None.' },
        11: { status: 'not_applicable', justification: 'Guest energy use already in Scope 2.' }, 12: { status: 'not_assessed', justification: 'Boutique items — not assessed.' }, 13: { status: 'not_applicable', justification: 'No space leased out.' },
        14: { status: 'not_applicable', justification: 'Not a franchisor.' }, 15: { status: 'not_applicable', justification: 'No investments.' },
      }),
    },
    activity: {
      ...b.activity,
      roomTypes: [
        { id: 'room', name: 'Garden rooms', count: 40, areaM2: 28, beds: 1, maxGuests: 2, guestsPerOccupiedRoom: 2.0, occupancyIndex: 1.0 },
        { id: 'family', name: 'Family suites', count: 16, areaM2: 42, beds: 2, maxGuests: 4, guestsPerOccupiedRoom: 3.4, occupancyIndex: 1.0 },
        { id: 'villa', name: 'Three-bedroom villas', count: 4, areaM2: 120, beds: 3, maxGuests: 6, guestsPerOccupiedRoom: 5.0, occupancyIndex: 0.9 },
      ],
      monthlyOpenDays: [...SEASON], monthlyOccupancy: [0, 0, 0, 0.55, 0.65, 0.8, 0.95, 0.97, 0.75, 0.5, 0, 0], avgLengthOfStayNights: 4.5, staffHeadcount: 85, staffFTE: 70, workingDaysPerFTE: 150, staffAccommodationBeds: 30,
      publicAreaM2: 1200, backOfHouseM2: 800, meetingAreaM2: 120, breakfastUptake: 0.85, dinnerUptake: 0.45, externalCoversPerOpenDay: 30, barCustomersPerOpenDay: 120, eventAttendeesPerYear: 600, meetingRoomHoursPerYear: 300, spaDayVisitorsPerYear: 300, poolDayVisitorsPerYear: 0,
    },
    building: {
      ...b.building, conditionedAreaM2: 5500, volumeM3: 15000, buildYear: 1995, renovationYear: 2018, wallAreaM2: 4200, wallU: 0.5, roofAreaM2: 2600, roofU: 0.25, floorAreaM2: 2600, floorU: 0.4, windowAreaM2: 900, windowU: 1.6, glazingG: 0.55,
      infiltrationACH: 0.35, mechVentilationM3h: 9000, requiredVentilationM3h: 8500, heatRecoveryEff: 0.5, heatingSetpointC: 21, unoccupiedSetbackK: 3, roomControlsEnabled: true, closedFrostSetpointC: 7,
      heating: heat({ tech: 'heat_pump', scop: 3.2, copModel: 'temperature', carnotFraction: 0.45, supplyTempC: 45, backupResistanceShare: 0.05, defrostAllowance: 0.03, distributionLoss: 0.05 }),
      coolingEnabled: false, fanPumpPowerKW: 15, fanPumpHoursPerOpenDay: 18, plugLoadWPerM2: 4, plugLoadHoursPerDay: 12, baseLoadKW: 12, otherElectricKWhPerOccRoomNight: 1.0,
    },
    dhw: { ...b.dhw, storageLossKWhPerDay: 25, loopLengthM: 600, loopLossWPerM: 9, sameAsSpaceHeating: false, system: heat({ tech: 'heat_pump', scop: 2.8, copModel: 'temperature', carnotFraction: 0.42, supplyTempC: 60, backupResistanceShare: 0.1 }) },
    bathrooms: { ...b.bathrooms, showerFlowLPerMin: 11, showerMinutes: 8, showersPerGuestNight: 1.1, bathsPerGuestNight: 0.06, leakM3PerDay: 1.5 },
    pools: [{ id: 'outdoor', name: 'Outdoor heated pool', indoor: false, areaM2: 250, volumeM3: 400, openMonths: [0, 0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 0], waterTempC: 27, hallAirTempC: 0, indoorEvapKgPerM2H: 0, surfaceLossWPerM2K: 6, coverUsed: false, coverHoursPerDay: 12, coverEvapReduction: 0.8, backwashM3PerWeek: 8, pumpKW: 5.5, pumpHoursPerDay: 16, heating: heat({ tech: 'heat_pump', scop: 4.5, copModel: 'temperature', carnotFraction: 0.45, supplyTempC: 32 }), dehumidKWhPerKgEvap: 0, chemicalsKgPerYear: 900 }],
    spa: { ...b.spa, enabled: true, saunas: 1, saunaKW: 9, saunaHoursPerOpenDay: 8, treatmentsPerYear: 1800 },
    irrigation: { ...b.irrigation, landscapedAreaM2: 6000, cropCoefficient: 0.7, irrigationEfficiency: 0.6, leakShare: 0.08, irrigatedMonths: [0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0] },
    lighting: [
      zone({ id: 'rooms', name: 'Guestrooms & villas', luminaires: 420, wattsPerLamp: 7, hoursPerDay: 5, occupancyLinked: true, tech: 'led' }),
      zone({ id: 'bathrooms', name: 'Guest bathrooms', luminaires: 200, wattsPerLamp: 7, hoursPerDay: 3, occupancyLinked: true, tech: 'led' }),
      zone({ id: 'public', name: 'Lobby, restaurant & bar', luminaires: 220, wattsPerLamp: 9, hoursPerDay: 14, tech: 'led' }),
      zone({ id: 'kitchen', name: 'Kitchen', luminaires: 40, lampsPerLuminaire: 2, wattsPerLamp: 18, hoursPerDay: 14, tech: 'led' }),
      zone({ id: 'laundry', name: 'Laundry', luminaires: 20, lampsPerLuminaire: 2, wattsPerLamp: 36, driverWPerLuminaire: 6, hoursPerDay: 10, tech: 'fluorescent_t8', lumensPerLamp: 3350, ratedLifeHours: 20000, lampPriceEUR: 4, embodiedKgPerLamp: 0.25 }),
      zone({ id: 'garden', name: 'Garden & paths (exterior)', luminaires: 150, wattsPerLamp: 15, hoursPerDay: 9, tech: 'led', inConditionedSpace: false }),
      zone({ id: 'carpark', name: 'Car park (exterior)', luminaires: 25, wattsPerLamp: 40, hoursPerDay: 10, basis: 'all_days', tech: 'led', inConditionedSpace: false }),
    ],
    textiles: [
      textile({ id: 'bath-towel', name: 'Bath towel', lengthCm: 140, widthCm: 70, gsm: 550, unitCostEUR: 8, basis: 'per_guest', stayoverIntervalNights: 2, reuseParticipation: 0.4, lifeWashCycles: 160, lossRatePerYear: 0.05 }),
      textile({ id: 'hand-towel', name: 'Hand towel', lengthCm: 90, widthCm: 50, gsm: 550, unitCostEUR: 4, stayoverIntervalNights: 2, reuseParticipation: 0.4, lifeWashCycles: 160 }),
      textile({ id: 'bath-mat', name: 'Bath mat', lengthCm: 80, widthCm: 50, gsm: 800, unitCostEUR: 6, basis: 'per_room', stayoverIntervalNights: 2, lifeWashCycles: 150 }),
      textile({ id: 'beach-towel', name: 'Pool & beach towel', lengthCm: 180, widthCm: 90, gsm: 450, unitCostEUR: 11, basis: 'per_pool_visit', usageRatePerBasis: 0.5, lifeWashCycles: 120, lossRatePerYear: 0.15 }),
      textile({ id: 'sheet', name: 'Flat sheet', lengthCm: 300, widthCm: 270, gsm: 140, material: 'Polycotton', factorId: 'textile_polycotton', unitCostEUR: 16, basis: 'per_bed', placedPer: 2, stayoverIntervalNights: 4, lifeWashCycles: 250, tumbleDried: true, ironed: true }),
      textile({ id: 'duvet-cover', name: 'Duvet cover', massModel: 'measured', measuredMassKg: 1.0, factorId: 'textile_cotton_percale', unitCostEUR: 30, basis: 'per_bed', stayoverIntervalNights: 4, lifeWashCycles: 250, ironed: true }),
      textile({ id: 'pillowcase', name: 'Pillowcase', lengthCm: 150, widthCm: 50, gsm: 140, factorId: 'textile_cotton_percale', unitCostEUR: 3.5, placedPer: 2, basis: 'per_bed', stayoverIntervalNights: 4, lifeWashCycles: 250, ironed: true }),
      textile({ id: 'napkin', name: 'Napkin', lengthCm: 45, widthCm: 45, gsm: 200, factorId: 'textile_polycotton', unitCostEUR: 2, basis: 'per_cover', usageRatePerBasis: 0.8, lifeWashCycles: 200, ironed: true }),
      textile({ id: 'uniform', name: 'Staff uniform', massModel: 'garment', garmentMassKg: 0.6, factorId: 'textile_polycotton', unitCostEUR: 35, basis: 'per_fte_day', usageRatePerBasis: 1, lifeWashCycles: 80, calendarLifeYears: 2 }),
    ],
    inHouseLaundry: { ...b.inHouseLaundry, machineCapacityKg: 40, loadFactor: 0.8, waterLPerCycle: 300, electricityKWhPerCycle: 2.5, thermalKWhPerCycle: 14, thermalCarrier: 'electricity', detergentGPerKg: 12, dryerTech: 'heat_pump', residualMoisture: 0.5, dryerKWhPerKgWater: 0.55, ironerKWhPerKg: 0.5, ironerCarrier: 'electricity', standbyKWhPerDay: 3, labourMinutesPerKg: 3.5, maintenanceEURPerYear: 4000 },
    cleaning: { ...b.cleaning, departureCleanMinutes: 40, stayoverCleanMinutes: 20, stayoverSkipShare: 0.15, publicAreaCleanM2PerDay: 1200, labourCostEURPerHour: 24, staffHoursCapacityPerYear: 22000 },
    amenities: [
      { id: 'refill', name: 'Refillable dispensers (shampoo/gel), per guest-night dose', basis: 'guest_night', quantityPerBasis: 1, consumedShare: 1, productMassG: 15, packagingMassG: 0.5, kgCO2ePerUnit: 0.012, unitPriceEUR: 0.06, refillable: true, dispenserCount: 180, dispenserLifeYears: 5, dispenserEmbodiedKg: 1.5, dispenserPriceEUR: 25, enabled: true },
      { id: 'soap', name: 'Soap bar 30 g', basis: 'stay', quantityPerBasis: 1, consumedShare: 0.4, productMassG: 30, packagingMassG: 4, kgCO2ePerUnit: 0.06, unitPriceEUR: 0.2, refillable: false, dispenserCount: 0, dispenserLifeYears: 5, dispenserEmbodiedKg: 0, dispenserPriceEUR: 0, enabled: true },
      { id: 'water-bottles', name: 'Bottled water 0.5 L (glass, returnable)', basis: 'occupied_room_night', quantityPerBasis: 1, consumedShare: 0.8, productMassG: 500, packagingMassG: 0, kgCO2ePerUnit: 0.08, unitPriceEUR: 0.35, refillable: false, dispenserCount: 0, dispenserLifeYears: 5, dispenserEmbodiedKg: 0, dispenserPriceEUR: 0, enabled: true },
      { id: 'capsules', name: 'Coffee capsules', basis: 'occupied_room_night', quantityPerBasis: 1, consumedShare: 1, productMassG: 6, packagingMassG: 3, kgCO2ePerUnit: 0.06, unitPriceEUR: 0.4, refillable: false, dispenserCount: 0, dispenserLifeYears: 5, dispenserEmbodiedKg: 0, dispenserPriceEUR: 0, enabled: true },
    ],
    food: {
      ...b.food,
      breakfastBasket: { bread_pastry: 0.12, dairy: 0.15, cheese: 0.02, eggs: 0.06, pork: 0.02, fruit: 0.15, cereals: 0.04, coffee: 0.015, tea: 0.002, oils: 0.01, soft_drinks: 0.15 },
      mainStandardBasket: { fish_seafood: 0.12, beef: 0.04, lamb: 0.03, poultry: 0.04, dairy: 0.05, cheese: 0.02, vegetables: 0.25, fruit: 0.08, cereals: 0.08, bread_pastry: 0.06, oils: 0.03, wine: 0.18, bottled_water: 0.3 },
      mainVegetarianBasket: { plant_protein: 0.1, eggs: 0.03, cheese: 0.05, dairy: 0.08, vegetables: 0.35, fruit: 0.1, cereals: 0.12, bread_pastry: 0.06, oils: 0.03, wine: 0.15, bottled_water: 0.3 },
      vegetarianUptake: 0.12, staffMealBasket: { poultry: 0.05, fish_seafood: 0.03, vegetables: 0.25, cereals: 0.12, bread_pastry: 0.06, dairy: 0.05, fruit: 0.1, oils: 0.02 }, barBasket: { wine: 0.15, beer: 0.25, spirits: 0.03, soft_drinks: 0.2 },
      overproductionShare: 0.18, prepLossShare: 0.1, spoilageShare: 0.04, plateWasteShare: 0.1, donationShareOfOverproduction: 0,
      foodPricePerKg: { beef: 30, lamb: 26, pork: 10, poultry: 11, fish_seafood: 24, eggs: 4.5, dairy: 1.7, cheese: 16, plant_protein: 4.5, cereals: 2.2, bread_pastry: 4.5, fruit: 3.3, vegetables: 2.8, oils: 6.5, coffee: 19, tea: 32, chocolate: 16, wine: 11, beer: 3.2, spirits: 26, soft_drinks: 2.7, bottled_water: 0.9 },
      cookingKWhPerCover: 1.1, cookingGasShare: 0, refrigerationKWhPerDay: 120, extractionKW: 8, extractionHoursPerOpenDay: 12, iceMachineKWhPerDay: 20,
    },
    vehicles: [
      { id: 'shuttle', name: 'Port shuttle minibus (Le Palais ↔ resort)', role: 'guest_shuttle', count: 1, powertrain: 'diesel', kmPerYear: 20000, usesHours: false, fuelLPer100Km: 10, kWhPer100Km: 0, chargingLoss: 0.1, chargedOnSite: true, purchaseCostEUR: 60000, embodiedKg: 9000, acquisitionYear: 2018, lifeYears: 9, maintenanceEURPerYear: 2800, replacement: null },
      { id: 'carts', name: 'Electric golf carts', role: 'golf_cart', count: 6, powertrain: 'bev', kmPerYear: 1500, usesHours: false, fuelLPer100Km: 0, kWhPer100Km: 12, chargingLoss: 0.15, chargedOnSite: true, purchaseCostEUR: 9000, embodiedKg: 900, acquisitionYear: 2021, lifeYears: 8, maintenanceEURPerYear: 300, replacement: null },
      { id: 'utility', name: 'Utility pickup', role: 'grounds', count: 1, powertrain: 'diesel', kmPerYear: 8000, usesHours: false, fuelLPer100Km: 9, kWhPer100Km: 0, chargingLoss: 0.1, chargedOnSite: true, purchaseCostEUR: 35000, embodiedKg: 8000, acquisitionYear: 2016, lifeYears: 12, maintenanceEURPerYear: 1500, replacement: null },
      { id: 'boat', name: 'Excursion boat (hours/yr, L/h)', role: 'boat', count: 1, powertrain: 'boat_diesel', kmPerYear: 300, usesHours: true, fuelLPer100Km: 25, kWhPer100Km: 0, chargingLoss: 0, chargedOnSite: false, purchaseCostEUR: 180000, embodiedKg: 20000, acquisitionYear: 2014, lifeYears: 25, maintenanceEURPerYear: 9000, replacement: null },
    ],
    commuting: { oneWayKm: 6, onSiteDaysPerFTE: 150, modes: { car: 0.5, car_ev: 0.05, train: 0, bus: 0.1, bike_walk: 0.35, employer_shuttle: 0 }, carOccupancy: 1.3, remoteWorkShare: 0, shuttleCoveredByFleet: true },
    businessTravel: { trainPkm: 15000, shortFlightPkm: 0, longFlightPkm: 0, carKm: 6000, hotelNightsElsewhere: 20 },
    guestTravel: {
      ...b.guestTravel, carOccupancy: 2.6, evShareOfCars: 0.06, lastLegCoveredByHotelShuttle: 0.6, lastLegKm: 8, excursionsKmPerStay: 20,
      origins: [
        { id: 'west', label: 'Brittany & Pays de la Loire', shareOfArrivals: 0.35, oneWayKm: 150, modes: { train: 0.2, car: 0.8, plane_short: 0, plane_long: 0, coach: 0 }, ferryKm: 15, arrangement: 'independent' },
        { id: 'paris', label: 'Paris region', shareOfArrivals: 0.4, oneWayKm: 500, modes: { train: 0.7, car: 0.3, plane_short: 0, plane_long: 0, coach: 0 }, ferryKm: 15, arrangement: 'independent' },
        { id: 'fr', label: 'Rest of France', shareOfArrivals: 0.15, oneWayKm: 700, modes: { train: 0.4, car: 0.4, plane_short: 0.2, plane_long: 0, coach: 0 }, ferryKm: 15, arrangement: 'independent' },
        { id: 'intl', label: 'International', shareOfArrivals: 0.1, oneWayKm: 1200, modes: { train: 0.3, car: 0, plane_short: 0.7, plane_long: 0, coach: 0 }, ferryKm: 15, arrangement: 'independent' },
      ],
    },
    deliveries: [
      { id: 'food', supplier: 'Mainland food wholesaler (Vannes depot)', productGroup: 'Food (chilled)', deliveriesPerYear: 30, kgPerDelivery: 1500, method: 'tonne_km', legs: [{ mode: 'road_truck', km: 55 }, { mode: 'ferry_freight', km: 15 }, { mode: 'road_van', km: 10 }], dedicatedRoundTripKm: 0, dedicatedVehicleFactorId: 'truck_rigid_vkm', routeAllocationShare: 1, refrigerated: true, refrigerationUplift: 0.2, includedInProductFactor: false, costPerDeliveryEUR: 180 },
      { id: 'bev', supplier: 'Beverage distributor (Lorient)', productGroup: 'Beverages', deliveriesPerYear: 15, kgPerDelivery: 2000, method: 'tonne_km', legs: [{ mode: 'road_truck', km: 60 }, { mode: 'ferry_freight', km: 15 }, { mode: 'road_van', km: 10 }], dedicatedRoundTripKm: 0, dedicatedVehicleFactorId: 'truck_rigid_vkm', routeAllocationShare: 1, refrigerated: false, refrigerationUplift: 0, includedInProductFactor: false, costPerDeliveryEUR: 150 },
      { id: 'consumables', supplier: 'Consumables & amenities', productGroup: 'Housekeeping consumables', deliveriesPerYear: 8, kgPerDelivery: 600, method: 'tonne_km', legs: [{ mode: 'road_truck', km: 450 }, { mode: 'ferry_freight', km: 15 }, { mode: 'road_van', km: 10 }], dedicatedRoundTripKm: 0, dedicatedVehicleFactorId: 'truck_rigid_vkm', routeAllocationShare: 1, refrigerated: false, refrigerationUplift: 0, includedInProductFactor: false, costPerDeliveryEUR: 120 },
    ],
    refrigerants: [
      { id: 'hp', name: 'Air-to-water heat pumps', refrigerant: 'R-32', chargeKg: 40, annualLeakRate: 0.03, measuredTopUpKg: null, retiredThisYear: false, recoveryEfficiency: 0.9, serviceCostEURPerYear: 2000 },
      { id: 'cold', name: 'Kitchen cold rooms', refrigerant: 'R-404A', chargeKg: 12, annualLeakRate: 0.12, measuredTopUpKg: null, retiredThisYear: false, recoveryEfficiency: 0.9, serviceCostEURPerYear: 1200 },
    ],
    waste: [
      { id: 'residual', name: 'Mixed residual waste', kgPerYear: null, kgPerGuestNight: 0.9, measurement: 'benchmark', treatment: 'incineration_energy_recovery', factorId: 'waste_residual_incineration', feePerTonneEUR: 260, liftsPerYear: 120, feePerLiftEUR: 10, linkedToFoodModule: false },
      { id: 'food', name: 'Food waste (from F&B mass balance)', kgPerYear: null, kgPerGuestNight: null, measurement: 'benchmark', treatment: 'composting', factorId: 'waste_food_composting', feePerTonneEUR: 120, liftsPerYear: 60, feePerLiftEUR: 6, linkedToFoodModule: true },
      { id: 'glass', name: 'Glass', kgPerYear: 9000, kgPerGuestNight: null, measurement: 'volume_estimate', treatment: 'recycling', factorId: 'waste_recycling_collection', feePerTonneEUR: 40, liftsPerYear: 30, feePerLiftEUR: 6, linkedToFoodModule: false },
      { id: 'cardboard', name: 'Cardboard & packaging', kgPerYear: 7000, kgPerGuestNight: null, measurement: 'volume_estimate', treatment: 'recycling', factorId: 'waste_recycling_collection', feePerTonneEUR: 40, liftsPerYear: 30, feePerLiftEUR: 6, linkedToFoodModule: false },
      { id: 'green', name: 'Green waste', kgPerYear: 12000, kgPerGuestNight: null, measurement: 'benchmark', treatment: 'composting', factorId: 'waste_green_composting', feePerTonneEUR: 30, liftsPerYear: 10, feePerLiftEUR: 20, linkedToFoodModule: false },
    ],
    assets: [
      { id: 'pv', name: 'Rooftop PV (60 kWp)', category: 'Energy', quantity: 60, unitEmbodiedKg: 700, unitCostEUR: 1200, acquisitionYear: 2023, usefulLifeYears: 25, embodiedSource: 'Demonstration value per kWp' },
      { id: 'hp-asset', name: 'Heat pumps', category: 'HVAC', quantity: 4, unitEmbodiedKg: 1800, unitCostEUR: 45000, acquisitionYear: 2018, usefulLifeYears: 18, embodiedSource: 'Demonstration value' },
      { id: 'beds', name: 'Beds & mattresses (villa refit)', category: 'Furniture', quantity: 12, unitEmbodiedKg: 180, unitCostEUR: 1400, acquisitionYear: 2025, usefulLifeYears: 10, embodiedSource: 'Demonstration value' },
    ],
    services: [
      { id: 'it', name: 'IT & booking systems', spendEUR: 25000, spendYear: 2025, factorId: 'spend_it_telecom', physicallyModelledElsewhere: false },
      { id: 'mkt', name: 'Marketing', spendEUR: 60000, spendYear: 2025, factorId: 'spend_marketing', physicallyModelledElsewhere: false },
      { id: 'maint', name: 'Maintenance contracts', spendEUR: 70000, spendYear: 2025, factorId: 'spend_maintenance', physicallyModelledElsewhere: false },
    ],
    electricity: { ...b.electricity, supplier: 'Demonstration market contract', fixedPerYear: 9000, priceEnergyHP: 0.14, priceEnergyHC: 0.11, offPeakShare: 0.3 },
    fuels: { ...b.fuels, dieselPerL: 1.48, gasFixedPerYear: 0 },
    water: { ...b.water, potablePerM3: 2.79, wastewaterPerM3: 4.26, fixedPerYear: 600, wastewaterBasis: 'excluding_irrigation_submeter' },
    solar: { ...b.solar, enabled: true, kWp: 60, simultaneityShare: 0.7, batteryKWh: 0, roofAreaM2Available: 900, exportPricePerKWh: 0.011 },
    generator: { enabled: true, kW: 150, testHoursPerYear: 18, outageHoursPerYear: 6, loadShare: 0.5, litresPerKWh: 0.28 },
    finance: { ...b.finance, horizonYears: 15 },
    constraints: { ...b.constraints, capexBudgetEUR: 250000, maxPaybackYears: 10, minTowelLengthCm: 120, roofAreaM2: 900, waterAvailabilityM3: 30000 },
  };
}
