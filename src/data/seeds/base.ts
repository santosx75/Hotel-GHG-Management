import type { HeatSystem, LightingZone, PropertyInputs, Scope3Screen, TextileItem } from '../../types';

export const ALL_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
export const heat = (h: Partial<HeatSystem>): HeatSystem => ({
  tech: 'gas_boiler', seasonalEfficiency: 0.9, scop: 3, copModel: 'seasonal', carnotFraction: 0.45, supplyTempC: 45, backupResistanceShare: 0, defrostAllowance: 0, distributionLoss: 0.05, ...h,
});

export const zone = (z: Partial<LightingZone> & { id: string; name: string }): LightingZone => ({
  luminaires: 0, lampsPerLuminaire: 1, wattsPerLamp: 10, driverWPerLuminaire: 0, standbyWPerLuminaire: 0, hoursPerDay: 8, basis: 'open_days', occupancyLinked: false, controlSaving: 0,
  tech: 'led', lumensPerLamp: 800, ratedLifeHours: 25000, weibullShape: 3, calendarLifeYears: 15, policy: 'on_failure', groupIntervalHours: 15000, lampPriceEUR: 8, labourPerLampEUR: 3,
  embodiedKgPerLamp: 0.3, inConditionedSpace: true, ...z,
});

export const textile = (t: Partial<TextileItem> & { id: string; name: string }): TextileItem => ({
  lengthCm: 0, widthCm: 0, gsm: null, measuredMassKg: null, massModel: 'rectangle', garmentMassKg: null, material: 'Cotton', recycledContent: 0, supplier: 'Demonstration supplier', manufacturingCountry: 'Portugal',
  factorId: 'textile_cotton_terry', unitCostEUR: 5, placedPer: 1, basis: 'per_guest', parLevel: 4, changeOnDeparture: true, stayoverIntervalNights: 0, reuseParticipation: 0, requestChangesPerStay: 0, usageRatePerBasis: 1,
  rewashRate: 0.04, lossRatePerYear: 0.03, rejectionRate: 0.01, lifeWashCycles: 200, calendarLifeYears: 5, existingStock: null, tumbleDried: true, ironed: false, stream: 'in_house', minLengthCm: null, minGsm: null, endOfLife: 'residual', ...t,
});

export function screening(overrides: Partial<Record<number, Omit<Scope3Screen, 'cat'>>>): Scope3Screen[] {
  return Array.from({ length: 15 }, (_, i) => ({ cat: i + 1, status: 'not_assessed' as const, justification: 'Not yet screened.', ...(overrides[i + 1] ?? {}) }));
}

