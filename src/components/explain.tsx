import type { CalcLine, CalculationResult, DataStatus, Library, PropertyInputs, ViewId } from '../types';
import { Badge, Drawer } from './ui';
import { findDef } from '../data/registry';
import { getPath, sum } from '../engine/util';
import { kgco2e, num, tco2e, signed, eur, mwh, m3 } from '../lib/format';
import { S3_NAMES } from '../engine/accounting';
import { STATUS_OPTIONS, useProp } from './fields';

export interface ExplainTarget { title: string; lines: CalcLine[]; note?: string; denominator?: string; view?: ViewId }

const VIEW_LABEL: Record<ViewId, string> = { corporate: 'Corporate inventory', hcmi: 'HCMI-aligned (partial)', visitor: 'Extended visitor impact', lca: 'Life-cycle decision view' };
export const viewLabel = (v: ViewId) => VIEW_LABEL[v];
export const scopeLabel = (l: CalcLine) => (l.scope === 'S3' ? `Scope 3 · cat. ${l.s3cat} ${S3_NAMES[l.s3cat!] ?? ''}` : l.scope === 'S2' ? 'Scope 2 (location-based)' : l.scope === 'S1' ? 'Scope 1' : 'Outside inventory scopes');

export function ExplainDrawer({ target, onClose, library }: { target: ExplainTarget | null; onClose: () => void; library: Library }) {
  const lines = target ? [...target.lines].sort((a, b) => b.kg - a.kg) : [];
  const total = sum(lines.map((l) => l.kg));
  return (
    <Drawer open={!!target} onClose={onClose} title={`Explain: ${target?.title ?? ''}`}>
      {target && (
        <div className="stack">
          <p><strong>{tco2e(total)}</strong> from {lines.length} calculation line{lines.length === 1 ? '' : 's'}.{target.denominator && <> Denominator: <strong>{target.denominator}</strong>.</>}</p>
          {target.view && <p className="muted">Boundary: {viewLabel(target.view)}.</p>}
          {target.note && <p className="muted">{target.note}</p>}
          {lines.some((l) => l.status === 'missing') && <div className="notice error">Some lines are <strong>missing</strong>: their emissions are unknown, not zero.</div>}
          {lines.slice(0, 40).map((l) => {
            const f = l.factorId ? library.factors[l.factorId] : undefined;
            const src = f ? library.sources[f.sourceId] : undefined;
            return (
              <details key={l.id} className="section">
                <summary>
                  <span style={{ flex: 1 }}>{l.label}</span>
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>{kgco2e(l.kg)}</span>
                </summary>
                <div className="body">
                  <dl className="kv">
                    <dt>Formula</dt><dd><code>{l.formula}</code></dd>
                    <dt>Activity</dt><dd>{num(l.activity)} {l.activityUnit}</dd>
                    <dt>Factor</dt><dd>{l.factorValue != null ? `${num(l.factorValue, 4)} ${l.factorUnit ?? ''}` : '—'} {f && <Badge status={f.verification} />}</dd>
                    {f && <><dt>Factor ID / version</dt><dd><code>{f.id}</code> · {f.version}</dd></>}
                    {src && <><dt>Source</dt><dd>{src.title} <Badge status={src.status} /><br /><span className="muted">{src.accessNote}</span></dd></>}
                    <dt>Scope / category</dt><dd>{scopeLabel(l)}</dd>
                    <dt>Boundary views</dt><dd>{l.views.length ? l.views.map(viewLabel).join(', ') : 'Reported separately (not in any total)'}</dd>
                    {l.scope === 'S2' && <><dt>Market-based</dt><dd>{l.kgMB == null ? 'Not available (no contractual factor)' : kgco2e(l.kgMB)} — alternative, not additive</dd></>}
                    <dt>Life-cycle stages</dt><dd>{l.stages.join(', ').replace(/_/g, ' ') || '—'}</dd>
                    <dt>Data status</dt><dd><Badge status={l.status} /></dd>
                    <dt>Department</dt><dd>{l.department}</dd>
                    <dt>Activity ID</dt><dd><code>{l.activityId}</code></dd>
                    {Object.keys(l.inputs).length > 0 && <><dt>Inputs</dt><dd>{Object.entries(l.inputs).map(([k, v]) => <div key={k}><code>{k}</code>: {typeof v === 'number' ? num(v, 4) : String(v)}</div>)}</dd></>}
                    {l.outsideInventoryReason && <><dt>Why outside inventory</dt><dd>{l.outsideInventoryReason}</dd></>}
                    {l.notes?.length ? <><dt>Notes</dt><dd>{l.notes.join(' ')}</dd></> : null}
                  </dl>
                </div>
              </details>
            );
          })}
          {lines.length > 40 && <p className="muted">{lines.length - 40} smaller lines not shown (see CSV export for all lines).</p>}
        </div>
      )}
    </Drawer>
  );
}

