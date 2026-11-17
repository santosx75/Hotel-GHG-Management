import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { CalcLine, CalculationResult, PropertyId, ViewId } from '../types';
import { useStore } from '../state/store';
import { usePropertyResults } from '../state/useResults';
import { Badge, Card, KPI, Modal, Notice, PillGroup, Tabs } from '../components/ui';
import { PropertyContext, type PropCtx } from '../components/fields';
import { ExplainDrawer, ParamDrawer, WhatChanged, viewLabel, type ExplainTarget } from '../components/explain';
import { BarList, ChartFrame, GroupedBars, MonthlyStack, PALETTE, Waterfall } from '../components/charts';
import { eur, kgco2e, m3, mwh, num, pct, signed, tco2e, deltaPct } from '../lib/format';
import { MONTHS, sum } from '../engine/util';
import { scope3Matrix } from '../engine/accounting';
import { ActivityTab, BuildingTab, WaterTab } from './sections/ActivityBuildingWater';
import { LightingTab, LaundryTab, HousekeepingTab } from './sections/LightingLaundry';
import { FoodTab, MobilityTab, RefrigerantsWasteAssetsTab } from './sections/FoodMobilityOther';
import { EnergySupplyTab, BoundaryTab, FinanceTab, DataQualityTab } from './sections/SupplyBoundaryFinance';

type TabId = 'overview' | 'activity' | 'building' | 'water' | 'lighting' | 'laundry' | 'housekeeping' | 'food' | 'mobility' | 'refrig' | 'supply' | 'boundary' | 'finance' | 'quality';
const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Overview' }, { id: 'activity', label: 'Activity' }, { id: 'building', label: 'Building & HVAC' }, { id: 'water', label: 'Water & hot water' },
  { id: 'lighting', label: 'Lighting' }, { id: 'laundry', label: 'Linen & laundry' }, { id: 'housekeeping', label: 'Housekeeping & amenities' }, { id: 'food', label: 'Food & beverage' },
  { id: 'mobility', label: 'Mobility & logistics' }, { id: 'refrig', label: 'Refrigerants, waste & assets' }, { id: 'supply', label: 'Energy & water supply' },
  { id: 'boundary', label: 'Boundary & Scope 3' }, { id: 'finance', label: 'Finance & decisions' }, { id: 'quality', label: 'Data quality' },
];

export const viewTotal = (r: CalculationResult, v: ViewId, method: 'location' | 'market') => {
  if (v === 'corporate') return method === 'market' ? r.totals.corporateMB : r.totals.corporateLB;
  return v === 'hcmi' ? r.totals.hcmi : v === 'visitor' ? r.totals.visitor : r.totals.lca;
};
export const viewLines = (r: CalculationResult, v: ViewId) => r.lines.filter((l) => l.views.includes(v));

