import type { PropertyResults } from '../../state/useResults';
import { Card, Notice } from '../../components/ui';
import { EditTable, Month12, NumField, Section, SelectField, Toggle, useProp } from '../../components/fields';
import { BarList, ChartFrame, MonthlyStack, PALETTE } from '../../components/charts';
import { MONTHS, sum, hdd, DAYS_IN_MONTH } from '../../engine/util';
import { heatPumpCop } from '../../engine/heat';
import { m3, mwh, num } from '../../lib/format';
import { useStore } from '../../state/store';
import { calculate } from '../../engine';

export const HEAT_OPTIONS = [
  { value: 'gas_boiler', label: 'Gas boiler' }, { value: 'oil_boiler', label: 'Heating-oil boiler' }, { value: 'lpg_boiler', label: 'LPG boiler' }, { value: 'heat_pump', label: 'Heat pump' },
  { value: 'electric_resistance', label: 'Electric resistance' }, { value: 'district_heat', label: 'District heat' }, { value: 'wood_pellet_boiler', label: 'Wood-pellet boiler' },
];

export function HeatSystemFields({ base, adv, title }: { base: string; adv: boolean; title: string }) {
  const { inputs } = useProp();
  const tech = base.split('.').reduce((o: any, k) => o?.[k], inputs)?.tech;
  return (
    <>
      <h4>{title}</h4>
      <div className="fields">
        <SelectField path={`${base}.tech`} label="Technology / fuel" options={HEAT_OPTIONS} />
        {tech === 'heat_pump' ? (
          <>
            <SelectField path={`${base}.copModel`} label="COP model" options={[{ value: 'seasonal', label: 'Fixed seasonal COP (SCOP)' }, { value: 'temperature', label: 'Temperature-dependent (Carnot fraction)' }]} />
            <NumField path={`${base}.scop`} label="Seasonal COP" min={1} max={7} step={0.1} slider />
            {adv && <NumField path={`${base}.carnotFraction`} label="Carnot fraction" min={0.2} max={0.7} step={0.01} />}
            <NumField path={`${base}.supplyTempC`} label="Supply temperature" unit="°C" min={25} max={90} />
            <NumField path={`${base}.backupResistanceShare`} label="Electric backup share" percent />
            {adv && <NumField path={`${base}.defrostAllowance`} label="Defrost allowance" percent />}
          </>
        ) : (
          <NumField path={`${base}.seasonalEfficiency`} label="Seasonal efficiency" percent help="Gas: on PCS (gross calorific) basis." />
        )}
        {adv && <NumField path={`${base}.distributionLoss`} label="Distribution losses" percent />}
      </div>
    </>
  );
}

