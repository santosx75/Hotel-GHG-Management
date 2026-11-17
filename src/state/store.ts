import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { GlobalSettings, PropertyId, PropertyInputs } from '../types';
import {
  type AppData, type Scenario, initialData, setScenarioInput, replaceScenarioInputs, undo, redo, saveAsBaseline, createScenario,
  updateScenarioMeta, deleteScenario, resetScenarioToBaseline, updateFactor, updatePrice, logImport, uid, now,
} from './model';
import { PRESET_MAP } from '../scenarios/presets';
import { deepClone } from '../engine/util';

interface Store {
  data: AppData;
  onboardingDismissed: boolean;
  setInput: (pid: PropertyId, path: string, value: unknown) => void;
  applyPatches: (pid: PropertyId, patches: { path: string; value: unknown }[], note: string) => void;
  applyPreset: (pid: PropertyId, presetId: string) => void;
  replaceInputs: (pid: PropertyId, inputs: PropertyInputs, note: string) => void;
  selectScenario: (pid: PropertyId, sid: string) => void;
  newScenario: (pid: PropertyId, name: string, from: string | 'baseline') => string;
  updateMeta: (pid: PropertyId, sid: string, patch: Partial<Pick<Scenario, 'name' | 'notes' | 'implementationYear' | 'locked'>>) => void;
  removeScenario: (pid: PropertyId, sid: string) => void;
  saveBaseline: (pid: PropertyId, label: string) => void;
  resetScenario: (pid: PropertyId) => void;
  undo: (pid: PropertyId) => void;
  redo: (pid: PropertyId) => void;
  setFactor: (id: string, value: number, note: string) => void;
  setPrice: (id: string, value: number, note: string) => void;
  togglePin: (id: string) => void;
  setSettings: (patch: Partial<GlobalSettings>) => void;
  importScenario: (pid: PropertyId, sc: Scenario) => void;
  replaceAll: (d: AppData) => void;
  resetAll: () => void;
  dismissOnboarding: () => void;
}

const active = (d: AppData, pid: PropertyId) => d.properties[pid].activeScenarioId;

export const useStore = create<Store>()(
  persist(
    (set, get) => ({
      data: initialData(),
      onboardingDismissed: false,
      setInput: (pid, path, value) => set((s) => ({ data: setScenarioInput(s.data, pid, active(s.data, pid), path, value) })),
      applyPatches: (pid, patches, note) => set((s) => {
        let d = s.data;
        for (const p of patches) d = setScenarioInput(d, pid, active(d, pid), p.path, p.value);
        return { data: logImport(d, pid, d.properties[pid].scenarios.find((x) => x.id === active(d, pid))!.name, patches.map((p) => p.path).join(', '), note) };
      }),
      applyPreset: (pid, presetId) => set((s) => {
        const sc = s.data.properties[pid].scenarios.find((x) => x.id === active(s.data, pid))!;
        const pr = PRESET_MAP[presetId];
        if (!pr || sc.locked) return s;
        const next = pr.apply(sc.inputs, sc.implementationYear);
        return { data: replaceScenarioInputs(s.data, pid, sc.id, next, `Applied preset: ${pr.label}`, presetId) };
      }),
      replaceInputs: (pid, inputs, note) => set((s) => ({ data: replaceScenarioInputs(s.data, pid, active(s.data, pid), inputs, note) })),
      selectScenario: (pid, sid) => set((s) => ({ data: { ...s.data, properties: { ...s.data.properties, [pid]: { ...s.data.properties[pid], activeScenarioId: sid } } } })),
      newScenario: (pid, name, from) => {
        const r = createScenario(get().data, pid, name, from);
        set({ data: r.data });
        return r.id;
      },
      updateMeta: (pid, sid, patch) => set((s) => ({ data: updateScenarioMeta(s.data, pid, sid, patch) })),
      removeScenario: (pid, sid) => set((s) => ({ data: deleteScenario(s.data, pid, sid) })),
      saveBaseline: (pid, label) => set((s) => ({ data: saveAsBaseline(s.data, pid, active(s.data, pid), label) })),
      resetScenario: (pid) => set((s) => ({ data: resetScenarioToBaseline(s.data, pid, active(s.data, pid)) })),
      undo: (pid) => set((s) => ({ data: undo(s.data, pid, active(s.data, pid)) })),
      redo: (pid) => set((s) => ({ data: redo(s.data, pid, active(s.data, pid)) })),
      setFactor: (id, value, note) => set((s) => ({ data: updateFactor(s.data, id, value, note) })),
      setPrice: (id, value, note) => set((s) => ({ data: updatePrice(s.data, id, value, note) })),
      togglePin: (id) => set((s) => {
        const pins = { ...s.data.pinnedFactorVersions };
        if (pins[id]) delete pins[id];
        else pins[id] = s.data.library.factors[id].version;
        return { data: { ...s.data, pinnedFactorVersions: pins } };
      }),
      setSettings: (patch) => set((s) => ({ data: { ...s.data, settings: { ...s.data.settings, ...patch }, audit: [{ ts: now(), propertyId: 'settings' as const, scenario: '—', path: Object.keys(patch).join(','), previous: Object.fromEntries(Object.keys(patch).map((k) => [k, (s.data.settings as any)[k]])), next: patch, kind: 'settings' as const }, ...s.data.audit].slice(0, 3000) } })),
      importScenario: (pid, sc) => set((s) => {
        const id = uid('sc');
        const ps = s.data.properties[pid];
        return { data: { ...s.data, properties: { ...s.data.properties, [pid]: { ...ps, scenarios: [...ps.scenarios, { ...deepClone(sc), id, locked: false, name: `${sc.name} (imported)` }], activeScenarioId: id, history: { ...ps.history, [id]: { past: [], future: [] } } } } } };
      }),
      replaceAll: (d) => set({ data: d }),
      resetAll: () => set({ data: initialData(), onboardingDismissed: false }),
      dismissOnboarding: () => set({ onboardingDismissed: true }),
    }),
    {
      name: 'hotel-carbon-lab-v1',
      version: 1,
      storage: createJSONStorage(() => {
        try { return localStorage; } catch { return sessionStorage; }
      }),
      // undo/redo history is session-only (not persisted) to keep storage small
      partialize: (s) => ({
        onboardingDismissed: s.onboardingDismissed,
        data: { ...s.data, properties: Object.fromEntries(Object.entries(s.data.properties).map(([k, v]) => [k, { ...v, history: {} }])) as AppData['properties'] },
      }),
      merge: (persisted: any, current) => {
        if (!persisted?.data?.properties) return current;
        const d = persisted.data as AppData;
        for (const ps of Object.values(d.properties)) ps.history = ps.history ?? {};
        return { ...current, ...persisted, data: d };
      },
    },
  ),
);

export function useActiveScenario(pid: PropertyId) {
  return useStore((s) => {
    const ps = s.data.properties[pid];
    return ps.scenarios.find((x) => x.id === ps.activeScenarioId) ?? ps.scenarios[0];
  });
}