export function PropertyPage({ pid }: { pid: PropertyId }) {
  const store = useStore();
  const ps = store.data.properties[pid];
  const sc = ps.scenarios.find((s) => s.id === ps.activeScenarioId) ?? ps.scenarios[0];
  const settings = store.data.settings;
  const lib = store.data.library;
  const res = usePropertyResults(pid);
  const [tab, setTab] = useState<TabId>('overview');
  const [view, setView] = useState<ViewId>(settings.analyticsView);
  const [explain, setExplain] = useState<ExplainTarget | null>(null);
  const [param, setParam] = useState<{ path: string; label: string } | null>(null);
  const [confirmBaseline, setConfirmBaseline] = useState(false);
  const [baselineLabel, setBaselineLabel] = useState('');
  const set = useCallback((path: string, value: unknown) => store.setInput(pid, path, value), [pid]); // eslint-disable-line
  const ctx: PropCtx = useMemo(() => ({ pid, inputs: sc.inputs, baseline: ps.baseline.inputs, locked: sc.locked, set, openParam: (path, label) => setParam({ path, label }) }), [pid, sc.inputs, ps.baseline.inputs, sc.locked, set]);
  const adv = sc.inputs.mode === 'advanced';
  const p = sc.inputs.profile;
  const method = settings.scope2Primary;
  const b = res.baseline;
  const s = res.scenario;

  return (
    <PropertyContext.Provider value={ctx}>
      <div className="prop-header">
        <div style={{ minWidth: 0 }}>
          <h1>{p.name}</h1>
          <div className="row muted" style={{ fontSize: '.84rem' }}>
            <span>{p.positioning}</span>·<span>{p.commune}, {p.department}</span>·<Badge status="assumed">Fictional demonstration property</Badge>
            {p.geoContext !== 'mainland' && <Badge status="missing">Geographic revalidation required</Badge>}
          </div>
        </div>
        <div className="controls">
          <div className="field">
            <label htmlFor="scenario-sel">Scenario</label>
            <select id="scenario-sel" value={sc.id} onChange={(e) => store.selectScenario(pid, e.target.value)}>
              {ps.scenarios.map((x) => <option key={x.id} value={x.id}>{x.name}{x.locked ? ' (locked)' : ''}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="year-sel">Reporting period</label>
            <select id="year-sel" value={sc.inputs.boundary.reportingYear} disabled={sc.locked} onChange={(e) => set('boundary.reportingYear', Number(e.target.value))}>
              {[2023, 2024, 2025, 2026, 2027].map((y) => <option key={y} value={y}>Calendar year {y}</option>)}
            </select>
          </div>
          <div className="field">
            <span className="flabel">Detail level</span>
            <PillGroup label="Detail level" value={sc.inputs.mode} onChange={(v) => set('mode', v)} options={[{ value: 'simple', label: 'Quick' }, { value: 'advanced', label: 'Advanced' }]} />
          </div>
        </div>
      </div>

      <div className="row no-print" style={{ marginTop: 10 }}>
        <PillGroup label="Analytical view (views overlap and are never added)" value={view} onChange={setView} options={[{ value: 'corporate', label: 'Corporate inventory' }, { value: 'hcmi', label: 'HCMI-aligned' }, { value: 'visitor', label: 'Visitor impact' }, { value: 'lca', label: 'Life-cycle' }]} />
        <PillGroup label="Scope 2 method" value={method} onChange={(v) => store.setSettings({ scope2Primary: v })} options={[{ value: 'location', label: 'Scope 2: location' }, { value: 'market', label: 'Scope 2: market' }]} />
        <span className="spacer" />
        <button className="btn small" onClick={() => store.undo(pid)} disabled={sc.locked} title="Undo last change">↶ Undo</button>
        <button className="btn small" onClick={() => store.redo(pid)} disabled={sc.locked} title="Redo">↷ Redo</button>
        <button className="btn small" onClick={() => { if (confirm('Reset this scenario to the saved baseline? (Undo is available.)')) store.resetScenario(pid); }} disabled={sc.locked}>Reset to baseline</button>
        <button className="btn small" onClick={() => store.updateMeta(pid, sc.id, { locked: !sc.locked })} aria-pressed={sc.locked}>{sc.locked ? 'Unlock assumptions' : 'Lock assumptions'}</button>
        <button className="btn small" onClick={() => { const n = prompt('Name for the duplicated scenario', `${sc.name} (copy)`); if (n) store.newScenario(pid, n, sc.id); }}>Duplicate</button>
        <button className="btn small" onClick={() => { setBaselineLabel(`Baseline saved ${new Date().toLocaleDateString('en-GB')}`); setConfirmBaseline(true); }}>Save as baseline…</button>
        <Link className="btn small" to={`/report/${pid}`}>Print report</Link>
      </div>
      {sc.locked && <Notice kind="info">This scenario is locked: inputs are read-only. Unlock to edit.</Notice>}
      <p className="muted" style={{ fontSize: '.78rem', margin: '6px 0 0' }}>Baseline: <strong>{ps.baseline.label}</strong> (saved {new Date(ps.baseline.savedAt).toLocaleString('en-GB')}). The baseline only changes when you explicitly save a scenario as baseline.</p>

      <Tabs tabs={TABS} value={tab} onChange={setTab} label="Property sections" />

      <div role="tabpanel" aria-labelledby={`tab-${tab}`}>
        {tab === 'overview' && <Overview pid={pid} res={res} view={view} method={method} onExplain={setExplain} goTab={setTab} />}
        {tab === 'activity' && <ActivityTab res={res} adv={adv} />}
        {tab === 'building' && <BuildingTab res={res} adv={adv} />}
        {tab === 'water' && <WaterTab res={res} adv={adv} />}
        {tab === 'lighting' && <LightingTab res={res} adv={adv} />}
        {tab === 'laundry' && <LaundryTab res={res} adv={adv} />}
        {tab === 'housekeeping' && <HousekeepingTab res={res} adv={adv} />}
        {tab === 'food' && <FoodTab res={res} adv={adv} />}
        {tab === 'mobility' && <MobilityTab res={res} adv={adv} />}
        {tab === 'refrig' && <RefrigerantsWasteAssetsTab res={res} adv={adv} />}
        {tab === 'supply' && <EnergySupplyTab res={res} adv={adv} />}
        {tab === 'boundary' && <BoundaryTab res={res} />}
        {tab === 'finance' && <FinanceTab res={res} implementationYear={sc.implementationYear} />}
        {tab === 'quality' && <DataQualityTab res={res} onExplain={setExplain} />}
      </div>

      <SummaryBar b={b} s={s} view={view} method={method} stale={res.stale} />
      <ExplainDrawer target={explain} onClose={() => setExplain(null)} library={lib} />
      {param && <ParamDrawer path={param.path} label={param.label} onClose={() => setParam(null)} library={lib} />}
      <Modal open={confirmBaseline} onClose={() => setConfirmBaseline(false)} title="Replace the saved baseline?">
        <p>The current scenario “{sc.name}” will become the new baseline for this property. All comparisons will then be measured against it. CAPEX items are not carried into the baseline. This is recorded in the audit trail.</p>
        <div className="field"><label htmlFor="bl-label">Baseline label</label><input id="bl-label" type="text" value={baselineLabel} onChange={(e) => setBaselineLabel(e.target.value)} /></div>
        <div className="row" style={{ marginTop: 12 }}><button className="btn primary" onClick={() => { store.saveBaseline(pid, baselineLabel || 'Baseline'); setConfirmBaseline(false); }}>Replace baseline</button><button className="btn" onClick={() => setConfirmBaseline(false)}>Cancel</button></div>
      </Modal>
    </PropertyContext.Provider>
  );
}

function SummaryBar({ b, s, view, method, stale }: { b: CalculationResult; s: CalculationResult; view: ViewId; method: 'location' | 'market'; stale: boolean }) {
  const tb = viewTotal(b, view, method);
  const ts = viewTotal(s, view, method);
  const d = tb != null && ts != null ? ts - tb : null;
  return (
    <div className="summary-bar" aria-live="polite" aria-atomic="true">
      <span><span className="muted">{viewLabel(view)} · scenario:</span> <strong>{ts == null ? 'n/a' : tco2e(ts)}</strong></span>
      <span><span className="muted">vs baseline:</span> <strong className={d != null && d < 0 ? 'delta-down' : d != null && d > 0 ? 'delta-up' : ''}>{d == null ? 'n/a' : signed(d, tco2e)}</strong> {d != null && tb ? `(${pct(deltaPct(tb, ts!), 1)})` : ''}</span>
      <span><span className="muted">Opex:</span> <strong>{signed(s.totals.opexEUR - b.totals.opexEUR, eur)}</strong>/yr</span>
      <span><span className="muted">Water:</span> <strong>{signed(s.totals.waterM3 - b.totals.waterM3, m3)}</strong></span>
      {s.capexTotal > 0 && <span><span className="muted">CAPEX:</span> <strong>{eur(s.capexTotal)}</strong></span>}
      {s.totals.partialInventory && <Badge status="not_assessed">Partial inventory</Badge>}
      {stale && <span className="muted">updating…</span>}
    </div>
  );
}

function Overview({ pid, res, view, method, onExplain, goTab }: { pid: PropertyId; res: ReturnType<typeof usePropertyResults>; view: ViewId; method: 'location' | 'market'; onExplain: (t: ExplainTarget) => void; goTab: (t: TabId) => void }) {
  const store = useStore();
  const { baseline: b, scenario: s } = res;
  const t = s.totals;
  const tb = b.totals;
  const occRN = sum(s.activity.occupiedRoomNights);
  const gn = sum(s.activity.guestNights);
  const vt = viewTotal(s, view, method);
  const vb = viewTotal(b, view, method);
  const d = (a: number | null, x: number | null, f: (v: number) => string) => (a == null || x == null ? null : <span className={x - a < 0 ? 'delta-down' : x - a > 0 ? 'delta-up' : ''}>{signed(x - a, f)} vs baseline</span>);
  const lines = viewLines(s, view);
  const ex = (title: string, ls: CalcLine[], extra?: Partial<ExplainTarget>) => () => onExplain({ title, lines: ls, view, ...extra });
  const s3rows = scope3Matrix(res.scenarioInputs, s.lines);

  // charts data
  const scopeData = [
    { name: 'Scope 1', baseline: tb.scope1 / 1000, scenario: t.scope1 / 1000 },
    { name: `Scope 2 (${method === 'market' ? 'MB' : 'LB'})`, baseline: ((method === 'market' ? tb.scope2MB : tb.scope2LB) ?? 0) / 1000, scenario: ((method === 'market' ? t.scope2MB : t.scope2LB) ?? 0) / 1000 },
    { name: 'Scope 3 (assessed)', baseline: tb.scope3 / 1000, scenario: t.scope3 / 1000 },
  ];
  const monthly = MONTHS.map((m, i) => {
    const row: Record<string, number | string> = { month: m };
    for (const sc of ['S1', 'S2', 'S3', 'OUT']) row[sc] = sum(lines.filter((l) => l.scope === sc).map((l) => l.monthly[i])) / 1000;
    return row;
  });
  const bySource: Record<string, number> = {};
  for (const l of lines) bySource[l.module] = (bySource[l.module] ?? 0) + l.kg;
  const byDept: Record<string, number> = {};
  for (const l of lines) byDept[l.department] = (byDept[l.department] ?? 0) + l.kg;
  const byDeptB: Record<string, number> = {};
  for (const l of viewLines(b, view)) byDeptB[l.department] = (byDeptB[l.department] ?? 0) + l.kg;
  const depts = Array.from(new Set([...Object.keys(byDept), ...Object.keys(byDeptB)]));
  const steps = depts.map((k) => ({ label: k, value: ((byDept[k] ?? 0) - (byDeptB[k] ?? 0)) / 1000 })).filter((x) => Math.abs(x.value) > 0.0005);
  const dq: Record<string, number> = {};
  for (const l of lines) dq[l.status] = (dq[l.status] ?? 0) + l.kg;
  const viewTotalAll = sum(lines.map((l) => l.kg));

  const checklist = [
    { label: 'Monthly electricity bills entered', done: res.scenarioInputs.measured.useMeasured && res.scenarioInputs.measured.electricityKWh.some((x) => x != null), tab: 'supply' as TabId },
    { label: 'Gas / fuel bills entered', done: res.scenarioInputs.measured.gasKWhPCS.some((x) => x != null) || !s.energy.natural_gas, tab: 'supply' as TabId },
    { label: 'Water bills entered', done: res.scenarioInputs.measured.waterM3.some((x) => x != null), tab: 'supply' as TabId },
    { label: 'Supplier factor for outsourced laundry', done: res.scenarioInputs.outsourcedLaundry.factorKgPerKg != null || s.laundry.kgWashedOutsourced === 0, tab: 'laundry' as TabId },
    { label: 'Refrigerant top-ups recorded (mass balance)', done: res.scenarioInputs.refrigerants.every((r) => r.measuredTopUpKg != null), tab: 'refrig' as TabId },
    { label: 'Waste weighed (all streams)', done: res.scenarioInputs.waste.every((w) => w.measurement === 'weighed' || w.linkedToFoodModule), tab: 'refrig' as TabId },
    { label: 'Food purchases from invoices', done: res.scenarioInputs.food.measuredPurchasesKg != null, tab: 'food' as TabId },
    { label: 'Scope 3 screening complete (no "not assessed")', done: !s3rows.some((r) => r.status === 'not_assessed'), tab: 'boundary' as TabId },
    { label: 'No missing data items', done: s.missing.length === 0, tab: 'quality' as TabId },
  ];

  return (
    <div className="stack">
      {t.partialInventory && view === 'corporate' && (
        <Notice kind="warn" title="Partial inventory.">Some Scope 3 categories are not assessed or some data are missing, so this is not a complete footprint. See Boundary & Scope 3 and Data quality.</Notice>
      )}
      {view === 'hcmi' && <Notice kind="info">HCMI-aligned view (partial): Scope 1 + Scope 2 (location-based) + outsourced laundry, with a floor-area allocation between rooms and meeting space. It reproduces only the publicly described structure of HCMI v2.0; it is <strong>not</strong> an HCMI calculation and has not been verified against the official tool.</Notice>}
      {view === 'visitor' && <Notice kind="info">Extended visitor-impact view: hotel operations (excluding one-off capital acquisitions) plus guest travel and excursions. Overlaps the corporate inventory — never add the two.</Notice>}
      {view === 'lca' && <Notice kind="info">Life-cycle decision view: operations incl. upstream, with capital goods shown as annualised embodied indicators instead of acquisition-year totals. A decision aid, not a reporting inventory.</Notice>}

      <div className="kpis">
        <KPI label={`Total — ${viewLabel(view)}`} value={vt == null ? 'n/a' : tco2e(vt)} delta={d(vb, vt, tco2e)} sub={view === 'corporate' ? `Scope 1 + 2 (${method}) + assessed Scope 3` : 'Overlapping view — not additive'} onExplain={ex(`Total — ${viewLabel(view)}`, lines)} />
        <KPI label="Scope 1" value={tco2e(t.scope1)} delta={d(tb.scope1, t.scope1, tco2e)} sub="Direct: fuels, fleet, refrigerants" onExplain={ex('Scope 1', s.lines.filter((l) => l.scope === 'S1'), { view: 'corporate' })} />
        <KPI label="Scope 2 — location-based" value={tco2e(t.scope2LB)} delta={d(tb.scope2LB, t.scope2LB, tco2e)} sub="Grid average factor" onExplain={ex('Scope 2 location-based', s.lines.filter((l) => l.scope === 'S2'), { view: 'corporate' })} />
        <KPI label="Scope 2 — market-based" value={t.scope2MB == null ? 'Not available' : tco2e(t.scope2MB)} sub={t.scope2MB == null ? 'Needs supplier or residual-mix factor' : 'Alternative to location-based'} />
        <KPI label={`Scope 3 ${t.partialInventory ? '(partial)' : ''}`} value={tco2e(t.scope3)} delta={d(tb.scope3, t.scope3, tco2e)} sub={`${s3rows.filter((r) => r.lineCount > 0).length} of 15 categories calculated`} onExplain={ex('Scope 3', s.lines.filter((l) => l.scope === 'S3' && l.views.includes('corporate')), { view: 'corporate' })} />
        <KPI label="Guest travel (disclosed separately)" value={tco2e(t.guestTravel)} delta={d(tb.guestTravel, t.guestTravel, tco2e)} sub={`Per arriving guest: ${kgco2e(sum(s.activity.arrivingGuests) ? t.guestTravel / sum(s.activity.arrivingGuests) : null)}${t.guestTravelNonCO2 ? ` · aviation non-CO2 shown separately: ${tco2e(t.guestTravelNonCO2)}` : ''}`} onExplain={ex('Guest travel', s.lines.filter((l) => l.department === 'Guest travel'), { view: 'visitor' })} />
        <KPI label="Per occupied room-night" value={occRN ? kgco2e((vt ?? 0) / occRN) : 'n/a'} sub={`${viewLabel(view)} ÷ ${num(occRN)} occupied room-nights`} />
        <KPI label="Per guest-night" value={gn ? kgco2e((vt ?? 0) / gn) : 'n/a'} sub={`${viewLabel(view)} ÷ ${num(gn)} guest-nights`} />
        {view === 'hcmi' && <KPI label="HCMI-aligned per occupied room" value={kgco2e(t.hcmiPerOccupiedRoom)} sub="Rooms share by floor area (meeting space excluded)" />}
        {view === 'hcmi' && <KPI label="HCMI-aligned per m²·h meeting" value={t.hcmiPerMeetingM2Hour == null ? 'n/a' : kgco2e(t.hcmiPerMeetingM2Hour)} sub="Meeting share ÷ (m² × hours used)" />}
        <KPI label="Final energy" value={mwh(t.energyKWh)} delta={d(tb.energyKWh, t.energyKWh, mwh)} sub={`of which electricity ${mwh(t.electricityKWh)}; gas in kWh PCS`} />
        <KPI label="Water (mains)" value={m3(t.waterM3)} delta={d(tb.waterM3, t.waterM3, m3)} sub={`${num(gn ? (t.waterM3 * 1000) / gn : null)} L per guest-night`} />
        <KPI label="Waste" value={`${num(t.wasteKg / 1000)} t`} delta={d(tb.wasteKg, t.wasteKg, (v) => `${num(v / 1000)} t`)} sub="Registered + modelled streams" />
        <KPI label="Operating cost (modelled lines)" value={eur(t.opexEUR)} delta={d(tb.opexEUR, t.opexEUR, eur)} sub={res.scenarioInputs.finance.vatRecoverable ? 'EUR excl. VAT' : 'EUR incl. non-recoverable VAT'} />
        <KPI label="CAPEX (scenario)" value={eur(s.capexTotal)} sub="One-off; see Finance for NPV and payback" />
        {t.perRevenueEUR != null && <KPI label="Per € revenue" value={`${num(t.perRevenueEUR * 1000)} gCO2e/€`} sub="Revenue entered by user (financial intensity)" />}
      </div>

      <Card title="What changed? (scenario vs saved baseline)">
        <WhatChanged baseline={b} scenario={s} bIn={res.baselineInputs} sIn={res.scenarioInputs} view={view} />
      </Card>

      <div className="grid grid-2">
        <ChartFrame title="Emissions by scope" description="tCO2e/yr, baseline vs scenario. Scope 2 shows the selected method only (location- and market-based are alternatives)." table={{ headers: ['Scope', 'Baseline t', 'Scenario t'], rows: scopeData.map((r) => [r.name, r.baseline, r.scenario]) }}>
          <GroupedBars data={scopeData} keys={[{ key: 'baseline', label: 'Baseline', color: PALETTE.base }, { key: 'scenario', label: 'Scenario', color: PALETTE.scen }]} yLabel="tCO2e" />
        </ChartFrame>
        <ChartFrame title="Monthly profile" description={`tCO2e per month in the ${viewLabel(view)} (scenario), stacked by scope. Months sum to the annual total.`} table={{ headers: ['Month', 'Scope 1', 'Scope 2', 'Scope 3', 'Outside scopes'], rows: monthly.map((r) => [r.month as string, r.S1 as number, r.S2 as number, r.S3 as number, r.OUT as number]) }}>
          <MonthlyStack data={monthly} keys={[{ key: 'S1', label: 'Scope 1', color: PALETTE.s1 }, { key: 'S2', label: 'Scope 2', color: PALETTE.s2 }, { key: 'S3', label: 'Scope 3', color: PALETTE.s3 }, { key: 'OUT', label: 'Outside scopes', color: PALETTE.out }]} />
        </ChartFrame>
      </div>
      <div className="grid grid-2">
        <Card title="Emissions by source (scenario)">
          <BarList items={Object.entries(bySource).map(([k, v]) => ({ label: k, value: v }))} unit={(v) => tco2e(v)} total={viewTotalAll} />
        </Card>
        <Card title="Emissions by department (scenario)">
          <BarList items={Object.entries(byDept).map(([k, v]) => ({ label: k, value: v }))} unit={(v) => tco2e(v)} total={viewTotalAll} color={PALETTE.s1} />
        </Card>
      </div>
      <div className="grid grid-2">
        <ChartFrame title="Baseline → scenario waterfall" description="Change by department in tCO2e/yr (green = reduction, red = increase). Recalculated as an integrated system, not summed from isolated measures." table={{ headers: ['Step', 'tCO2e'], rows: [['Baseline', (vb ?? 0) / 1000], ...steps.map((x) => [x.label, x.value] as [string, number]), ['Scenario', (vt ?? 0) / 1000]] }} tall>
          <Waterfall start={sum(viewLines(b, view).map((l) => l.kg)) / 1000} steps={steps} end={viewTotalAll / 1000} startLabel="Baseline" endLabel="Scenario" />
        </ChartFrame>
        <Card title="Data-quality distribution (share of emissions)">
          <BarList items={Object.entries(dq).map(([k, v]) => ({ label: k.replace('_', ' '), value: v }))} unit={(v) => tco2e(v)} total={viewTotalAll} color={PALETTE.s3} />
          <p className="muted" style={{ fontSize: '.78rem' }}>“Assumed” = fictional demonstration operating assumption; “modelled” = engineering estimate; “disaggregated” = split from measured bills. Missing items carry 0 kg here but are flagged and make the inventory partial.</p>
        </Card>
      </div>

      <div className="grid grid-2">
        <Card title="Five-minute quick start">
          <ol style={{ paddingLeft: 18, margin: 0 }} className="stack">
            <li><button className="btn link" onClick={() => goTab('water')}>Reduce shower flow</button> — edit the flow rate and watch water <em>and</em> hot-water energy change.</li>
            <li><button className="btn link" onClick={() => goTab('laundry')}>Change towel dimensions</button> — shorter/lighter towels change mass, laundry loads, water, energy and purchases.</li>
            <li><button className="btn link" onClick={() => store.applyPreset(pid, 'led-retrofit')}>Replace lighting (apply LED preset)</button> — lighting electricity, heat gains and lamp purchases change; CAPEX is added.</li>
            <li><button className="btn link" onClick={() => goTab('laundry')}>Compare laundry options</button> — in-house vs outsourced: emissions shift scope but do not disappear.</li>
            <li><button className="btn link" onClick={() => goTab('mobility')}>Change guest arrival modes</button> — visible in the visitor-impact view, never forced into the corporate inventory.</li>
          </ol>
        </Card>
        <Card title="Data-completeness checklist">
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }} className="stack">
            {checklist.map((c) => <li key={c.label} className="row"><span aria-hidden="true">{c.done ? '✅' : '⬜'}</span><span style={{ flex: 1 }}>{c.label}</span><span className="sr-only">{c.done ? 'done' : 'to do'}</span>{!c.done && <button className="btn small" onClick={() => goTab(c.tab)}>Go</button>}</li>)}
          </ul>
        </Card>
      </div>

      {s.warnings.length > 0 && (
        <Card title={`Assumptions, constraints & warnings (${s.warnings.length})`}>
          <ul style={{ paddingLeft: 18, margin: 0 }}>
            {s.warnings.map((w) => <li key={w.message}><Badge status={w.level === 'error' ? 'missing' : w.level === 'warn' ? 'assumed' : 'disaggregated'}>{w.level}</Badge> <strong>{w.module}:</strong> {w.message}</li>)}
          </ul>
        </Card>
      )}
    </div>
  );
}
