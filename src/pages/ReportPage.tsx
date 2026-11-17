import { Link, useParams } from 'react-router-dom';
import type { PropertyId } from '../types';
import { useStore } from '../state/store';
import { usePropertyResults } from '../state/useResults';
import { Badge, Card, Notice, download } from '../components/ui';
import { scope3Matrix } from '../engine/accounting';
import { costsCSV, resultsCSV } from '../lib/export';
import { eur, kgco2e, m3, mwh, num, tco2e } from '../lib/format';
import { sum } from '../engine/util';
import { MODEL_VERSION } from '../engine';
import { PROPERTY_IDS } from '../data/library';

export default function ReportPage() {
  const { pid } = useParams();
  if (!PROPERTY_IDS.includes(pid as PropertyId)) return <p>Unknown property.</p>;
  return <Report pid={pid as PropertyId} />;
}

function Report({ pid }: { pid: PropertyId }) {
  const data = useStore((s) => s.data);
  const ps = data.properties[pid];
  const sc = ps.scenarios.find((s) => s.id === ps.activeScenarioId)!;
  const { baseline: b, scenario: r } = usePropertyResults(pid);
  const p = sc.inputs;
  const t = r.totals;
  const top = r.lines.filter((l) => l.views.includes('corporate')).sort((a, c) => c.kg - a.kg).slice(0, 15);
  return (
    <div className="stack">
      <div className="row no-print">
        <Link className="btn small" to={`/${pid}`}>← Back to simulator</Link>
        <button className="btn small primary" onClick={() => window.print()}>Print / save as PDF</button>
        <button className="btn small" onClick={() => download(`${pid}-results.csv`, resultsCSV(r, sc.name), 'text/csv')}>Results CSV</button>
        <button className="btn small" onClick={() => download(`${pid}-costs.csv`, costsCSV(r), 'text/csv')}>Costs CSV</button>
      </div>
      <h1>{p.profile.name} — scenario “{sc.name}”</h1>
      <p className="muted">Reporting period: calendar year {p.boundary.reportingYear} · Model {MODEL_VERSION} · generated {new Date().toLocaleString('en-GB')} · baseline “{ps.baseline.label}”.</p>
      <Notice kind="warn">Fictional demonstration property. Results are estimates that depend on editable assumptions and partly unverified reference data; not certified or audited. {t.partialInventory ? 'This is a PARTIAL inventory.' : ''}</Notice>
      <Card title="Headline results">
        <div className="table-wrap" tabIndex={0} role="region" aria-label="Scrollable table"><table><thead><tr><th>Metric</th><th className="num">Baseline</th><th className="num">Scenario</th><th>Boundary / denominator</th></tr></thead>
          <tbody>
            <tr><td>Corporate inventory, location-based</td><td className="num">{tco2e(b.totals.corporateLB)}</td><td className="num">{tco2e(t.corporateLB)}</td><td>Scope 1 + 2 LB + assessed Scope 3</td></tr>
            <tr><td>Corporate inventory, market-based</td><td className="num">{tco2e(b.totals.corporateMB)}</td><td className="num">{tco2e(t.corporateMB)}</td><td>Alternative to location-based (not additive)</td></tr>
            <tr><td>Scope 1</td><td className="num">{tco2e(b.totals.scope1)}</td><td className="num">{tco2e(t.scope1)}</td><td>Direct</td></tr>
            <tr><td>Scope 2 location-based</td><td className="num">{tco2e(b.totals.scope2LB)}</td><td className="num">{tco2e(t.scope2LB)}</td><td>Grid average</td></tr>
            <tr><td>Scope 3 (assessed)</td><td className="num">{tco2e(b.totals.scope3)}</td><td className="num">{tco2e(t.scope3)}</td><td>See screening matrix</td></tr>
            <tr><td>HCMI-aligned (partial)</td><td className="num">{tco2e(b.totals.hcmi)}</td><td className="num">{tco2e(t.hcmi)}</td><td>Not an HCMI calculation</td></tr>
            <tr><td>Guest travel (disclosed separately)</td><td className="num">{tco2e(b.totals.guestTravel)}</td><td className="num">{tco2e(t.guestTravel)}</td><td>Visitor-impact view</td></tr>
            <tr><td>Biogenic CO2 (outside scopes)</td><td className="num">{tco2e(b.totals.biogenicCO2)}</td><td className="num">{tco2e(t.biogenicCO2)}</td><td>Reported separately</td></tr>
            <tr><td>Per occupied room-night</td><td className="num">{kgco2e(b.totals.perOccupiedRoomNight)}</td><td className="num">{kgco2e(t.perOccupiedRoomNight)}</td><td>Corporate LB ÷ {num(sum(r.activity.occupiedRoomNights))} occupied room-nights</td></tr>
            <tr><td>Per guest-night</td><td className="num">{kgco2e(b.totals.perGuestNight)}</td><td className="num">{kgco2e(t.perGuestNight)}</td><td>Corporate LB ÷ {num(sum(r.activity.guestNights))} guest-nights</td></tr>
            <tr><td>Final energy</td><td className="num">{mwh(b.totals.energyKWh)}</td><td className="num">{mwh(t.energyKWh)}</td><td>Gas on PCS basis</td></tr>
            <tr><td>Mains water</td><td className="num">{m3(b.totals.waterM3)}</td><td className="num">{m3(t.waterM3)}</td><td></td></tr>
            <tr><td>Operating cost (modelled lines)</td><td className="num">{eur(b.totals.opexEUR)}</td><td className="num">{eur(t.opexEUR)}</td><td>{p.finance.vatRecoverable ? 'excl. VAT' : 'incl. non-recoverable VAT'}</td></tr>
            <tr><td>CAPEX</td><td className="num">—</td><td className="num">{eur(r.capexTotal)}</td><td>Scenario one-off</td></tr>
          </tbody></table></div>
      </Card>
      <Card title="Organisational boundary">
        <p>{p.boundary.reportingEntity} · {p.boundary.ownership} · {p.boundary.consolidation.replace('_', ' ')} · base year {p.boundary.baseYear}. Included: {p.boundary.includedBuildings}. {p.boundary.outsourcedActivitiesNote} {p.boundary.concessionNote}</p>
      </Card>
      <Card title="Scope 3 screening">
        <div className="table-wrap" tabIndex={0} role="region" aria-label="Scrollable table"><table><thead><tr><th>Category</th><th>Status</th><th className="num">tCO2e</th><th>Justification</th></tr></thead>
          <tbody>{scope3Matrix(p, r.lines).map((x) => <tr key={x.cat}><td>{x.cat}. {x.name}</td><td><Badge status={x.status} /></td><td className="num">{x.lineCount ? num(x.kg / 1000) : '—'}</td><td>{x.justification}</td></tr>)}</tbody></table></div>
      </Card>
      <Card title="Largest emission sources">
        <div className="table-wrap" tabIndex={0} role="region" aria-label="Scrollable table"><table><thead><tr><th>Line</th><th>Scope</th><th className="num">tCO2e</th><th>Status</th><th>Factor</th></tr></thead>
          <tbody>{top.map((l) => <tr key={l.id}><td>{l.label}</td><td>{l.scope}{l.s3cat ? `.${l.s3cat}` : ''}</td><td className="num">{num(l.kg / 1000)}</td><td><Badge status={l.status} /></td><td><code>{l.factorId ?? 'input'}</code></td></tr>)}</tbody></table></div>
      </Card>
      <Card title="Assumptions, warnings and missing data">
        <ul>{r.warnings.map((w) => <li key={w.message}>[{w.level}] {w.module}: {w.message}</li>)}</ul>
        {r.missing.length > 0 && <p><strong>Missing:</strong> {r.missing.join('; ')}</p>}
        <p><strong>Double-counting suppressed:</strong> {r.suppressed.map((s) => s.label).join('; ') || 'none'}</p>
      </Card>
    </div>
  );
}
