/**
 * Core domain types for Hotel Carbon Lab.
 * Canonical units: energy kWh (gas in kWh PCS / HHV), water m³, mass kg, distance km,
 * money EUR excluding VAT, emissions kgCO2e. Formatting happens only in the UI layer.
 */

export type M12 = number[]; // 12 monthly values, Jan..Dec

export type PropertyId = 'city-hotel' | 'island-resort' | 'independent-bnb';

/** How a value was obtained. Missing ≠ zero ≠ not applicable ≠ not assessed. */
export type DataStatus =
  | 'measured'
  | 'disaggregated' // split from a measured total
  | 'modelled' // bottom-up engineering estimate
  | 'estimated' // benchmark / proxy estimate
  | 'assumed' // fictional demonstration operating assumption
  | 'imported'
  | 'missing'
  | 'not_applicable'
  | 'not_assessed';

export type Verification =
  | 'secondary_report' // value seen in a secondary source via web search; primary doc not opened
  | 'recalled_unverified' // from prior knowledge; not re-verified at research date
  | 'demonstration' // illustrative placeholder
  | 'derived' // computed from other recorded values
  | 'physical_constant'
  | 'user';

export type SourceStatus =
  | 'in_force'
  | 'draft'
  | 'consultation'
  | 'outdated'
  | 'commercial_claim'
  | 'secondary_report'
  | 'demonstration'
  | 'regulation';

export interface SourceRecord {
  id: string;
  title: string;
  publisher: string;
  url?: string;
  researchedOn: string;
  publicationDate?: string;
  observationYear?: string;
  effectiveDate?: string;
  version?: string;
  geography: string;
  customerCategory?: string;
  units?: string;
  taxTreatment?: string;
  boundary?: string;
  licence: string;
  status: SourceStatus;
  limitations: string;
  accessNote: string;
}

export type LifeStage =
  | 'combustion'
  | 'generation'
  | 'upstream_fuel'
  | 'transmission_losses'
  | 'manufacture'
  | 'transport'
  | 'use'
  | 'end_of_life'
  | 'treatment'
  | 'full_lifecycle';

export type Geography = 'FR-mainland' | 'FR-corsica' | 'FR-overseas' | 'FR-any' | 'EU' | 'global';

export interface EmissionFactor {
  id: string;
  version: string;
  name: string;
  value: number;
  unit: string; // e.g. kgCO2e/kWh
  activityUnit: string; // e.g. kWh
  stages: LifeStage[];
  includesTransport?: boolean;
  geography: Geography[];
  sourceId: string;
  verification: Verification;
  observationYear?: string;
  notes?: string;
  low?: number;
  high?: number;
  /** For biomass: kg biogenic CO2 per activity unit, reported outside scopes. */
  biogenicCO2?: number;
}

export type PriceKind =
  | 'observed_current'
  | 'observed_older'
  | 'indexed_estimate'
  | 'user_contract'
  | 'demonstration';

export interface PriceRecord {
  id: string;
  name: string;
  value: number; // EUR excl. VAT per unit
  unit: string;
  vatRate: number;
  customerCategory: string;
  geography: Geography[];
  effectiveDate?: string;
  lastVerified: string;
  sourceId: string;
  kind: PriceKind;
  applicabilityWarning?: string;
  low?: number;
  high?: number;
}

export interface GwpRecord {
  gas: string;
  AR5: number;
  AR6: number;
  verification: Verification;
  sourceId: string;
}

export interface ClimateProfile {
  id: string;
  name: string;
  geography: Geography;
  meanTempC: M12;
  dailyTempSdC: M12;
  coldWaterC: M12;
  solarGainWPerM2Glazing: M12; // mean 24-h incident on average glazing orientation
  pvYieldKWhPerKWp: M12;
  rainfallMm: M12;
  et0Mm: M12; // reference evapotranspiration
  outdoorPoolEvapLPerM2Day: M12;
  sourceId: string;
  verification: Verification;
}

// ─────────────────────────────── Property inputs ───────────────────────────────

export interface RoomType {
  id: string;
  name: string;
  count: number;
  areaM2: number;
  beds: number;
  maxGuests: number;
  guestsPerOccupiedRoom: number;
  occupancyIndex: number; // multiplier on reference monthly occupancy
}

