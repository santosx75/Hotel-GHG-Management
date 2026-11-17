import { useMemo, useState } from 'react';
import type { CalculationResult, PropertyId } from '../types';
import { useStore } from '../state/store';
import { calculate, calibrationFrom } from '../engine';
import { Card, Notice } from '../components/ui';
import { ChartFrame, GroupedBars, PALETTE, Scatter2 } from '../components/charts';
import { eur, kgco2e, m3, mwh, num, signed, tco2e } from '../lib/format';
import { sum } from '../engine/util';
import { PROPERTY_IDS } from '../data/library';

const COLORS = [PALETTE.base, PALETTE.scen, PALETTE.s1, PALETTE.s3, PALETTE.out];

export default function ComparePage() {
  const data = useStore((s) => s.data);
  const [pid, setPid] = useState<PropertyId>('city-hotel');
  const ps = data.properties[pid];
  const [sel, setSel] = useState<string[]>(() => ps.scenarios.slice(0, 4).map((s) => s.id));
  const results = useMemo(() => {
    const base = calculate(ps.baseline.inputs, data.settings, data.library);
    const cal = calibrationFrom(base);
    const list: { id: string; name: string; r: CalculationResult; capex: number }[] = [{ id: 'baseline', name: `Baseline — ${ps.baseline.label}`, r: base, capex: 0 }];
    for (const s of ps.scenarios.filter((x) => sel.includes(x.id)).slice(0, 4)) list.push({ id: s.id, name: s.name, r: calculate(s.inputs, data.settings, data.library, cal), capex: sum(s.inputs.capex.map((c) => c.amountEUR)) });
    return list;
  }, [ps, sel, data.settings, data.library]);
  const crossProps = useMemo(() => PROPERTY_IDS.map((id) => ({ id, name: data.properties[id].baseline.inputs.profile.name, r: calculate(data.properties[id].baseline.inputs, data.settings, data.library) })), [data]);
  const b = results[0].r;
  const metrics: { label: string; f: (r: CalculationResult) => number | null; fmt: (v: number) => string }[] = [
    { label: 'Corporate inventory (location-based)', f: (r) => r.totals.corporateLB, fmt: tco2e },
    { label: 'Corporate inventory (market-based)', f: (r) => r.totals.corporateMB, fmt: tco2e },
    { label: 'Scope 1', f: (r) => r.totals.scope1, fmt: tco2e },
    { label: 'Scope 2 location-based', f: (r) => r.totals.scope2LB, fmt: tco2e },
    { label: 'Scope 3 (assessed)', f: (r) => r.totals.scope3, fmt: tco2e },
    { label: 'HCMI-aligned (partial)', f: (r) => r.totals.hcmi, fmt: tco2e },
    { label: 'Guest travel (separate)', f: (r) => r.totals.guestTravel, fmt: tco2e },
    { label: 'Life-cycle view', f: (r) => r.totals.lca, fmt: tco2e },
    { label: 'kgCO2e per occupied room-night (corporate)', f: (r) => r.totals.perOccupiedRoomNight, fmt: kgco2e },
    { label: 'kgCO2e per guest-night (corporate)', f: (r) => r.totals.perGuestNight, fmt: kgco2e },
    { label: 'Final energy', f: (r) => r.totals.energyKWh, fmt: mwh },
    { label: 'Water (mains)', f: (r) => r.totals.waterM3, fmt: m3 },
    { label: 'Waste (t)', f: (r) => r.totals.wasteKg / 1000, fmt: (v) => `${num(v)} t` },
    { label: 'Operating cost', f: (r) => r.totals.opexEUR, fmt: eur },
  ];
  return (
    <div className="stack">
      <h1>Compare scenarios</h1>
      <Notice kind="info">Every scenario is recalculated as an integrated system with the same engine and the baseline's calibration. Location- and market-based totals are alternatives; views overlap and must not be added.</Notice>
      <Card title="Selection">
        <div className="fields">
          <div className="field"><label htmlFor="cmp-prop">Property</label><select id="cmp-prop" value={pid} onChange={(e) => { const p = e.target.value as PropertyId; setPid(p); setSel(data.properties[p].scenarios.slice(0, 4).map((s) => s.id)); }}>{PROPERTY_IDS.map((id) => <option key={id} value={id}>{data.properties[id].baseline.inputs.profile.name}</option>)}</select></div>
        </div>
        <fieldset style={{ border: 'none', padding: 0 }}><legend className="muted">Scenarios to compare (max 4, plus baseline)</legend>
          <div className="row">{ps.scenarios.map((s) => <label key={s.id} className="toggle"><input type="checkbox" checked={sel.includes(s.id)} disabled={!sel.includes(s.id) && sel.length >= 4} onChange={(e) => setSel(e.target.checked ? [...sel, s.id] : sel.filter((x) => x !== s.id))} /> {s.name}</label>)}</div>
        </fieldset>
        {ps.scenarios.length < 2 && <p className="muted">Create more scenarios on the property page (Duplicate) or the Scenarios page.</p>}
      </Card>
      <Card title="Side-by-side results">
        <div className="table-wrap" tabIndex={0} role="region" aria-label="Scrollable table">
          <table>
            <thead><tr><th>Metric</th>{results.map((x) => <th key={x.id} className="num">{x.name}</th>)}</tr></thead>
            <tbody>
              {metrics.map((m) => (
                <tr key={m.label}><th scope="row">{m.label}</th>{results.map((x, i) => { const v = m.f(x.r); const bv = m.f(b); return <td key={x.id} className="num">{v == null ? 'n/a' : m.fmt(v)}{i > 0 && v != null && bv != null && <div className={v - bv < 0 ? 'delta-down' : v - bv > 0 ? 'delta-up' : 'muted'} style={{ fontSize: '.74rem' }}>{signed(v - bv, m.fmt)}</div>}</td>; })}</tr>
              ))}
              <tr><th scope="row">CAPEX</th>{results.map((x) => <td key={x.id} className="num">{eur(x.capex)}</td>)}</tr>
              <tr><th scope="row">Partial inventory</th>{results.map((x) => <td key={x.id} className="num">{x.r.totals.partialInventory ? 'yes' : 'no'}</td>)}</tr>
            </tbody>
          </table>
        </div>
      </Card>
      <div className="grid grid-2">
        <ChartFrame title="Emissions by scope" description="tCO2e/yr per scenario (Scope 2 location-based)." table={{ headers: ['Scenario', 'Scope 1', 'Scope 2', 'Scope 3'], rows: results.map((x) => [x.name, x.r.totals.scope1 / 1000, x.r.totals.scope2LB / 1000, x.r.totals.scope3 / 1000]) }}>
          <GroupedBars data={['Scope 1', 'Scope 2', 'Scope 3'].map((sc, j) => ({ name: sc, ...Object.fromEntries(results.map((x) => [x.id, [x.r.totals.scope1, x.r.totals.scope2LB, x.r.totals.scope3][j] / 1000])) }))} keys={results.map((x, i) => ({ key: x.id, label: x.name, color: COLORS[i % COLORS.length] }))} yLabel="tCO2e" />
        </ChartFrame>
        <ChartFrame title="Cost vs carbon" description="Change vs baseline: x = ΔtCO2e/yr (corporate), y = Δ operating cost €/yr. Lower-left saves both." table={{ headers: ['Scenario', 'ΔtCO2e', 'Δ€/yr', 'CAPEX €'], rows: results.slice(1).map((x) => [x.name, (x.r.totals.corporateLB - b.totals.corporateLB) / 1000, x.r.totals.opexEUR - b.totals.opexEUR, x.capex]) }}>
          <Scatter2 xLabel="ΔtCO2e/yr" yLabel="Δ€/yr" points={results.slice(1).map((x, i) => ({ name: x.name, x: (x.r.totals.corporateLB - b.totals.corporateLB) / 1000, y: x.r.totals.opexEUR - b.totals.opexEUR, color: COLORS[(i + 1) % COLORS.length] }))} />
        </ChartFrame>
      </div>
      <Card title="Three properties — saved baselines (not a benchmark)">
        <div className="table-wrap" tabIndex={0} role="region" aria-label="Scrollable table"><table><thead><tr><th>Property</th><th className="num">Corporate t</th><th className="num">kg/occ. room-night</th><th className="num">kg/guest-night</th><th className="num">Visitor view t</th><th className="num">Energy</th><th className="num">Water</th></tr></thead>
          <tbody>{crossProps.map((x) => <tr key={x.id}><td>{x.name}</td><td className="num">{num(x.r.totals.corporateLB / 1000)}</td><td className="num">{num(x.r.totals.perOccupiedRoomNight)}</td><td className="num">{num(x.r.totals.perGuestNight)}</td><td className="num">{num(x.r.totals.visitor / 1000)}</td><td className="num">{mwh(x.r.totals.energyKWh)}</td><td className="num">{m3(x.r.totals.waterM3)}</td></tr>)}</tbody></table></div>
        <p className="muted" style={{ fontSize: '.78rem' }}>Different boundaries (scope 3 coverage, outlets) and fictional data — not comparable as performance benchmarks.</p>
      </Card>
    </div>
  );
}
