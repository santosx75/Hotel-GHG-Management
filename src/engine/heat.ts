import type { ClimateProfile, DataStatus, Department, HeatSystem, M12 } from '../types';
import type { Acc } from './context';
import { clamp, map12 } from './util';

/** Monthly COP for a heat pump. Seasonal model uses SCOP; temperature model uses a Carnot fraction. */
export function heatPumpCop(sys: HeatSystem, sourceTempC: number): number {
  if (sys.copModel === 'seasonal') return Math.max(1, sys.scop);
  const tSink = sys.supplyTempC + 273.15;
  const lift = Math.max(5, sys.supplyTempC - sourceTempC);
  return clamp(sys.carnotFraction * (tSink / lift), 1.5, 7);
}

/**
 * Convert delivered thermal energy (kWh) into final energy by carrier, and record it.
 * Distinguishes thermal energy delivered from fuel/electric input.
 */
export function deliverHeat(
  acc: Acc,
  sys: HeatSystem,
  thermal: M12,
  endUse: string,
  department: Department,
  climate: ClimateProfile,
  status: DataStatus,
  module: string,
) {
  const eff = Math.max(0.05, sys.seasonalEfficiency);
  switch (sys.tech) {
    case 'gas_boiler':
      acc.addEnergy({ carrier: 'natural_gas', endUse, department, monthly: thermal.map((q) => q / eff), status, module });
      break;
    case 'oil_boiler':
      acc.addEnergy({ carrier: 'heating_oil', endUse, department, monthly: thermal.map((q) => q / eff / 10.0), status, module });
      break;
    case 'lpg_boiler':
      acc.addEnergy({ carrier: 'lpg', endUse, department, monthly: thermal.map((q) => q / eff / 12.8), status, module });
      break;
    case 'wood_pellet_boiler':
      acc.addEnergy({ carrier: 'wood_pellets', endUse, department, monthly: thermal.map((q) => q / eff), status, module });
      break;
    case 'district_heat':
      acc.addEnergy({ carrier: 'district_heat', endUse, department, monthly: thermal, status, module });
      break;
    case 'electric_resistance':
      acc.addEnergy({ carrier: 'electricity', endUse, department, monthly: thermal.map((q) => q / Math.min(1, eff)), status, module });
      break;
    case 'heat_pump': {
      const backup = clamp(sys.backupResistanceShare, 0, 1);
      const elec = map12((m) => {
        const cop = heatPumpCop(sys, climate.meanTempC[m]);
        return (thermal[m] * (1 - backup) / cop) * (1 + Math.max(0, sys.defrostAllowance)) + thermal[m] * backup;
      });
      acc.addEnergy({ carrier: 'electricity', endUse, department, monthly: elec, status, module });
      break;
    }
  }
}

export const HEAT_TECH_LABEL: Record<HeatSystem['tech'], string> = {
  gas_boiler: 'Gas boiler',
  oil_boiler: 'Heating-oil boiler',
  lpg_boiler: 'LPG boiler',
  heat_pump: 'Heat pump',
  electric_resistance: 'Electric resistance',
  district_heat: 'District heat',
  wood_pellet_boiler: 'Wood-pellet boiler',
};
