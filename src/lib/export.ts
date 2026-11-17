import type { CalculationResult, Library, PropertyInputs, GlobalSettings } from '../types';
import type { Scenario } from '../state/model';
import { MODEL_VERSION } from '../engine';
import { findDef } from '../data/registry';
import { scope3Matrix } from '../engine/accounting';

const esc = (v: unknown) => {
  const s = v == null ? '' : String(v);
  return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
export const toCSV = (rows: unknown[][]) => rows.map((r) => r.map(esc).join(',')).join('\n');

export function resultsCSV(r: CalculationResult, scenarioName: string) {
  const header = ['property', 'scenario', 'line_id', 'activity_id', 'label', 'module', 'department', 'scope', 's3_category', 'views', 'activity', 'activity_unit', 'factor_id', 'factor_version', 'factor_value', 'factor_unit', 'kgCO2e', 'kgCO2e_market_based', 'status', 'stages', 'formula', ...['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((m) => `kg_${m}`)];
  const rows = r.lines.map((l) => [r.propertyId, scenarioName, l.id, l.activityId, l.label, l.module, l.department, l.scope, l.s3cat ?? '', l.views.join('|'), l.activity, l.activityUnit, l.factorId ?? '', l.factorVersion ?? '', l.factorValue ?? '', l.factorUnit ?? '', l.kg, l.scope === 'S2' ? l.kgMB ?? 'n/a' : '', l.status, l.stages.join('|'), l.formula, ...l.monthly]);
  return toCSV([header, ...rows]);
}

export function costsCSV(r: CalculationResult) {
  return toCSV([['id', 'label', 'category', 'department', 'fixed_EUR', 'variable_EUR', 'total_EUR_exVAT', 'vat_rate', 'status'], ...r.costs.map((c) => [c.id, c.label, c.category, c.department, c.fixed, c.variable, c.total, c.vatRate, c.status])]);
}

function flatten(obj: any, prefix = '', out: [string, unknown][] = []) {
  if (obj == null || typeof obj !== 'object') { out.push([prefix, obj]); return out; }
  if (Array.isArray(obj) && obj.every((x) => typeof x !== 'object' || x == null)) { out.push([prefix, obj.join(' | ')]); return out; }
  for (const [k, v] of Object.entries(obj)) flatten(v, prefix ? `${prefix}.${k}` : k, out);
  return out;
}

export function parametersCSV(p: PropertyInputs) {
  return toCSV([['parameter_id', 'name', 'value', 'unit', 'declared_status', 'category'], ...flatten(p).map(([k, v]) => { const d = findDef(k); return [k, d?.name ?? '', v, d?.unit ?? '', p.statusOverrides[k] ?? '', d?.category ?? '']; })]);
}

export function factorsCSV(lib: Library) {
  return toCSV([['factor_id', 'version', 'name', 'value', 'unit', 'activity_unit', 'stages', 'geography', 'source_id', 'verification', 'observation_year', 'includes_transport', 'notes'],
    ...Object.values(lib.factors).map((f) => [f.id, f.version, f.name, f.value, f.unit, f.activityUnit, f.stages.join('|'), f.geography.join('|'), f.sourceId, f.verification, f.observationYear ?? '', f.includesTransport ?? '', f.notes ?? ''])]);
}

/** Reproducible scenario export: inputs, factor IDs/versions used, prices, boundary, model version, timestamp, assumptions, exclusions. */
export function reproducibleExport(pid: string, scenario: Scenario, baselineInputs: PropertyInputs, result: CalculationResult, lib: Library, settings: GlobalSettings) {
  const usedFactors = Array.from(new Set(result.lines.map((l) => l.factorId).filter(Boolean))) as string[];
  return {
    format: 'hotel-carbon-lab/scenario@1',
    modelVersion: MODEL_VERSION,
    calculatedAt: new Date().toISOString(),
    propertyId: pid,
    scenario: { ...scenario },
    baselineInputs,
    settings,
    reportingBoundary: scenario.inputs.boundary,
    factorsUsed: usedFactors.map((id) => (id.startsWith('gwp:') ? { id, gwpSet: settings.gwpSet, value: lib.gwp[id.slice(4)]?.[settings.gwpSet] } : { id, version: lib.factors[id]?.version, value: lib.factors[id]?.value, unit: lib.factors[id]?.unit, sourceId: lib.factors[id]?.sourceId, verification: lib.factors[id]?.verification })),
    pricesInContract: { electricity: scenario.inputs.electricity, fuels: scenario.inputs.fuels, water: scenario.inputs.water },
    totals: result.totals,
    assumptionsAndWarnings: result.warnings,
    exclusions: scope3Matrix(scenario.inputs, result.lines).filter((r) => r.status !== 'included' && r.status !== 'estimated'),
    doubleCountingSuppressed: result.suppressed,
    missing: result.missing,
    privacy: 'Contains aggregated operational data only; no personal guest data.',
  };
}
