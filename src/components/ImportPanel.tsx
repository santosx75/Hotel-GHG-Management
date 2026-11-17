import { useMemo, useState } from 'react';
import type { PropertyId, PropertyInputs } from '../types';
import { TARGETS, buildPatches, detectDelimiter, parseCSV, preview, type DateFormat, type ImportTarget, type Mapping } from '../lib/importer';
import { useStore } from '../state/store';
import { Badge, Notice } from './ui';

const SAMPLE: Record<ImportTarget, string> = {
  electricity: 'Month;Consumption;Unit\n2025-01;182,4;MWh\n2025-02;171,9;MWh\n',
  gas: 'Month,Energy,Unit\n2025-01,152000,kWh PCS\n',
  water: 'Month,Volume,Unit\n2025-01,1310,m3\n',
  laundry: 'Month,Mass,Unit\n2025-01,7.4,t\n',
  waste: 'Stream,Mass,Unit\nresidual,92.5,t\n',
  food: 'Category,Mass,Unit\nbeef,4200,kg\n',
  fleet_fuel: 'Fuel,Volume,Unit\ndiesel,2650,L\n',
  refrigerant: 'Equipment,Top-up,Unit\nchiller,9.5,kg\n',
  guest_origin: 'Origin,Share,Unit\nidf,6,%\n',
};