function flatten(obj: any, prefix = '', out: Record<string, unknown> = {}): Record<string, unknown> {
  if (obj == null || typeof obj !== 'object') { out[prefix] = obj; return out; }
  if (Array.isArray(obj) && obj.every((x) => typeof x !== 'object' || x == null)) { out[prefix] = JSON.stringify(obj); return out; }
  for (const [k, v] of Object.entries(obj)) flatten(v, prefix ? `${prefix}.${k}` : k, out);
  return out;
}

export function inputDiff(a: PropertyInputs, b: PropertyInputs) {
  const fa = flatten({ ...a, statusOverrides: {} });
  const fb = flatten({ ...b, statusOverrides: {} });
  const keys = new Set([...Object.keys(fa), ...Object.keys(fb)]);
  const diffs: { path: string; label: string; from: unknown; to: unknown }[] = [];
  for (const k of keys) {
    if (JSON.stringify(fa[k]) === JSON.stringify(fb[k])) continue;
    const def = findDef(k);
    const parts = k.split('.');
    let label = def?.name ?? parts[parts.length - 1];
    const idx = parts.findIndex((p) => /^\d+$/.test(p));
    if (idx > 0) {
      const item = getPath(b, parts.slice(0, idx + 1).join('.')) ?? getPath(a, parts.slice(0, idx + 1).join('.'));
      const name = item?.name ?? item?.label ?? item?.id;
      if (name) label = `${name} — ${label}`;
    }
    diffs.push({ path: k, label, from: fa[k], to: fb[k] });
  }
  return diffs;
}

const fmtVal = (v: unknown) => (v == null ? 'missing' : typeof v === 'number' ? num(v, 4) : typeof v === 'boolean' ? (v ? 'yes' : 'no') : String(v).length > 40 ? `${String(v).slice(0, 40)}…` : String(v));

export function WhatChanged({ baseline, scenario, bIn, sIn, view }: { baseline: CalculationResult; scenario: CalculationResult; bIn: PropertyInputs; sIn: PropertyInputs; view: ViewId }) {
  const diffs = inputDiff(bIn, sIn);
  const deptDelta: Record<string, number> = {};
  for (const l of baseline.lines) if (l.views.includes(view)) deptDelta[l.module] = (deptDelta[l.module] ?? 0) - l.kg;
  for (const l of scenario.lines) if (l.views.includes(view)) deptDelta[l.module] = (deptDelta[l.module] ?? 0) + l.kg;
  const mech = Object.entries(deptDelta).filter(([, v]) => Math.abs(v) > 0.5).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  const carriers = new Set([...Object.keys(baseline.energy), ...Object.keys(scenario.energy)]);
  const energyRows = [...carriers].map((c) => ({ c, d: sum(scenario.energy[c]?.total ?? [0]) - sum(baseline.energy[c]?.total ?? [0]) })).filter((x) => Math.abs(x.d) > 0.5);
  const newWarnings = scenario.warnings.filter((w) => !baseline.warnings.some((b) => b.message === w.message));
  if (!diffs.length) return <p className="muted">The active scenario is identical to the saved baseline. Edit any parameter or apply a preset to see changes here.</p>;
  return (
    <div className="grid grid-2">
      <div>
        <h3>Inputs changed ({diffs.length})</h3>
        <div className="table-wrap" tabIndex={0} role="region" aria-label="Scrollable table" style={{ maxHeight: 280, overflowY: 'auto' }}>
          <table><thead><tr><th>Parameter</th><th className="num">Baseline</th><th className="num">Scenario</th></tr></thead>
            <tbody>{diffs.slice(0, 60).map((d) => <tr key={d.path}><td title={d.path}>{d.label}</td><td className="num">{fmtVal(d.from)}</td><td className="num">{fmtVal(d.to)}</td></tr>)}</tbody></table>
        </div>
      </div>
      <div>
        <h3>Mechanisms that changed</h3>
        <ul style={{ paddingLeft: 18, margin: 0 }}>
          {mech.map(([m, v]) => <li key={m}><strong>{m}</strong>: <span className={v < 0 ? 'delta-down' : 'delta-up'}>{signed(v, (x) => kgco2e(x))}</span></li>)}
          {energyRows.map((e) => <li key={e.c}>Energy {e.c.replace('_', ' ')}: {signed(e.d, (x) => (e.c === 'electricity' || e.c === 'natural_gas' || e.c === 'wood_pellets' ? mwh(x) : num(x)))}{e.c === 'natural_gas' ? ' (PCS)' : ['diesel', 'petrol', 'heating_oil'].includes(e.c) ? ' L' : ''}</li>)}
          <li>Water: {signed(scenario.totals.waterM3 - baseline.totals.waterM3, m3)}</li>
          <li>Operating cost: {signed(scenario.totals.opexEUR - baseline.totals.opexEUR, eur)} (fixed charges: {signed(scenario.totals.opexFixedEUR - baseline.totals.opexFixedEUR, eur)})</li>
          {scenario.capexTotal > 0 && <li>CAPEX in scenario: {eur(scenario.capexTotal)}</li>}
        </ul>
        {newWarnings.length > 0 && <div className="notice warn" style={{ marginTop: 8 }}><strong>New constraints/warnings:</strong><ul>{newWarnings.map((w) => <li key={w.message}>{w.message}</li>)}</ul></div>}
      </div>
    </div>
  );
}