export interface ActivityInputs {
  roomTypes: RoomType[];
  monthlyOpenDays: M12;
  monthlyOccupancy: M12; // 0..1 reference occupancy
  avgLengthOfStayNights: number;
  outOfOrderRate: number;
  dayUseRoomsPerYear: number;
  staffHeadcount: number;
  staffFTE: number;
  workingDaysPerFTE: number;
  staffAccommodationBeds: number;
  publicAreaM2: number;
  guestroomAreaM2Override: number | null; // null → sum of room types
  backOfHouseM2: number;
  meetingAreaM2: number;
  breakfastUptake: number; // share of guest-nights
  dinnerUptake: number; // share of guest-nights
  externalCoversPerOpenDay: number;
  roomServiceOrdersPerOccRoomNight: number;
  barCustomersPerOpenDay: number;
  eventAttendeesPerYear: number;
  meetingRoomHoursPerYear: number;
  spaDayVisitorsPerYear: number;
  poolDayVisitorsPerYear: number;
  staffMealsPerFTEDay: number;
  childrenShareOfGuests: number;
}

export type HeatTech = 'gas_boiler' | 'oil_boiler' | 'lpg_boiler' | 'heat_pump' | 'electric_resistance' | 'district_heat' | 'wood_pellet_boiler';

export interface HeatSystem {
  tech: HeatTech;
  seasonalEfficiency: number; // boilers (fraction) / resistance
  scop: number; // heat pumps
  copModel: 'seasonal' | 'temperature';
  carnotFraction: number; // used when copModel = temperature
  supplyTempC: number;
  backupResistanceShare: number; // fraction of heat from electric backup
  defrostAllowance: number; // fraction extra electricity (heat pumps)
  distributionLoss: number; // fraction of delivered heat lost
}

export interface BuildingInputs {
  conditionedAreaM2: number;
  volumeM3: number;
  buildYear: number;
  renovationYear: number | null;
  wallAreaM2: number;
  wallU: number;
  roofAreaM2: number;
  roofU: number;
  floorAreaM2: number;
  floorU: number;
  windowAreaM2: number;
  windowU: number;
  glazingG: number;
  shadingFactor: number; // 0..1 fraction of solar gain admitted
  infiltrationACH: number;
  mechVentilationM3h: number;
  requiredVentilationM3h: number;
  heatRecoveryEff: number;
  heatingSetpointC: number;
  coolingSetpointC: number;
  unoccupiedSetbackK: number;
  roomControlsEnabled: boolean; // key-card / occupancy setback of unsold & unoccupied rooms
  windowInterlocks: boolean;
  windowOpeningExtraACH: number; // extra air change in occupied guestrooms from opened windows (user estimate)
  preconditioningHours: number; // hours before arrival during which setback is lifted
  closedFrostSetpointC: number;
  heating: HeatSystem;
  coolingEnabled: boolean;
  coolingSEER: number;
  fanPumpPowerKW: number;
  fanPumpHoursPerOpenDay: number;
  variableSpeedSaving: number; // fraction of fan/pump energy avoided by VSD, user-sourced
  plugLoadWPerM2: number;
  plugLoadHoursPerDay: number;
  baseLoadKW: number; // continuous (lifts standby, IT, security, standby when closed)
  otherElectricKWhPerOccRoomNight: number; // minibars, TVs, in-room devices
  peopleGainWPerGuest: number;
  guestPresenceShare: number; // share of day guests present in building
}

export interface DhwInputs {
  storageTempC: number;
  loopReturnTempC: number;
  showerMixTempC: number;
  basinMixTempC: number;
  storageLossKWhPerDay: number;
  loopLengthM: number;
  loopLossWPerM: number;
  pipeInsulationImprovement: number; // fraction reduction of loop loss
  heatRecoveryShare: number; // share of DHW demand covered by recovered heat
  system: HeatSystem;
  sameAsSpaceHeating: boolean;
}

