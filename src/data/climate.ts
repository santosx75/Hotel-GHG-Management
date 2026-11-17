import type { ClimateProfile } from '../types';

/**
 * Monthly climate profiles. ALL values are demonstration approximations consistent with typical
 * 1991–2020 normals for the area; they were NOT downloaded from Météo-France during research.
 * Replace via Data Library → climate import (Météo-France DJU / normals) for real use.
 */
export const CLIMATES: ClimateProfile[] = [
  {
    id: 'paris', name: 'Paris (approx. Paris-Montsouris normals)', geography: 'FR-mainland',
    meanTempC: [5.0, 5.8, 9.0, 11.9, 15.5, 18.6, 20.8, 20.5, 17.0, 13.0, 8.4, 5.6],
    dailyTempSdC: [3.6, 3.6, 3.4, 3.2, 3.0, 3.0, 3.0, 3.0, 3.0, 3.2, 3.4, 3.6],
    coldWaterC: [10, 9, 10, 12, 14, 16, 18, 19, 18, 16, 13, 11],
    solarGainWPerM2Glazing: [20, 32, 50, 68, 80, 85, 88, 78, 60, 40, 24, 17],
    pvYieldKWhPerKWp: [35, 55, 90, 120, 135, 140, 145, 130, 100, 70, 40, 30],
    rainfallMm: [50, 44, 49, 53, 65, 55, 63, 62, 50, 62, 52, 58],
    et0Mm: [10, 18, 40, 65, 95, 110, 125, 105, 68, 35, 14, 9],
    outdoorPoolEvapLPerM2Day: [1, 1.2, 2, 3, 4, 5, 5.5, 5, 3.5, 2, 1.2, 1],
    sourceId: 'demo', verification: 'demonstration',
  },
  {
    id: 'belle-ile', name: 'Belle-Île-en-Mer (approx. Le Palais / Bangor maritime normals)', geography: 'FR-mainland',
    meanTempC: [8.6, 8.4, 10.0, 11.6, 14.3, 16.9, 18.6, 18.9, 17.3, 14.8, 11.6, 9.4],
    dailyTempSdC: [2.4, 2.4, 2.4, 2.3, 2.2, 2.2, 2.2, 2.2, 2.2, 2.3, 2.4, 2.4],
    coldWaterC: [10, 9.5, 10, 11, 13, 15, 17, 18, 17, 15, 13, 11],
    solarGainWPerM2Glazing: [22, 35, 55, 75, 88, 92, 95, 85, 66, 44, 26, 19],
    pvYieldKWhPerKWp: [40, 60, 100, 135, 150, 155, 160, 145, 115, 75, 45, 35],
    rainfallMm: [90, 70, 60, 55, 55, 40, 40, 40, 55, 85, 95, 100],
    et0Mm: [12, 20, 45, 70, 100, 115, 130, 110, 75, 40, 18, 11],
    outdoorPoolEvapLPerM2Day: [1.5, 1.6, 2.5, 3.2, 4, 4.8, 5.5, 5.2, 4, 2.8, 1.8, 1.5],
    sourceId: 'demo', verification: 'demonstration',
  },
  {
    id: 'dordogne', name: 'Vézère valley, Dordogne (approx. Périgord inland normals)', geography: 'FR-mainland',
    meanTempC: [5.6, 6.5, 9.6, 12.0, 15.7, 19.3, 21.4, 21.2, 17.9, 14.0, 9.0, 6.1],
    dailyTempSdC: [3.8, 3.8, 3.6, 3.4, 3.2, 3.2, 3.2, 3.2, 3.2, 3.4, 3.6, 3.8],
    coldWaterC: [9, 9, 11, 13, 15, 17, 19, 19, 18, 15, 12, 10],
    solarGainWPerM2Glazing: [24, 37, 56, 72, 84, 92, 96, 87, 68, 45, 27, 20],
    pvYieldKWhPerKWp: [45, 65, 100, 125, 140, 150, 160, 145, 115, 80, 50, 40],
    rainfallMm: [80, 65, 65, 80, 80, 65, 55, 60, 70, 85, 90, 90],
    et0Mm: [12, 20, 45, 70, 100, 125, 140, 120, 80, 40, 17, 11],
    outdoorPoolEvapLPerM2Day: [1, 1.2, 2, 3, 4.2, 5.2, 5.8, 5.3, 3.8, 2.2, 1.3, 1],
    sourceId: 'demo', verification: 'demonstration',
  },
  {
    id: 'ajaccio', name: 'Ajaccio, Corsica (approx.) — non-interconnected electricity zone', geography: 'FR-corsica',
    meanTempC: [9.0, 9.3, 11.0, 13.3, 17.0, 20.8, 23.6, 24.0, 21.0, 17.6, 13.2, 10.2],
    dailyTempSdC: [2.6, 2.6, 2.6, 2.5, 2.4, 2.4, 2.4, 2.4, 2.4, 2.5, 2.6, 2.6],
    coldWaterC: [12, 12, 13, 14, 17, 20, 22, 23, 22, 19, 16, 13],
    solarGainWPerM2Glazing: [32, 45, 64, 80, 94, 102, 106, 96, 76, 56, 36, 28],
    pvYieldKWhPerKWp: [70, 85, 120, 145, 165, 175, 185, 170, 135, 105, 75, 65],
    rainfallMm: [70, 60, 55, 55, 40, 20, 10, 20, 50, 85, 100, 85],
    et0Mm: [25, 35, 60, 85, 120, 150, 175, 155, 105, 65, 35, 25],
    outdoorPoolEvapLPerM2Day: [2, 2.2, 3, 3.8, 5, 6, 6.8, 6.4, 5, 3.6, 2.4, 2],
    sourceId: 'demo', verification: 'demonstration',
  },
];

export const CLIMATE_MAP: Record<string, ClimateProfile> = Object.fromEntries(CLIMATES.map((c) => [c.id, c]));
