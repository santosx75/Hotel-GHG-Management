import type { ActivityMetrics, ClimateProfile } from '../types';
import type { Acc } from './context';
import { deliverHeat } from './heat';
import { AIR_WH_PER_M3K, DAYS_IN_MONTH, cdd, clamp01, hdd, map12 } from './util';

export interface BuildingModelOutput {
  heatLossCoefficientWK: number;
  heatingThermal: number[];
  coolingThermal: number[];
  balanceTempHeating: number[];
}

/**
 * Monthly degree-day heat-balance model (documented simplification, not a dynamic simulation).
 *   H = Σ U·A (+ 0.5 ground correction on floor) + 0.34·[q_mech·(1−η_HR) + ACH·V]  (W/K)
 *   T_balance = T_setpoint,eff − (internal + solar gains) / H
 *   Q_heat = H · HDD(T_balance) · 24 / 1000 · (1 + distribution loss)
 * Gains include lighting in conditioned zones (so lighting changes interact with heating/cooling).
 * Not modelled: thermal mass dynamics, latent cooling loads, simultaneous heating/cooling, zoning detail.
 */
export function runBuilding(acc: Acc, act: ActivityMetrics, climate: ClimateProfile): BuildingModelOutput {
  const b = acc.p.building;
  const st = acc.status('building', 'modelled');
  const Htr = b.wallU * b.wallAreaM2 + b.roofU * b.roofAreaM2 + 0.5 * b.floorU * b.floorAreaM2 + b.windowU * b.windowAreaM2;
  const guestroomShare = clamp01(act.guestroomAreaM2 / Math.max(1, b.conditionedAreaM2));
  const extraWindowACH = b.windowInterlocks ? 0 : Math.max(0, b.windowOpeningExtraACH);
  const Hve = (occ: number) =>
    AIR_WH_PER_M3K * (b.mechVentilationM3h * (1 - clamp01(b.heatRecoveryEff)) + (b.infiltrationACH + extraWindowACH * occ * guestroomShare) * b.volumeM3);

  // Plug & base loads (electricity + gains)
  const plugElec = map12((m) => (b.plugLoadWPerM2 * b.conditionedAreaM2 * b.plugLoadHoursPerDay * act.openDays[m]) / 1000);
  const baseElec = map12((m) => b.baseLoadKW * 24 * DAYS_IN_MONTH[m]);
  const roomElec = map12((m) => act.occupiedRoomNights[m] * b.otherElectricKWhPerOccRoomNight);
  acc.addEnergy({ carrier: 'electricity', endUse: 'Plug loads & equipment', department: 'Engineering & Building', monthly: plugElec, status: st, module: 'building' });
  acc.addEnergy({ carrier: 'electricity', endUse: 'Continuous base load (IT, lifts, security, standby)', department: 'Engineering & Building', monthly: baseElec, status: st, module: 'building' });
  acc.addEnergy({ carrier: 'electricity', endUse: 'In-room devices (TV, minibar, chargers)', department: 'Rooms', monthly: roomElec, status: st, module: 'building' });
  acc.addGains(map12((m) => ((plugElec[m] + baseElec[m] + roomElec[m]) * 1000) / (DAYS_IN_MONTH[m] * 24)));

  const heating = new Array(12).fill(0);
  const cooling = new Array(12).fill(0);
  const balance = new Array(12).fill(0);
  for (let m = 0; m < 12; m++) {
    const days = DAYS_IN_MONTH[m];
    const openFrac = clamp01(act.openDays[m] / days);
    const occ = act.occupancyRate[m];
    const presence = clamp01(b.guestPresenceShare);
    const setbackShare = b.roomControlsEnabled
      ? guestroomShare * ((1 - occ) + occ * (1 - presence)) * (1 - clamp01(b.preconditioningHours / 24))
      : 0;
    const tHeat = b.heatingSetpointC - b.unoccupiedSetbackK * setbackShare;
    const tCool = b.coolingSetpointC + b.unoccupiedSetbackK * setbackShare;
    const people = act.openDays[m] > 0 ? (act.guestNights[m] / act.openDays[m]) * b.peopleGainWPerGuest * presence : 0;
    const solar = b.windowAreaM2 * b.glazingG * clamp01(b.shadingFactor) * climate.solarGainWPerM2Glazing[m];
    // internal gains are monthly means over all days → convert to "while open" mean
    const internalOpen = openFrac > 0 ? acc.internalGainsW[m] / openFrac : 0;
    const gainsOpen = internalOpen + people + solar;
    const H = Htr + Hve(occ);
    const tbOpen = tHeat - gainsOpen / H;
    balance[m] = tbOpen;
    const qOpen = (H * hdd(tbOpen, climate.meanTempC[m], climate.dailyTempSdC[m], days) * 24) / 1000;
    const gainsClosed = b.baseLoadKW * 1000 + solar;
    const tbClosed = b.closedFrostSetpointC - gainsClosed / (Htr + Hve(0));
    const qClosed = ((Htr + Hve(0)) * hdd(tbClosed, climate.meanTempC[m], climate.dailyTempSdC[m], days) * 24) / 1000;
    heating[m] = (qOpen * openFrac + qClosed * (1 - openFrac)) * (1 + Math.max(0, b.heating.distributionLoss));
    if (b.coolingEnabled) {
      const tbc = tCool - gainsOpen / H;
      cooling[m] = ((H * cdd(tbc, climate.meanTempC[m], climate.dailyTempSdC[m], days) * 24) / 1000) * openFrac;
    }
  }
  deliverHeat(acc, b.heating, heating, 'Space heating', 'Engineering & Building', climate, st, 'building');
  if (b.coolingEnabled) {
    acc.addEnergy({ carrier: 'electricity', endUse: 'Space cooling', department: 'Engineering & Building', monthly: cooling.map((q) => q / Math.max(0.5, b.coolingSEER)), status: st, module: 'building' });
  }
  const fans = map12((m) => b.fanPumpPowerKW * b.fanPumpHoursPerOpenDay * act.openDays[m] * (1 - clamp01(b.variableSpeedSaving)));
  acc.addEnergy({ carrier: 'electricity', endUse: 'Ventilation fans & pumps', department: 'Engineering & Building', monthly: fans, status: st, module: 'building' });

  // Service & safety constraints
  const c = acc.p.constraints;
  if (b.heatingSetpointC < c.minHeatingSetpointC) acc.warn('warn', 'comfort', `Heating setpoint ${b.heatingSetpointC} °C is below the comfort constraint of ${c.minHeatingSetpointC} °C.`);
  if (b.coolingEnabled && b.coolingSetpointC > c.maxCoolingSetpointC) acc.warn('warn', 'comfort', `Cooling setpoint ${b.coolingSetpointC} °C exceeds the comfort constraint of ${c.maxCoolingSetpointC} °C.`);
  if (b.mechVentilationM3h < b.requiredVentilationM3h) acc.warn('error', 'indoor air quality', `Mechanical ventilation (${b.mechVentilationM3h} m³/h) is below the declared required rate (${b.requiredVentilationM3h} m³/h). Energy savings from under-ventilation are not acceptable.`);
  if (b.unoccupiedSetbackK >= 5) acc.warn('warn', 'humidity', 'Large setbacks can increase condensation/mould risk in unoccupied rooms; verify humidity control and minimum surface temperatures.');
  if (b.closedFrostSetpointC < 5) acc.warn('warn', 'freeze protection', 'Closed-period setpoint below 5 °C: verify freeze protection of pipes and equipment.');
  return { heatLossCoefficientWK: Htr + Hve(0.7), heatingThermal: heating, coolingThermal: cooling, balanceTempHeating: balance };
}