export interface BathroomInputs {
  showerFlowLPerMin: number;
  showerMinutes: number;
  showersPerGuestNight: number;
  bathVolumeL: number;
  bathsPerGuestNight: number;
  basinFlowLPerMin: number;
  basinMinutesPerGuestNight: number;
  basinHotShare: number;
  toiletFullFlushL: number;
  toiletPartFlushL: number;
  dualFlushPartShare: number;
  flushesPerGuestNight: number;
  leakM3PerDay: number;
  lowFlowUptake: number; // share of rooms with low-flow showers fitted
  lowFlowShowerLPerMin: number;
  showerRebound: number; // relative increase in shower duration where low-flow fitted
}

export interface OtherWaterInputs {
  kitchenLPerCover: number;
  kitchenHotShare: number;
  dishwasherLPerRack: number;
  racksPerCover: number;
  housekeepingLPerClean: number;
  housekeepingHotShare: number;
  staffLPerFTEDay: number;
  staffHotShare: number;
  coolingTowerM3PerYear: number;
  waterTreatmentLossShare: number;
  rainwaterM3PerYear: number; // substitutes mains for irrigation/toilets
}

export interface PoolInputs {
  id: string;
  name: string;
  indoor: boolean;
  areaM2: number;
  volumeM3: number;
  openMonths: M12; // 1 = open
  waterTempC: number;
  hallAirTempC: number;
  indoorEvapKgPerM2H: number;
  surfaceLossWPerM2K: number;
  coverUsed: boolean;
  coverHoursPerDay: number;
  coverEvapReduction: number;
  backwashM3PerWeek: number;
  pumpKW: number;
  pumpHoursPerDay: number;
  heating: HeatSystem;
  dehumidKWhPerKgEvap: number;
  chemicalsKgPerYear: number;
}

export interface SpaInputs {
  enabled: boolean;
  saunas: number;
  saunaKW: number;
  saunaHoursPerOpenDay: number;
  steamRooms: number;
  steamKW: number;
  steamHoursPerOpenDay: number;
  hotTubs: number;
  hotTubKWhPerDay: number;
  treatmentsPerYear: number;
  spaShowerLPerVisit: number;
}

export interface IrrigationInputs {
  landscapedAreaM2: number;
  cropCoefficient: number;
  irrigationEfficiency: number;
  effectiveRainShare: number;
  leakShare: number;
  irrigatedMonths: M12;
  reclaimedShare: number;
}

export type LampTech = 'incandescent' | 'halogen' | 'cfl' | 'fluorescent_t8' | 'led';
export type ReplacementPolicy = 'on_failure' | 'group';

export interface LightingZone {
  id: string;
  name: string;
  luminaires: number;
  lampsPerLuminaire: number;
  wattsPerLamp: number;
  driverWPerLuminaire: number;
  standbyWPerLuminaire: number;
  hoursPerDay: number;
  basis: 'open_days' | 'all_days';
  occupancyLinked: boolean;
  controlSaving: number; // fraction reduction from occupancy/daylight controls (user-sourced)
  tech: LampTech;
  lumensPerLamp: number;
  ratedLifeHours: number;
  weibullShape: number;
  calendarLifeYears: number;
  policy: ReplacementPolicy;
  groupIntervalHours: number;
  lampPriceEUR: number;
  labourPerLampEUR: number;
  embodiedKgPerLamp: number;
  inConditionedSpace: boolean;
}

export type TextileBasis = 'per_room' | 'per_bed' | 'per_guest' | 'per_pool_visit' | 'per_cover' | 'per_fte_day' | 'per_treatment';
export type LaundryStream = 'in_house' | 'outsourced';

export interface TextileItem {
  id: string;
  name: string;
  lengthCm: number;
  widthCm: number;
  gsm: number | null;
  measuredMassKg: number | null;
  massModel: 'rectangle' | 'measured' | 'garment';
  garmentMassKg: number | null;
  material: string;
  recycledContent: number;
  supplier: string;
  manufacturingCountry: string;
  factorId: string; // textile production factor per kg
  unitCostEUR: number;
  placedPer: number; // quantity per basis unit
  basis: TextileBasis;
  parLevel: number; // stock pars
  changeOnDeparture: boolean;
  stayoverIntervalNights: number; // 0 = never on stayover
  reuseParticipation: number; // share of stayover changes avoided
  requestChangesPerStay: number;
  usageRatePerBasis: number; // for per_pool_visit / per_cover / per_fte_day items: items used per unit
  rewashRate: number;
  lossRatePerYear: number; // share of stock lost/stolen per year
  rejectionRate: number; // share of washes ending in rejection
  lifeWashCycles: number;
  calendarLifeYears: number;
  existingStock: number | null;
  tumbleDried: boolean;
  ironed: boolean;
  stream: LaundryStream;
  minLengthCm: number | null; // service constraint
  minGsm: number | null;
  endOfLife: 'residual' | 'textile_recycling' | 'reuse_rags';
}