export function ActivityTab({ res, adv }: { res: PropertyResults; adv: boolean }) {
  const a = res.scenario.activity;
  const rows = [
    ['Available room-nights', a.availableRoomNights], ['Occupied room-nights', a.occupiedRoomNights], ['Guest-nights', a.guestNights], ['Room-stays (= departures)', a.stays],
    ['Arriving guests', a.arrivingGuests], ['Stayover room-nights', a.stayoverRoomNights], ['Breakfast covers', a.covers.breakfast], ['Lunch/dinner covers', a.covers.mainMeals],
  ] as const;
  return (
    <div className="stack">
      <Card title="Rooms and capacity">
        <EditTable path="activity.roomTypes" caption="Room types" columns={[
          { key: 'name', label: 'Room type', type: 'text', width: 160 }, { key: 'count', label: 'Rooms' }, { key: 'areaM2', label: 'Area m²' }, { key: 'beds', label: 'Beds' },
          { key: 'maxGuests', label: 'Max guests' }, { key: 'guestsPerOccupiedRoom', label: 'Guests / occ. room', step: 0.1 }, { key: 'occupancyIndex', label: 'Occupancy index', step: 0.01, max: 2 },
        ]} newRow={() => ({ id: `rt-${Date.now()}`, name: 'New room type', count: 1, areaM2: 25, beds: 1, maxGuests: 2, guestsPerOccupiedRoom: 1.8, occupancyIndex: 1 })} />
        <p className="muted" style={{ fontSize: '.78rem' }}>Total: {a.rooms} rooms, {a.beds} beds, {num(a.guestroomAreaM2)} m² of guestrooms. Occupancy per type = reference monthly occupancy × index (capped at 100 %).</p>
      </Card>
      <Card title="Calendar">
        <div className="stack">
          <Month12 path="activity.monthlyOpenDays" label="Open days per month" max={31} />
          <Month12 path="activity.monthlyOccupancy" label="Reference occupancy" percent />
          <div className="fields">
            <NumField path="activity.avgLengthOfStayNights" slider />
            <NumField path="activity.outOfOrderRate" />
            {adv && <NumField path="activity.dayUseRoomsPerYear" />}
          </div>
        </div>
      </Card>
      <Section title="Staff, areas and outlets" open={adv}>
        <div className="fields">
          <NumField path="activity.staffHeadcount" /><NumField path="activity.staffFTE" /><NumField path="activity.workingDaysPerFTE" /><NumField path="activity.staffAccommodationBeds" />
          <NumField path="activity.publicAreaM2" /><NumField path="activity.backOfHouseM2" /><NumField path="activity.meetingAreaM2" />
          <NumField path="activity.breakfastUptake" /><NumField path="activity.dinnerUptake" /><NumField path="activity.externalCoversPerOpenDay" /><NumField path="activity.roomServiceOrdersPerOccRoomNight" />
          <NumField path="activity.barCustomersPerOpenDay" /><NumField path="activity.eventAttendeesPerYear" /><NumField path="activity.meetingRoomHoursPerYear" />
          <NumField path="activity.spaDayVisitorsPerYear" /><NumField path="activity.poolDayVisitorsPerYear" /><NumField path="activity.staffMealsPerFTEDay" />
        </div>
      </Section>
      <Card title="Derived activity (never interchangeable)">
        <div className="table-wrap" tabIndex={0} role="region" aria-label="Scrollable table">
          <table>
            <thead><tr><th>Quantity</th>{MONTHS.map((m) => <th key={m} className="num">{m}</th>)}<th className="num">Year</th></tr></thead>
            <tbody>{rows.map(([l, arr]) => <tr key={l}><th scope="row">{l}</th>{arr.map((v, i) => <td key={i} className="num">{num(v)}</td>)}<td className="num"><strong>{num(sum(arr))}</strong></td></tr>)}</tbody>
          </table>
        </div>
        <p className="muted" style={{ fontSize: '.78rem' }}>Stays = occupied room-nights ÷ average length of stay (steady-state approximation for non-integer stays); arriving guests = guest-nights ÷ length of stay; stayover room-nights = occupied room-nights − departures. Departure cleans and stayover cleans are modelled separately.</p>
      </Card>
    </div>
  );
}

