import { useMemo, useState } from 'react';
import { useStore } from '../state/store';
import { Badge, Card, Notice, Tabs, download } from '../components/ui';
import { REGISTRY } from '../data/registry';
import { RESEARCH_DATE } from '../data/sources';
import { calculate } from '../engine';
import { deepClone } from '../engine/util';
import { PROPERTY_IDS } from '../data/library';
import { factorsCSV, toCSV } from '../lib/export';
import { num, signed, tco2e } from '../lib/format';
import { parseCSV } from '../lib/importer';
import { UNRESOLVED } from './MethodologyPage';

type T = 'factors' | 'prices' | 'sources' | 'climate' | 'gwp' | 'registry' | 'unresolved' | 'log';

export default function DataLibraryPage() {
  const [tab, setTab] = useState<T>('factors');
  return (
    <div className="stack">
      <h1>Data library</h1>
      <Notice kind="warn">Research date {RESEARCH_DATE}. No source in this app is live: nothing is fetched automatically, and calculations use only the locally loaded library. Many values are labelled <Badge status="demonstration" /> or <Badge status="secondary_report" /> (seen in search results, primary document not opened). Replace them before any reporting use.</Notice>
      <Tabs label="Library sections" value={tab} onChange={setTab} tabs={[{ id: 'factors', label: 'Emission factors' }, { id: 'prices', label: 'Prices' }, { id: 'sources', label: 'Source register' }, { id: 'climate', label: 'Climate profiles' }, { id: 'gwp', label: 'GWP values' }, { id: 'registry', label: 'Parameter registry' }, { id: 'unresolved', label: 'Unresolved data' }, { id: 'log', label: 'Change log' }]} />
      {tab === 'factors' && <Factors />}
      {tab === 'prices' && <Prices />}
      {tab === 'sources' && <Sources />}
      {tab === 'climate' && <Climate />}
      {tab === 'gwp' && <Gwp />}
      {tab === 'registry' && <Registry />}
      {tab === 'unresolved' && <Unresolved />}
      {tab === 'log' && <Log />}
    </div>
  );
}

