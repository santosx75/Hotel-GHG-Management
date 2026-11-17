import type { EmissionFactor, GwpRecord } from '../types';

/**
 * Emission factor library (physical factors only — never prices).
 * verification:
 *  - secondary_report: value seen in a secondary source on the research date; primary not opened
 *  - recalled_unverified: order-of-magnitude reference value from prior literature; not re-verified
 *  - demonstration: illustrative placeholder
 *  - derived: computed from other records (see notes)
 */
const F = (f: Omit<EmissionFactor, 'version'> & { version?: string }): EmissionFactor => ({ version: '2026.11-demo', ...f });

export const FACTORS: EmissionFactor[] = [
  // ── Electricity (France mainland interconnected system) ──
  F({ id: 'elec_fr_lca', name: 'Electricity, France mainland, average consumption mix, life-cycle', value: 0.052, low: 0.041, high: 0.06, unit: 'kgCO2e/kWh', activityUnit: 'kWh', stages: ['full_lifecycle'], geography: ['FR-mainland'], sourceId: 'ademe-base-empreinte', verification: 'secondary_report', observationYear: '2021–2024 smoothed', notes: 'Reported as Base Empreinte "Électricité 2024 – mix moyen consommation", 52 g incl. 3.8 g T&D. Ember 2025 life-cycle 41.4 g used as low bound (different method).' }),
  F({ id: 'elec_fr_generation', name: 'Electricity, France mainland, direct generation emissions (Scope 2 location-based)', value: 0.0196, low: 0.015, high: 0.03, unit: 'kgCO2e/kWh', activityUnit: 'kWh', stages: ['generation'], geography: ['FR-mainland'], sourceId: 'rte-direct', verification: 'secondary_report', notes: 'Direct combustion at power plants as reported for RTE. Vintage differs from life-cycle factor.' }),
  F({ id: 'elec_fr_upstream', name: 'Electricity, France mainland, upstream + T&D losses (Scope 3 cat. 3)', value: 0.0324, unit: 'kgCO2e/kWh', activityUnit: 'kWh', stages: ['upstream_fuel', 'transmission_losses', 'manufacture'], geography: ['FR-mainland'], sourceId: 'ademe-base-empreinte', verification: 'derived', notes: 'Derived = life-cycle (0.052) − generation (0.0196). Mixed vintages → low data quality.' }),
  // ── Fuels (combustion = Scope 1; upstream = Scope 3 cat. 3) ──
  F({ id: 'gas_combustion', name: 'Natural gas, combustion (per kWh PCS/HHV)', value: 0.1683, low: 0.16, high: 0.18, unit: 'kgCO2e/kWh PCS', activityUnit: 'kWh PCS', stages: ['combustion'], geography: ['FR-mainland'], sourceId: 'recalled', verification: 'derived', notes: 'Derived from recalled 0.187 kgCO2e/kWh PCI × 0.9 PCI/PCS. Verify in Base Empreinte.' }),
  F({ id: 'gas_upstream', name: 'Natural gas, upstream (per kWh PCS)', value: 0.0471, low: 0.03, high: 0.06, unit: 'kgCO2e/kWh PCS', activityUnit: 'kWh PCS', stages: ['upstream_fuel'], geography: ['FR-mainland'], sourceId: 'banque-france-beges-gas', verification: 'derived', notes: 'Derived = 0.2154 (reported total, Base Carbone v23.9, 2022 mix) − 0.1683 combustion.' }),
  F({ id: 'heating_oil_combustion', name: 'Heating oil (fioul domestique), combustion', value: 2.68, unit: 'kgCO2e/L', activityUnit: 'L', stages: ['combustion'], geography: ['FR-any'], sourceId: 'recalled', verification: 'recalled_unverified' }),
  F({ id: 'heating_oil_upstream', name: 'Heating oil, upstream', value: 0.56, unit: 'kgCO2e/L', activityUnit: 'L', stages: ['upstream_fuel'], geography: ['FR-any'], sourceId: 'recalled', verification: 'recalled_unverified' }),
  F({ id: 'diesel_combustion', name: 'Diesel (B7), combustion', value: 2.49, unit: 'kgCO2e/L', activityUnit: 'L', stages: ['combustion'], geography: ['FR-any'], sourceId: 'recalled', verification: 'recalled_unverified' }),
  F({ id: 'diesel_upstream', name: 'Diesel (B7), upstream', value: 0.61, unit: 'kgCO2e/L', activityUnit: 'L', stages: ['upstream_fuel'], geography: ['FR-any'], sourceId: 'recalled', verification: 'recalled_unverified' }),
  F({ id: 'petrol_combustion', name: 'Petrol (SP95-E10), combustion', value: 2.24, unit: 'kgCO2e/L', activityUnit: 'L', stages: ['combustion'], geography: ['FR-any'], sourceId: 'recalled', verification: 'recalled_unverified' }),
  F({ id: 'petrol_upstream', name: 'Petrol, upstream', value: 0.56, unit: 'kgCO2e/L', activityUnit: 'L', stages: ['upstream_fuel'], geography: ['FR-any'], sourceId: 'recalled', verification: 'recalled_unverified' }),
  F({ id: 'lpg_combustion', name: 'LPG (propane), combustion', value: 2.94, unit: 'kgCO2e/kg', activityUnit: 'kg', stages: ['combustion'], geography: ['FR-any'], sourceId: 'recalled', verification: 'recalled_unverified' }),
  F({ id: 'lpg_upstream', name: 'LPG, upstream', value: 0.37, unit: 'kgCO2e/kg', activityUnit: 'kg', stages: ['upstream_fuel'], geography: ['FR-any'], sourceId: 'recalled', verification: 'recalled_unverified' }),
  F({ id: 'pellet_combustion_nonco2', name: 'Wood pellets, combustion CH4+N2O (fossil-equivalent inventory part)', value: 0.0042, unit: 'kgCO2e/kWh', activityUnit: 'kWh', stages: ['combustion'], geography: ['FR-any'], sourceId: 'recalled', verification: 'recalled_unverified', biogenicCO2: 0.39, notes: 'Biogenic CO2 (≈0.39 kg/kWh) reported separately, outside scopes. Biomass is NOT treated as zero-carbon: non-CO2 gases and upstream are counted.' }),
  F({ id: 'pellet_upstream', name: 'Wood pellets, production & transport', value: 0.025, unit: 'kgCO2e/kWh', activityUnit: 'kWh', stages: ['upstream_fuel'], geography: ['FR-any'], sourceId: 'demo', verification: 'demonstration' }),
  F({ id: 'district_heat_demo', name: 'District heat (placeholder — network-specific factor required)', value: 0.15, unit: 'kgCO2e/kWh', activityUnit: 'kWh', stages: ['generation'], geography: ['FR-any'], sourceId: 'demo', verification: 'demonstration', notes: 'French networks publish individual factors; replace with the network value.' }),
  // ── Water ──
  F({ id: 'water_supply', name: 'Mains drinking water supply', value: 0.13, low: 0.05, high: 0.4, unit: 'kgCO2e/m³', activityUnit: 'm³', stages: ['full_lifecycle'], geography: ['FR-any'], sourceId: 'recalled', verification: 'recalled_unverified', notes: 'Does not include island desalination uplift.' }),
  F({ id: 'wastewater_treatment', name: 'Collective wastewater treatment', value: 0.26, low: 0.1, high: 0.6, unit: 'kgCO2e/m³', activityUnit: 'm³', stages: ['treatment'], geography: ['FR-any'], sourceId: 'recalled', verification: 'recalled_unverified' }),
  // ── Textiles (cradle-to-gate per kg finished product; demonstration — product-specific data preferred) ──
  F({ id: 'textile_cotton_terry', name: 'Cotton terry towelling (conventional)', value: 20, low: 8, high: 35, unit: 'kgCO2e/kg', activityUnit: 'kg', stages: ['manufacture', 'transport'], includesTransport: true, geography: ['global'], sourceId: 'demo', verification: 'demonstration', notes: 'Wide literature range; footprint does not scale perfectly with mass or price.' }),
  F({ id: 'textile_cotton_percale', name: 'Cotton percale bed linen', value: 18, low: 8, high: 30, unit: 'kgCO2e/kg', activityUnit: 'kg', stages: ['manufacture', 'transport'], includesTransport: true, geography: ['global'], sourceId: 'demo', verification: 'demonstration' }),
  F({ id: 'textile_polycotton', name: 'Polyester-cotton 50/50 flat linen', value: 15, low: 7, high: 25, unit: 'kgCO2e/kg', activityUnit: 'kg', stages: ['manufacture', 'transport'], includesTransport: true, geography: ['global'], sourceId: 'demo', verification: 'demonstration' }),
  F({ id: 'textile_recycled_cotton', name: 'Cotton with recycled content (50%)', value: 13, low: 6, high: 22, unit: 'kgCO2e/kg', activityUnit: 'kg', stages: ['manufacture', 'transport'], includesTransport: true, geography: ['global'], sourceId: 'demo', verification: 'demonstration' }),
  F({ id: 'textile_polyester_fill', name: 'Polyester-filled duvets/pillows', value: 9, unit: 'kgCO2e/kg', activityUnit: 'kg', stages: ['manufacture', 'transport'], includesTransport: true, geography: ['global'], sourceId: 'demo', verification: 'demonstration' }),
  F({ id: 'textile_linen_flax', name: 'Linen (flax) table textiles', value: 10, unit: 'kgCO2e/kg', activityUnit: 'kg', stages: ['manufacture', 'transport'], includesTransport: true, geography: ['EU'], sourceId: 'demo', verification: 'demonstration' }),
  // ── Chemicals & consumables ──
  F({ id: 'detergent', name: 'Laundry detergent (professional)', value: 2.0, unit: 'kgCO2e/kg', activityUnit: 'kg', stages: ['manufacture', 'transport'], includesTransport: true, geography: ['EU'], sourceId: 'demo', verification: 'demonstration' }),
  F({ id: 'cleaning_concentrate', name: 'Cleaning chemical concentrate', value: 1.5, unit: 'kgCO2e/L', activityUnit: 'L', stages: ['manufacture', 'transport'], includesTransport: true, geography: ['EU'], sourceId: 'demo', verification: 'demonstration' }),
  F({ id: 'ldpe_film', name: 'LDPE bin liners / film', value: 2.6, unit: 'kgCO2e/kg', activityUnit: 'kg', stages: ['manufacture'], geography: ['EU'], sourceId: 'demo', verification: 'demonstration' }),
  F({ id: 'pool_chemicals', name: 'Pool treatment chemicals (chlorine products)', value: 1.2, unit: 'kgCO2e/kg', activityUnit: 'kg', stages: ['manufacture'], geography: ['EU'], sourceId: 'demo', verification: 'demonstration' }),
  // ── Food (per kg/L purchased; ORDER-OF-MAGNITUDE demonstration, not AGRIBALYSE item values) ──
  ...([
    ['beef', 'Beef', 30, 20, 45], ['lamb', 'Lamb', 28, 18, 40], ['pork', 'Pork', 7, 5, 10], ['poultry', 'Poultry', 5.5, 3.5, 8],
    ['fish_seafood', 'Fish & seafood', 8, 3, 20], ['eggs', 'Eggs', 2.8, 2, 4], ['dairy', 'Milk & yoghurt', 1.4, 1, 2], ['cheese', 'Cheese', 7, 5, 10],
    ['plant_protein', 'Plant proteins (pulses, tofu)', 1.2, 0.6, 2.5], ['cereals', 'Cereals, rice, pasta', 1.3, 0.8, 3], ['bread_pastry', 'Bread & pastries', 1.6, 1, 3],
    ['fruit', 'Fruit', 0.8, 0.3, 3], ['vegetables', 'Vegetables', 0.7, 0.3, 2.5], ['oils', 'Oils & fats', 3.5, 2, 6], ['coffee', 'Coffee (roasted)', 15, 8, 25],
    ['tea', 'Tea (dry)', 5, 3, 10], ['chocolate', 'Chocolate', 12, 5, 20], ['wine', 'Wine (per L)', 1.3, 0.9, 2], ['beer', 'Beer (per L)', 0.9, 0.6, 1.3],
    ['spirits', 'Spirits (per L)', 3, 2, 5], ['soft_drinks', 'Soft drinks (per L)', 0.45, 0.3, 0.7], ['bottled_water', 'Bottled water (per L)', 0.25, 0.15, 0.4],
  ] as const).map(([id, name, v, lo, hi]) =>
    F({ id: `food_${id}`, name: `${name} — purchased`, value: v, low: lo, high: hi, unit: 'kgCO2e/kg', activityUnit: 'kg', stages: ['full_lifecycle'], includesTransport: true, geography: ['FR-any'], sourceId: 'agribalyse-32', verification: 'demonstration', notes: 'Order-of-magnitude placeholder pending import of AGRIBALYSE v3.2 synthesis values (farm-to-retail incl. transport & packaging).' }),
  ),
  // ── Passenger transport ──
  F({ id: 'car_petrol_vkm', name: 'Car, average thermal, per vehicle-km', value: 0.218, low: 0.142, high: 0.25, unit: 'kgCO2e/vkm', activityUnit: 'vehicle-km', stages: ['full_lifecycle'], geography: ['FR-any'], sourceId: 'ademe-impactco2', verification: 'secondary_report', notes: 'Reported Impact CO2 value per km for a single occupant → treated as per vehicle-km and divided by occupancy.' }),
  F({ id: 'car_bev_vkm', name: 'Car, battery electric (France), per vehicle-km', value: 0.103, low: 0.06, high: 0.13, unit: 'kgCO2e/vkm', activityUnit: 'vehicle-km', stages: ['full_lifecycle'], geography: ['FR-mainland'], sourceId: 'demo', verification: 'demonstration' }),
  F({ id: 'train_hsr_pkm', name: 'High-speed train (TGV), per passenger-km', value: 0.00293, low: 0.0024, high: 0.005, unit: 'kgCO2e/pkm', activityUnit: 'passenger-km', stages: ['full_lifecycle'], geography: ['FR-mainland'], sourceId: 'ademe-impactco2', verification: 'secondary_report', notes: 'Occupancy embedded — do not divide by occupancy again.' }),
  F({ id: 'train_regional_pkm', name: 'Regional/intercity train mix, per passenger-km', value: 0.025, unit: 'kgCO2e/pkm', activityUnit: 'passenger-km', stages: ['full_lifecycle'], geography: ['FR-mainland'], sourceId: 'demo', verification: 'demonstration' }),
  F({ id: 'plane_short_pkm', name: 'Aircraft, short-haul (500–1000 km), CO2 + upstream, excl. non-CO2', value: 0.126, low: 0.1, high: 0.18, unit: 'kgCO2e/pkm', activityUnit: 'passenger-km', stages: ['combustion', 'upstream_fuel'], geography: ['global'], sourceId: 'ademe-impactco2', verification: 'secondary_report', notes: 'Reported 126 g excl. contrails, 230 g incl. contrails → default non-CO2 multiplier 1.83 (derived).' }),
  F({ id: 'plane_long_pkm', name: 'Aircraft, long-haul, excl. non-CO2', value: 0.1, low: 0.08, high: 0.13, unit: 'kgCO2e/pkm', activityUnit: 'passenger-km', stages: ['combustion', 'upstream_fuel'], geography: ['global'], sourceId: 'demo', verification: 'demonstration' }),
  F({ id: 'coach_pkm', name: 'Coach, per passenger-km', value: 0.03, unit: 'kgCO2e/pkm', activityUnit: 'passenger-km', stages: ['full_lifecycle'], geography: ['FR-any'], sourceId: 'demo', verification: 'demonstration' }),
  F({ id: 'bus_urban_pkm', name: 'Urban bus/metro mix, per passenger-km', value: 0.05, unit: 'kgCO2e/pkm', activityUnit: 'passenger-km', stages: ['full_lifecycle'], geography: ['FR-any'], sourceId: 'demo', verification: 'demonstration' }),
  F({ id: 'ferry_pkm', name: 'Passenger ferry (short crossing), per passenger-km', value: 0.12, low: 0.05, high: 0.3, unit: 'kgCO2e/pkm', activityUnit: 'passenger-km', stages: ['combustion', 'upstream_fuel'], geography: ['FR-any'], sourceId: 'demo', verification: 'demonstration' }),
  F({ id: 'taxi_vkm', name: 'Taxi / VTC per vehicle-km', value: 0.2, unit: 'kgCO2e/vkm', activityUnit: 'vehicle-km', stages: ['full_lifecycle'], geography: ['FR-any'], sourceId: 'demo', verification: 'demonstration' }),
  F({ id: 'hotel_night_fr', name: 'Hotel night elsewhere (business travel)', value: 8, unit: 'kgCO2e/night', activityUnit: 'night', stages: ['full_lifecycle'], geography: ['FR-any'], sourceId: 'demo', verification: 'demonstration' }),
  // ── Freight ──
  F({ id: 'van_diesel_vkm', name: 'Diesel van (<3.5 t), per vehicle-km (incl. empty running)', value: 0.27, unit: 'kgCO2e/vkm', activityUnit: 'vehicle-km', stages: ['combustion', 'upstream_fuel'], geography: ['FR-any'], sourceId: 'demo', verification: 'demonstration' }),
  F({ id: 'truck_rigid_vkm', name: 'Rigid truck (12 t), per vehicle-km', value: 0.75, unit: 'kgCO2e/vkm', activityUnit: 'vehicle-km', stages: ['combustion', 'upstream_fuel'], geography: ['FR-any'], sourceId: 'demo', verification: 'demonstration' }),
  F({ id: 'road_truck_tkm', name: 'Road freight, articulated/rigid mix, per tonne-km (average load & empty return)', value: 0.12, low: 0.08, high: 0.2, unit: 'kgCO2e/tkm', activityUnit: 'tonne-km', stages: ['combustion', 'upstream_fuel'], geography: ['FR-any'], sourceId: 'demo', verification: 'demonstration' }),
  F({ id: 'road_van_tkm', name: 'Van delivery, per tonne-km', value: 0.9, unit: 'kgCO2e/tkm', activityUnit: 'tonne-km', stages: ['combustion', 'upstream_fuel'], geography: ['FR-any'], sourceId: 'demo', verification: 'demonstration' }),
  F({ id: 'rail_tkm', name: 'Rail freight (France), per tonne-km', value: 0.005, unit: 'kgCO2e/tkm', activityUnit: 'tonne-km', stages: ['full_lifecycle'], geography: ['FR-mainland'], sourceId: 'demo', verification: 'demonstration' }),
  F({ id: 'sea_tkm', name: 'Container ship, per tonne-km', value: 0.015, unit: 'kgCO2e/tkm', activityUnit: 'tonne-km', stages: ['combustion', 'upstream_fuel'], geography: ['global'], sourceId: 'demo', verification: 'demonstration' }),
  F({ id: 'ferry_freight_tkm', name: 'Ro-pax island ferry freight, per tonne-km', value: 0.2, low: 0.08, high: 0.4, unit: 'kgCO2e/tkm', activityUnit: 'tonne-km', stages: ['combustion', 'upstream_fuel'], geography: ['FR-any'], sourceId: 'demo', verification: 'demonstration', notes: 'Allocation between passengers and freight on ro-pax vessels is method-dependent.' }),
  F({ id: 'air_tkm', name: 'Air freight, per tonne-km', value: 1.5, unit: 'kgCO2e/tkm', activityUnit: 'tonne-km', stages: ['combustion', 'upstream_fuel'], geography: ['global'], sourceId: 'demo', verification: 'demonstration' }),
  // ── Waste treatment (cut-off approach; no recycling credits) ──
  F({ id: 'waste_residual_incineration', name: 'Residual waste, incineration with energy recovery', value: 0.36, unit: 'kgCO2e/kg', activityUnit: 'kg', stages: ['treatment', 'transport'], geography: ['FR-any'], sourceId: 'recalled', verification: 'recalled_unverified' }),
  F({ id: 'waste_residual_landfill', name: 'Residual waste, landfill', value: 0.5, unit: 'kgCO2e/kg', activityUnit: 'kg', stages: ['treatment', 'transport'], geography: ['FR-any'], sourceId: 'demo', verification: 'demonstration' }),
  F({ id: 'waste_recycling_collection', name: 'Dry recyclables, collection & sorting only (no avoided-burden credit)', value: 0.03, unit: 'kgCO2e/kg', activityUnit: 'kg', stages: ['treatment', 'transport'], geography: ['FR-any'], sourceId: 'demo', verification: 'demonstration' }),
  F({ id: 'waste_food_composting', name: 'Food/bio-waste, composting', value: 0.05, unit: 'kgCO2e/kg', activityUnit: 'kg', stages: ['treatment', 'transport'], geography: ['FR-any'], sourceId: 'demo', verification: 'demonstration' }),
  F({ id: 'waste_food_ad', name: 'Food/bio-waste, anaerobic digestion', value: 0.03, unit: 'kgCO2e/kg', activityUnit: 'kg', stages: ['treatment', 'transport'], geography: ['FR-any'], sourceId: 'demo', verification: 'demonstration' }),
  F({ id: 'waste_food_residual', name: 'Food waste in residual stream (incineration)', value: 0.05, unit: 'kgCO2e/kg', activityUnit: 'kg', stages: ['treatment', 'transport'], geography: ['FR-any'], sourceId: 'demo', verification: 'demonstration', notes: 'Treatment only. Production footprint of wasted food is already in purchased food (no double count).' }),
  F({ id: 'waste_hazardous', name: 'Hazardous waste treatment', value: 0.4, unit: 'kgCO2e/kg', activityUnit: 'kg', stages: ['treatment', 'transport'], geography: ['FR-any'], sourceId: 'demo', verification: 'demonstration' }),
  F({ id: 'waste_weee', name: 'WEEE / lamps take-back', value: 0.05, unit: 'kgCO2e/kg', activityUnit: 'kg', stages: ['treatment', 'transport'], geography: ['FR-any'], sourceId: 'demo', verification: 'demonstration' }),
  F({ id: 'waste_green_composting', name: 'Green waste composting', value: 0.04, unit: 'kgCO2e/kg', activityUnit: 'kg', stages: ['treatment', 'transport'], geography: ['FR-any'], sourceId: 'demo', verification: 'demonstration' }),
  // ── Spend-based (EEIO-style fallback; currency EUR, price year in observationYear) ──
  F({ id: 'spend_services_generic', name: 'Spend-based: professional services', value: 0.12, unit: 'kgCO2e/EUR', activityUnit: 'EUR (2022 prices, excl. VAT)', stages: ['full_lifecycle'], geography: ['FR-any'], sourceId: 'demo', verification: 'demonstration', observationYear: '2022', notes: 'Spend-based fallback — disclosed as low quality.' }),
  F({ id: 'spend_maintenance', name: 'Spend-based: maintenance & repair services', value: 0.2, unit: 'kgCO2e/EUR', activityUnit: 'EUR (2022 prices, excl. VAT)', stages: ['full_lifecycle'], geography: ['FR-any'], sourceId: 'demo', verification: 'demonstration', observationYear: '2022' }),
  F({ id: 'spend_it_telecom', name: 'Spend-based: IT, cloud & telecom', value: 0.15, unit: 'kgCO2e/EUR', activityUnit: 'EUR (2022 prices, excl. VAT)', stages: ['full_lifecycle'], geography: ['FR-any'], sourceId: 'demo', verification: 'demonstration', observationYear: '2022' }),
  F({ id: 'spend_marketing', name: 'Spend-based: marketing & printing', value: 0.18, unit: 'kgCO2e/EUR', activityUnit: 'EUR (2022 prices, excl. VAT)', stages: ['full_lifecycle'], geography: ['FR-any'], sourceId: 'demo', verification: 'demonstration', observationYear: '2022' }),
  F({ id: 'spend_security_landscaping', name: 'Spend-based: security & landscaping services', value: 0.1, unit: 'kgCO2e/EUR', activityUnit: 'EUR (2022 prices, excl. VAT)', stages: ['full_lifecycle'], geography: ['FR-any'], sourceId: 'demo', verification: 'demonstration', observationYear: '2022' }),
  F({ id: 'spend_franchise_fees', name: 'Spend-based: management/franchise fees', value: 0.08, unit: 'kgCO2e/EUR', activityUnit: 'EUR (2022 prices, excl. VAT)', stages: ['full_lifecycle'], geography: ['FR-any'], sourceId: 'demo', verification: 'demonstration', observationYear: '2022' }),
];

