import type {
  CalcLine, CostLine, DataStatus, Department, EmissionFactor, GlobalSettings, Library, M12, PropertyInputs, SuppressedItem, Warning, CalibrationRef,
} from '../types';
import { add, sum, zeros } from './util';

export type Carrier = 'electricity' | 'natural_gas' | 'heating_oil' | 'lpg' | 'wood_pellets' | 'district_heat' | 'diesel' | 'petrol';

export interface EnergyUse {
  carrier: Carrier;
  endUse: string;
  department: Department;
  monthly: M12;
  status: DataStatus;
  module: string;
  scope1Override?: 'fleet' | 'stationary';
  offSite?: boolean; // consumed outside the site meter (e.g. hotel-paid public EV charging)
}

export interface WaterUse {
  endUse: string;
  department: Department;
  monthly: M12; // m³ mains-equivalent demand
  discharged: boolean; // goes to sewer / private treatment
  status: DataStatus;
}

export interface EngineOptions {
  settings: GlobalSettings;
  library: Library;
  calibration?: CalibrationRef;
}

/** Mutable accumulator used by engine modules while computing one property. */
export class Acc {
  lines: CalcLine[] = [];
  costs: CostLine[] = [];
  energy: EnergyUse[] = [];
  water: WaterUse[] = [];
  wasteKg: Record<string, number> = {};
  warnings: Warning[] = [];
  suppressed: SuppressedItem[] = [];
  missing: string[] = [];
  /** Hot-water thermal demands (kWh at point of use) collected from all modules, delivered by the DHW system. */
  dhwDemands: { endUse: string; department: Department; monthly: M12 }[] = [];
  internalGainsW: M12 = zeros(); // monthly mean internal gains in conditioned space (W)
  derivedWaste: { foodWasteKg: number; foodWasteMonthly: M12; packagingKg: number; textileDiscardKg: number; lampsKg: number } = {
    foodWasteKg: 0, foodWasteMonthly: zeros(), packagingKg: 0, textileDiscardKg: 0, lampsKg: 0,
  };

  constructor(public p: PropertyInputs, public opt: EngineOptions) {}

  factor(id: string): EmissionFactor | undefined {
    const f = this.opt.library.factors[id];
    if (!f) {
      this.warn('error', 'factors', `Emission factor "${id}" not found in library — related emissions are reported as missing, not zero.`);
      this.markMissing(`factor:${id}`);
    }
    return f;
  }

  status(path: string, fallback: DataStatus): DataStatus {
    return this.p.statusOverrides[path] ?? fallback;
  }

  warn(level: Warning['level'], module: string, message: string) {
    if (!this.warnings.some((w) => w.message === message)) this.warnings.push({ level, module, message });
  }

  markMissing(what: string) {
    if (!this.missing.includes(what)) this.missing.push(what);
  }

  addEnergy(u: EnergyUse) {
    if (sum(u.monthly) === 0) return;
    this.energy.push(u);
  }

  addWater(u: WaterUse) {
    if (sum(u.monthly) === 0) return;
    this.water.push(u);
  }

  addWaste(stream: string, kg: number) {
    this.wasteKg[stream] = (this.wasteKg[stream] ?? 0) + kg;
  }

  addGains(w: M12) {
    this.internalGainsW = add(this.internalGainsW, w);
  }

  /**
   * Add an emissions line computed from an activity and a library factor.
   * If the factor is missing, a zero-kg line with status "missing" is recorded and the item is listed as missing.
   */
  emit(l: Omit<CalcLine, 'kg' | 'activity' | 'factorValue' | 'factorUnit' | 'factorVersion' | 'monthly' | 'stages'> & {
    monthlyActivity: M12;
    factorId: string;
    multiplier?: number; // e.g. 1/occupancy, GWP
    stages?: CalcLine['stages'];
  }) {
    const f = this.factor(l.factorId);
    const mult = l.multiplier ?? 1;
    const monthly = l.monthlyActivity.map((a) => (f ? a * f.value * mult : 0));
    const kg = sum(monthly);
    const line: CalcLine = {
      ...l,
      activity: sum(l.monthlyActivity),
      factorValue: f?.value,
      factorUnit: f?.unit,
      factorVersion: f?.version,
      monthly,
      kg,
      status: f ? l.status : 'missing',
      stages: l.stages ?? f?.stages ?? [],
    };
    delete (line as any).monthlyActivity;
    delete (line as any).multiplier;
    this.lines.push(line);
    return line;
  }

  /** Add a line with a directly computed kg value (e.g. refrigerant mass × GWP). */
  push(line: CalcLine) {
    this.lines.push(line);
    return line;
  }

  cost(c: Omit<CostLine, 'total'>) {
    const total = c.fixed + c.variable;
    if (total === 0 && c.fixed === 0) return;
    this.costs.push({ ...c, total });
  }
}