function Factors() {
  const store = useStore();
  const { library, settings, properties, pinnedFactorVersions } = store.data;
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState<{ id: string; value: string; note: string } | null>(null);
  const [csvMsg, setCsvMsg] = useState<string | null>(null);
  const list = Object.values(library.factors).filter((f) => !q || `${f.id} ${f.name}`.toLowerCase().includes(q.toLowerCase()));
  const preview = useMemo(() => {
    if (!edit) return null;
    const v = Number(edit.value);
    if (!Number.isFinite(v) || v < 0) return null;
    const lib2 = deepClone(library);
    lib2.factors[edit.id].value = v;
    return PROPERTY_IDS.map((pid) => {
      const a = calculate(properties[pid].baseline.inputs, settings, library).totals.corporateLB;
      const b = calculate(properties[pid].baseline.inputs, settings, lib2).totals.corporateLB;
      return { pid, name: properties[pid].baseline.inputs.profile.name, a, b };
    });
  }, [edit, library, settings, properties]);
  const onCsv = (f: File | undefined) => {
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      const rows = parseCSV(String(r.result));
      const [h, ...data] = rows;
      const iid = h.indexOf('factor_id'), iv = h.indexOf('value'), iu = h.indexOf('unit');
      if (iid < 0 || iv < 0 || iu < 0) { setCsvMsg('CSV must have columns factor_id, value, unit (adapter format).'); return; }
      let ok = 0; const errs: string[] = [];
      for (const row of data) {
        const f2 = library.factors[row[iid]];
        const v = Number(row[iv]);
        if (!f2) { errs.push(`${row[iid]}: unknown factor id`); continue; }
        if (row[iu] !== f2.unit) { errs.push(`${row[iid]}: unit "${row[iu]}" ≠ "${f2.unit}" — rejected`); continue; }
        if (!Number.isFinite(v) || v < 0) { errs.push(`${row[iid]}: invalid value`); continue; }
        if (pinnedFactorVersions[f2.id]) { errs.push(`${row[iid]}: pinned — not changed`); continue; }
        store.setFactor(f2.id, v, `CSV import (${f.name})`); ok++;
      }
      setCsvMsg(`${ok} factor(s) updated as new versions. ${errs.length ? `Rejected: ${errs.join('; ')}` : ''}`);
    };
    r.readAsText(f);
  };
  return (
    <>
      <Card title="Emission factor library" actions={<><button className="btn small" onClick={() => download('emission-factors.csv', factorsCSV(library), 'text/csv')}>Export CSV</button><label className="btn small">Import CSV (adapter)<input type="file" accept=".csv" className="sr-only" onChange={(e) => onCsv(e.target.files?.[0])} /></label></>}>
        <p className="muted" style={{ fontSize: '.8rem' }}>Adapter format for authorised datasets (e.g. your own Base Empreinte or AGRIBALYSE extract): <code>factor_id,value,unit</code>. Units must match exactly; each import creates a new version and is logged. This app does not bundle licensed database exports.</p>
        {csvMsg && <Notice kind="info">{csvMsg}</Notice>}
        <div className="field" style={{ maxWidth: 320 }}><label htmlFor="fq">Search factors</label><input id="fq" type="text" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div className="table-wrap" tabIndex={0} role="region" aria-label="Scrollable table" style={{ maxHeight: 520, overflowY: 'auto', marginTop: 8 }}>
          <table>
            <thead><tr><th>ID</th><th>Name</th><th className="num">Value</th><th>Unit</th><th>Stages</th><th>Geography</th><th>Verification</th><th>Source</th><th>Version</th><th>Actions</th></tr></thead>
            <tbody>{list.map((f) => (
              <tr key={f.id}><td><code>{f.id}</code></td><td>{f.name}{f.notes && <div className="muted" style={{ fontSize: '.74rem' }}>{f.notes}</div>}</td><td className="num">{num(f.value, 4)}{f.low != null && <div className="muted" style={{ fontSize: '.72rem' }}>range {num(f.low, 3)}–{num(f.high, 3)}</div>}</td><td>{f.unit}</td><td style={{ fontSize: '.75rem' }}>{f.stages.join(', ')}</td><td>{f.geography.join(', ')}</td>
                <td><Badge status={f.verification} /></td><td style={{ fontSize: '.78rem' }}>{library.sources[f.sourceId]?.title ?? f.sourceId}</td><td style={{ fontSize: '.75rem' }}>{f.version}{pinnedFactorVersions[f.id] && <div><Badge status="measured">pinned</Badge></div>}</td>
                <td className="row"><button className="btn small" disabled={!!pinnedFactorVersions[f.id]} onClick={() => setEdit({ id: f.id, value: String(f.value), note: '' })}>Edit</button><button className="btn small" onClick={() => store.togglePin(f.id)}>{pinnedFactorVersions[f.id] ? 'Unpin' : 'Pin version'}</button></td></tr>
            ))}</tbody>
          </table>
        </div>
      </Card>
      {edit && (
        <Card title={`New version of ${edit.id}`}>
          <div className="fields">
            <div className="field"><label htmlFor="fv">New value ({library.factors[edit.id].unit})</label><input id="fv" type="number" step="any" min={0} value={edit.value} onChange={(e) => setEdit({ ...edit, value: e.target.value })} /></div>
            <div className="field"><label htmlFor="fn">Source / justification (required)</label><input id="fn" type="text" value={edit.note} onChange={(e) => setEdit({ ...edit, note: e.target.value })} /></div>
          </div>
          <h3>Impact preview on saved baselines (before applying)</h3>
          {preview ? <ul>{preview.map((p) => <li key={p.pid}>{p.name}: {tco2e(p.a)} → {tco2e(p.b)} ({signed(p.b - p.a, tco2e)})</li>)}</ul> : <p className="muted">Enter a valid non-negative number.</p>}
          <div className="row"><button className="btn primary" disabled={!preview || !edit.note.trim()} onClick={() => { store.setFactor(edit.id, Number(edit.value), edit.note); setEdit(null); }}>Apply as new version</button><button className="btn" onClick={() => setEdit(null)}>Cancel</button></div>
          <p className="muted" style={{ fontSize: '.78rem' }}>Changing a physical factor never changes activity data (kWh, m³, kg) or prices.</p>
        </Card>
      )}
    </>
  );
}

