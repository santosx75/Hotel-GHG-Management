import { useMemo, useState } from 'react';
import type { PropertyResults } from '../../state/useResults';
import { Badge, Card, Notice } from '../../components/ui';
import { EditTable, NumField, Section, SelectField, Toggle, useProp } from '../../components/fields';
import { BarList, ChartFrame, GroupedBars, Lines, PALETTE } from '../../components/charts';
import { compareLightingStrategies, replacementsPerYear, zoneBurnHours, zoneElectricityMonthly } from '../../engine/lighting';
import { textileMass } from '../../engine/laundry';
import { amenityBreakEven } from '../../engine/housekeeping';
import { sum } from '../../engine/util';
import { calculate } from '../../engine';
import { eur, kgco2e, num, tco2e } from '../../lib/format';
import { useStore } from '../../state/store';
import { PRESET_MAP } from '../../scenarios/presets';
import { deepClone } from '../../engine/util';

const TECH = [{ value: 'incandescent', label: 'Incandescent' }, { value: 'halogen', label: 'Halogen' }, { value: 'cfl', label: 'CFL' }, { value: 'fluorescent_t8', label: 'Fluorescent T8' }, { value: 'led', label: 'LED' }];

export function LightingTab({ res, adv }: { res: PropertyResults; adv: boolean }) {
  const { inputs } = useProp();
  const lib = useStore((s) => s.data.library);
  const act = res.scenario.activity;
  const [zid, setZid] = useState(inputs.lighting.find((z) => z.tech !== 'led')?.id ?? inputs.lighting[0]?.id);
  const zone = inputs.lighting.find((z) => z.id === zid);
  const [newW, setNewW] = useState(5);
  const [newLm, setNewLm] = useState(400);
  const [newPrice, setNewPrice] = useState(6.5);
  const [newLife, setNewLife] = useState(25000);
  const e = inputs.electricity;
  const unitPrice = (1 - e.offPeakShare) * e.priceEnergyHP + e.offPeakShare * e.priceEnergyHC + e.networkVariablePerKWh + e.excisePerKWh;
  const gridF = lib.factors.elec_fr_generation.value + lib.factors.elec_fr_upstream.value;
  const cmp = useMemo(() => zone ? compareLightingStrategies(zone, { wattsPerLamp: newW, ratedLifeHours: newLife, lampPriceEUR: newPrice, labourPerLampEUR: zone.labourPerLampEUR, embodiedKgPerLamp: 0.4, lumensPerLamp: newLm, driverWPerLuminaire: 0 }, act, unitPrice, gridF, inputs.finance.horizonYears) : null, [zone, newW, newLm, newPrice, newLife, act, unitPrice, gridF, inputs.finance.horizonYears]);
  const zoneRows = inputs.lighting.map((z) => {
    const burn = zoneBurnHours(z, act);
    return { z, kwh: sum(zoneElectricityMonthly(z, act)), repl: replacementsPerYear(z, burn), burn };
  });
  return (
    <div className="stack">
      <Card title="Lighting zones">
        <EditTable path="lighting" caption="Lighting zones" columns={[
          { key: 'name', label: 'Zone', type: 'text', width: 150 }, { key: 'luminaires', label: 'Luminaires' }, { key: 'lampsPerLuminaire', label: 'Lamps/lum.' }, { key: 'wattsPerLamp', label: 'W/lamp', step: 0.5 },
          { key: 'tech', label: 'Technology', type: 'select', options: TECH }, { key: 'hoursPerDay', label: 'h/day', step: 0.5, max: 24 }, { key: 'basis', label: 'Days', type: 'select', options: [{ value: 'open_days', label: 'Open days' }, { value: 'all_days', label: 'All days' }] },
          { key: 'occupancyLinked', label: 'Occupancy-linked', type: 'bool' }, { key: 'controlSaving', label: 'Controls saving %', type: 'percent' },
          { key: 'policy', label: 'Replacement', type: 'select', options: [{ value: 'on_failure', label: 'On failure' }, { value: 'group', label: 'Group' }] },
          ...(adv ? [
            { key: 'groupIntervalHours', label: 'Group interval h' }, { key: 'ratedLifeHours', label: 'Rated life h (B50)' }, { key: 'weibullShape', label: 'Failure shape k', step: 0.1 }, { key: 'calendarLifeYears', label: 'Calendar life yr' },
            { key: 'driverWPerLuminaire', label: 'Driver W', step: 0.5 }, { key: 'standbyWPerLuminaire', label: 'Standby W', step: 0.1 }, { key: 'lumensPerLamp', label: 'Lumens/lamp' },
            { key: 'lampPriceEUR', label: 'Lamp €', step: 0.1 }, { key: 'labourPerLampEUR', label: 'Labour €/lamp', step: 0.1 }, { key: 'embodiedKgPerLamp', label: 'kgCO2e/lamp', step: 0.01 }, { key: 'inConditionedSpace', label: 'In heated space', type: 'bool' },
          ] as any : []),
        ]} newRow={() => ({ id: `z-${Date.now()}`, name: 'New zone', luminaires: 10, lampsPerLuminaire: 1, wattsPerLamp: 10, driverWPerLuminaire: 0, standbyWPerLuminaire: 0, hoursPerDay: 8, basis: 'open_days', occupancyLinked: false, controlSaving: 0, tech: 'led', lumensPerLamp: 800, ratedLifeHours: 25000, weibullShape: 3, calendarLifeYears: 15, policy: 'on_failure', groupIntervalHours: 15000, lampPriceEUR: 8, labourPerLampEUR: 3, embodiedKgPerLamp: 0.3, inConditionedSpace: true })} />
        <div className="table-wrap" tabIndex={0} role="region" aria-label="Scrollable table" style={{ marginTop: 10 }}>
          <table>
            <thead><tr><th>Zone</th><th className="num">Electricity kWh/yr</th><th className="num">Burn h/lamp/yr</th><th className="num">Lamp replacements/yr (long-run)</th></tr></thead>
            <tbody>{zoneRows.map((r) => <tr key={r.z.id}><td>{r.z.name}</td><td className="num">{num(r.kwh)}</td><td className="num">{num(r.burn)}</td><td className="num">{num(r.repl)}</td></tr>)}</tbody>
          </table>
        </div>
        <p className="muted" style={{ fontSize: '.78rem' }}>Electricity = luminaires × (lamps × W + driver) × hours × days × (1 − controls) ÷ 1000 (+ standby). Replacement rates use a Weibull failure model with median = rated life; group replacement adds spot failures before the interval, so a longer interval does not save lamps that fail first. Lighting heat gains feed the building model.</p>
      </Card>
      {zone && cmp && (
        <Card title="Keep, replace now, or replace at end of life?">
          <div className="fields">
            <div className="field"><label htmlFor="zsel">Zone</label><select id="zsel" value={zid} onChange={(e) => setZid(e.target.value)}>{inputs.lighting.map((z) => <option key={z.id} value={z.id}>{z.name} ({z.tech}, {z.wattsPerLamp} W)</option>)}</select></div>
            <div className="field"><label htmlFor="nw">New lamp power (W)</label><input id="nw" type="number" value={newW} min={1} onChange={(e) => setNewW(Math.max(1, Number(e.target.value) || 1))} /></div>
            <div className="field"><label htmlFor="nlm">New lamp output (lm)</label><input id="nlm" type="number" value={newLm} min={1} onChange={(e) => setNewLm(Math.max(1, Number(e.target.value) || 1))} /></div>
            <div className="field"><label htmlFor="np">New lamp price (€)</label><input id="np" type="number" value={newPrice} min={0} step={0.1} onChange={(e) => setNewPrice(Math.max(0, Number(e.target.value) || 0))} /></div>
            <div className="field"><label htmlFor="nl">New lamp rated life (h)</label><input id="nl" type="number" value={newLife} min={100} onChange={(e) => setNewLife(Math.max(100, Number(e.target.value) || 100))} /></div>
          </div>
          {cmp.serviceWarning && <Notice kind="warn">{cmp.serviceWarning}</Notice>}
          <p style={{ fontSize: '.86rem' }}>Annual electricity: {num(cmp.kwhOld)} → {num(cmp.kwhNew)} kWh. Simple payback (replace now): <strong>{cmp.simplePaybackYears == null ? 'no payback (savings ≤ 0)' : `${num(cmp.simplePaybackYears, 2)} years`}</strong>. Carbon break-even (lamp manufacturing vs operational saving): <strong>{cmp.carbonBreakEvenYears == null ? 'not reached' : `${num(cmp.carbonBreakEvenYears * 12, 2)} months`}</strong>. Prices: {eur(unitPrice * 1000)}/MWh all-in from contract; electricity life-cycle factor {num(gridF, 3)} kg/kWh.</p>
          <div className="grid grid-2">
            <ChartFrame title="Cumulative cost" description="EUR (real), lamps + electricity, by strategy." table={{ headers: ['Year', ...cmp.results.map((r) => r.label)], rows: cmp.results[0].cumulativeCostEUR.map((_, i) => [i + 1, ...cmp.results.map((r) => r.cumulativeCostEUR[i])]) }}>
              <Lines yLabel="EUR" data={cmp.results[0].cumulativeCostEUR.map((_, i) => ({ year: i + 1, ...Object.fromEntries(cmp.results.map((r) => [r.strategy, r.cumulativeCostEUR[i]])) }))} keys={[{ key: 'keep', label: 'Keep', color: PALETTE.base }, { key: 'replace_now', label: 'Replace now', color: PALETTE.scen }, { key: 'replace_at_failure', label: 'At failure', color: PALETTE.s3, dashed: true }]} />
            </ChartFrame>
            <ChartFrame title="Cumulative emissions" description="kgCO2e incl. lamp manufacturing (life-cycle electricity factor)." table={{ headers: ['Year', ...cmp.results.map((r) => r.label)], rows: cmp.results[0].cumulativeKg.map((_, i) => [i + 1, ...cmp.results.map((r) => r.cumulativeKg[i])]) }}>
              <Lines yLabel="kgCO2e" data={cmp.results[0].cumulativeKg.map((_, i) => ({ year: i + 1, ...Object.fromEntries(cmp.results.map((r) => [r.strategy, r.cumulativeKg[i]])) }))} keys={[{ key: 'keep', label: 'Keep', color: PALETTE.base }, { key: 'replace_now', label: 'Replace now', color: PALETTE.scen }, { key: 'replace_at_failure', label: 'At failure', color: PALETTE.s3, dashed: true }]} />
            </ChartFrame>
          </div>
          <p className="muted" style={{ fontSize: '.78rem' }}>This comparator is a decision aid for one zone (life-cycle view). It does not change the scenario; use the zone table or the LED preset to apply a choice.</p>
        </Card>
      )}
    </div>
  );
}