export interface InHouseLaundry {
  machineCapacityKg: number;
  loadFactor: number;
  waterLPerCycle: number;
  electricityKWhPerCycle: number;
  thermalKWhPerCycle: number;
  thermalCarrier: 'natural_gas' | 'electricity' | 'dhw';
  washTempC: number;
  detergentGPerKg: number;
  detergentFactorId: string;
  dryerTech: 'gas' | 'electric' | 'heat_pump';
  residualMoisture: number; // kg water / kg dry textile after extraction
  dryerKWhPerKgWater: number;
  ironerKWhPerKg: number;
  ironerCarrier: 'natural_gas' | 'electricity';
  heatRecoveryShare: number;
  standbyKWhPerDay: number;
  labourMinutesPerKg: number;
  maintenanceEURPerYear: number;
}

export interface OutsourcedLaundry {
  supplier: string;
  factorKgPerKg: number | null; // supplier-declared kgCO2e per kg washed; null = missing
  factorBoundaryIncludesTransport: boolean;
  factorSourceNote: string;
  pricePerKgEUR: number;
  minChargePerCollectionEUR: number;
  collectionsPerWeek: number;
  roundTripKm: number;
  vehicleFactorId: string;
  routeAllocationShare: number; // share of the vehicle route attributable to this hotel
  packagingKgPerCollection: number;
}

export interface CleaningInputs {
  departureCleanMinutes: number;
  stayoverCleanMinutes: number;
  stayoverSkipShare: number; // green-choice skipped cleans
  publicAreaCleanM2PerDay: number;
  publicAreaMinutesPer100M2: number;
  chemicalMlPerClean: number;
  chemicalFactorId: string;
  chemicalPricePerL: number;
  linersPerClean: number;
  linerKg: number;
  wipesPerClean: number;
  glovesPairsPerClean: number;
  vacuumKWhPerClean: number;
  labourCostEURPerHour: number;
  includeLabourInCosts: boolean;
  staffHoursCapacityPerYear: number; // constraint
}

export type AmenityBasis = 'guest_night' | 'stay' | 'occupied_room_night' | 'departure';

export interface AmenityItem {
  id: string;
  name: string;
  basis: AmenityBasis;
  quantityPerBasis: number;
  consumedShare: number;
  productMassG: number;
  packagingMassG: number;
  kgCO2ePerUnit: number; // cradle-to-gate incl. packaging, product-specific or demonstration
  unitPriceEUR: number;
  refillable: boolean;
  dispenserCount: number;
  dispenserLifeYears: number;
  dispenserEmbodiedKg: number;
  dispenserPriceEUR: number;
  enabled: boolean;
}

export type FoodCategory =
  | 'beef' | 'lamb' | 'pork' | 'poultry' | 'fish_seafood' | 'eggs' | 'dairy' | 'cheese' | 'plant_protein'
  | 'cereals' | 'bread_pastry' | 'fruit' | 'vegetables' | 'oils' | 'coffee' | 'tea' | 'chocolate'
  | 'wine' | 'beer' | 'spirits' | 'soft_drinks' | 'bottled_water';

export type Basket = Partial<Record<FoodCategory, number>>; // kg (or L) per cover

