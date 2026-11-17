import { useEffect, useMemo, useRef, useState } from 'react';
import type { PropertyResults } from '../../state/useResults';
import type { S3Status } from '../../types';
import { Badge, Card, Notice } from '../../components/ui';
import { Month12, NumField, Section, SelectField, TextField, Toggle, useProp } from '../../components/fields';
import { BarList, ChartFrame, Lines, MacCurve, MonthlyStack, PALETTE, Scatter2, Tornado } from '../../components/charts';
import { ImportPanel } from '../../components/ImportPanel';
import { scope3Matrix, S3_NAMES } from '../../engine/accounting';
import { bnbBusinessShare } from '../../engine/supply';
import { MONTHS, sum } from '../../engine/util';
import { calibrationFrom } from '../../engine';
import { multiYear, type FinanceResult } from '../../engine/finance';
import { tornado, type TornadoRow } from '../../engine/sensitivity';
import { evaluatePresets, greedyPackage, type PresetEvaluation } from '../../scenarios/decision';
import { PRESETS } from '../../scenarios/presets';
import { useStore } from '../../state/store';
import { eur, kgco2e, mwh, num, pct, tco2e } from '../../lib/format';
import { Acc } from '../../engine/context';
import type { ExplainTarget } from '../../components/explain';

export function EnergySupplyTab({ res, adv }: { res: PropertyResults; adv: boolean }) {
  const { inputs, pid } = useProp();
  const lib = useStore((s) => s.data.library);
  const settings = useStore((s) => s.data.settings);
  const sol = res.scenario.solar;
  const solarData = MONTHS.map((m, i) => ({ month: m, self: sol.selfConsumed[i] / 1000, exported: sol.exported[i] / 1000, grid: sol.gridImport[i] / 1000 }));
  const share = inputs.bnb ? bnbBusinessShare(new Acc(inputs, { settings, library: lib }), res.scenario.activity) : 1;
  const priceRefs = Object.values(lib.prices);
  return (
    <div className="stack">
      {inputs.bnb && (
        <Card title="B&B: separating household and business">
          <Notice kind="info">Only accommodation-business activity is included. Guest-driven loads (showers, guest laundry, breakfasts) are fully business; shared building services (space heating, hot-water losses, base load, leaks, shared lighting) are allocated with the method below. Owner-private travel and household food are never allocated automatically.</Notice>
          <div className="fields">
            <SelectField path="bnb.method" label="Allocation method" options={[{ value: 'dedicated_meter', label: 'Dedicated meter (bills are business-only)' }, { value: 'floor_area', label: 'Floor-area share' }, { value: 'occupied_nights', label: 'Occupied nights (guest vs household person-nights)' }, { value: 'direct_measurement', label: 'Direct measurement (sub-meter share)' }, { value: 'user_defined', label: 'User-defined share' }]} />
            <NumField path="bnb.businessFloorShare" /><NumField path="bnb.householdPersons" label="Household members" unit="persons" max={20} /><NumField path="bnb.householdNightsPerYear" label="Household nights at home" unit="nights/yr" max={366} />
            <NumField path="bnb.measuredBusinessShare" label="Measured business share" percent nullable /><NumField path="bnb.userShare" />
          </div>
          <p><strong>Business share applied to shared services: {pct(share, 1)}</strong></p>
        </Card>
      )}
      <Card title="Electricity contract">
        <div className="fields">
          <NumField path="electricity.priceEnergyHP" /><NumField path="electricity.priceEnergyHC" /><NumField path="electricity.offPeakShare" />
          <NumField path="electricity.networkVariablePerKWh" label="Network (TURPE) variable" unit="EUR/kWh" step={0.001} max={1} /><NumField path="electricity.excisePerKWh" label="Excise (accise)" unit="EUR/kWh" step={0.0001} max={1} />
          <NumField path="electricity.fixedPerYear" />
          <Toggle path="electricity.greenTariff" label="Green tariff" /><NumField path="electricity.goCoveredShare" />
          <NumField path="electricity.supplierMarketFactor" label="Supplier-specific factor (market-based)" unit="kgCO2e/kWh" step={0.001} nullable max={2} />
          <NumField path="electricity.residualMixFactor" label="Residual-mix factor" unit="kgCO2e/kWh" step={0.001} nullable max={2} />
        </div>
        <p className="muted" style={{ fontSize: '.78rem' }}>{inputs.electricity.priceSourceNote} Fixed charges stay unless the contract changes; they are never turned into a marginal per-kWh saving. Market-based Scope 2 is calculated only when a supplier or residual-mix factor is entered.</p>
        <details><summary className="muted" style={{ cursor: 'pointer' }}>Reference price records (library)</summary>
          <div className="table-wrap" tabIndex={0} role="region" aria-label="Scrollable table"><table><thead><tr><th>Record</th><th className="num">Value</th><th>Kind</th><th>Applicability</th></tr></thead>
            <tbody>{priceRefs.filter((p) => /elec|gas|pv/.test(p.id)).map((p) => <tr key={p.id}><td>{p.name}</td><td className="num">{num(p.value, 4)} {p.unit}</td><td><Badge status={p.kind} /></td><td className="muted">{p.applicabilityWarning ?? p.customerCategory}</td></tr>)}</tbody></table></div>
        </details>
      </Card>
      <div className="grid grid-2">
        <Section title="Fuels & heat prices" open={adv}>
          <div className="fields">
            <NumField path="fuels.gasPricePerKWh" label="Gas (energy + network)" unit="EUR/kWh PCS" step={0.001} max={1} /><NumField path="fuels.gasFixedPerYear" label="Gas fixed charges" unit="EUR/yr" />
            <NumField path="fuels.gasExcisePerKWh" label="Gas excise" unit="EUR/kWh" step={0.001} max={1} /><NumField path="fuels.dieselPerL" label="Diesel" unit="EUR/L" step={0.01} />
            <NumField path="fuels.petrolPerL" label="Petrol" unit="EUR/L" step={0.01} /><NumField path="fuels.heatingOilPerL" label="Heating oil" unit="EUR/L" step={0.01} />
            <NumField path="fuels.lpgPerKg" label="LPG" unit="EUR/kg" step={0.01} /><NumField path="fuels.pelletsPerTonne" label="Wood pellets" unit="EUR/t" /><NumField path="fuels.districtHeatPerKWh" label="District heat" unit="EUR/kWh" step={0.001} />
          </div>
        </Section>
        <Section title="Water & wastewater tariff" open={adv}>
          <div className="fields">
            <NumField path="water.potablePerM3" label="Drinking water" unit="EUR/m³" step={0.01} /><NumField path="water.wastewaterPerM3" label="Wastewater (sanitation)" unit="EUR/m³" step={0.01} />
            <NumField path="water.fixedPerYear" label="Fixed/meter charges" unit="EUR/yr" />
            <SelectField path="water.wastewaterBasis" label="Wastewater billing basis" options={[{ value: 'all_metered', label: 'All metered volume' }, { value: 'excluding_irrigation_submeter', label: 'Excluding sub-metered irrigation' }, { value: 'private_treatment', label: 'Private on-site treatment (no sanitation charge)' }]} />
            {inputs.water.wastewaterBasis === 'private_treatment' && <><NumField path="water.privateTreatmentCostPerYear" label="Private treatment servicing" unit="EUR/yr" /><NumField path="water.septicBODgPerGuestNight" label="BOD load" unit="g/guest-night" /></>}
          </div>
          <p className="muted" style={{ fontSize: '.78rem' }}>{inputs.profile.waterContextNote}</p>
        </Section>
      </div>
      <Card title="On-site solar PV & battery">
        <div className="fields">
          <Toggle path="solar.enabled" label="PV installed" /><NumField path="solar.kWp" /><NumField path="solar.simultaneityShare" /><NumField path="solar.batteryKWh" />
          {adv && <><NumField path="solar.batteryCyclesPerMonth" label="Battery cycles" unit="per month" max={31} /><NumField path="solar.batteryRoundTrip" /><NumField path="solar.m2PerKWp" label="Roof area per kWp" unit="m²" step={0.1} /></>}
          <NumField path="solar.roofAreaM2Available" label="Roof area available" unit="m²" /><NumField path="solar.exportPricePerKWh" label="Export price" unit="EUR/kWh" step={0.001} max={1} />
        </div>
        {inputs.solar.enabled && (
          <ChartFrame title="PV generation use and grid import" description="MWh per month: self-consumed, exported and grid import. Self-consumption never exceeds generation or demand." table={{ headers: ['Month', 'Self-consumed', 'Exported', 'Grid import'], rows: solarData.map((r) => [r.month, r.self, r.exported, r.grid]) }}>
            <MonthlyStack data={solarData} keys={[{ key: 'self', label: 'Self-consumed PV', color: PALETTE.good }, { key: 'exported', label: 'Exported', color: PALETTE.s3 }, { key: 'grid', label: 'Grid import', color: PALETTE.s1 }]} />
          </ChartFrame>
        )}
        <p className="muted" style={{ fontSize: '.78rem' }}>Monthly balance with a direct-simultaneity share and battery shifting (monthly resolution — hourly timing is not modelled). Yields are demonstration values for the climate profile. Export tariff 1.1 c€/kWh (purchase obligation for requests from 5 Jun 2026, as reported).</p>
      </Card>
      <Section title="Backup generator & maintenance fuel" open={adv}>
        <div className="fields">
          <Toggle path="generator.enabled" label="Backup generator" /><NumField path="generator.kW" label="Rated power" unit="kW" /><NumField path="generator.testHoursPerYear" label="Test hours" unit="h/yr" />
          <NumField path="generator.outageHoursPerYear" label="Outage hours" unit="h/yr" /><NumField path="generator.loadShare" label="Average load" percent /><NumField path="generator.litresPerKWh" label="Fuel use" unit="L/kWh" step={0.01} />
          <NumField path="maintenanceFuel.dieselL" label="Maintenance equipment diesel" unit="L/yr" /><NumField path="maintenanceFuel.petrolL" label="Maintenance equipment petrol" unit="L/yr" />
          <Toggle path="guestEvCharging.enabled" label="Guest EV charging point" /><NumField path="guestEvCharging.shareOfStays" label="Stays that charge" percent /><NumField path="guestEvCharging.kWhPerCharge" label="Energy per charge" unit="kWh" />
          <NumField path="guestEvCharging.rechargedPricePerKWh" label="Re-invoiced to guests" unit="EUR/kWh" step={0.01} max={2} />
        </div>
      </Section>
      <Card title="Measured data (bills) and calibration">
        <div className="fields"><Toggle path="measured.useMeasured" label="Use measured bills (calibrate the model to them)" /></div>
        <div className="stack" style={{ marginTop: 8 }}>
          <Month12 path="measured.electricityKWh" label="Electricity grid import (kWh)" nullable />
          <Month12 path="measured.gasKWhPCS" label="Natural gas (kWh PCS)" nullable />
          <Month12 path="measured.waterM3" label="Mains water (m³)" nullable />
          <Month12 path="measured.laundryKgOutsourced" label="Outsourced laundry (kg)" nullable />
          <div className="fields"><NumField path="measured.fleetDieselL" label="Fleet diesel (annual)" unit="L" nullable /><NumField path="measured.fleetPetrolL" label="Fleet petrol (annual)" unit="L" nullable /></div>
        </div>
        <div className="table-wrap" tabIndex={0} role="region" aria-label="Scrollable table" style={{ marginTop: 10 }}>
          <table><thead><tr><th>Stream</th><th className="num">Measured</th><th className="num">Bottom-up model</th><th className="num">Calibration residual</th><th>Reported total is</th></tr></thead>
            <tbody>{Object.entries(res.scenario.calibration).map(([k, v]) => <tr key={k}><td>{k.replace('_', ' ')}</td><td className="num">{v.measured == null ? '—' : num(v.measured)}</td><td className="num">{num(v.modelled)}</td><td className="num">{v.residual == null ? '—' : `${num(v.residual)} (${pct(v.modelled ? v.residual / v.modelled : null, 1)})`}</td><td>{v.factors ? <Badge status="disaggregated" /> : <Badge status="modelled">Bottom-up modelled</Badge>}</td></tr>)}</tbody></table>
        </div>
        <p className="muted" style={{ fontSize: '.78rem' }}>In measured mode, bottom-up end uses are scaled to the bills month by month (no loads are added on top of a measured total); the residual shows how far the engineering model was from the bills. Scenarios apply the baseline calibration factors.</p>
      </Card>
      <Card title="Import CSV data"><ImportPanel pid={pid} inputs={inputs} /></Card>
      <Card title="Energy by carrier and end use (scenario)">
        <div className="grid grid-2">
          {Object.entries(res.scenario.energy).map(([c, f]) => (
            <div key={c}><h4>{c.replace('_', ' ')} — {c === 'electricity' || c === 'natural_gas' || c === 'wood_pellets' || c === 'district_heat' ? mwh(sum(f.total)) : `${num(sum(f.total))} ${c === 'lpg' ? 'kg' : 'L'}`} <Badge status={f.status} /></h4>
              <BarList items={Object.entries(f.endUses).map(([k, v]) => ({ label: k, value: sum(v) }))} unit={(v) => num(v)} max={10} /></div>
          ))}
        </div>
      </Card>
    </div>
  );
}