export function LaundryTab({ res, adv }: { res: PropertyResults; adv: boolean }) {
  const { inputs, pid } = useProp();
  const lib = useStore((s) => s.data.library);
  const settings = useStore((s) => s.data.settings);
  const l = res.scenario.laundry;
  const lb = res.baseline.laundry;
  const options = useMemo(() => {
    const variants: { name: string; p: typeof inputs }[] = [{ name: 'Current scenario', p: inputs }];
    if (inputs.textiles.some((t) => t.stream === 'in_house')) variants.push({ name: 'All outsourced', p: PRESET_MAP['laundry-outsource'].apply(inputs, inputs.boundary.reportingYear) });
    if (inputs.textiles.some((t) => t.stream === 'outsourced')) { const p = deepClone(inputs); p.textiles = p.textiles.map((t) => ({ ...t, stream: 'in_house' })); variants.push({ name: 'All in-house (no new CAPEX)', p }); }
    return variants.map((v) => {
      const r = calculate(v.p, settings, lib);
      const laundryLines = r.lines.filter((x) => x.department === 'Housekeeping & Laundry' && x.views.includes('corporate'));
      const by = (s: string) => sum(laundryLines.filter((x) => x.scope === s).map((x) => x.kg)) / 1000;
      const cost = sum(r.costs.filter((c) => c.department === 'Housekeeping & Laundry').map((c) => c.total));
      return { name: v.name, s1: by('S1'), s2: by('S2'), s3: by('S3'), cost, missing: laundryLines.some((x) => x.status === 'missing') };
    });
  }, [inputs, settings, lib]);
  return (
    <div className="stack">
      <Card title="Textile inventory and change policies">
        <EditTable path="textiles" caption="Textile items" columns={[
          { key: 'name', label: 'Item', type: 'text', width: 130 }, { key: 'lengthCm', label: 'Length cm' }, { key: 'widthCm', label: 'Width cm' }, { key: 'gsm', label: 'GSM', nullable: true, step: 10 },
          { key: 'massModel', label: 'Mass model', type: 'select', options: [{ value: 'rectangle', label: 'Rectangle L×W×GSM' }, { value: 'measured', label: 'Measured' }, { value: 'garment', label: 'Garment model' }] },
          { key: 'measuredMassKg', label: 'Measured kg', nullable: true, step: 0.01 }, { key: 'garmentMassKg', label: 'Garment kg', nullable: true, step: 0.01 },
          { key: 'basis', label: 'Placed per', type: 'select', options: [{ value: 'per_guest', label: 'Guest' }, { value: 'per_bed', label: 'Bed' }, { value: 'per_room', label: 'Room' }, { value: 'per_pool_visit', label: 'Pool use' }, { value: 'per_cover', label: 'Cover' }, { value: 'per_fte_day', label: 'FTE-day' }, { value: 'per_treatment', label: 'Spa visit' }] },
          { key: 'placedPer', label: 'Qty placed', step: 0.5 }, { key: 'usageRatePerBasis', label: 'Usage rate', step: 0.01 },
          { key: 'changeOnDeparture', label: 'Change at departure', type: 'bool' }, { key: 'stayoverIntervalNights', label: 'Stayover interval (nights)' }, { key: 'reuseParticipation', label: 'Realised reuse %', type: 'percent' },
          { key: 'stream', label: 'Laundry', type: 'select', options: [{ value: 'in_house', label: 'In-house' }, { value: 'outsourced', label: 'Outsourced' }] },
          ...(adv ? [
            { key: 'requestChangesPerStay', label: 'Requests/stay', step: 0.01 }, { key: 'parLevel', label: 'Par level', step: 0.1 }, { key: 'rewashRate', label: 'Rewash %', type: 'percent' }, { key: 'lossRatePerYear', label: 'Loss/theft %/yr', type: 'percent' },
            { key: 'rejectionRate', label: 'Rejection %', type: 'percent' }, { key: 'lifeWashCycles', label: 'Life (washes)', min: 1 }, { key: 'calendarLifeYears', label: 'Calendar life yr', step: 0.5 },
            { key: 'tumbleDried', label: 'Tumble dried', type: 'bool' }, { key: 'ironed', label: 'Ironed', type: 'bool' }, { key: 'unitCostEUR', label: 'Unit € (ex VAT)', step: 0.1 },
            { key: 'factorId', label: 'Product factor', type: 'select', options: Object.values(lib.factors).filter((f) => f.id.startsWith('textile_')).map((f) => ({ value: f.id, label: f.name })) },
            { key: 'supplier', label: 'Supplier', type: 'text' }, { key: 'manufacturingCountry', label: 'Made in', type: 'text' }, { key: 'material', label: 'Material', type: 'text' },
            { key: 'existingStock', label: 'Existing stock', nullable: true }, { key: 'minLengthCm', label: 'Min length cm', nullable: true }, { key: 'minGsm', label: 'Min GSM', nullable: true },
            { key: 'endOfLife', label: 'End of life', type: 'select', options: [{ value: 'residual', label: 'Residual' }, { value: 'textile_recycling', label: 'Textile recycling' }, { value: 'reuse_rags', label: 'Reuse as rags' }] },
          ] as any : []),
        ]} newRow={() => ({ id: `t-${Date.now()}`, name: 'New textile', lengthCm: 100, widthCm: 50, gsm: 400, measuredMassKg: null, massModel: 'rectangle', garmentMassKg: null, material: 'Cotton', recycledContent: 0, supplier: '', manufacturingCountry: '', factorId: 'textile_cotton_terry', unitCostEUR: 5, placedPer: 1, basis: 'per_guest', parLevel: 4, changeOnDeparture: true, stayoverIntervalNights: 0, reuseParticipation: 0, requestChangesPerStay: 0, usageRatePerBasis: 1, rewashRate: 0.04, lossRatePerYear: 0.03, rejectionRate: 0.01, lifeWashCycles: 200, calendarLifeYears: 5, existingStock: null, tumbleDried: true, ironed: false, stream: 'in_house', minLengthCm: null, minGsm: null, endOfLife: 'residual' })} />
        <p className="muted" style={{ fontSize: '.78rem' }}>Mass = (L/100)·(W/100)·(GSM/1000) kg for flat textiles; measured mass takes precedence; bathrobes/uniforms need a garment mass. Pieces changed per stay = 1 at departure + (length of stay − 1) ÷ interval × (1 − realised reuse) + requests. Textile footprints scale with mass here only as a disclosed approximation.</p>
      </Card>
      <Card title="Textile flows (scenario)">
        <div className="table-wrap" tabIndex={0} role="region" aria-label="Scrollable table">
          <table>
            <thead><tr><th>Item</th><th className="num">Mass kg/piece</th><th>Method</th><th className="num">Pieces washed/yr</th><th className="num">kg washed/yr</th><th className="num">Baseline kg</th><th className="num">Purchases/yr</th></tr></thead>
            <tbody>{inputs.textiles.map((t) => { const m = textileMass(t); return (
              <tr key={t.id}><td>{t.name} <Badge status={t.stream === 'in_house' ? 'modelled' : 'disaggregated'}>{t.stream === 'in_house' ? 'in-house' : 'outsourced'}</Badge></td><td className="num">{m.kg == null ? <Badge status="missing" /> : num(m.kg, 3)}</td><td>{m.method}</td>
                <td className="num">{num(l.piecesWashed[t.name])}</td><td className="num">{num(l.kgByItem[t.name])}</td><td className="num">{num(lb.kgByItem[t.name])}</td><td className="num">{num(l.purchasesPerYear[t.name])}</td></tr>); })}</tbody>
          </table>
        </div>
        <p style={{ fontSize: '.86rem' }}>In-house: <strong>{num(l.kgWashedInHouse / 1000)} t/yr</strong> in {num(l.loads)} loads · outsourced: <strong>{num(l.kgWashedOutsourced / 1000)} t/yr</strong> (baseline {num(lb.kgWashedInHouse / 1000)} t / {num(lb.kgWashedOutsourced / 1000)} t).</p>
      </Card>
      <div className="grid grid-2">
        <Section title="In-house laundry equipment" open={adv}>
          <div className="fields">
            <NumField path="inHouseLaundry.machineCapacityKg" /><NumField path="inHouseLaundry.loadFactor" slider />
            <NumField path="inHouseLaundry.waterLPerCycle" label="Water per cycle" unit="L" /><NumField path="inHouseLaundry.electricityKWhPerCycle" label="Electricity per cycle" unit="kWh" step={0.1} />
            <NumField path="inHouseLaundry.thermalKWhPerCycle" label="Wash heat per cycle at 60 °C" unit="kWh" step={0.5} />
            <SelectField path="inHouseLaundry.thermalCarrier" label="Wash heat source" options={[{ value: 'natural_gas', label: 'Gas (direct)' }, { value: 'electricity', label: 'Electric (in machine)' }, { value: 'dhw', label: 'From hot-water system' }]} />
            <NumField path="inHouseLaundry.washTempC" label="Wash temperature" unit="°C" min={20} max={95} help="Wash heat scales with (T − 12 °C)/(60 − 12 °C). Lower temperatures need validated hygiene chemistry." />
            <NumField path="inHouseLaundry.detergentGPerKg" label="Detergent dose" unit="g/kg" />
            <SelectField path="inHouseLaundry.dryerTech" label="Dryer" options={[{ value: 'gas', label: 'Gas' }, { value: 'electric', label: 'Electric' }, { value: 'heat_pump', label: 'Heat-pump dryer' }]} />
            <NumField path="inHouseLaundry.residualMoisture" label="Residual moisture after extraction" unit="kg water/kg" step={0.05} max={2} />
            <NumField path="inHouseLaundry.dryerKWhPerKgWater" label="Dryer energy" unit="kWh/kg water" step={0.05} />
            <NumField path="inHouseLaundry.ironerKWhPerKg" label="Ironer/calender" unit="kWh/kg" step={0.05} />
            <NumField path="inHouseLaundry.heatRecoveryShare" label="Heat recovery" percent />
            <NumField path="inHouseLaundry.standbyKWhPerDay" label="Standby" unit="kWh/day" step={0.1} />
            <NumField path="inHouseLaundry.labourMinutesPerKg" label="Labour" unit="min/kg" step={0.1} />
            <NumField path="inHouseLaundry.maintenanceEURPerYear" label="Maintenance" unit="EUR/yr" />
          </div>
        </Section>
        <Section title="Outsourced laundry supplier" open>
          <div className="fields">
            <div className="field"><label>Supplier</label><input type="text" value={inputs.outsourcedLaundry.supplier} readOnly aria-readonly /></div>
            <NumField path="outsourcedLaundry.factorKgPerKg" nullable help="Supplier-declared factor. Leave empty if unknown: reported as MISSING, never zero." />
            <Toggle path="outsourcedLaundry.factorBoundaryIncludesTransport" label="Factor includes collection transport" help="If ticked, transport is not added again." />
            <NumField path="outsourcedLaundry.pricePerKgEUR" />
            <NumField path="outsourcedLaundry.minChargePerCollectionEUR" label="Minimum charge per collection" unit="EUR" />
            <NumField path="outsourcedLaundry.collectionsPerWeek" label="Collections per week" unit="per week" step={0.5} />
            <NumField path="outsourcedLaundry.roundTripKm" label="Collection round trip" unit="km" />
            <NumField path="outsourcedLaundry.routeAllocationShare" label="Share of route allocated" percent />
          </div>
        </Section>
      </div>
      <ChartFrame title="Laundry options — integrated recalculation" description="Laundry & housekeeping department emissions (tCO2e/yr) by scope for each option. Outsourcing moves emissions to Scope 3 cat. 1; it does not erase them." table={{ headers: ['Option', 'Scope 1 t', 'Scope 2 t', 'Scope 3 t', 'Cost € (ex VAT)'], rows: options.map((o) => [o.name, o.s1, o.s2, o.s3, o.cost]) }}>
        <GroupedBars data={options.map((o) => ({ name: o.name, S1: o.s1, S2: o.s2, S3: o.s3 }))} keys={[{ key: 'S1', label: 'Scope 1', color: PALETTE.s1 }, { key: 'S2', label: 'Scope 2', color: PALETTE.s2 }, { key: 'S3', label: 'Scope 3', color: PALETTE.s3 }]} yLabel="tCO2e" />
      </ChartFrame>
      {options.some((o) => o.missing) && <Notice kind="warn">At least one option relies on a missing supplier factor — its Scope 3 laundry emissions are unknown, not zero.</Notice>}
      <p className="muted" style={{ fontSize: '.78rem' }}>Option costs: {options.map((o) => `${o.name}: ${eur(o.cost)}`).join(' · ')} (housekeeping & laundry department, excl. CAPEX). Property: {pid}.</p>
    </div>
  );
}