export interface FoodInputs {
  breakfastBasket: Basket;
  mainStandardBasket: Basket;
  mainVegetarianBasket: Basket;
  vegetarianUptake: number;
  staffMealBasket: Basket;
  barBasket: Basket;
  banquetMealsPerAttendee: number;
  buffetBreakfast: boolean;
  overproductionShare: number;
  prepLossShare: number;
  spoilageShare: number;
  plateWasteShare: number;
  donationShareOfOverproduction: number;
  foodWasteRoute: 'biowaste' | 'residual';
  measuredPurchasesKg: Partial<Record<FoodCategory, number>> | null;
  foodPricePerKg: Partial<Record<FoodCategory, number>>;
  factorsIncludeTransport: boolean;
  transportTkmPerKg: number; // used only when factors exclude transport
  cookingKWhPerCover: number;
  cookingGasShare: number;
  refrigerationKWhPerDay: number;
  extractionKW: number;
  extractionHoursPerOpenDay: number;
  dishwasherKWhPerRack: number;
  iceMachineKWhPerDay: number;
}

export type Powertrain = 'diesel' | 'petrol' | 'bev' | 'lpg' | 'boat_diesel' | 'boat_petrol';

export interface Vehicle {
  id: string;
  name: string;
  role: 'guest_shuttle' | 'executive_car' | 'delivery_van' | 'golf_cart' | 'grounds' | 'boat' | 'other';
  count: number;
  powertrain: Powertrain;
  kmPerYear: number; // or hours for boats (see usesHours)
  usesHours: boolean;
  fuelLPer100Km: number; // or L/h for boats
  kWhPer100Km: number;
  chargingLoss: number;
  chargedOnSite: boolean;
  purchaseCostEUR: number;
  embodiedKg: number;
  acquisitionYear: number;
  lifeYears: number;
  maintenanceEURPerYear: number;
  replacement: null | {
    year: number;
    powertrain: Powertrain;
    fuelLPer100Km: number;
    kWhPer100Km: number;
    purchaseCostEUR: number;
    embodiedKg: number;
    maintenanceEURPerYear: number;
  };
}

export interface ModeShare {
  car: number;
  car_ev: number;
  train: number;
  bus: number;
  bike_walk: number;
  employer_shuttle: number;
}

export interface CommutingInputs {
  oneWayKm: number;
  onSiteDaysPerFTE: number;
  modes: ModeShare;
  carOccupancy: number;
  remoteWorkShare: number;
  shuttleCoveredByFleet: boolean;
}

export interface BusinessTravelInputs {
  trainPkm: number;
  shortFlightPkm: number;
  longFlightPkm: number;
  carKm: number;
  hotelNightsElsewhere: number;
}

export type TravelArrangement = 'independent' | 'hotel_sold' | 'hotel_purchased_transfer';

export interface GuestOrigin {
  id: string;
  label: string;
  shareOfArrivals: number;
  oneWayKm: number;
  modes: { train: number; car: number; plane_short: number; plane_long: number; coach: number };
  ferryKm: number;
  arrangement: TravelArrangement;
}

export interface GuestTravelInputs {
  origins: GuestOrigin[];
  carOccupancy: number;
  evShareOfCars: number;
  roundTrip: boolean;
  multipurposeTripShare: number; // share of trip not attributed to this stay
  lastLegCoveredByHotelShuttle: number; // share of arrivals whose final leg is the hotel's own shuttle
  lastLegKm: number;
  excursionsKmPerStay: number;
  excursionFactorId: string;
}

export interface TransportLeg {
  mode: 'road_truck' | 'road_van' | 'rail' | 'sea' | 'ferry_freight' | 'air';
  km: number;
}

export interface DeliveryFlow {
  id: string;
  supplier: string;
  productGroup: string;
  deliveriesPerYear: number;
  kgPerDelivery: number;
  method: 'tonne_km' | 'dedicated_vehicle';
  legs: TransportLeg[];
  dedicatedRoundTripKm: number;
  dedicatedVehicleFactorId: string;
  routeAllocationShare: number;
  refrigerated: boolean;
  refrigerationUplift: number; // user-sourced uplift on t-km factor
  includedInProductFactor: boolean;
  costPerDeliveryEUR: number;
}

export interface RefrigerantUnit {
  id: string;
  name: string;
  refrigerant: string;
  chargeKg: number;
  annualLeakRate: number;
  measuredTopUpKg: number | null;
  retiredThisYear: boolean;
  retirementYear?: number | null; // when set, retirement losses occur only in this year (multi-year safe)
  recoveryEfficiency: number;
  serviceCostEURPerYear: number;
}

