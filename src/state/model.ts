import type { GlobalSettings, Library, PropertyId, PropertyInputs } from '../types';
import { DEFAULT_SETTINGS, PROPERTY_IDS, SEEDS, defaultLibrary } from '../data/library';
import { deepClone, getPath, setPath } from '../engine/util';
import { MODEL_VERSION } from '../engine';

export interface Scenario {
  id: string;
  name: string;
  notes: string;
  inputs: PropertyInputs;
  implementationYear: number;
  locked: boolean;
  createdAt: string;
  appliedPresets: string[];
}

export interface PropertyState {
  baseline: { inputs: PropertyInputs; savedAt: string; label: string };
  scenarios: Scenario[];
  activeScenarioId: string;
  history: Record<string, { past: PropertyInputs[]; future: PropertyInputs[] }>;
}

export interface AuditEntry {
  ts: string;
  propertyId: PropertyId | 'library' | 'settings';
  scenario: string;
  path: string;
  previous: unknown;
  next: unknown;
  kind: 'parameter' | 'baseline' | 'scenario' | 'factor' | 'price' | 'import' | 'settings';
}

export interface FactorChange { ts: string; factorId: string; previous: number; next: number; previousVersion: string; nextVersion: string; note: string }

export interface AppData {
  schemaVersion: number;
  modelVersion: string;
  settings: GlobalSettings;
  library: Library;
  pinnedFactorVersions: Record<string, string>;
  factorChangeLog: FactorChange[];
  properties: Record<PropertyId, PropertyState>;
  audit: AuditEntry[];
}

export const now = () => new Date().toISOString();
export const uid = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
const AUDIT_LIMIT = 3000;

export function newPropertyState(id: PropertyId): PropertyState {
  const inputs = SEEDS[id]();
  const sid = 'working';
  return {
    baseline: { inputs: deepClone(inputs), savedAt: now(), label: 'Demonstration baseline' },
    scenarios: [{ id: sid, name: 'Working scenario', notes: '', inputs: deepClone(inputs), implementationYear: inputs.boundary.reportingYear + 1, locked: false, createdAt: now(), appliedPresets: [] }],
    activeScenarioId: sid,
    history: { [sid]: { past: [], future: [] } },
  };
}

export function initialData(): AppData {
  return {
    schemaVersion: 1,
    modelVersion: MODEL_VERSION,
    settings: { ...DEFAULT_SETTINGS },
    library: defaultLibrary(),
    pinnedFactorVersions: {},
    factorChangeLog: [],
    properties: Object.fromEntries(PROPERTY_IDS.map((id) => [id, newPropertyState(id)])) as Record<PropertyId, PropertyState>,
    audit: [],
  };
}

const pushAudit = (d: AppData, e: Omit<AuditEntry, 'ts'>): AuditEntry[] => [{ ...e, ts: now() }, ...d.audit].slice(0, AUDIT_LIMIT);

export function activeScenario(d: AppData, pid: PropertyId): Scenario {
  const ps = d.properties[pid];
  return ps.scenarios.find((s) => s.id === ps.activeScenarioId) ?? ps.scenarios[0];
}

function updateProperty(d: AppData, pid: PropertyId, f: (ps: PropertyState) => PropertyState): AppData {
  return { ...d, properties: { ...d.properties, [pid]: f(d.properties[pid]) } };
}

/** Edit one input of a scenario. The baseline is never touched; other properties are never touched. */
export function setScenarioInput(d: AppData, pid: PropertyId, sid: string, path: string, value: unknown): AppData {
  const ps = d.properties[pid];
  const sc = ps.scenarios.find((s) => s.id === sid);
  if (!sc || sc.locked) return d;
  const previous = getPath(sc.inputs, path);
  if (JSON.stringify(previous) === JSON.stringify(value)) return d;
  const inputs = setPath(sc.inputs, path, value);
  const hist = ps.history[sid] ?? { past: [], future: [] };
  const next = updateProperty(d, pid, (p) => ({
    ...p,
    scenarios: p.scenarios.map((s) => (s.id === sid ? { ...s, inputs } : s)),
    history: { ...p.history, [sid]: { past: [...hist.past, sc.inputs].slice(-100), future: [] } },
  }));
  return { ...next, audit: pushAudit(d, { propertyId: pid, scenario: sc.name, path, previous, next: value, kind: 'parameter' }) };
}

export function replaceScenarioInputs(d: AppData, pid: PropertyId, sid: string, inputs: PropertyInputs, note: string, presetId?: string): AppData {
  const ps = d.properties[pid];
  const sc = ps.scenarios.find((s) => s.id === sid);
  if (!sc || sc.locked) return d;
  const hist = ps.history[sid] ?? { past: [], future: [] };
  const next = updateProperty(d, pid, (p) => ({
    ...p,
    scenarios: p.scenarios.map((s) => (s.id === sid ? { ...s, inputs, appliedPresets: presetId ? [...s.appliedPresets, presetId] : s.appliedPresets } : s)),
    history: { ...p.history, [sid]: { past: [...hist.past, sc.inputs].slice(-100), future: [] } },
  }));
  return { ...next, audit: pushAudit(d, { propertyId: pid, scenario: sc.name, path: '*', previous: null, next: note, kind: 'scenario' }) };
}

export function undo(d: AppData, pid: PropertyId, sid: string): AppData {
  const ps = d.properties[pid];
  const h = ps.history[sid];
  const sc = ps.scenarios.find((s) => s.id === sid);
  if (!h || !h.past.length || !sc || sc.locked) return d;
  const prev = h.past[h.past.length - 1];
  return updateProperty(d, pid, (p) => ({ ...p, scenarios: p.scenarios.map((s) => (s.id === sid ? { ...s, inputs: prev } : s)), history: { ...p.history, [sid]: { past: h.past.slice(0, -1), future: [sc.inputs, ...h.future] } } }));
}

