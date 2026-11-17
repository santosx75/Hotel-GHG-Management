import { createContext, useContext, useEffect, useId, useState, type ReactNode } from 'react';
import type { DataStatus, PropertyId, PropertyInputs } from '../types';
import { findDef } from '../data/registry';
import { getPath } from '../engine/util';
import { MONTHS } from '../engine/util';

export interface PropCtx {
  pid: PropertyId;
  inputs: PropertyInputs;
  baseline: PropertyInputs;
  locked: boolean;
  set: (path: string, value: unknown) => void;
  openParam: (path: string, label: string) => void;
}
export const PropertyContext = createContext<PropCtx | null>(null);
export const useProp = () => {
  const c = useContext(PropertyContext);
  if (!c) throw new Error('PropertyContext missing');
  return c;
};

function Changed({ path }: { path: string }) {
  const { inputs, baseline } = useProp();
  const changed = JSON.stringify(getPath(inputs, path)) !== JSON.stringify(getPath(baseline, path));
  return changed ? <span className="changed-dot" title="Differs from saved baseline" aria-label="changed from baseline" /> : null;
}

function InfoBtn({ path, label }: { path: string; label: string }) {
  const { openParam } = useProp();
  return <button type="button" className="icon-btn" onClick={() => openParam(path, label)} aria-label={`Details and data status for ${label}`} title="Definition, source & data status">ⓘ</button>;
}

interface NumProps { path: string; label?: string; unit?: string; min?: number; max?: number; step?: number; slider?: boolean; help?: ReactNode; nullable?: boolean; percent?: boolean; disabled?: boolean }

/** Numeric input (optionally with slider). Percent fields are stored as fractions and shown ×100. */
export function NumField({ path, label, unit, min, max, step, slider, help, nullable, percent, disabled }: NumProps) {
  const { inputs, set, locked } = useProp();
  const def = findDef(path);
  const isPct = percent ?? (def?.type === 'percent');
  const k = isPct ? 100 : 1;
  const lo = (min ?? def?.min ?? (isPct ? 0 : undefined));
  const hi = (max ?? def?.max ?? (isPct ? 1 : undefined));
  const st = step ?? (isPct ? 0.01 : def?.step ?? 1);
  const raw = getPath(inputs, path) as number | null;
  const [text, setText] = useState(raw == null ? '' : String(+(raw * k).toFixed(6)));
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { setText(raw == null ? '' : String(+(raw * k).toFixed(6))); setErr(null); }, [raw, k]);
  const id = useId();
  const name = label ?? def?.name ?? path;
  const u = isPct ? '%' : unit ?? def?.unit ?? '';
  const commit = (s: string) => {
    setText(s);
    if (s.trim() === '') {
      if (nullable) { setErr(null); set(path, null); } else setErr('A value is required (use 0 only if truly zero).');
      return;
    }
    const v = Number(s.replace(',', '.'));
    if (!Number.isFinite(v)) { setErr('Not a number.'); return; }
    const val = v / k;
    if (lo != null && val < lo) { setErr(`Minimum ${lo * k}${isPct ? ' %' : ''}.`); return; }
    if (hi != null && val > hi) { setErr(`Maximum ${hi * k}${isPct ? ' %' : ''}.`); return; }
    setErr(null);
    set(path, val);
  };
  return (
    <div className={`field ${err ? 'invalid' : ''}`}>
      <label htmlFor={id}>{name} {u && <span className="unit">({u})</span>} <Changed path={path} /><InfoBtn path={path} label={name} /></label>
      <input id={id} type="number" inputMode="decimal" value={text} step={st * k} min={lo != null ? lo * k : undefined} max={hi != null ? hi * k : undefined} disabled={locked || disabled}
        onChange={(e) => commit(e.target.value)} aria-invalid={!!err} aria-describedby={err ? `${id}-err` : undefined} placeholder={nullable ? 'missing' : undefined} />
      {slider && lo != null && hi != null && raw != null && (
        <input type="range" aria-label={`${name} slider`} min={lo * k} max={hi * k} step={st * k} value={raw * k} disabled={locked || disabled} onChange={(e) => commit(e.target.value)} />
      )}
      {err && <span className="err" id={`${id}-err`} role="alert">{err}</span>}
      {help && <span className="help">{help}</span>}
      {nullable && raw == null && <span className="help">Missing — reported as missing, not zero.</span>}
    </div>
  );
}

export function SelectField({ path, label, options, help }: { path: string; label: string; options: { value: string; label: string }[]; help?: ReactNode }) {
  const { inputs, set, locked } = useProp();
  const id = useId();
  const v = getPath(inputs, path) as string;
  return (
    <div className="field">
      <label htmlFor={id}>{label} <Changed path={path} /><InfoBtn path={path} label={label} /></label>
      <select id={id} value={v} disabled={locked} onChange={(e) => set(path, e.target.value)}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {help && <span className="help">{help}</span>}
    </div>
  );
}

export function Toggle({ path, label, help }: { path: string; label: string; help?: ReactNode }) {
  const { inputs, set, locked } = useProp();
  const v = !!getPath(inputs, path);
  return (
    <div className="field">
      <label className="toggle"><input type="checkbox" checked={v} disabled={locked} onChange={(e) => set(path, e.target.checked)} /> {label} <Changed path={path} /></label>
      {help && <span className="help">{help}</span>}
    </div>
  );
}