export function ImportPanel({ pid, inputs }: { pid: PropertyId; inputs: PropertyInputs }) {
  const applyPatches = useStore((s) => s.applyPatches);
  const [target, setTarget] = useState<ImportTarget>('electricity');
  const [text, setText] = useState('');
  const [hasHeader, setHasHeader] = useState(true);
  const [decimal, setDecimal] = useState<'.' | ','>(',');
  const [dateFormat, setDateFormat] = useState<DateFormat>('YYYY-MM');
  const [dateCol, setDateCol] = useState(0);
  const [valueCol, setValueCol] = useState(1);
  const [unitCol, setUnitCol] = useState<number | null>(2);
  const [fixedUnit, setFixedUnit] = useState('kWh');
  const [done, setDone] = useState<string | null>(null);
  const rows = useMemo(() => (text.trim() ? parseCSV(text, detectDelimiter(text)) : []), [text]);
  const cols = rows[0]?.length ?? 0;
  const t = TARGETS[target];
  const mapping: Mapping = { target, hasHeader, dateCol, dateFormat, keyCol: dateCol, valueCol, unitCol, fixedUnit, decimal, year: inputs.boundary.reportingYear };
  const pv = useMemo(() => (rows.length ? preview(rows, mapping, inputs) : []), [rows, target, hasHeader, dateCol, dateFormat, valueCol, unitCol, fixedUnit, decimal, inputs]); // eslint-disable-line
  const ok = pv.filter((r) => r.status === 'ok').length;
  const colOpts = Array.from({ length: cols }, (_, i) => ({ v: i, l: hasHeader ? `${i + 1}: ${rows[0][i]}` : `Column ${i + 1}` }));
  const onFile = (f: File | undefined) => { if (!f) return; const r = new FileReader(); r.onload = () => setText(String(r.result ?? '')); r.readAsText(f); };
  return (
    <div className="stack">
      <div className="fields">
        <div className="field"><label htmlFor="imp-target">Dataset</label><select id="imp-target" value={target} onChange={(e) => { setTarget(e.target.value as ImportTarget); setDone(null); }}>{Object.entries(TARGETS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></div>
        <div className="field"><label htmlFor="imp-file">CSV file</label><input id="imp-file" type="file" accept=".csv,text/csv,text/plain" onChange={(e) => onFile(e.target.files?.[0])} /></div>
        <div className="field"><label htmlFor="imp-dec">Decimal separator</label><select id="imp-dec" value={decimal} onChange={(e) => setDecimal(e.target.value as '.' | ',')}><option value=",">Comma (12,5)</option><option value=".">Point (12.5)</option></select></div>
        {t.monthly && <div className="field"><label htmlFor="imp-df">Date format</label><select id="imp-df" value={dateFormat} onChange={(e) => setDateFormat(e.target.value as DateFormat)}>{['YYYY-MM', 'MM/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD', 'month-name'].map((d) => <option key={d}>{d}</option>)}</select></div>}
        <label className="toggle"><input type="checkbox" checked={hasHeader} onChange={(e) => setHasHeader(e.target.checked)} /> First row is a header</label>
      </div>
      <div className="field"><label htmlFor="imp-text">…or paste CSV ({t.canonical} canonical; delimiter auto-detected)</label><textarea id="imp-text" rows={5} value={text} onChange={(e) => { setText(e.target.value); setDone(null); }} placeholder={SAMPLE[target]} /></div>
      <button className="btn small" onClick={() => setText(SAMPLE[target])}>Load example format</button>
      {cols > 0 && (
        <div className="fields">
          <div className="field"><label htmlFor="imp-dc">{t.monthly ? 'Date column' : `${t.keyLabel} column`}</label><select id="imp-dc" value={dateCol} onChange={(e) => setDateCol(Number(e.target.value))}>{colOpts.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}</select></div>
          <div className="field"><label htmlFor="imp-vc">Value column</label><select id="imp-vc" value={valueCol} onChange={(e) => setValueCol(Number(e.target.value))}>{colOpts.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}</select></div>
          <div className="field"><label htmlFor="imp-uc">Unit</label><select id="imp-uc" value={unitCol ?? -1} onChange={(e) => setUnitCol(Number(e.target.value) < 0 ? null : Number(e.target.value))}><option value={-1}>Fixed unit for all rows</option>{colOpts.map((o) => <option key={o.v} value={o.v}>From {o.l}</option>)}</select></div>
          {unitCol == null && <div className="field"><label htmlFor="imp-fu">Fixed unit</label><input id="imp-fu" type="text" value={fixedUnit} onChange={(e) => setFixedUnit(e.target.value)} /></div>}
        </div>
      )}
      {pv.length > 0 && (
        <>
          <div className="table-wrap" tabIndex={0} role="region" aria-label="Scrollable table" style={{ maxHeight: 260, overflowY: 'auto' }}>
            <table>
              <thead><tr><th>Line</th><th>Raw</th><th>Key / month</th><th className="num">Value ({t.canonical})</th><th>Status</th><th>Message</th></tr></thead>
              <tbody>{pv.map((r) => <tr key={r.line}><td>{r.line}</td><td>{r.raw.join(' | ')}</td><td>{r.month != null ? r.month + 1 : r.key}</td><td className="num">{r.value ?? '—'}</td><td><Badge status={r.status === 'ok' ? 'measured' : r.status === 'error' ? 'missing' : 'assumed'}>{r.status}</Badge></td><td>{r.message}</td></tr>)}</tbody>
            </table>
          </div>
          <div className="row">
            <button className="btn primary" disabled={!ok} onClick={() => { const patches = buildPatches(pv, mapping, inputs); applyPatches(pid, patches, `CSV import: ${t.label}, ${ok} rows`); setDone(`${ok} row(s) imported into the active scenario (${patches.map((p) => p.path).join(', ')}).`); }}>Import {ok} valid row(s) into active scenario</button>
            <span className="muted">{pv.length - ok} row(s) rejected, duplicated or ignored — see messages.</span>
          </div>
        </>
      )}
      {done && <Notice kind="info">{done} Measured mode is switched on for bill data; the import is logged in the audit trail. Use “Save as baseline” to make measured data the baseline.</Notice>}
      <p className="muted" style={{ fontSize: '.76rem' }}>Privacy by design: only aggregated data are accepted (e.g. guest-origin shares). Do not import personal guest information.</p>
    </div>
  );
}