/** Neutral defaults; every property overrides what is relevant. */
export function baseInputs(): Omit<PropertyInputs, 'id' | 'profile'> {
  return {
    schemaVersion: 1,
    boundary: {
      reportingEntity: '', ownership: 'owned', consolidation: 'operational_control', reportingYear: 2025, baseYear: 2023, includedBuildings: 'Main building', restaurantsIncluded: true, concessionsIncluded: false,
      concessionNote: '', sharedServicesNote: '', outsourcedActivitiesNote: '', openingsClosuresNote: 'None in reporting period.', renovationNote: '', scope3: screening({}),
    },
    mode: 'advanced',
    activity: {
      roomTypes: [], monthlyOpenDays: [...ALL_DAYS], monthlyOccupancy: new Array(12).fill(0.7), avgLengthOfStayNights: 2, outOfOrderRate: 0, dayUseRoomsPerYear: 0, staffHeadcount: 0, staffFTE: 0, workingDaysPerFTE: 220,
      staffAccommodationBeds: 0, publicAreaM2: 0, guestroomAreaM2Override: null, backOfHouseM2: 0, meetingAreaM2: 0, breakfastUptake: 0.6, dinnerUptake: 0.2, externalCoversPerOpenDay: 0, roomServiceOrdersPerOccRoomNight: 0,
      barCustomersPerOpenDay: 0, eventAttendeesPerYear: 0, meetingRoomHoursPerYear: 0, spaDayVisitorsPerYear: 0, poolDayVisitorsPerYear: 0, staffMealsPerFTEDay: 1, childrenShareOfGuests: 0.1,
    },
    building: {
      conditionedAreaM2: 1000, volumeM3: 3000, buildYear: 1980, renovationYear: null, wallAreaM2: 800, wallU: 0.8, roofAreaM2: 300, roofU: 0.4, floorAreaM2: 300, floorU: 0.6, windowAreaM2: 150, windowU: 2.0, glazingG: 0.5, shadingFactor: 0.7,
      infiltrationACH: 0.3, mechVentilationM3h: 0, requiredVentilationM3h: 0, heatRecoveryEff: 0, heatingSetpointC: 21, coolingSetpointC: 25, unoccupiedSetbackK: 3, roomControlsEnabled: false, windowInterlocks: false, windowOpeningExtraACH: 0.2,
      preconditioningHours: 2, closedFrostSetpointC: 8, heating: heat({}), coolingEnabled: false, coolingSEER: 3.5, fanPumpPowerKW: 0, fanPumpHoursPerOpenDay: 0, variableSpeedSaving: 0, plugLoadWPerM2: 3, plugLoadHoursPerDay: 10,
      baseLoadKW: 1, otherElectricKWhPerOccRoomNight: 0.8, peopleGainWPerGuest: 80, guestPresenceShare: 0.6,
    },
    dhw: { storageTempC: 60, loopReturnTempC: 55, showerMixTempC: 40, basinMixTempC: 38, storageLossKWhPerDay: 3, loopLengthM: 0, loopLossWPerM: 10, pipeInsulationImprovement: 0, heatRecoveryShare: 0, system: heat({}), sameAsSpaceHeating: true },
    bathrooms: { showerFlowLPerMin: 10, showerMinutes: 8, showersPerGuestNight: 0.9, bathVolumeL: 150, bathsPerGuestNight: 0.05, basinFlowLPerMin: 6, basinMinutesPerGuestNight: 3, basinHotShare: 0.5, toiletFullFlushL: 6, toiletPartFlushL: 3, dualFlushPartShare: 0.6, flushesPerGuestNight: 4, leakM3PerDay: 0, lowFlowUptake: 0, lowFlowShowerLPerMin: 7, showerRebound: 0.05 },
    otherWater: { kitchenLPerCover: 10, kitchenHotShare: 0.4, dishwasherLPerRack: 3, racksPerCover: 0.3, housekeepingLPerClean: 15, housekeepingHotShare: 0.3, staffLPerFTEDay: 30, staffHotShare: 0.4, coolingTowerM3PerYear: 0, waterTreatmentLossShare: 0, rainwaterM3PerYear: 0 },
    pools: [],
    spa: { enabled: false, saunas: 0, saunaKW: 9, saunaHoursPerOpenDay: 8, steamRooms: 0, steamKW: 12, steamHoursPerOpenDay: 8, hotTubs: 0, hotTubKWhPerDay: 20, treatmentsPerYear: 0, spaShowerLPerVisit: 40 },
    irrigation: { landscapedAreaM2: 0, cropCoefficient: 0.7, irrigationEfficiency: 0.7, effectiveRainShare: 0.7, leakShare: 0.05, irrigatedMonths: [0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0], reclaimedShare: 0 },
    lighting: [],
    textiles: [],
    inHouseLaundry: { machineCapacityKg: 20, loadFactor: 0.8, waterLPerCycle: 160, electricityKWhPerCycle: 1.2, thermalKWhPerCycle: 8, thermalCarrier: 'electricity', washTempC: 60, detergentGPerKg: 12, detergentFactorId: 'detergent', dryerTech: 'electric', residualMoisture: 0.5, dryerKWhPerKgWater: 1.0, ironerKWhPerKg: 0.5, ironerCarrier: 'electricity', heatRecoveryShare: 0, standbyKWhPerDay: 1, labourMinutesPerKg: 3, maintenanceEURPerYear: 500 },
    outsourcedLaundry: { supplier: 'Demonstration laundry', factorKgPerKg: null, factorBoundaryIncludesTransport: false, factorSourceNote: '', pricePerKgEUR: 2.2, minChargePerCollectionEUR: 0, collectionsPerWeek: 2, roundTripKm: 40, vehicleFactorId: 'van_diesel_vkm', routeAllocationShare: 0.2, packagingKgPerCollection: 0.5 },
    cleaning: { departureCleanMinutes: 30, stayoverCleanMinutes: 18, stayoverSkipShare: 0, publicAreaCleanM2PerDay: 0, publicAreaMinutesPer100M2: 15, chemicalMlPerClean: 25, chemicalFactorId: 'cleaning_concentrate', chemicalPricePerL: 8, linersPerClean: 2, linerKg: 0.01, wipesPerClean: 1, glovesPairsPerClean: 0.3, vacuumKWhPerClean: 0.12, labourCostEURPerHour: 25, includeLabourInCosts: false, staffHoursCapacityPerYear: 0 },
    amenities: [],
    food: {
      breakfastBasket: {}, mainStandardBasket: {}, mainVegetarianBasket: {}, vegetarianUptake: 0.1, staffMealBasket: {}, barBasket: {}, banquetMealsPerAttendee: 1, buffetBreakfast: true, overproductionShare: 0.1, prepLossShare: 0.1, spoilageShare: 0.03, plateWasteShare: 0.1,
      donationShareOfOverproduction: 0, foodWasteRoute: 'biowaste', measuredPurchasesKg: null, foodPricePerKg: {}, factorsIncludeTransport: true, transportTkmPerKg: 0, cookingKWhPerCover: 1, cookingGasShare: 0, refrigerationKWhPerDay: 10, extractionKW: 0, extractionHoursPerOpenDay: 0, dishwasherKWhPerRack: 0.05, iceMachineKWhPerDay: 0,
    },
    vehicles: [],
    commuting: { oneWayKm: 10, onSiteDaysPerFTE: 210, modes: { car: 0.6, car_ev: 0.05, train: 0.15, bus: 0.1, bike_walk: 0.1, employer_shuttle: 0 }, carOccupancy: 1.1, remoteWorkShare: 0, shuttleCoveredByFleet: true },
    businessTravel: { trainPkm: 0, shortFlightPkm: 0, longFlightPkm: 0, carKm: 0, hotelNightsElsewhere: 0 },
    guestTravel: { origins: [], carOccupancy: 2.2, evShareOfCars: 0.05, roundTrip: true, multipurposeTripShare: 0, lastLegCoveredByHotelShuttle: 0, lastLegKm: 0, excursionsKmPerStay: 0, excursionFactorId: 'car_petrol_vkm' },
    deliveries: [],
    refrigerants: [],
    fireSuppressionReleaseKg: 0,
    fireSuppressionAgent: 'HFC-227ea',
    waste: [],
    assets: [],
    services: [],
    electricity: { supplier: 'Demonstration supplier', priceEnergyHP: 0.135, priceEnergyHC: 0.105, offPeakShare: 0.3, networkVariablePerKWh: 0.032, excisePerKWh: 0.0258, fixedPerYear: 1000, greenTariff: false, goCoveredShare: 0, supplierMarketFactor: null, residualMixFactor: null, priceSourceNote: 'Demonstration contract values (see Data Library price records).' },
    fuels: { gasPricePerKWh: 0.075, gasFixedPerYear: 0, gasExcisePerKWh: 0.016, dieselPerL: 1.38, petrolPerL: 1.42, heatingOilPerL: 1.0, lpgPerKg: 2.2, pelletsPerTonne: 330, districtHeatPerKWh: 0.1 },
    water: { potablePerM3: 2.2, wastewaterPerM3: 2.0, fixedPerYear: 100, wastewaterBasis: 'all_metered', privateTreatmentCostPerYear: 0, septicBODgPerGuestNight: 40 },
    solar: { enabled: false, kWp: 0, simultaneityShare: 0.6, batteryKWh: 0, batteryCyclesPerMonth: 25, batteryRoundTrip: 0.9, exportPricePerKWh: 0.011, roofAreaM2Available: 0, m2PerKWp: 5.5 },
    generator: { enabled: false, kW: 0, testHoursPerYear: 12, outageHoursPerYear: 0, loadShare: 0.5, litresPerKWh: 0.28 },
    maintenanceFuel: { dieselL: 0, petrolL: 0 },
    guestEvCharging: { enabled: false, shareOfStays: 0.05, kWhPerCharge: 20, rechargedPricePerKWh: 0 },
    measured: { useMeasured: false, electricityKWh: new Array(12).fill(null), gasKWhPCS: new Array(12).fill(null), waterM3: new Array(12).fill(null), laundryKgOutsourced: new Array(12).fill(null), fleetDieselL: null, fleetPetrolL: null },
    bnb: null,
    finance: { horizonYears: 15, realDiscountRate: 0.05, energyRealEscalation: 0.01, productRealEscalation: 0.005, maintenanceRealEscalation: 0.01, vatRecoverable: true, revenueEUR: null, hypotheticalCarbonPricePerT: 100 },
    constraints: { capexBudgetEUR: null, maxPaybackYears: null, minHeatingSetpointC: 20, maxCoolingSetpointC: 26, minTowelLengthCm: null, minTowelGsm: null, maxHousekeepingHours: null, roofAreaM2: null, waterAvailabilityM3: null },
    statusOverrides: {},
    capex: [],
  };
}