export type WasteTreatment = 'incineration_energy_recovery' | 'landfill' | 'recycling' | 'composting' | 'anaerobic_digestion' | 'hazardous_treatment';

export interface WasteStream {
  id: string;
  name: string;
  kgPerYear: number | null;
  kgPerGuestNight: number | null;
  measurement: 'weighed' | 'volume_estimate' | 'benchmark' | 'missing';
  treatment: WasteTreatment;
  factorId: string;
  feePerTonneEUR: number;
  liftsPerYear: number;
  feePerLiftEUR: number;
  linkedToFoodModule: boolean;
}

export interface CapitalAsset {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unitEmbodiedKg: number | null;
  unitCostEUR: number;
  acquisitionYear: number;
  usefulLifeYears: number;
  embodiedSource: string;
}

export interface PurchasedService {
  id: string;
  name: string;
  spendEUR: number;
  spendYear: number;
  factorId: string;
  physicallyModelledElsewhere: boolean;
}

export interface ElectricityContract {
  supplier: string;
  priceEnergyHP: number;
  priceEnergyHC: number;
  offPeakShare: number;
  networkVariablePerKWh: number;
  excisePerKWh: number;
  fixedPerYear: number;
  greenTariff: boolean;
  goCoveredShare: number;
  supplierMarketFactor: number | null; // kgCO2e/kWh (generation), null = not provided
  residualMixFactor: number | null;
  priceSourceNote: string;
}

export interface FuelContract {
  gasPricePerKWh: number;
  gasFixedPerYear: number;
  gasExcisePerKWh: number;
  dieselPerL: number;
  petrolPerL: number;
  heatingOilPerL: number;
  lpgPerKg: number;
  pelletsPerTonne: number;
  districtHeatPerKWh: number;
}

export interface WaterContract {
  potablePerM3: number;
  wastewaterPerM3: number;
  fixedPerYear: number;
  wastewaterBasis: 'all_metered' | 'excluding_irrigation_submeter' | 'private_treatment';
  privateTreatmentCostPerYear: number;
  septicBODgPerGuestNight: number;
}

export interface SolarInputs {
  enabled: boolean;
  kWp: number;
  simultaneityShare: number; // share of generation coinciding with on-site demand without storage
  batteryKWh: number;
  batteryCyclesPerMonth: number;
  batteryRoundTrip: number;
  exportPricePerKWh: number;
  roofAreaM2Available: number;
  m2PerKWp: number;
}

export interface GeneratorInputs {
  enabled: boolean;
  kW: number;
  testHoursPerYear: number;
  outageHoursPerYear: number;
  loadShare: number;
  litresPerKWh: number;
}

export interface MeasuredData {
  useMeasured: boolean;
  electricityKWh: (number | null)[]; // 12, grid import
  gasKWhPCS: (number | null)[];
  waterM3: (number | null)[];
  laundryKgOutsourced: (number | null)[];
  fleetDieselL: number | null;
  fleetPetrolL: number | null;
}

export type S3Status = 'included' | 'estimated' | 'not_applicable' | 'not_assessed' | 'excluded' | 'missing';

export interface Scope3Screen {
  cat: number;
  status: S3Status;
  justification: string;
}

export interface BoundaryInputs {
  reportingEntity: string;
  ownership: 'owned' | 'leased' | 'managed' | 'franchised';
  consolidation: 'operational_control' | 'financial_control' | 'equity_share';
  reportingYear: number;
  baseYear: number;
  includedBuildings: string;
  restaurantsIncluded: boolean;
  concessionsIncluded: boolean;
  concessionNote: string;
  sharedServicesNote: string;
  outsourcedActivitiesNote: string;
  openingsClosuresNote: string;
  renovationNote: string;
  scope3: Scope3Screen[];
}

export interface BnbAllocation {
  method: 'dedicated_meter' | 'floor_area' | 'occupied_nights' | 'direct_measurement' | 'user_defined';
  businessFloorShare: number;
  householdPersons: number;
  householdNightsPerYear: number;
  userShare: number;
  measuredBusinessShare: number | null;
  sharedServiceKeys: string[];
}