export function BuildingTab({ res, adv }: { res: PropertyResults; adv: boolean }) {
  const { inputs } = useProp();
  const lib = useStore((s) => s.data.library);
  const settings = useStore((s) => s.data.settings);
  const climate = lib.climates[inputs.profile.climateProfileId];
  const b = inputs.building;
  const e = res.scenario.energy;
  const heatCarrier = Object.entries(e).find(([, f]) => f.endUses['Space heating'])?.[0];
  const heat = heatCarrier ? e[heatCarrier].endUses['Space heating'] : new Array(12).fill(0);
  const cool = e.electricity?.endUses['Space cooling'] ?? new Array(12).fill(0);
  const data = MONTHS.map((m, i) => ({ month: m, heat: heat[i] / 1000, cool: cool[i] / 1000 }));
  const sensitivity = (() => {
    const p2 = { ...inputs, building: { ...b, heatingSetpointC: b.heatingSetpointC + 1 } };
    const r2 = calculate(p2, settings, lib);
    const r1 = res.scenario;
    return { dHeat: sum(r2.energy[heatCarrier ?? 'electricity']?.endUses['Space heating'] ?? [0]) - sum(heat), dKg: r2.totals.corporateLB - r1.totals.corporateLB };
  })();
  return (
    <div className="stack">
      <Notice kind="info">Monthly degree-day heat balance (normal-distribution degree-days around monthly mean temperatures). Setpoint changes act through the balance-point temperature — no fixed “% per °C” rule. Lighting and equipment heat gains interact with heating and cooling. Not modelled: thermal mass, latent loads, simultaneous heating & cooling.</Notice>
      <Card title="Controls and comfort">
        <div className="fields">
          <NumField path="building.heatingSetpointC" slider /><NumField path="building.coolingSetpointC" slider />
          <Toggle path="building.coolingEnabled" label="Cooling installed" />
          <Toggle path="building.roomControlsEnabled" label="Room key-card / occupancy setback" />
          <NumField path="building.unoccupiedSetbackK" />
          {adv && <NumField path="building.preconditioningHours" />}
          <Toggle path="building.windowInterlocks" label="Window-open interlocks" help="When off, opened windows in occupied rooms add the extra air change below." />
          {adv && <NumField path="building.windowOpeningExtraACH" />}
          <NumField path="building.closedFrostSetpointC" />
        </div>
        <p className="muted" style={{ fontSize: '.8rem' }}>Model sensitivity at current inputs: +1 °C heating setpoint → {num(sensitivity.dHeat / 1000)} MWh heating fuel/electricity, {num(sensitivity.dKg / 1000)} tCO2e (computed by the model, not a rule of thumb).</p>
      </Card>
      <Card title="Heating & cooling systems">
        <HeatSystemFields base="building.heating" adv={adv} title="Space heating" />
        <div className="fields" style={{ marginTop: 10 }}>
          <NumField path="building.coolingSEER" />
          <NumField path="building.fanPumpPowerKW" /><NumField path="building.fanPumpHoursPerOpenDay" /><NumField path="building.variableSpeedSaving" />
        </div>
        {b.heating.tech === 'heat_pump' && (
          <p className="muted" style={{ fontSize: '.8rem' }}>COP by month: {MONTHS.map((m, i) => `${m} ${num(heatPumpCop(b.heating, climate.meanTempC[i]), 2)}`).join(' · ')}</p>
        )}
      </Card>
      <Section title="Envelope & ventilation" open={adv}>
        <div className="fields">
          <NumField path="building.conditionedAreaM2" /><NumField path="building.volumeM3" />
          <NumField path="building.wallAreaM2" /><NumField path="building.wallU" /><NumField path="building.roofAreaM2" /><NumField path="building.roofU" />
          <NumField path="building.floorAreaM2" /><NumField path="building.floorU" /><NumField path="building.windowAreaM2" /><NumField path="building.windowU" />
          <NumField path="building.glazingG" /><NumField path="building.shadingFactor" /><NumField path="building.infiltrationACH" />
          <NumField path="building.mechVentilationM3h" /><NumField path="building.requiredVentilationM3h" /><NumField path="building.heatRecoveryEff" />
        </div>
      </Section>
      <Section title="Electrical base loads & gains" open={adv}>
        <div className="fields">
          <NumField path="building.plugLoadWPerM2" /><NumField path="building.plugLoadHoursPerDay" /><NumField path="building.baseLoadKW" />
          <NumField path="building.otherElectricKWhPerOccRoomNight" /><NumField path="building.guestPresenceShare" />
        </div>
      </Section>
      <ChartFrame title="Monthly heating and cooling final energy" description={`MWh per month (${heatCarrier?.replace('_', ' ') ?? 'n/a'} for heating; electricity for cooling).`} table={{ headers: ['Month', 'Heating MWh', 'Cooling MWh'], rows: data.map((r) => [r.month, r.heat, r.cool]) }}>
        <MonthlyStack data={data} keys={[{ key: 'heat', label: 'Heating', color: PALETTE.s3 }, { key: 'cool', label: 'Cooling', color: PALETTE.s1 }]} />
      </ChartFrame>
      <Card title="Climate profile used">
        <p className="muted" style={{ fontSize: '.8rem' }}>{climate.name} — <strong>demonstration approximation</strong>, not downloaded from Météo-France. Heating degree-days (base 18 °C, method above): {num(sum(climate.meanTempC.map((t, i) => hdd(18, t, climate.dailyTempSdC[i], DAYS_IN_MONTH[i]))))} K·day/yr.</p>
      </Card>
    </div>
  );
}

