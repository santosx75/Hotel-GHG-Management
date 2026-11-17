import type { GlobalSettings, Library, PropertyId, PropertyInputs } from '../types';
import { CLIMATES } from './climate';
import { FACTORS, GWP } from './factors';
import { PRICES } from './prices';
import { SOURCES } from './sources';
import { independentBnb } from './seeds/bnb';
import { cityHotel } from './seeds/cityHotel';
import { islandResort } from './seeds/islandResort';

export function defaultLibrary(): Library {
  return {
    factors: Object.fromEntries(FACTORS.map((f) => [f.id, { ...f }])),
    prices: Object.fromEntries(PRICES.map((p) => [p.id, { ...p }])),
    gwp: Object.fromEntries(GWP.map((g) => [g.gas, { ...g }])),
    climates: Object.fromEntries(CLIMATES.map((c) => [c.id, { ...c }])),
    sources: Object.fromEntries(SOURCES.map((s) => [s.id, { ...s }])),
  };
}

export const DEFAULT_SETTINGS: GlobalSettings = {
  gwpSet: 'AR6',
  aviationNonCO2: 'separate',
  aviationNonCO2Multiplier: 1.83,
  scope2Primary: 'location',
  staleAfterMonths: 12,
  showOnboarding: true,
  analyticsView: 'corporate',
};

export const SEEDS: Record<PropertyId, () => PropertyInputs> = {
  'city-hotel': cityHotel,
  'island-resort': islandResort,
  'independent-bnb': independentBnb,
};

export const PROPERTY_IDS: PropertyId[] = ['city-hotel', 'island-resort', 'independent-bnb'];
