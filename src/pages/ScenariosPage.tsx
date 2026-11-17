import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { PropertyId } from '../types';
import { useStore } from '../state/store';
import { Badge, Card, Notice, download } from '../components/ui';
import { PRESETS } from '../scenarios/presets';
import { calculate, calibrationFrom } from '../engine';
import { reproducibleExport, resultsCSV } from '../lib/export';
import { PROPERTY_IDS } from '../data/library';
import { tco2e } from '../lib/format';

export default function ScenariosPage() {
  const store = useStore();
  const data = store.data;
  const [msg, setMsg] = useState<{ kind: 'info' | 'error'; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [importPid, setImportPid] = useState<PropertyId>('city-hotel');
  const onImport = (f: File | undefined) => {
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const j = JSON.parse(String(r.result));
        if (j.format !== 'hotel-carbon-lab/scenario@1' || !j.scenario?.inputs) throw new Error('Not a Hotel Carbon Lab scenario export (format hotel-carbon-lab/scenario@1).');
        if (j.propertyId !== importPid) throw new Error(`This file is for "${j.propertyId}", not "${importPid}". Inputs are not moved between properties.`);
        store.importScenario(importPid, j.scenario);
        setMsg({ kind: 'info', text: `Imported "${j.scenario.name}" (model ${j.modelVersion}). Factor versions in the file may differ from the current library; results are recalculated with the current library.` });
      } catch (e) { setMsg({ kind: 'error', text: String(e) }); }
    };
    r.readAsText(f);
  };
  return (
    <div className="stack">
      <h1>Scenarios & decisions</h1>
      <Notice kind="info">Each property has an independent saved baseline and its own scenarios. Edit a scenario on its property page; it never alters the baseline or another property. Scenario packages are always recalculated as integrated systems.</Notice>
      {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
      {PROPERTY_IDS.map((pid) => {
        const ps = data.properties[pid];
        const base = calculate(ps.baseline.inputs, data.settings, data.library);
        const cal = calibrationFrom(base);
        return (
          <Card key={pid} title={ps.baseline.inputs.profile.name} actions={<><Link className="btn small" to={`/${pid}`}>Open simulator</Link><button className="btn small" onClick={() => { const n = prompt('New scenario name', 'New scenario'); if (n) store.newScenario(pid, n, 'baseline'); }}>+ New from baseline</button></>}>
            <p className="muted" style={{ fontSize: '.8rem' }}>Baseline “{ps.baseline.label}” — {tco2e(base.totals.corporateLB)} corporate (location-based).</p>
            <div className="table-wrap" tabIndex={0} role="region" aria-label="Scrollable table">
              <table className="edit-table">
                <thead><tr><th>Name</th><th>Notes</th><th>Implementation year</th><th>Presets applied</th><th className="num">Corporate</th><th>State</th><th>Actions</th></tr></thead>
                <tbody>{ps.scenarios.map((s) => {
                  const r = calculate(s.inputs, data.settings, data.library, cal);
                  return (
                    <tr key={s.id}>
                      <td><input type="text" aria-label="Scenario name" value={s.name} onChange={(e) => store.updateMeta(pid, s.id, { name: e.target.value })} /></td>
                      <td><input type="text" aria-label={`Notes for ${s.name}`} value={s.notes} onChange={(e) => store.updateMeta(pid, s.id, { notes: e.target.value })} placeholder="Add notes" /></td>
                      <td><input type="number" aria-label={`Implementation year for ${s.name}`} value={s.implementationYear} min={2020} max={2060} onChange={(e) => store.updateMeta(pid, s.id, { implementationYear: Number(e.target.value) })} /></td>
                      <td style={{ fontSize: '.78rem' }}>{s.appliedPresets.join(', ') || '—'}</td>
                      <td className="num">{tco2e(r.totals.corporateLB)}<div className={r.totals.corporateLB < base.totals.corporateLB ? 'delta-down' : 'delta-up'} style={{ fontSize: '.74rem' }}>{tco2e(r.totals.corporateLB - base.totals.corporateLB)}</div></td>
                      <td>{s.locked ? <Badge status="measured">locked</Badge> : <Badge status="modelled">editable</Badge>}{ps.activeScenarioId === s.id && <> <Badge status="disaggregated">active</Badge></>}</td>
                      <td className="row">
                        <button className="btn small" onClick={() => store.selectScenario(pid, s.id)}>Make active</button>
                        <button className="btn small" onClick={() => store.newScenario(pid, `${s.name} (copy)`, s.id)}>Duplicate</button>
                        <button className="btn small" onClick={() => store.updateMeta(pid, s.id, { locked: !s.locked })}>{s.locked ? 'Unlock' : 'Lock'}</button>
                        <button className="btn small" onClick={() => download(`${pid}-${s.name.replace(/\W+/g, '_')}.json`, JSON.stringify(reproducibleExport(pid, s, ps.baseline.inputs, r, data.library, data.settings), null, 2), 'application/json')}>Export JSON</button>
                        <button className="btn small" onClick={() => download(`${pid}-${s.name.replace(/\W+/g, '_')}-results.csv`, resultsCSV(r, s.name), 'text/csv')}>Results CSV</button>
                        <button className="btn small danger" disabled={ps.scenarios.length <= 1} onClick={() => { if (confirm(`Delete scenario "${s.name}"?`)) store.removeScenario(pid, s.id); }}>Delete</button>
                      </td>
                    </tr>
                  );
                })}</tbody>
              </table>
            </div>
          </Card>
        );
      })}
      <Card title="Import a scenario (JSON)">
        <div className="fields">
          <div className="field"><label htmlFor="imp-pid">Into property</label><select id="imp-pid" value={importPid} onChange={(e) => setImportPid(e.target.value as PropertyId)}>{PROPERTY_IDS.map((id) => <option key={id} value={id}>{data.properties[id].baseline.inputs.profile.name}</option>)}</select></div>
          <div className="field"><label htmlFor="imp-json">Scenario file</label><input id="imp-json" ref={fileRef} type="file" accept="application/json,.json" onChange={(e) => onImport(e.target.files?.[0])} /></div>
        </div>
      </Card>
      <Card title="Intervention library">
        <div className="table-wrap" tabIndex={0} role="region" aria-label="Scrollable table"><table><thead><tr><th>Intervention</th><th>What it changes</th><th>Mechanisms propagated</th></tr></thead>
          <tbody>{PRESETS.map((p) => <tr key={p.id}><td><strong>{p.label}</strong></td><td>{p.description}</td><td style={{ fontSize: '.8rem' }}>{p.mechanisms.join(' · ')}</td></tr>)}</tbody></table></div>
        <p className="muted" style={{ fontSize: '.78rem' }}>Preset parameters (e.g. 25 % control savings, 7.5 L/min heads, heat-pump COP) are editable demonstration assumptions, not universal savings claims. Apply presets from a property's Finance & decisions tab; outcomes are computed by the model for that property.</p>
      </Card>
    </div>
  );
}