export function WaterTab({ res, adv }: { res: PropertyResults; adv: boolean }) {
  const { inputs } = useProp();
  const w = res.scenario.water;
  const wb = res.baseline.water;
  const dhwUses = Object.entries(res.scenario.energy).flatMap(([c, f]) => Object.entries(f.endUses).filter(([k]) => /hot water|Hot-water|Laundry wash/i.test(k)).map(([k, v]) => ({ label: `${k} (${c.replace('_', ' ')})`, value: sum(v) })));
  return (
    <div className="stack">
      <Notice kind="info">Water savings and carbon savings are shown separately: hot-water reductions save energy and emissions, cold-water reductions mainly save water and wastewater charges.</Notice>
      <Card title="Guest bathrooms">
        <div className="fields">
          <NumField path="bathrooms.showerFlowLPerMin" slider /><NumField path="bathrooms.showerMinutes" slider /><NumField path="bathrooms.showersPerGuestNight" />
          <NumField path="bathrooms.lowFlowUptake" slider /><NumField path="bathrooms.lowFlowShowerLPerMin" /><NumField path="bathrooms.showerRebound" />
          {adv && <><NumField path="bathrooms.bathVolumeL" /><NumField path="bathrooms.bathsPerGuestNight" /><NumField path="bathrooms.basinFlowLPerMin" /><NumField path="bathrooms.basinMinutesPerGuestNight" /><NumField path="bathrooms.basinHotShare" />
            <NumField path="bathrooms.toiletFullFlushL" /><NumField path="bathrooms.toiletPartFlushL" /><NumField path="bathrooms.dualFlushPartShare" /><NumField path="bathrooms.flushesPerGuestNight" /></>}
          <NumField path="bathrooms.leakM3PerDay" />
        </div>
      </Card>
      <Card title="Domestic hot water">
        <div className="fields">
          <NumField path="dhw.storageTempC" help="French ERP Legionella order (1 Feb 2010, as summarised): ≥55 °C at production outlet." />
          <NumField path="dhw.loopReturnTempC" help="≥50 °C throughout the network incl. loop return." />
          <NumField path="dhw.showerMixTempC" help="Anti-scald: ≤50 °C at washing points." /><NumField path="dhw.basinMixTempC" />
          {adv && <><NumField path="dhw.storageLossKWhPerDay" /><NumField path="dhw.loopLengthM" /><NumField path="dhw.loopLossWPerM" /><NumField path="dhw.pipeInsulationImprovement" /></>}
          <NumField path="dhw.heatRecoveryShare" />
          <Toggle path="dhw.sameAsSpaceHeating" label="Same generator as space heating" />
        </div>
        {!inputs.dhw.sameAsSpaceHeating && <div style={{ marginTop: 10 }}><HeatSystemFields base="dhw.system" adv={adv} title="Hot-water generator" /></div>}
        <p className="muted" style={{ fontSize: '.78rem' }}>Hot-water energy = mixed litres × 4.186 × (use temperature − cold inlet) ÷ 3600, i.e. the hot fraction raised to storage temperature — the full mixed volume is never heated to storage temperature.</p>
      </Card>
      <div className="grid grid-2">
        <Card title={`Water by end use — ${m3(sum(w.total))} (baseline ${m3(sum(wb.total))})`}>
          <BarList items={Object.entries(w.endUses).map(([k, v]) => ({ label: k, value: sum(v) }))} unit={m3} total={sum(w.total)} />
          <p className="muted" style={{ fontSize: '.78rem' }}>Mains supplied: {m3(sum(w.mainsM3))}; discharged to sewer/treatment: {m3(sum(w.dischargedToSewer))}.</p>
        </Card>
        <Card title="Hot-water final energy by end use">
          <BarList items={dhwUses} unit={(v) => `${num(v / 1000)} MWh`} />
        </Card>
      </div>
      {inputs.pools.length > 0 && (
        <Card title="Pools">
          <EditTable path="pools" caption="Pools" columns={[
            { key: 'name', label: 'Pool', type: 'text', width: 140 }, { key: 'indoor', label: 'Indoor', type: 'bool' }, { key: 'areaM2', label: 'Area m²' }, { key: 'waterTempC', label: 'Water °C', step: 0.5 },
            { key: 'coverUsed', label: 'Cover used', type: 'bool' }, { key: 'coverHoursPerDay', label: 'Cover h/day', max: 24 }, { key: 'coverEvapReduction', label: 'Cover evap. reduction %', type: 'percent' },
            { key: 'backwashM3PerWeek', label: 'Backwash m³/wk', step: 0.5 }, { key: 'pumpKW', label: 'Pump kW', step: 0.1 }, { key: 'pumpHoursPerDay', label: 'Pump h/day', max: 24 },
            ...(adv ? [{ key: 'surfaceLossWPerM2K', label: 'Surface loss W/m²K', step: 0.5 }, { key: 'indoorEvapKgPerM2H', label: 'Indoor evap kg/m²h', step: 0.01 }, { key: 'dehumidKWhPerKgEvap', label: 'Dehumid. kWh/kg', step: 0.1 }, { key: 'chemicalsKgPerYear', label: 'Chemicals kg/yr' }] : []),
          ]} />
          <p className="muted" style={{ fontSize: '.78rem' }}>Heat demand = evaporation × 0.68 kWh/kg + surface losses + make-up water heating; cover reduces evaporation and surface losses for its hours of use. Outdoor evaporation rates are demonstration values; solar gains on outdoor pools are not modelled (conservative).</p>
          {inputs.pools.map((pl, i) => <div key={pl.id} style={{ marginTop: 8 }}><Month12 path={`pools.${i}.openMonths`} label={`${pl.name}: open months (1 = open)`} max={1} /><HeatSystemFields base={`pools.${i}.heating`} adv={adv} title={`${pl.name}: heating`} /></div>)}
        </Card>
      )}
      <Section title="Kitchen, housekeeping, staff & other water" open={adv}>
        <div className="fields">
          <NumField path="otherWater.kitchenLPerCover" label="Kitchen water per cover" unit="L" /><NumField path="otherWater.kitchenHotShare" label="Kitchen hot share" percent />
          <NumField path="otherWater.dishwasherLPerRack" label="Dishwasher water per rack" unit="L" step={0.1} /><NumField path="otherWater.racksPerCover" label="Racks per cover" unit="–" step={0.01} />
          <NumField path="otherWater.housekeepingLPerClean" label="Housekeeping water per clean" unit="L" /><NumField path="otherWater.housekeepingHotShare" label="Housekeeping hot share" percent />
          <NumField path="otherWater.staffLPerFTEDay" label="Staff facilities per FTE-day" unit="L" /><NumField path="otherWater.coolingTowerM3PerYear" label="Cooling tower make-up" unit="m³/yr" />
          <NumField path="otherWater.rainwaterM3PerYear" label="Rainwater used (toilets/irrigation)" unit="m³/yr" />
        </div>
      </Section>
      <Section title="Spa & irrigation" open={adv}>
        <div className="fields">
          <Toggle path="spa.enabled" label="Spa operated" /><NumField path="spa.saunas" label="Saunas" unit="units" /><NumField path="spa.saunaKW" label="Sauna heater" unit="kW" /><NumField path="spa.saunaHoursPerOpenDay" label="Sauna hours" unit="h/day" max={24} />
          <NumField path="spa.steamRooms" label="Steam rooms" unit="units" /><NumField path="spa.steamKW" label="Steam generator" unit="kW" /><NumField path="spa.hotTubs" label="Hot tubs" unit="units" /><NumField path="spa.treatmentsPerYear" label="Treatments" unit="per year" />
          <NumField path="irrigation.landscapedAreaM2" label="Irrigated landscape" unit="m²" /><NumField path="irrigation.cropCoefficient" label="Plant coefficient (Kc)" unit="–" step={0.05} max={1.5} />
          <NumField path="irrigation.irrigationEfficiency" label="Irrigation efficiency" percent /><NumField path="irrigation.leakShare" label="Irrigation leaks" percent /><NumField path="irrigation.reclaimedShare" label="Reclaimed water share" percent />
        </div>
      </Section>
    </div>
  );
}