export interface FinanceInputs {
  horizonYears: number;
  realDiscountRate: number;
  energyRealEscalation: number;
  productRealEscalation: number;
  maintenanceRealEscalation: number;
  vatRecoverable: boolean;
  revenueEUR: number | null;
  hypotheticalCarbonPricePerT: number;
}

export interface Constraints {
  capexBudgetEUR: number | null;
  maxPaybackYears: number | null;
  minHeatingSetpointC: number;
  maxCoolingSetpointC: number;
  minTowelLengthCm: number | null;
  minTowelGsm: number | null;
  maxHousekeepingHours: number | null;
  roofAreaM2: number | null;
  waterAvailabilityM3: number | null;
}

export interface Profile {
  name: string;
  positioning: string;
  commune: string;
  inseeCode: string;
  department: string;
  region: string;
  geoContext: 'mainland' | 'corsica' | 'overseas';
  climateProfileId: string;
  rtClimateZone: string;
  electricityContextNote: string;
  waterContextNote: string;
  description: string;
}

export interface PropertyInputs {
  id: PropertyId;
  schemaVersion: number;
  profile: Profile;
  boundary: BoundaryInputs;
  mode: 'simple' | 'advanced';
  activity: ActivityInputs;
  building: BuildingInputs;
  dhw: DhwInputs;
  bathrooms: BathroomInputs;
  otherWater: OtherWaterInputs;
  pools: PoolInputs[];
  spa: SpaInputs;
  irrigation: IrrigationInputs;
  lighting: LightingZone[];
  textiles: TextileItem[];
  inHouseLaundry: InHouseLaundry;
  outsourcedLaundry: OutsourcedLaundry;
  cleaning: CleaningInputs;
  amenities: AmenityItem[];
  food: FoodInputs;
  vehicles: Vehicle[];
  commuting: CommutingInputs;
  businessTravel: BusinessTravelInputs;
  guestTravel: GuestTravelInputs;
  deliveries: DeliveryFlow[];
  refrigerants: RefrigerantUnit[];
  fireSuppressionReleaseKg: number;
  fireSuppressionAgent: string;
  waste: WasteStream[];
  assets: CapitalAsset[];
  services: PurchasedService[];
  electricity: ElectricityContract;
  fuels: FuelContract;
  water: WaterContract;
  solar: SolarInputs;
  generator: GeneratorInputs;
  maintenanceFuel: { dieselL: number; petrolL: number };
  guestEvCharging: { enabled: boolean; shareOfStays: number; kWhPerCharge: number; rechargedPricePerKWh: number };
  measured: MeasuredData;
  bnb: BnbAllocation | null;
  finance: FinanceInputs;
  constraints: Constraints;
  /** User-declared status overrides per input path (e.g. 'bathrooms.showerFlowLPerMin' → 'measured'). */
  statusOverrides: Record<string, DataStatus>;
  /** Scenario capital items (interventions). */
  capex: CapexItem[];
}

export interface CapexItem {
  id: string;
  label: string;
  amountEUR: number;
  year: number; // implementation year
  embodiedKg: number;
  lifeYears: number;
  category: string;
  interventionId?: string;
}

// ─────────────────────────────── Results ───────────────────────────────

export type Scope = 'S1' | 'S2' | 'S3' | 'OUT';
export type ViewId = 'corporate' | 'hcmi' | 'visitor' | 'lca';

export type Department =
  | 'Rooms'
  | 'Housekeeping & Laundry'
  | 'Food & Beverage'
  | 'Spa, Pool & Leisure'
  | 'Engineering & Building'
  | 'Grounds'
  | 'Fleet & Logistics'
  | 'Staff & Administration'
  | 'Guest travel';

export interface CalcLine {
  id: string;
  activityId: string;
  label: string;
  module: string;
  department: Department;
  scope: Scope;
  s3cat?: number;
  views: ViewId[];
  activity: number;
  activityUnit: string;
  factorId?: string;
  factorVersion?: string;
  factorValue?: number;
  factorUnit?: string;
  kg: number; // location-based for scope 2
  kgMB?: number | null; // only for scope 2: market-based; null = not available
  monthly: M12;
  status: DataStatus;
  stages: LifeStage[];
  formula: string;
  inputs: Record<string, string | number>;
  notes?: string[];
  outsideInventoryReason?: string; // for OUT lines
}

