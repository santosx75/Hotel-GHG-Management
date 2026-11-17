import { useDeferredValue, useMemo } from 'react';
import type { CalculationResult, PropertyId, PropertyInputs } from '../types';
import { calculate, calibrationFrom } from '../engine';
import { useStore } from './store';

export interface PropertyResults {
  baseline: CalculationResult;
  scenario: CalculationResult;
  baselineInputs: PropertyInputs;
  scenarioInputs: PropertyInputs;
  stale: boolean;
}

/** Baseline and active-scenario results. Scenario recalculation is deferred so typing stays responsive. */
export function usePropertyResults(pid: PropertyId): PropertyResults {
  const ps = useStore((s) => s.data.properties[pid]);
  const settings = useStore((s) => s.data.settings);
  const library = useStore((s) => s.data.library);
  const sc = ps.scenarios.find((x) => x.id === ps.activeScenarioId) ?? ps.scenarios[0];
  const baseline = useMemo(() => calculate(ps.baseline.inputs, settings, library), [ps.baseline.inputs, settings, library]);
  const cal = useMemo(() => calibrationFrom(baseline), [baseline]);
  const deferred = useDeferredValue(sc.inputs);
  const scenario = useMemo(() => calculate(deferred, settings, library, cal), [deferred, settings, library, cal]);
  return { baseline, scenario, baselineInputs: ps.baseline.inputs, scenarioInputs: sc.inputs, stale: deferred !== sc.inputs };
}

export function useScenarioResult(pid: PropertyId, inputs: PropertyInputs) {
  const ps = useStore((s) => s.data.properties[pid]);
  const settings = useStore((s) => s.data.settings);
  const library = useStore((s) => s.data.library);
  const baseline = useMemo(() => calculate(ps.baseline.inputs, settings, library), [ps.baseline.inputs, settings, library]);
  return useMemo(() => calculate(inputs, settings, library, calibrationFrom(baseline)), [inputs, settings, library, baseline]);
}