export const FACTOR_MAP: Record<string, EmissionFactor> = Object.fromEntries(FACTORS.map((f) => [f.id, f]));

/** GWP (100-year). AR6 values for single HFCs from secondary references; blends derived by mass fraction. */
export const GWP: GwpRecord[] = [
  { gas: 'R-410A', AR5: 1924, AR6: 2256, verification: 'secondary_report', sourceId: 'gwp-ar6' },
  { gas: 'R-32', AR5: 677, AR6: 771, verification: 'secondary_report', sourceId: 'gwp-ar6' },
  { gas: 'R-134a', AR5: 1300, AR6: 1530, verification: 'secondary_report', sourceId: 'gwp-ar6' },
  { gas: 'R-404A', AR5: 3943, AR6: 4728, verification: 'secondary_report', sourceId: 'gwp-ar6' },
  { gas: 'R-407C', AR5: 1624, AR6: 1908, verification: 'derived', sourceId: 'gwp-ar6' },
  { gas: 'R-290', AR5: 3, AR6: 0.02, verification: 'recalled_unverified', sourceId: 'recalled' },
  { gas: 'R-744', AR5: 1, AR6: 1, verification: 'physical_constant', sourceId: 'physics' },
  { gas: 'R-1234ze', AR5: 1, AR6: 1.37, verification: 'recalled_unverified', sourceId: 'recalled' },
  { gas: 'HFC-227ea', AR5: 3350, AR6: 3600, verification: 'recalled_unverified', sourceId: 'recalled' },
  { gas: 'CH4 (biogenic)', AR5: 28, AR6: 27, verification: 'recalled_unverified', sourceId: 'recalled' },
  { gas: 'N2O', AR5: 265, AR6: 273, verification: 'recalled_unverified', sourceId: 'recalled' },
];
export const GWP_MAP = Object.fromEntries(GWP.map((g) => [g.gas, g]));

/** French CPI annual index (2022 = 100). Recalled approximations — verify with INSEE before use. */
export const CPI_FR: Record<number, number> = { 2020: 93.6, 2021: 95.1, 2022: 100, 2023: 104.9, 2024: 107.0, 2025: 108.1, 2026: 109.3 };