export interface CostLine {
  id: string;
  label: string;
  category: 'energy' | 'water' | 'laundry' | 'products' | 'food' | 'waste' | 'maintenance' | 'labour' | 'fleet' | 'services' | 'revenue_offset';
  department: Department;
  fixed: number;
  variable: number;
  total: number;
  vatRate: number;
  monthly: M12;
  status: DataStatus;
  notes?: string;
}

export interface Warning {
  level: 'info' | 'warn' | 'error';
  module: string;
  message: string;
}

export interface SuppressedItem {
  activityId: string;
  label: string;
  reason: string;
  kgAvoidedDoubleCount: number;
}

export interface FlowSet {
  endUses: Record<string, M12>;
  total: M12;
  status: DataStatus;
}

export interface ActivityMetrics {
  availableRoomNights: M12;
  occupiedRoomNights: M12;
  guestNights: M12;
  stays: M12; // room-stays (= departures)
  arrivingGuests: M12;
  stayoverRoomNights: M12;
  openDays: M12;
  occupancyRate: M12;
  rooms: number;
  beds: number;
  guestroomAreaM2: number;
  covers: { breakfast: M12; mainMeals: M12; roomService: M12; banquet: M12; staff: M12; bar: M12 };
}

export interface CalculationResult {
  propertyId: PropertyId;
  modelVersion: string;
  activity: ActivityMetrics;
  lines: CalcLine[];
  costs: CostLine[];
  energy: Record<string, FlowSet>; // carrier → end uses (kWh; gas kWh PCS)
  modelledEnergyBeforeCalibration: Record<string, M12>;
  calibration: Record<string, { measured: number | null; modelled: number; residual: number | null; factors: M12 | null }>;
  water: FlowSet & { dischargedToSewer: M12; mainsM3: M12 };
  wasteKg: Record<string, number>;
  laundry: {
    kgWashedInHouse: number;
    kgWashedOutsourced: number;
    loads: number;
    piecesWashed: Record<string, number>;
    kgByItem: Record<string, number>;
    purchasesPerYear: Record<string, number>;
    massPerItemKg: Record<string, number>;
  };
  solar: { generation: M12; selfConsumed: M12; exported: M12; gridImport: M12; demand: M12 };
  warnings: Warning[];
  suppressed: SuppressedItem[];
  missing: string[];
  totals: Totals;
  capexTotal: number;
}

export interface Totals {
  scope1: number;
  scope2LB: number;
  scope2MB: number | null;
  scope3: number;
  scope3ByCat: Record<number, number>;
  outsideScopes: number;
  biogenicCO2: number;
  corporateLB: number;
  corporateMB: number | null;
  hcmi: number;
  visitor: number;
  lca: number;
  guestTravel: number;
  guestTravelNonCO2: number;
  energyKWh: number;
  electricityKWh: number;
  waterM3: number;
  wasteKg: number;
  opexEUR: number;
  opexFixedEUR: number;
  partialInventory: boolean;
  perOccupiedRoomNight: number | null;
  perGuestNight: number | null;
  hcmiPerOccupiedRoom: number | null;
  hcmiPerMeetingM2Hour: number | null;
  perRevenueEUR: number | null;
}

export interface GlobalSettings {
  gwpSet: 'AR5' | 'AR6';
  aviationNonCO2: 'excluded' | 'separate' | 'included';
  aviationNonCO2Multiplier: number;
  scope2Primary: 'location' | 'market';
  staleAfterMonths: number;
  showOnboarding: boolean;
  analyticsView: ViewId;
}

export interface Library {
  factors: Record<string, EmissionFactor>;
  prices: Record<string, PriceRecord>;
  gwp: Record<string, GwpRecord>;
  climates: Record<string, ClimateProfile>;
  sources: Record<string, SourceRecord>;
}

export interface CalibrationRef {
  /** monthly scale factors per carrier derived from the baseline measured bills */
  factors: Record<string, M12 | null>;
}