function Prices() {
  const store = useStore();
  const { library, settings } = store.data;
  const [edit, setEdit] = useState<{ id: string; value: string; note: string } | null>(null);
  const now = new Date();
  const stale = (d: string) => { const t = new Date(d); return (now.getTime() - t.getTime()) / (30.4 * 864e5) > settings.staleAfterMonths; };
  return (
    <Card title="Price library (EUR excl. VAT)">
      <p className="muted" style={{ fontSize: '.8rem' }}>Price records are references. Property contracts are entered on each property's Energy & water supply tab and are never overwritten by library updates. No price is refreshed automatically.</p>
      <div className="table-wrap" tabIndex={0} role="region" aria-label="Scrollable table" style={{ maxHeight: 520, overflowY: 'auto' }}>
        <table>
          <thead><tr><th>Record</th><th className="num">Value</th><th>Unit</th><th>VAT</th><th>Customer category</th><th>Kind</th><th>Effective</th><th>Last verified</th><th>Applicability</th><th></th></tr></thead>
          <tbody>{Object.values(library.prices).map((p) => (
            <tr key={p.id}><td>{p.name}<div className="muted" style={{ fontSize: '.72rem' }}>{library.sources[p.sourceId]?.title}</div></td><td className="num">{num(p.value, 4)}</td><td>{p.unit}</td><td>{(p.vatRate * 100).toFixed(1)} %</td><td style={{ fontSize: '.78rem' }}>{p.customerCategory}</td><td><Badge status={p.kind} /></td><td>{p.effectiveDate ?? '—'}</td>
              <td>{p.lastVerified} {stale(p.lastVerified) && <Badge status="missing">stale</Badge>}</td><td style={{ fontSize: '.76rem' }}>{p.applicabilityWarning ?? '—'}</td><td><button className="btn small" onClick={() => setEdit({ id: p.id, value: String(p.value), note: '' })}>Edit</button></td></tr>
          ))}</tbody>
        </table>
      </div>
      {edit && (
        <div className="stack" style={{ marginTop: 10 }}>
          <div className="fields">
            <div className="field"><label htmlFor="pv">New value ({library.prices[edit.id].unit})</label><input id="pv" type="number" step="any" min={0} value={edit.value} onChange={(e) => setEdit({ ...edit, value: e.target.value })} /></div>
            <div className="field"><label htmlFor="pn">Source (quote, contract, tariff sheet)</label><input id="pn" type="text" value={edit.note} onChange={(e) => setEdit({ ...edit, note: e.target.value })} /></div>
          </div>
          <div className="row"><button className="btn primary" disabled={!edit.note.trim() || !(Number(edit.value) >= 0)} onClick={() => { store.setPrice(edit.id, Number(edit.value), edit.note); setEdit(null); }}>Save as user contract price</button><button className="btn" onClick={() => setEdit(null)}>Cancel</button></div>
        </div>
      )}
    </Card>
  );
}