const S3_STATUS: { value: S3Status; label: string }[] = [
  { value: 'not_assessed', label: 'Not assessed' }, { value: 'not_applicable', label: 'Not applicable' }, { value: 'excluded', label: 'Excluded (justified)' }, { value: 'missing', label: 'Applicable — data missing' }, { value: 'estimated', label: 'Estimated elsewhere' }, { value: 'included', label: 'Included' },
];

export function BoundaryTab({ res }: { res: PropertyResults }) {
  const { inputs, set, locked } = useProp();
  const rows = scope3Matrix(inputs, res.scenario.lines);
  return (
    <div className="stack">
      <Card title="Organisational boundary">
        <div className="fields">
          <TextField path="boundary.reportingEntity" label="Reporting entity" />
          <SelectField path="boundary.ownership" label="Asset status" options={[{ value: 'owned', label: 'Owned' }, { value: 'leased', label: 'Leased' }, { value: 'managed', label: 'Managed' }, { value: 'franchised', label: 'Franchised' }]} />
          <SelectField path="boundary.consolidation" label="Consolidation approach" options={[{ value: 'operational_control', label: 'Operational control' }, { value: 'financial_control', label: 'Financial control' }, { value: 'equity_share', label: 'Equity share' }]} help="All three are recorded; the calculations assume the property is 100 % inside the selected boundary." />
          <NumField path="boundary.baseYear" label="Base year" unit="year" min={1990} max={2100} />
          <TextField path="boundary.includedBuildings" label="Included buildings" />
          <Toggle path="boundary.restaurantsIncluded" label="Restaurants & bars inside boundary" />
          <Toggle path="boundary.concessionsIncluded" label="Third-party concessions included" />
          <TextField path="boundary.concessionNote" label="Shops / concessions" multiline />
          <TextField path="boundary.sharedServicesNote" label="Shared services" multiline />
          <TextField path="boundary.outsourcedActivitiesNote" label="Outsourced activities" multiline />
          <TextField path="boundary.openingsClosuresNote" label="Openings / closures" multiline />
          <TextField path="boundary.renovationNote" label="Major renovations" multiline />
        </div>
      </Card>
      <Card title="Scope 3 screening matrix (15 categories)">
        <div className="table-wrap" tabIndex={0} role="region" aria-label="Scrollable table">
          <table>
            <thead><tr><th>#</th><th>Category</th><th>Status</th><th className="num">tCO2e</th><th>Justification / basis</th></tr></thead>
            <tbody>{rows.map((r) => {
              const idx = inputs.boundary.scope3.findIndex((s) => s.cat === r.cat);
              return (
                <tr key={r.cat}><td>{r.cat}</td><td>{r.name}</td>
                  <td>{r.auto ? <Badge status={r.status} /> : (
                    <select aria-label={`Status for category ${r.cat}`} value={r.status} disabled={locked} onChange={(e) => set(`boundary.scope3.${idx}.status`, e.target.value)}>{S3_STATUS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
                  )}</td>
                  <td className="num">{r.lineCount ? num(r.kg / 1000) : r.status === 'not_applicable' ? 'n/a' : '—'}</td>
                  <td>{r.auto ? <span className="muted">Calculated from {r.lineCount} activity line(s).</span> : <input type="text" aria-label={`Justification for category ${r.cat}`} value={inputs.boundary.scope3[idx]?.justification ?? ''} disabled={locked} onChange={(e) => set(`boundary.scope3.${idx}.justification`, e.target.value)} />}</td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
        <p className="muted" style={{ fontSize: '.78rem' }}>No numerical value is forced for irrelevant categories. Guest-room electricity is hotel Scope 2, not category 11. Outsourced activities stay in the footprint (category 1). Independently booked guest travel is disclosed in the visitor-impact view.</p>
      </Card>
      <Card title="Analytical views (overlapping — never added together)">
        <ul>
          <li><strong>Corporate inventory</strong> — Scope 1 + Scope 2 (location- or market-based) + assessed Scope 3; capital goods in acquisition year. {tco2e(res.scenario.totals.corporateLB)} (location-based).</li>
          <li><strong>HCMI-aligned (partial)</strong> — Scope 1 + Scope 2 location-based + outsourced laundry; per occupied room and per m²·h of meeting space by floor-area allocation. {tco2e(res.scenario.totals.hcmi)}.</li>
          <li><strong>Extended visitor impact</strong> — hotel operations + guest travel + excursions. {tco2e(res.scenario.totals.visitor)}.</li>
          <li><strong>Life-cycle decision view</strong> — operations incl. upstream + annualised embodied emissions. {tco2e(res.scenario.totals.lca)}.</li>
          <li><strong>Reported separately</strong> — biogenic CO2 {tco2e(res.scenario.totals.biogenicCO2)}; aviation non-CO2 {tco2e(res.scenario.totals.guestTravelNonCO2)}.</li>
        </ul>
      </Card>
    </div>
  );
}

export function FinanceTab({ res, implementationYear }: { res: PropertyResults; implementationYear: number }) {
  const { inputs, pid, locked } = useProp();
  const store = useStore();
  const settings = store.data.settings;
  const lib = store.data.library;
  const sc = store.data.properties[pid].scenarios.find((s) => s.id === store.data.properties[pid].activeScenarioId)!;
  const [fin, setFin] = useState<FinanceResult | null>(null);
  const [evals, setEvals] = useState<PresetEvaluation[] | null>(null);
  const [pkg, setPkg] = useState<ReturnType<typeof greedyPackage> | null>(null);
  const [tor, setTor] = useState<TornadoRow[] | null>(null);
  const [mc, setMc] = useState<{ status: 'idle' | 'running' | 'done' | 'error'; r?: any; err?: string }>({ status: 'idle' });
  const cal = useMemo(() => calibrationFrom(res.baseline), [res.baseline]);
  useEffect(() => {
    const t = setTimeout(() => setFin(multiYear(res.baselineInputs, inputs, implementationYear, settings, lib, cal)), 250);
    return () => clearTimeout(t);
  }, [inputs, res.baselineInputs, implementationYear, settings, lib, cal]);
  const workerRef = useRef<Worker | null>(null);
  useEffect(() => () => workerRef.current?.terminate(), []);
  const runMc = () => {
    setMc({ status: 'running' });
    workerRef.current?.terminate();
    const w = new Worker(new URL('../../engine/mc.worker.ts', import.meta.url), { type: 'module' });
    workerRef.current = w;
    w.onmessage = (e) => { setMc(e.data.ok ? { status: 'done', r: e.data.result } : { status: 'error', err: e.data.error }); w.terminate(); };
    w.postMessage({ inputs, settings, library: lib, n: 300, seed: 42, calibration: cal });
  };
  const years = fin?.years ?? [];
  let cb = 0, cs = 0, ccb = 0, ccs = 0;
  const cum = years.map((y) => { cb += y.baselineKg / 1000; cs += y.scenarioKg / 1000; ccb += y.baselineOpex; ccs += y.scenarioOpex + y.capex - y.residual; return { year: y.year, baseT: cb, scenT: cs, baseEUR: ccb, scenEUR: ccs }; });
  return (
    <div className="stack">
      <Card title="Financial framework">
        <div className="fields">
          <NumField path="finance.horizonYears" /><NumField path="finance.realDiscountRate" /><NumField path="finance.energyRealEscalation" label="Energy real escalation" percent min={-0.2} max={0.3} />
          <NumField path="finance.productRealEscalation" label="Product real escalation" percent min={-0.2} max={0.3} /><NumField path="finance.maintenanceRealEscalation" label="Maintenance real escalation" percent min={-0.2} max={0.3} />
          <Toggle path="finance.vatRecoverable" label="VAT recoverable (business ex-VAT analysis)" />
          <NumField path="finance.revenueEUR" label="Annual revenue (optional, for intensity)" unit="EUR" nullable />
          <NumField path="finance.hypotheticalCarbonPricePerT" label="Hypothetical carbon value (not cash)" unit="EUR/tCO2e" />
          <div className="field"><label htmlFor="impl">Scenario implementation year</label><input id="impl" type="number" value={implementationYear} min={inputs.boundary.reportingYear} max={inputs.boundary.reportingYear + 30} disabled={locked} onChange={(e) => store.updateMeta(pid, sc.id, { implementationYear: Number(e.target.value) })} /></div>
        </div>
        <p className="muted" style={{ fontSize: '.78rem' }}>Real-terms framework: real discount rate with real escalation on constant-price cash flows (no nominal/real mixing). Grants are not modelled (none verified for eligibility).</p>
      </Card>
      <Card title="Scenario CAPEX items">
        {inputs.capex.length === 0 ? <p className="muted">No CAPEX in this scenario. Presets add CAPEX items automatically; you can edit them here.</p> : (
          <div className="table-wrap" tabIndex={0} role="region" aria-label="Scrollable table"><table className="edit-table"><thead><tr><th>Item</th><th>€ (ex VAT)</th><th>Year</th><th>Embodied kgCO2e</th><th>Life yr</th><th></th></tr></thead>
            <tbody>{inputs.capex.map((c, i) => (
              <tr key={c.id}><td>{c.label}</td>
                {(['amountEUR', 'year', 'embodiedKg', 'lifeYears'] as const).map((k) => <td key={k}><input type="number" aria-label={`${k} ${c.label}`} disabled={locked} value={c[k]} min={0} onChange={(e) => { const v = Number(e.target.value); if (Number.isFinite(v) && v >= 0) store.setInput(pid, `capex.${i}.${k}`, v); }} /></td>)}
                <td><button className="icon-btn" disabled={locked} aria-label={`Remove ${c.label}`} onClick={() => store.setInput(pid, 'capex', inputs.capex.filter((_, j) => j !== i))}>✕</button></td></tr>
            ))}</tbody></table></div>
        )}
      </Card>
      {fin && (
        <>
          <div className="kpis">
            <div className="kpi"><div className="label">CAPEX</div><div className="value">{eur(fin.capexTotal)}</div></div>
            <div className="kpi"><div className="label">Annual saving (first full year)</div><div className="value">{eur(fin.annualSavingFirstFullYear)}</div></div>
            <div className="kpi"><div className="label">Simple payback</div><div className="value">{fin.simplePaybackYears == null ? 'No payback' : `${num(fin.simplePaybackYears, 2)} yr`}</div></div>
            <div className="kpi"><div className="label">NPV ({inputs.finance.horizonYears} yr)</div><div className="value">{eur(fin.npv)}</div></div>
            <div className="kpi"><div className="label">IRR</div><div className="value">{fin.irr == null ? 'Not meaningful' : pct(fin.irr, 1)}</div></div>
            <div className="kpi"><div className="label">Annual abatement</div><div className="value">{tco2e(fin.annualAbatementKgFirstFullYear)}</div><div className="sub">operational, corporate</div></div>
            <div className="kpi"><div className="label">Abatement cost</div><div className="value">{fin.macEURPerT == null ? 'n/a' : `${num(fin.macEURPerT)} €/t`}</div><div className="sub">−NPV ÷ cumulative abatement</div></div>
            <div className="kpi"><div className="label">Carbon break-even</div><div className="value">{fin.carbonBreakEvenYears == null ? 'Not reached' : `${num(fin.carbonBreakEvenYears, 2)} yr`}</div><div className="sub">embodied ÷ annual abatement</div></div>
            <div className="kpi"><div className="label">Hypothetical carbon value</div><div className="value">{eur(fin.hypotheticalCarbonValueEUR)}</div><div className="sub">not a cash flow</div></div>
          </div>
          {fin.notes.map((n) => <Notice key={n} kind="warn">{n}</Notice>)}
          <p className="muted" style={{ fontSize: '.78rem' }}>{fin.framework}</p>
          <div className="grid grid-2">
            <ChartFrame title="Cumulative emissions" description="tCO2e, corporate inventory, each year recalculated (replacements and acquisitions in their year)." table={{ headers: ['Year', 'Baseline t', 'Scenario t'], rows: cum.map((r) => [r.year, r.baseT, r.scenT]) }}>
              <Lines data={cum} yLabel="tCO2e" keys={[{ key: 'baseT', label: 'Baseline', color: PALETTE.base }, { key: 'scenT', label: 'Scenario', color: PALETTE.scen }]} />
            </ChartFrame>
            <ChartFrame title="Cumulative cost incl. CAPEX" description="EUR (real, undiscounted), operating cost + CAPEX − residual value." table={{ headers: ['Year', 'Baseline €', 'Scenario €'], rows: cum.map((r) => [r.year, r.baseEUR, r.scenEUR]) }}>
              <Lines data={cum} yLabel="EUR" keys={[{ key: 'baseEUR', label: 'Baseline', color: PALETTE.base }, { key: 'scenEUR', label: 'Scenario', color: PALETTE.scen }]} />
            </ChartFrame>
          </div>
        </>
      )}
      <Card title="Preset interventions (applied to the active scenario and recalculated as one system)">
        <div className="grid grid-3">
          {PRESETS.filter((p) => p.applicable(inputs)).map((p) => (
            <div key={p.id} className="preset-card">
              <strong>{p.label}</strong>
              <span style={{ fontSize: '.82rem' }}>{p.description}</span>
              <span className="mech">Mechanisms: {p.mechanisms.join(' · ')}</span>
              <button className="btn small" disabled={locked} onClick={() => store.applyPreset(pid, p.id)}>{sc.appliedPresets.includes(p.id) ? 'Apply again' : 'Apply to scenario'}</button>
            </div>
          ))}
        </div>
        {sc.appliedPresets.length > 0 && <p className="muted" style={{ fontSize: '.8rem' }}>Applied so far: {sc.appliedPresets.join(', ')}. Undo is available.</p>}
      </Card>
      <Card title="Decision support: evaluate interventions individually" actions={<button className="btn primary small" onClick={() => { const e = evaluatePresets(res.baselineInputs, settings, lib, cal); setEvals(e); setPkg(greedyPackage(res.baselineInputs, e, settings, lib, cal)); }}>Evaluate against baseline</button>}>
        <div className="fields" style={{ marginBottom: 8 }}>
          <NumField path="constraints.capexBudgetEUR" label="CAPEX budget" unit="EUR" nullable /><NumField path="constraints.maxPaybackYears" label="Maximum payback" unit="years" nullable step={0.5} />
          <NumField path="constraints.minHeatingSetpointC" label="Minimum heating setpoint" unit="°C" min={10} max={26} /><NumField path="constraints.maxCoolingSetpointC" label="Maximum cooling setpoint" unit="°C" min={18} max={32} />
          <NumField path="constraints.minTowelLengthCm" label="Minimum bath-towel length" unit="cm" nullable /><NumField path="constraints.minTowelGsm" label="Minimum bath-towel weight" unit="g/m²" nullable />
          <NumField path="constraints.maxHousekeepingHours" label="Housekeeping hours limit" unit="h/yr" nullable /><NumField path="constraints.roofAreaM2" label="Roof area limit" unit="m²" nullable /><NumField path="constraints.waterAvailabilityM3" label="Water availability" unit="m³/yr" nullable />
        </div>
        <p className="muted" style={{ fontSize: '.78rem' }}>Constraints are read from the <em>baseline</em> when evaluating (edit them, save as baseline, or evaluate again). Each intervention is applied alone to the baseline; NPV uses a constant-saving approximation here (the Finance KPIs above use the full year-by-year model).</p>
        {evals && (
          <>
            <div className="table-wrap" tabIndex={0} role="region" aria-label="Scrollable table">
              <table><thead><tr><th>Intervention</th><th>Category</th><th className="num">CAPEX</th><th className="num">Saving €/yr</th><th className="num">Abatement t/yr</th><th className="num">Water m³/yr</th><th className="num">Payback</th><th className="num">€/tCO2e</th><th className="num">Carbon break-even</th><th>Constraint warnings</th></tr></thead>
                <tbody>{[...evals].sort((a, b) => b.annualAbatementKg - a.annualAbatementKg).map((e) => (
                  <tr key={e.id}><td>{e.label}</td><td>{e.category}</td><td className="num">{eur(e.capex)}</td><td className="num">{eur(e.annualSaving)}</td><td className="num">{num(e.annualAbatementKg / 1000)}</td><td className="num">{num(e.waterSavingM3)}</td>
                    <td className="num">{e.simplePayback == null ? 'none' : `${num(e.simplePayback, 2)} yr`}</td><td className="num">{e.macApprox == null ? 'n/a' : num(e.macApprox)}</td><td className="num">{e.carbonBreakEven == null ? 'not reached' : `${num(e.carbonBreakEven, 2)} yr`}</td><td style={{ fontSize: '.78rem' }}>{e.warnings.join(' ') || '—'}</td></tr>
                ))}</tbody></table>
            </div>
            <div className="grid grid-2" style={{ marginTop: 10 }}>
              <ChartFrame title="Cost vs carbon" description="Each intervention: annual abatement (x, tCO2e) vs annual saving (y, €). Upper-right = saves money and carbon." table={{ headers: ['Intervention', 'Abatement t', 'Saving €'], rows: evals.map((e) => [e.label, e.annualAbatementKg / 1000, e.annualSaving]) }}>
                <Scatter2 xLabel="tCO2e/yr abated" yLabel="€/yr saved" points={evals.map((e) => ({ name: e.label, x: e.annualAbatementKg / 1000, y: e.annualSaving, color: e.annualSaving >= 0 ? PALETTE.good : PALETTE.s3 }))} />
              </ChartFrame>
              <ChartFrame title="Marginal abatement curve (approximate)" description="Bar width = annual abatement; height = €/tCO2e (negative = net saving). Only interventions that reduce emissions." table={{ headers: ['Intervention', 'Abatement t', '€/t'], rows: evals.filter((e) => e.macApprox != null).map((e) => [e.label, e.annualAbatementKg / 1000, e.macApprox!]) }}>
                <MacCurve items={evals.filter((e) => e.macApprox != null).map((e) => ({ label: e.label, widthT: e.annualAbatementKg / 1000, mac: e.macApprox! }))} />
              </ChartFrame>
            </div>
            {pkg && (
              <Notice kind="info" title="Heuristic package (not an optimum).">
                {pkg.method} Selected: {pkg.chosen.map((c) => c.label).join(', ') || 'none'}. CAPEX {eur(pkg.capex)}. Integrated abatement <strong>{tco2e(pkg.integratedAbatementKg)}</strong>/yr vs naive sum of isolated savings {tco2e(pkg.isolatedSumAbatementKg)}/yr (difference = interactions).
                {' '}<button className="btn small" disabled={locked} onClick={() => store.replaceInputs(pid, pkg.package, 'Applied heuristic package')}>Load this package into the active scenario</button>
              </Notice>
            )}
          </>
        )}
      </Card>
      <Card title="Sensitivity and uncertainty" actions={<><button className="btn small" onClick={() => setTor(tornado(inputs, settings, lib, cal).rows)}>Run sensitivity (one-at-a-time)</button><button className="btn small" onClick={runMc} disabled={mc.status === 'running'}>{mc.status === 'running' ? 'Running 300 samples…' : 'Run Monte Carlo (300 samples)'}</button></>}>
        <p className="muted" style={{ fontSize: '.78rem' }}>Drivers act on primary inputs only; dependent quantities (guest-nights, towel mass, heating demand) are recomputed, so correlated variables are not varied independently. Ranges are scenario ranges chosen for illustration, not statistical confidence intervals.</p>
        {tor && (() => {
          const rows = [...tor].sort((a, b) => Math.max(Math.abs(b.dLowKg), Math.abs(b.dHighKg)) - Math.max(Math.abs(a.dLowKg), Math.abs(a.dHighKg)));
          const rowsE = [...tor].sort((a, b) => Math.max(Math.abs(b.dLowEUR), Math.abs(b.dHighEUR)) - Math.max(Math.abs(a.dLowEUR), Math.abs(a.dHighEUR)));
          return (
            <div className="grid grid-2">
              <ChartFrame title="Emission drivers (tornado)" description="Change in corporate inventory (tCO2e) at low/high case of each driver." table={{ headers: ['Driver', 'Range', 'Low t', 'High t'], rows: rows.map((r) => [r.label, `${r.low} / ${r.high}`, r.dLowKg / 1000, r.dHighKg / 1000]) }} tall>
                <Tornado unit="ΔtCO2e" rows={rows.slice(0, 10).map((r) => ({ label: r.label, low: r.dLowKg / 1000, high: r.dHighKg / 1000 }))} />
              </ChartFrame>
              <ChartFrame title="Cost drivers (tornado)" description="Change in annual operating cost (€) at low/high case of each driver." table={{ headers: ['Driver', 'Range', 'Low €', 'High €'], rows: rowsE.map((r) => [r.label, `${r.low} / ${r.high}`, r.dLowEUR, r.dHighEUR]) }} tall>
                <Tornado unit="Δ€" rows={rowsE.slice(0, 10).map((r) => ({ label: r.label, low: r.dLowEUR, high: r.dHighEUR }))} />
              </ChartFrame>
            </div>
          );
        })()}
        {mc.status === 'done' && <p>Modelled uncertainty range (P10–P50–P90 of 300 samples, triangular ranges): <strong>{tco2e(mc.r.kg.p10)} – {tco2e(mc.r.kg.p50)} – {tco2e(mc.r.kg.p90)}</strong>; operating cost {eur(mc.r.eur.p10)} – {eur(mc.r.eur.p50)} – {eur(mc.r.eur.p90)}. This is not a statistical confidence interval.</p>}
        {mc.status === 'error' && <Notice kind="error">Monte Carlo failed: {mc.err}</Notice>}
      </Card>
    </div>
  );
}

export function DataQualityTab({ res, onExplain }: { res: PropertyResults; onExplain: (t: ExplainTarget) => void }) {
  const { inputs } = useProp();
  const lib = useStore((s) => s.data.library);
  const s = res.scenario;
  const corp = s.lines.filter((l) => l.views.includes('corporate'));
  const total = sum(corp.map((l) => l.kg));
  const byStatus: Record<string, number> = {};
  for (const l of corp) byStatus[l.status] = (byStatus[l.status] ?? 0) + l.kg;
  const byVerif: Record<string, number> = {};
  for (const l of corp) { const v = l.factorId ? lib.factors[l.factorId]?.verification ?? 'product/user input' : 'product/user input'; byVerif[v] = (byVerif[v] ?? 0) + l.kg; }
  const demoTop = corp.filter((l) => l.factorId && lib.factors[l.factorId]?.verification === 'demonstration').sort((a, b) => b.kg - a.kg).slice(0, 8);
  const missingLines = s.lines.filter((l) => l.status === 'missing');
  const declared = Object.entries(inputs.statusOverrides);
  return (
    <div className="stack">
      {s.totals.partialInventory && <Notice kind="warn" title="Partial inventory.">Not a complete footprint — see missing items and the Scope 3 screening matrix.</Notice>}
      <div className="grid grid-2">
        <Card title="Emissions by data status (corporate view)"><BarList items={Object.entries(byStatus).map(([k, v]) => ({ label: k.replace('_', ' '), value: v }))} unit={tco2e} total={total} color={PALETTE.s3} /></Card>
        <Card title="Emissions by factor verification"><BarList items={Object.entries(byVerif).map(([k, v]) => ({ label: k.replace('_', ' '), value: v }))} unit={tco2e} total={total} color={PALETTE.out} /></Card>
      </div>
      <Card title={`Missing data (${s.missing.length})`}>
        {s.missing.length === 0 ? <p className="muted">No items flagged as missing.</p> : <ul>{s.missing.map((m) => <li key={m}><Badge status="missing" /> {m}</li>)}</ul>}
        {missingLines.length > 0 && <button className="btn small" onClick={() => onExplain({ title: 'Lines with missing data', lines: missingLines })}>Explain missing lines</button>}
      </Card>
      <Card title="Data collection priorities (largest emissions resting on demonstration factors)">
        <ol>{demoTop.map((l) => <li key={l.id}>{l.label} — {tco2e(l.kg)} ({pct(l.kg / total, 1)}) using <code>{l.factorId}</code>: replace with supplier, AGRIBALYSE or Base Empreinte value.</li>)}</ol>
        <p className="muted" style={{ fontSize: '.78rem' }}>Also: enter monthly bills (measured mode), weigh waste streams, record refrigerant top-ups and obtain the outsourced-laundry supplier factor.</p>
      </Card>
      <Card title={`Double-counting controls (${s.suppressed.length} items suppressed)`}>
        <div className="table-wrap" tabIndex={0} role="region" aria-label="Scrollable table"><table><thead><tr><th>Item</th><th>Reason</th><th className="num">Avoided double count</th></tr></thead>
          <tbody>{s.suppressed.map((x) => <tr key={x.activityId}><td>{x.label}</td><td>{x.reason}</td><td className="num">{x.kgAvoidedDoubleCount ? kgco2e(x.kgAvoidedDoubleCount) : '—'}</td></tr>)}</tbody></table></div>
      </Card>
      <Card title="Declared input statuses">
        {declared.length === 0 ? <p className="muted">No input has been declared as measured/estimated yet. Use the ⓘ button next to any input.</p> : <ul>{declared.map(([k, v]) => <li key={k}><code>{k}</code>: <Badge status={v} /></li>)}</ul>}
      </Card>
      <Card title="Scope 3 coverage">
        <ul>{scope3Matrix(inputs, s.lines).map((r) => <li key={r.cat}>Cat. {r.cat} {S3_NAMES[r.cat]}: <Badge status={r.status} /> {r.lineCount ? tco2e(r.kg) : ''}</li>)}</ul>
      </Card>
    </div>
  );
}
