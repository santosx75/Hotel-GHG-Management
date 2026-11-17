import { useState, type ReactNode } from 'react';
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis,
} from 'recharts';
import { num } from '../lib/format';

export const PALETTE = { s1: '#2f5d8a', s2: '#3a8c7a', s3: '#c08a2e', out: '#8b6fb0', base: '#7d8a84', scen: '#1f5f57', good: '#2c6e3f', bad: '#a3271f' };
const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const anim = !reduced;
const tick = { fontSize: 11, fill: '#6b7872' };

export function ChartFrame({ title, description, table, children, tall }: { title: string; description: string; table: { headers: string[]; rows: (string | number)[][] }; children: ReactNode; tall?: boolean }) {
  const [showTable, setShowTable] = useState(false);
  return (
    <figure className="card" style={{ margin: 0 }} aria-label={title}>
      <div className="card-head">
        <h3 style={{ margin: 0 }}>{title}</h3>
        <button className="btn small no-print" onClick={() => setShowTable(!showTable)} aria-expanded={showTable}>{showTable ? 'Show chart' : 'Show data table'}</button>
      </div>
      <figcaption className="muted" style={{ fontSize: '.78rem', marginBottom: 6 }}>{description}</figcaption>
      {showTable ? (
        <div className="table-wrap" tabIndex={0} role="region" aria-label="Scrollable table">
          <table>
            <caption className="sr-only">{title}</caption>
            <thead><tr>{table.headers.map((h) => <th key={h} scope="col">{h}</th>)}</tr></thead>
            <tbody>{table.rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className={typeof c === 'number' ? 'num' : ''}>{typeof c === 'number' ? num(c) : c}</td>)}</tr>)}</tbody>
          </table>
        </div>
      ) : (
        <div className={`chart-box ${tall ? 'tall' : ''}`} role="img" aria-label={`${title}. ${description}. Use "Show data table" for values.`}><div aria-hidden="true" style={{ width: '100%', height: '100%' }}>{children}</div></div>
      )}
    </figure>
  );
}

/** Accessible horizontal bar list (used for many-category breakdowns, adapts to small screens). */
export function BarList({ items, unit, total, max = 12, color = PALETTE.scen }: { items: { label: string; value: number; color?: string }[]; unit: (v: number) => string; total?: number; max?: number; color?: string }) {
  const sorted = [...items].filter((i) => Math.abs(i.value) > 1e-9).sort((a, b) => b.value - a.value);
  const shown = sorted.slice(0, max);
  const rest = sorted.slice(max).reduce((s, i) => s + i.value, 0);
  const top = Math.max(1e-9, ...shown.map((i) => Math.abs(i.value)));
  return (
    <div className="bar-list">
      {shown.map((i) => (
        <div className="bar-row" key={i.label}>
          <div>
            <div style={{ fontSize: '.8rem', overflowWrap: 'anywhere' }}>{i.label}</div>
            <div className="bar-track" aria-hidden="true"><div className="bar-fill" style={{ width: `${(Math.abs(i.value) / top) * 100}%`, background: i.color ?? color }} /></div>
          </div>
          <div style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{unit(i.value)}{total ? <div className="muted" style={{ fontSize: '.72rem' }}>{num((i.value / total) * 100, 2)} %</div> : null}</div>
        </div>
      ))}
      {rest !== 0 && <div className="bar-row"><div className="muted" style={{ fontSize: '.8rem' }}>{sorted.length - max} other items</div><div style={{ textAlign: 'right' }}>{unit(rest)}</div></div>}
    </div>
  );
}