export function ParamDrawer({ path, label, onClose, library }: { path: string | null; label: string; onClose: () => void; library: Library }) {
  const ctx = useProp();
  if (!path) return null;
  const def = findDef(path);
  const src = def ? library.sources[def.sourceId] : undefined;
  const status: DataStatus | undefined = ctx.inputs.statusOverrides[path] ?? ctx.inputs.statusOverrides[path.split('.').slice(0, 2).join('.')];
  const cur = getPath(ctx.inputs, path);
  const base = getPath(ctx.baseline, path);
  return (
    <Drawer open={!!path} onClose={onClose} title={label}>
      <dl className="kv">
        <dt>Parameter ID</dt><dd><code>{path}</code></dd>
        <dt>Definition</dt><dd>{def?.definition ?? 'Operational input of this property (see Methodology).'}</dd>
        <dt>Unit</dt><dd>{def?.unit ?? '—'}</dd>
        {def && <><dt>Range</dt><dd>{def.min ?? '—'} to {def.max ?? '—'} (step {def.step})</dd></>}
        <dt>Current (scenario)</dt><dd>{fmtVal(Array.isArray(cur) ? JSON.stringify(cur) : cur)}</dd>
        <dt>Saved baseline</dt><dd>{fmtVal(Array.isArray(base) ? JSON.stringify(base) : base)}</dd>
        <dt>Seed origin</dt><dd><Badge status={def?.defaultOrigin ?? 'assumed'} /> — demonstration property values are fictional operating assumptions unless stated.</dd>
        <dt>Source</dt><dd>{src ? <>{src.title} <Badge status={src.status} /></> : 'Hotel Carbon Lab demonstration assumption'}</dd>
        {def && <><dt>Category</dt><dd>{def.category} · {def.subcategory}</dd><dt>Model linkage</dt><dd>{def.modelLink}</dd><dt>Role</dt><dd>{def.role}</dd><dt>Confidence</dt><dd>{def.confidence}</dd></>}
      </dl>
      <div className="field" style={{ marginTop: 14 }}>
        <label htmlFor="status-sel">Declared data status for this input</label>
        <select id="status-sel" value={status ?? ''} disabled={ctx.locked} onChange={(e) => {
          const next = { ...ctx.inputs.statusOverrides };
          if (e.target.value) next[path] = e.target.value as DataStatus; else delete next[path];
          ctx.set('statusOverrides', next);
        }}>
          <option value="">Default (model decides)</option>
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
        </select>
        <span className="help">Declaring a value as measured changes the data-quality report; it never changes the number itself.</span>
      </div>
    </Drawer>
  );
}