export function redo(d: AppData, pid: PropertyId, sid: string): AppData {
  const ps = d.properties[pid];
  const h = ps.history[sid];
  const sc = ps.scenarios.find((s) => s.id === sid);
  if (!h || !h.future.length || !sc || sc.locked) return d;
  const nxt = h.future[0];
  return updateProperty(d, pid, (p) => ({ ...p, scenarios: p.scenarios.map((s) => (s.id === sid ? { ...s, inputs: nxt } : s)), history: { ...p.history, [sid]: { past: [...h.past, sc.inputs], future: h.future.slice(1) } } }));
}

/** Explicit, user-confirmed action: the only way the baseline changes. */
export function saveAsBaseline(d: AppData, pid: PropertyId, sid: string, label: string): AppData {
  const sc = d.properties[pid].scenarios.find((s) => s.id === sid);
  if (!sc) return d;
  const next = updateProperty(d, pid, (p) => ({ ...p, baseline: { inputs: deepClone({ ...sc.inputs, capex: [] }), savedAt: now(), label } }));
  return { ...next, audit: pushAudit(d, { propertyId: pid, scenario: sc.name, path: 'baseline', previous: d.properties[pid].baseline.label, next: label, kind: 'baseline' }) };
}

export function createScenario(d: AppData, pid: PropertyId, name: string, fromId: string | 'baseline'): { data: AppData; id: string } {
  const ps = d.properties[pid];
  const src = fromId === 'baseline' ? ps.baseline.inputs : ps.scenarios.find((s) => s.id === fromId)?.inputs ?? ps.baseline.inputs;
  const srcSc = ps.scenarios.find((s) => s.id === fromId);
  const id = uid('sc');
  const sc: Scenario = { id, name, notes: srcSc?.notes ?? '', inputs: deepClone(src), implementationYear: srcSc?.implementationYear ?? ps.baseline.inputs.boundary.reportingYear + 1, locked: false, createdAt: now(), appliedPresets: srcSc ? [...srcSc.appliedPresets] : [] };
  const data = updateProperty(d, pid, (p) => ({ ...p, scenarios: [...p.scenarios, sc], activeScenarioId: id, history: { ...p.history, [id]: { past: [], future: [] } } }));
  return { data: { ...data, audit: pushAudit(d, { propertyId: pid, scenario: name, path: 'scenario', previous: fromId, next: 'created', kind: 'scenario' }) }, id };
}

export function updateScenarioMeta(d: AppData, pid: PropertyId, sid: string, patch: Partial<Pick<Scenario, 'name' | 'notes' | 'implementationYear' | 'locked'>>): AppData {
  return updateProperty(d, pid, (p) => ({ ...p, scenarios: p.scenarios.map((s) => (s.id === sid ? { ...s, ...patch } : s)) }));
}

export function deleteScenario(d: AppData, pid: PropertyId, sid: string): AppData {
  const ps = d.properties[pid];
  if (ps.scenarios.length <= 1) return d;
  const scenarios = ps.scenarios.filter((s) => s.id !== sid);
  return updateProperty(d, pid, (p) => ({ ...p, scenarios, activeScenarioId: p.activeScenarioId === sid ? scenarios[0].id : p.activeScenarioId }));
}

export function resetScenarioToBaseline(d: AppData, pid: PropertyId, sid: string): AppData {
  const b = d.properties[pid].baseline.inputs;
  return replaceScenarioInputs(d, pid, sid, deepClone(b), 'Reset to baseline');
}

/** Update a library emission factor as a NEW VERSION; logged. Pinned factors are not changed. */
export function updateFactor(d: AppData, id: string, value: number, note: string): AppData {
  const f = d.library.factors[id];
  if (!f || !Number.isFinite(value) || value < 0) return d;
  if (d.pinnedFactorVersions[id]) return d;
  const version = `user-${new Date().toISOString().slice(0, 10)}-${(d.factorChangeLog.filter((c) => c.factorId === id).length + 1)}`;
  return {
    ...d,
    library: { ...d.library, factors: { ...d.library.factors, [id]: { ...f, value, version, verification: 'user', notes: `${note} (previous ${f.value} ${f.unit}, version ${f.version})` } } },
    factorChangeLog: [{ ts: now(), factorId: id, previous: f.value, next: value, previousVersion: f.version, nextVersion: version, note }, ...d.factorChangeLog],
    audit: pushAudit(d, { propertyId: 'library', scenario: '—', path: `factors.${id}`, previous: f.value, next: value, kind: 'factor' }),
  };
}

export function updatePrice(d: AppData, id: string, value: number, note: string): AppData {
  const pr = d.library.prices[id];
  if (!pr || !Number.isFinite(value) || value < 0) return d;
  return {
    ...d,
    library: { ...d.library, prices: { ...d.library.prices, [id]: { ...pr, value, kind: 'user_contract', lastVerified: new Date().toISOString().slice(0, 10), applicabilityWarning: `${note} (previous ${pr.value})` } } },
    audit: pushAudit(d, { propertyId: 'library', scenario: '—', path: `prices.${id}`, previous: pr.value, next: value, kind: 'price' }),
  };
}

export function logImport(d: AppData, pid: PropertyId, scenario: string, path: string, summary: string): AppData {
  return { ...d, audit: pushAudit(d, { propertyId: pid, scenario, path, previous: null, next: summary, kind: 'import' }) };
}
