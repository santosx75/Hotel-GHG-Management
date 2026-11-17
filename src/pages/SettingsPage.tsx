import { useState } from 'react';
import { useStore } from '../state/store';
import { Card, Notice, PillGroup, download } from '../components/ui';
import { calculate } from '../engine';
import { parametersCSV, toCSV } from '../lib/export';
import { PROPERTY_IDS } from '../data/library';

export default function SettingsPage() {
  const store = useStore();
  const { settings, audit } = store.data;
  const [msg, setMsg] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const onImportAll = (f: File | undefined) => {
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const d = JSON.parse(String(r.result));
        if (!d.properties || !d.library || !d.settings) throw new Error('Not a full Hotel Carbon Lab data export.');
        for (const id of PROPERTY_IDS) if (!d.properties[id]) throw new Error(`Missing property ${id}.`);
        for (const ps of Object.values<any>(d.properties)) ps.history = {};
        store.replaceAll(d);
        setMsg('All data imported.');
      } catch (e) { setMsg(String(e)); }
    };
    r.readAsText(f);
  };
  const rows = audit.filter((a) => !filter || `${a.propertyId} ${a.path} ${a.scenario} ${a.kind}`.toLowerCase().includes(filter.toLowerCase()));
  return (
    <div className="stack">
      <h1>Settings & data</h1>
      <Card title="Methodological conventions (apply to all properties)">
        <div className="stack">
          <div className="field"><span className="flabel">GWP set (refrigerants, CH4)</span><PillGroup label="GWP set" value={settings.gwpSet} onChange={(v) => store.setSettings({ gwpSet: v })} options={[{ value: 'AR6', label: 'IPCC AR6 (default)' }, { value: 'AR5', label: 'IPCC AR5' }]} /></div>
          <div className="field"><span className="flabel">Aviation non-CO2 effects</span><PillGroup label="Aviation non-CO2" value={settings.aviationNonCO2} onChange={(v) => store.setSettings({ aviationNonCO2: v })} options={[{ value: 'separate', label: 'Disclose separately' }, { value: 'included', label: 'Include in visitor view' }, { value: 'excluded', label: 'Exclude' }]} />
            <span className="help">Never part of the GHG Protocol inventory. Default multiplier 1.83 derived from reported ADEME values (230 vs 126 g/pkm).</span></div>
          <div className="field" style={{ maxWidth: 260 }}><label htmlFor="mult">Non-CO2 multiplier</label><input id="mult" type="number" min={1} max={5} step={0.01} value={settings.aviationNonCO2Multiplier} onChange={(e) => { const v = Number(e.target.value); if (v >= 1 && v <= 5) store.setSettings({ aviationNonCO2Multiplier: v }); }} /></div>
          <div className="field"><span className="flabel">Primary Scope 2 method for headline totals</span><PillGroup label="Scope 2 method" value={settings.scope2Primary} onChange={(v) => store.setSettings({ scope2Primary: v })} options={[{ value: 'location', label: 'Location-based' }, { value: 'market', label: 'Market-based (if available)' }]} /></div>
          <div className="field" style={{ maxWidth: 260 }}><label htmlFor="stale">Price "stale" warning after (months)</label><input id="stale" type="number" min={1} max={60} value={settings.staleAfterMonths} onChange={(e) => store.setSettings({ staleAfterMonths: Math.max(1, Number(e.target.value) || 12) })} /></div>
          <div className="field"><span className="flabel">Default analytical view</span><PillGroup label="Default view" value={settings.analyticsView} onChange={(v) => store.setSettings({ analyticsView: v })} options={[{ value: 'corporate', label: 'Corporate' }, { value: 'hcmi', label: 'HCMI-aligned' }, { value: 'visitor', label: 'Visitor' }, { value: 'lca', label: 'Life-cycle' }]} /></div>
        </div>
      </Card>
      <Card title="Storage, export & import">
        <Notice kind="info">All data are stored only in this browser (localStorage). Nothing is sent to a server. Clearing site data deletes your work — export regularly.</Notice>
        <div className="row" style={{ marginTop: 10 }}>
          <button className="btn" onClick={() => download('hotel-carbon-lab-data.json', JSON.stringify(store.data, null, 2), 'application/json')}>Export all data (JSON)</button>
          {PROPERTY_IDS.map((id) => <button key={id} className="btn small" onClick={() => { const ps = store.data.properties[id]; const sc = ps.scenarios.find((s) => s.id === ps.activeScenarioId)!; download(`${id}-parameters.csv`, parametersCSV(sc.inputs), 'text/csv'); }}>Parameters CSV — {id}</button>)}
          <label className="btn">Import all data (JSON)<input type="file" accept=".json" className="sr-only" onChange={(e) => onImportAll(e.target.files?.[0])} /></label>
          <button className="btn danger" onClick={() => { if (confirm('Reset ALL properties, scenarios, library changes and audit trail to the demonstration defaults?')) store.resetAll(); }}>Reset to demonstration data</button>
        </div>
        {msg && <Notice kind="info">{msg}</Notice>}
        <p className="muted" style={{ fontSize: '.78rem', marginTop: 8 }}>Engine check: city hotel baseline currently computes {Math.round(calculate(store.data.properties['city-hotel'].baseline.inputs, settings, store.data.library).totals.corporateLB / 1000)} tCO2e (corporate, location-based).</p>
      </Card>
      <Card title={`Audit trail (${audit.length} entries)`} actions={<button className="btn small" onClick={() => download('audit-trail.csv', toCSV([['timestamp', 'property', 'scenario', 'kind', 'path', 'previous', 'next'], ...audit.map((a) => [a.ts, a.propertyId, a.scenario, a.kind, a.path, JSON.stringify(a.previous), JSON.stringify(a.next)])]), 'text/csv')}>Export CSV</button>}>
        <div className="field" style={{ maxWidth: 320 }}><label htmlFor="af">Filter</label><input id="af" type="text" value={filter} onChange={(e) => setFilter(e.target.value)} /></div>
        <div className="table-wrap" tabIndex={0} role="region" aria-label="Scrollable table" style={{ maxHeight: 420, overflowY: 'auto', marginTop: 8 }}>
          <table><thead><tr><th>When</th><th>Property</th><th>Scenario</th><th>Kind</th><th>Changed</th><th>Previous</th><th>New</th></tr></thead>
            <tbody>{rows.slice(0, 400).map((a, i) => <tr key={i}><td>{new Date(a.ts).toLocaleString('en-GB')}</td><td>{a.propertyId}</td><td>{a.scenario}</td><td>{a.kind}</td><td><code>{a.path}</code></td><td>{short(a.previous)}</td><td>{short(a.next)}</td></tr>)}</tbody></table>
        </div>
      </Card>
    </div>
  );
}
const short = (v: unknown) => { const s = typeof v === 'string' ? v : JSON.stringify(v); return s == null ? '—' : s.length > 60 ? `${s.slice(0, 60)}…` : s; };