export function MonthlyStack({ data, keys }: { data: Record<string, number | string>[]; keys: { key: string; label: string; color: string }[] }) {
  return (
    <ResponsiveContainer>
      <BarChart data={data} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#d9ddd6" />
        <XAxis dataKey="month" tick={tick} />
        <YAxis tick={tick} width={44} tickFormatter={(v) => num(v, 2)} />
        <Tooltip formatter={(v: number) => num(v)} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {keys.map((k) => <Bar key={k.key} dataKey={k.key} name={k.label} stackId="a" fill={k.color} isAnimationActive={anim} />)}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function GroupedBars({ data, keys, yLabel }: { data: Record<string, number | string>[]; keys: { key: string; label: string; color: string }[]; yLabel?: string }) {
  return (
    <ResponsiveContainer>
      <BarChart data={data} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#d9ddd6" />
        <XAxis dataKey="name" tick={tick} interval={0} />
        <YAxis tick={tick} width={48} tickFormatter={(v) => num(v, 2)} label={yLabel ? { value: yLabel, angle: -90, position: 'insideLeft', style: { fontSize: 11, fill: '#6b7872' } } : undefined} />
        <Tooltip formatter={(v: number) => num(v)} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {keys.map((k) => <Bar key={k.key} dataKey={k.key} name={k.label} fill={k.color} isAnimationActive={anim} />)}
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Waterfall: start, signed steps, end (all in the same unit). */
export function Waterfall({ start, steps, end, startLabel, endLabel }: { start: number; steps: { label: string; value: number }[]; end: number; startLabel: string; endLabel: string }) {
  let run = start;
  const data = [{ name: startLabel, base: 0, value: start, kind: 'total' }];
  for (const s of steps) {
    const lo = Math.min(run, run + s.value);
    data.push({ name: s.label, base: lo, value: Math.abs(s.value), kind: s.value < 0 ? 'down' : 'up' });
    run += s.value;
  }
  data.push({ name: endLabel, base: 0, value: end, kind: 'total' });
  return (
    <ResponsiveContainer>
      <BarChart data={data} margin={{ top: 6, right: 6, left: 0, bottom: 40 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#d9ddd6" />
        <XAxis dataKey="name" tick={{ ...tick, fontSize: 10 }} interval={0} angle={-30} textAnchor="end" height={60} />
        <YAxis tick={tick} width={48} tickFormatter={(v) => num(v, 2)} />
        <Tooltip formatter={(v: number, n: string) => (n === 'base' ? [null, null] : num(v))} />
        <Bar dataKey="base" stackId="w" fill="transparent" isAnimationActive={false} />
        <Bar dataKey="value" stackId="w" isAnimationActive={anim}>
          {data.map((d, i) => <Cell key={i} fill={d.kind === 'total' ? PALETTE.base : d.kind === 'down' ? PALETTE.good : PALETTE.bad} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function Scatter2({ points, xLabel, yLabel }: { points: { name: string; x: number; y: number; color?: string }[]; xLabel: string; yLabel: string }) {
  return (
    <ResponsiveContainer>
      <ScatterChart margin={{ top: 10, right: 10, left: 14, bottom: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#d9ddd6" />
        <XAxis type="number" dataKey="x" name={xLabel} tick={tick} tickFormatter={(v) => num(v, 2)} label={{ value: xLabel, position: 'insideBottom', offset: -10, style: { fontSize: 11, fill: '#6b7872' } }} />
        <YAxis type="number" dataKey="y" name={yLabel} tick={tick} width={70} tickFormatter={(v) => num(v, 2)} label={{ value: yLabel, angle: -90, position: 'left', offset: -2, style: { fontSize: 11, fill: '#6b7872' } }} />
        <ZAxis range={[70, 70]} />
        <ReferenceLine x={0} stroke="#999" />
        <ReferenceLine y={0} stroke="#999" />
        <Tooltip cursor={{ strokeDasharray: '3 3' }} content={({ payload }) => payload?.[0] ? <div className="card" style={{ padding: 8 }}><strong>{(payload[0].payload as any).name}</strong><div>{xLabel}: {num((payload[0].payload as any).x)}</div><div>{yLabel}: {num((payload[0].payload as any).y)}</div></div> : null} />
        <Scatter data={points} isAnimationActive={anim}>{points.map((p, i) => <Cell key={i} fill={p.color ?? PALETTE.scen} />)}</Scatter>
      </ScatterChart>
    </ResponsiveContainer>
  );
}

export function Lines({ data, keys, yLabel }: { data: Record<string, number | string>[]; keys: { key: string; label: string; color: string; dashed?: boolean }[]; yLabel: string }) {
  return (
    <ResponsiveContainer>
      <LineChart data={data} margin={{ top: 6, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#d9ddd6" />
        <XAxis dataKey="year" tick={tick} />
        <YAxis tick={tick} width={52} tickFormatter={(v) => num(v, 2)} label={{ value: yLabel, angle: -90, position: 'insideLeft', style: { fontSize: 11, fill: '#6b7872' } }} />
        <Tooltip formatter={(v: number) => num(v)} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {keys.map((k) => <Line key={k.key} dataKey={k.key} name={k.label} stroke={k.color} strokeDasharray={k.dashed ? '5 4' : undefined} dot={false} strokeWidth={2} isAnimationActive={anim} />)}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function Tornado({ rows, unit }: { rows: { label: string; low: number; high: number }[]; unit: string }) {
  const data = rows.map((r) => ({ name: r.label, low: r.low, high: r.high }));
  return (
    <ResponsiveContainer>
      <BarChart data={data} layout="vertical" margin={{ top: 6, right: 12, left: 4, bottom: 6 }} stackOffset="sign">
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#d9ddd6" />
        <XAxis type="number" tick={tick} tickFormatter={(v) => num(v, 2)} label={{ value: unit, position: 'insideBottom', offset: -2, style: { fontSize: 11, fill: '#6b7872' } }} />
        <YAxis type="category" dataKey="name" tick={{ ...tick, fontSize: 10 }} width={150} />
        <Tooltip formatter={(v: number) => num(v)} />
        <ReferenceLine x={0} stroke="#666" />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="low" name="Low case" fill={PALETTE.s1} stackId="t" isAnimationActive={anim} />
        <Bar dataKey="high" name="High case" fill={PALETTE.s3} stackId="t" isAnimationActive={anim} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Marginal abatement curve: bar widths = annual abatement, heights = €/tCO2e. Custom SVG (Recharts lacks variable-width bars). */
export function MacCurve({ items }: { items: { label: string; widthT: number; mac: number }[] }) {
  const data = items.filter((i) => i.widthT > 0).sort((a, b) => a.mac - b.mac);
  if (!data.length) return <p className="muted">No intervention reduces emissions on the modelled data.</p>;
  const W = 640, H = 260, pad = 40;
  const totalW = data.reduce((s, d) => s + d.widthT, 0);
  const maxY = Math.max(10, ...data.map((d) => d.mac));
  const minY = Math.min(0, ...data.map((d) => d.mac));
  const y = (v: number) => pad / 2 + ((maxY - v) / (maxY - minY)) * (H - pad);
  let x = pad;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" preserveAspectRatio="none" aria-hidden="true">
      <line x1={pad} x2={W - 4} y1={y(0)} y2={y(0)} stroke="#888" />
      <text x={4} y={y(maxY) + 4} fontSize="10" fill="#6b7872">{num(maxY, 2)}</text>
      <text x={4} y={y(minY)} fontSize="10" fill="#6b7872">{num(minY, 2)}</text>
      {data.map((d) => {
        const w = (d.widthT / totalW) * (W - pad - 4);
        const r = <g key={d.label}><rect x={x} y={Math.min(y(0), y(d.mac))} width={Math.max(1, w - 1)} height={Math.abs(y(d.mac) - y(0))} fill={d.mac < 0 ? PALETTE.good : PALETTE.s3}><title>{`${d.label}: ${num(d.widthT)} tCO2e/yr at ${num(d.mac)} €/t`}</title></rect></g>;
        x += w;
        return r;
      })}
      <text x={W - 4} y={H - 4} fontSize="10" textAnchor="end" fill="#6b7872">cumulative abatement (tCO2e/yr) →</text>
    </svg>
  );
}