function Sources() {
  const lib = useStore((s) => s.data.library);
  return (
    <Card title="Source register" actions={<button className="btn small" onClick={() => download('sources.csv', toCSV([['id', 'title', 'publisher', 'url', 'researched_on', 'publication', 'observation', 'effective', 'version', 'geography', 'customer', 'units', 'tax', 'boundary', 'licence', 'status', 'limitations', 'access_note'], ...Object.values(lib.sources).map((s) => [s.id, s.title, s.publisher, s.url ?? '', s.researchedOn, s.publicationDate ?? '', s.observationYear ?? '', s.effectiveDate ?? '', s.version ?? '', s.geography, s.customerCategory ?? '', s.units ?? '', s.taxTreatment ?? '', s.boundary ?? '', s.licence, s.status, s.limitations, s.accessNote])]), 'text/csv')}>Export CSV</button>}>
      <div className="stack">{Object.values(lib.sources).map((s) => (
        <details key={s.id} className="section"><summary><span style={{ flex: 1 }}>{s.title}</span><Badge status={s.status} /></summary>
          <div className="body"><dl className="kv">
            <dt>Publisher</dt><dd>{s.publisher}</dd>{s.url && <><dt>URL</dt><dd><a href={s.url} target="_blank" rel="noreferrer">{s.url}</a></dd></>}
            <dt>Researched on</dt><dd>{s.researchedOn}</dd>{s.publicationDate && <><dt>Publication</dt><dd>{s.publicationDate}</dd></>}{s.observationYear && <><dt>Observation year</dt><dd>{s.observationYear}</dd></>}
            {s.effectiveDate && <><dt>Effective</dt><dd>{s.effectiveDate}</dd></>}{s.version && <><dt>Version</dt><dd>{s.version}</dd></>}<dt>Geography</dt><dd>{s.geography}</dd>
            {s.customerCategory && <><dt>Customer category</dt><dd>{s.customerCategory}</dd></>}{s.units && <><dt>Units</dt><dd>{s.units}</dd></>}{s.taxTreatment && <><dt>Tax treatment</dt><dd>{s.taxTreatment}</dd></>}
            {s.boundary && <><dt>Boundary</dt><dd>{s.boundary}</dd></>}<dt>Licence / reuse</dt><dd>{s.licence}</dd><dt>Limitations</dt><dd>{s.limitations}</dd><dt>Access note</dt><dd>{s.accessNote}</dd>
          </dl></div></details>
      ))}</div>
    </Card>
  );
}

function Climate() {
  const lib = useStore((s) => s.data.library);
  return (
    <Card title="Climate profiles (demonstration approximations)">
      {Object.values(lib.climates).map((c) => (
        <div key={c.id} style={{ marginBottom: 12 }}><h3>{c.name} <Badge status={c.verification} /></h3>
          <div className="table-wrap" tabIndex={0} role="region" aria-label="Scrollable table"><table><thead><tr><th>Series</th>{['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'].map((m, i) => <th key={i} className="num">{m}</th>)}</tr></thead>
            <tbody>{([['Mean temp °C', c.meanTempC], ['Daily SD °C', c.dailyTempSdC], ['Cold water °C', c.coldWaterC], ['Solar on glazing W/m²', c.solarGainWPerM2Glazing], ['PV kWh/kWp', c.pvYieldKWhPerKWp], ['Rain mm', c.rainfallMm], ['ET0 mm', c.et0Mm], ['Pool evap L/m²/d', c.outdoorPoolEvapLPerM2Day]] as const).map(([l, a]) => <tr key={l}><th scope="row">{l}</th>{a.map((v, i) => <td key={i} className="num">{v}</td>)}</tr>)}</tbody></table></div></div>
      ))}
    </Card>
  );
}

function Gwp() {
  const { library, settings } = useStore((s) => s.data);
  return (
    <Card title={`GWP-100 values (active set: ${settings.gwpSet})`}>
      <div className="table-wrap" tabIndex={0} role="region" aria-label="Scrollable table"><table><thead><tr><th>Gas</th><th className="num">AR5</th><th className="num">AR6</th><th>Verification</th></tr></thead>
        <tbody>{Object.values(library.gwp).map((g) => <tr key={g.gas}><td>{g.gas}</td><td className="num">{g.AR5}</td><td className="num">{g.AR6}</td><td><Badge status={g.verification} /></td></tr>)}</tbody></table></div>
      <p className="muted" style={{ fontSize: '.78rem' }}>Blends (e.g. R-407C) derived from component GWPs by mass fraction. Regulatory (EU F-gas) reference values may differ from IPCC values.</p>
    </Card>
  );
}