export function HousekeepingTab({ res, adv }: { res: PropertyResults; adv: boolean }) {
  const { inputs } = useProp();
  const act = res.scenario.activity;
  const gn = sum(act.guestNights);
  const perGN = (b: string) => (gn > 0 ? (b === 'guest_night' ? 1 : b === 'occupied_room_night' ? sum(act.occupiedRoomNights) / gn : sum(act.stays) / gn) : 0);
  const singles = inputs.amenities.filter((a) => !a.refillable && /shampoo|conditioner|gel|lotion/i.test(a.name));
  const refill = inputs.amenities.find((a) => a.refillable);
  // the single-use "set" replaced by the refill system, expressed per guest-night
  const singleSet = singles.length ? { ...singles[0], quantityPerBasis: 1, kgCO2ePerUnit: sum(singles.map((a) => a.quantityPerBasis * a.kgCO2ePerUnit * perGN(a.basis))) } : null;
  const be = singleSet && refill ? amenityBreakEven(singleSet, refill, gn) : null;
  const am = res.scenario.lines.filter((l) => l.module === 'amenities' && l.views.includes('corporate'));
  return (
    <div className="stack">
      <Card title="Cleaning">
        <div className="fields">
          <NumField path="cleaning.departureCleanMinutes" label="Departure clean" unit="min" /><NumField path="cleaning.stayoverCleanMinutes" label="Stayover clean" unit="min" />
          <NumField path="cleaning.stayoverSkipShare" slider />
          {adv && <><NumField path="cleaning.publicAreaCleanM2PerDay" label="Public area cleaned" unit="m²/day" /><NumField path="cleaning.publicAreaMinutesPer100M2" label="Public cleaning time" unit="min/100 m²" />
            <NumField path="cleaning.chemicalMlPerClean" label="Chemical concentrate" unit="mL/clean" /><NumField path="cleaning.chemicalPricePerL" label="Concentrate price" unit="EUR/L" step={0.1} />
            <NumField path="cleaning.linersPerClean" label="Bin liners" unit="per clean" step={0.5} /><NumField path="cleaning.linerKg" label="Liner mass" unit="kg" step={0.001} />
            <NumField path="cleaning.wipesPerClean" label="Disposable wipes" unit="per clean" step={0.5} /><NumField path="cleaning.glovesPairsPerClean" label="Glove pairs" unit="per clean" step={0.1} />
            <NumField path="cleaning.vacuumKWhPerClean" label="Vacuum/equipment" unit="kWh/clean" step={0.01} /></>}
          <NumField path="cleaning.labourCostEURPerHour" label="Loaded labour cost" unit="EUR/h" step={0.5} />
          <Toggle path="cleaning.includeLabourInCosts" label="Include housekeeping & laundry labour in operating cost" />
          <NumField path="cleaning.staffHoursCapacityPerYear" label="Staff hours capacity (constraint)" unit="h/yr" />
        </div>
      </Card>
      <Card title="Amenities & consumables">
        <EditTable path="amenities" caption="Amenities" columns={[
          { key: 'enabled', label: 'In use', type: 'bool' }, { key: 'name', label: 'Item', type: 'text', width: 180 },
          { key: 'basis', label: 'Basis', type: 'select', options: [{ value: 'guest_night', label: 'Guest-night' }, { value: 'occupied_room_night', label: 'Occupied room-night' }, { value: 'stay', label: 'Stay' }, { value: 'departure', label: 'Departure' }] },
          { key: 'quantityPerBasis', label: 'Qty supplied', step: 0.05 }, { key: 'consumedShare', label: 'Actually consumed %', type: 'percent' }, { key: 'productMassG', label: 'Product g' }, { key: 'packagingMassG', label: 'Packaging g', step: 0.5 },
          { key: 'kgCO2ePerUnit', label: 'kgCO2e/unit', step: 0.001 }, { key: 'unitPriceEUR', label: '€/unit', step: 0.01 }, { key: 'refillable', label: 'Refillable', type: 'bool' },
          ...(adv ? [{ key: 'dispenserCount', label: 'Dispensers' }, { key: 'dispenserLifeYears', label: 'Dispenser life yr' }, { key: 'dispenserEmbodiedKg', label: 'Dispenser kgCO2e', step: 0.1 }] as any : []),
        ]} newRow={() => ({ id: `a-${Date.now()}`, name: 'New item', basis: 'guest_night', quantityPerBasis: 1, consumedShare: 1, productMassG: 10, packagingMassG: 2, kgCO2ePerUnit: 0.02, unitPriceEUR: 0.1, refillable: false, dispenserCount: 0, dispenserLifeYears: 5, dispenserEmbodiedKg: 0, dispenserPriceEUR: 0, enabled: true })} />
        <p className="muted" style={{ fontSize: '.78rem' }}>Product footprints per unit are demonstration values (replace with supplier data). Unconsumed product and packaging are counted as residual waste.</p>
        <div className="grid grid-2" style={{ marginTop: 8 }}>
          <div><h4>Amenity emissions (scenario)</h4><BarList items={am.map((l) => ({ label: l.label.replace('Amenity — ', ''), value: l.kg }))} unit={kgco2e} /></div>
          <div>
            <h4>Single-use vs refillable break-even</h4>
            {be ? (
              <p style={{ fontSize: '.86rem' }}>Single-use set ({singles.map((a) => a.name.split(' ')[0]).join(', ')}) ≈ <strong>{kgco2e(be.singleKgPerGN)}</strong> per guest-night vs refillable ≈ <strong>{kgco2e(be.refillKgPerGN)}</strong> (incl. dispensers spread over {refill!.dispenserLifeYears} years). Refillable is lower above <strong>{be.minGuestNightsPerYearForBreakEven == null ? 'never (refill per use is not lower)' : `${num(be.minGuestNightsPerYearForBreakEven)} guest-nights/yr`}</strong>; current: {num(gn)}. Not a universal preference — it depends on these use conditions.</p>
            ) : <p className="muted">Add one single-use and one refillable item to compute break-even.</p>}
          </div>
        </div>
      </Card>
      <p className="muted" style={{ fontSize: '.78rem' }}>Cleans this year: departures {num(sum(res.scenario.activity.stays))}, stayovers {num(sum(res.scenario.activity.stayoverRoomNights) * (1 - inputs.cleaning.stayoverSkipShare))}. Total amenity emissions {tco2e(sum(am.map((l) => l.kg)))}.</p>
    </div>
  );
}