export function TextField({ path, label, multiline }: { path: string; label: string; multiline?: boolean }) {
  const { inputs, set, locked } = useProp();
  const id = useId();
  const v = (getPath(inputs, path) as string) ?? '';
  return (
    <div className="field">
      <label htmlFor={id}>{label} <Changed path={path} /></label>
      {multiline ? <textarea id={id} rows={2} value={v} disabled={locked} onChange={(e) => set(path, e.target.value)} /> : <input id={id} type="text" value={v} disabled={locked} onChange={(e) => set(path, e.target.value)} />}
    </div>
  );
}

/** Monthly matrix editor. */
export function Month12({ path, label, percent, max, step, nullable }: { path: string; label: string; percent?: boolean; max?: number; step?: number; nullable?: boolean }) {
  const { inputs, set, locked } = useProp();
  const arr = (getPath(inputs, path) as (number | null)[]) ?? [];
  const k = percent ? 100 : 1;
  const hi = max ?? (percent ? 1 : undefined);
  return (
    <fieldset className="field" style={{ border: 'none', padding: 0, margin: 0 }}>
      <legend className="flabel" style={{ fontSize: '.82rem', fontWeight: 600 }}>{label} {percent && <span className="unit">(%)</span>} <Changed path={path} /></legend>
      <div className="m12">
        {MONTHS.map((m, i) => (
          <div key={m}>
            <label htmlFor={`${path}-${i}`}>{m}</label>
            <input id={`${path}-${i}`} type="number" inputMode="decimal" disabled={locked} value={arr[i] == null ? '' : +((arr[i] as number) * k).toFixed(4)} step={(step ?? (percent ? 0.01 : 1)) * k} min={0} max={hi != null ? hi * k : undefined}
              placeholder={nullable ? '—' : undefined}
              onChange={(e) => {
                const s = e.target.value;
                const next = [...arr];
                if (s === '') { if (!nullable) return; next[i] = null; }
                else {
                  const v = Number(s) / k;
                  if (!Number.isFinite(v) || v < 0 || (hi != null && v > hi)) return;
                  next[i] = v;
                }
                set(path, next);
              }} />
          </div>
        ))}
      </div>
    </fieldset>
  );
}

export interface Col {
  key: string;
  label: string;
  type?: 'number' | 'text' | 'select' | 'bool' | 'percent';
  options?: { value: string; label: string }[];
  step?: number;
  nullable?: boolean;
  min?: number;
  max?: number;
  width?: number;
}

/** Editable inventory table bound to an array path. */
export function EditTable({ path, columns, newRow, caption, rowLabel }: { path: string; columns: Col[]; newRow?: () => any; caption: string; rowLabel?: (r: any) => string }) {
  const { inputs, set, locked } = useProp();
  const rows = (getPath(inputs, path) as any[]) ?? [];
  const update = (i: number, key: string, value: unknown) => {
    const next = rows.map((r, j) => (j === i ? { ...r, [key]: value } : r));
    set(path, next);
  };
  return (
    <div className="stack">
      <div className="table-wrap" tabIndex={0} role="region" aria-label="Scrollable table">
        <table className="edit-table">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>{columns.map((c) => <th key={c.key} style={c.width ? { minWidth: c.width } : undefined} scope="col">{c.label}</th>)}{newRow && <th scope="col"><span className="sr-only">Actions</span></th>}</tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id ?? i}>
                {columns.map((c) => {
                  const v = r[c.key];
                  const aria = `${c.label} — ${rowLabel ? rowLabel(r) : r.name ?? r.label ?? `row ${i + 1}`}`;
                  if (c.type === 'select') return <td key={c.key}><select aria-label={aria} value={v} disabled={locked} onChange={(e) => update(i, c.key, e.target.value)}>{c.options!.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></td>;
                  if (c.type === 'bool') return <td key={c.key} style={{ textAlign: 'center' }}><input type="checkbox" aria-label={aria} checked={!!v} disabled={locked} onChange={(e) => update(i, c.key, e.target.checked)} /></td>;
                  if (c.type === 'text') return <td key={c.key}><input type="text" aria-label={aria} value={v ?? ''} disabled={locked} onChange={(e) => update(i, c.key, e.target.value)} /></td>;
                  const k = c.type === 'percent' ? 100 : 1;
                  return (
                    <td key={c.key}>
                      <input type="number" aria-label={aria} inputMode="decimal" disabled={locked} value={v == null ? '' : +(v * k).toFixed(5)} step={(c.step ?? 1)} placeholder={c.nullable ? 'missing' : undefined}
                        onChange={(e) => {
                          const s = e.target.value;
                          if (s === '') { if (c.nullable) update(i, c.key, null); return; }
                          const x = Number(s) / k;
                          if (!Number.isFinite(x) || x < (c.min ?? 0) || (c.max != null && x > c.max) || (c.type === 'percent' && x > 1)) return;
                          update(i, c.key, x);
                        }} />
                    </td>
                  );
                })}
                {newRow && <td><button className="icon-btn" disabled={locked} onClick={() => set(path, rows.filter((_, j) => j !== i))} aria-label={`Remove ${rowLabel ? rowLabel(r) : r.name ?? `row ${i + 1}`}`}>✕</button></td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {newRow && <button className="btn small" disabled={locked} onClick={() => set(path, [...rows, newRow()])}>+ Add row</button>}
    </div>
  );
}

export function Section({ title, children, open = false, badge }: { title: string; children: ReactNode; open?: boolean; badge?: ReactNode }) {
  return (
    <details className="section" open={open}>
      <summary>{title} {badge}</summary>
      <div className="body">{children}</div>
    </details>
  );
}

export const STATUS_OPTIONS: DataStatus[] = ['measured', 'disaggregated', 'modelled', 'estimated', 'assumed', 'imported', 'missing', 'not_applicable', 'not_assessed'];