function Registry() {
  const [q, setQ] = useState('');
  const rows = REGISTRY.filter((r) => !q || `${r.id} ${r.name} ${r.category}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <Card title={`Parameter registry (${REGISTRY.length} registered inputs)`} actions={<button className="btn small" onClick={() => download('parameter-registry.csv', toCSV([['id', 'name', 'category', 'subcategory', 'definition', 'unit', 'type', 'min', 'max', 'step', 'applies_to', 'source', 'seed_origin', 'confidence', 'editable', 'model_link', 'scope_mapping', 'role'], ...REGISTRY.map((r) => [r.id, r.name, r.category, r.subcategory, r.definition, r.unit, r.type, r.min ?? '', r.max ?? '', r.step ?? '', Array.isArray(r.appliesTo) ? r.appliesTo.join('|') : r.appliesTo, r.sourceId, r.defaultOrigin, r.confidence, r.editable, r.modelLink, r.scopeMapping, r.role])]), 'text/csv')}>Export CSV</button>}>
      <p className="muted" style={{ fontSize: '.8rem' }}>Registered inputs carry validation ranges and metadata. Other inputs (e.g. table columns) are documented in the Methodology page. Defaults come from each property's seed (fictional demonstration assumptions).</p>
      <div className="field" style={{ maxWidth: 320 }}><label htmlFor="rq">Search</label><input id="rq" type="text" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <div className="table-wrap" tabIndex={0} role="region" aria-label="Scrollable table" style={{ maxHeight: 520, overflowY: 'auto', marginTop: 8 }}>
        <table><thead><tr><th>ID</th><th>Name</th><th>Category</th><th>Unit</th><th>Type</th><th>Range</th><th>Seed origin</th><th>Source</th></tr></thead>
          <tbody>{rows.map((r) => <tr key={r.id}><td><code>{r.id}</code></td><td>{r.name}</td><td>{r.category} · {r.subcategory}</td><td>{r.unit}</td><td>{r.type}</td><td>{r.min ?? '—'} – {r.max ?? '—'}</td><td><Badge status={r.defaultOrigin} /></td><td>{r.sourceId}</td></tr>)}</tbody></table>
      </div>
    </Card>
  );
}

function Unresolved() {
  return (
    <Card title="Unresolved-data register">
      <div className="table-wrap" tabIndex={0} role="region" aria-label="Scrollable table"><table><thead><tr><th>Item</th><th>Why unresolved</th><th>Current treatment</th><th>How to resolve</th></tr></thead>
        <tbody>{UNRESOLVED.map((u) => <tr key={u[0]}><td>{u[0]}</td><td>{u[1]}</td><td>{u[2]}</td><td>{u[3]}</td></tr>)}</tbody></table></div>
    </Card>
  );
}

function Log() {
  const { factorChangeLog, audit } = useStore((s) => s.data);
  const lib = audit.filter((a) => a.kind === 'factor' || a.kind === 'price');
  return (
    <Card title="Factor & price change log">
      {factorChangeLog.length === 0 && lib.length === 0 ? <p className="muted">No library changes yet.</p> : (
        <div className="table-wrap" tabIndex={0} role="region" aria-label="Scrollable table"><table><thead><tr><th>When</th><th>Item</th><th className="num">Previous</th><th className="num">New</th><th>Versions / note</th></tr></thead>
          <tbody>{factorChangeLog.map((c, i) => <tr key={`f${i}`}><td>{new Date(c.ts).toLocaleString('en-GB')}</td><td>{c.factorId}</td><td className="num">{c.previous}</td><td className="num">{c.next}</td><td>{c.previousVersion} → {c.nextVersion}: {c.note}</td></tr>)}
            {lib.filter((a) => a.kind === 'price').map((a, i) => <tr key={`p${i}`}><td>{new Date(a.ts).toLocaleString('en-GB')}</td><td>{a.path}</td><td className="num">{String(a.previous)}</td><td className="num">{String(a.next)}</td><td>price</td></tr>)}</tbody></table></div>
      )}
    </Card>
  );
}
