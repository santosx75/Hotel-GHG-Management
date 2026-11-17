import type { PropertyResults } from '../../state/useResults';
import type { FoodCategory, TransportLeg } from '../../types';
import { Badge, Card, Notice } from '../../components/ui';
import { EditTable, NumField, Section, SelectField, Toggle, useProp } from '../../components/fields';
import { BarList } from '../../components/charts';
import { FOOD_CATEGORIES } from '../../engine/food';
import { sum } from '../../engine/util';
import { kgco2e, num, tco2e } from '../../lib/format';
import { useStore } from '../../state/store';

const BASKETS: { key: string; label: string }[] = [
  { key: 'breakfastBasket', label: 'Breakfast (per cover)' }, { key: 'mainStandardBasket', label: 'Main meal — standard' }, { key: 'mainVegetarianBasket', label: 'Main meal — vegetarian' },
  { key: 'staffMealBasket', label: 'Staff meal' }, { key: 'barBasket', label: 'Bar (per customer)' },
];

export function FoodTab({ res, adv }: { res: PropertyResults; adv: boolean }) {
  const { inputs, set, locked } = useProp();
  const lib = useStore((s) => s.data.library);
  const f = inputs.food;
  const food = res.scenario.lines.filter((l) => l.module === 'food' && l.views.includes('corporate'));
  const fw = res.scenario.lines.find((l) => l.activityId === 'waste-food');
  const measured = f.measuredPurchasesKg != null;
  const cell = (path: string, v: number | undefined, label: string) => (
    <input type="number" aria-label={label} step={0.005} min={0} value={v ?? ''} disabled={locked} placeholder="0" onChange={(e) => { const x = e.target.value === '' ? 0 : Number(e.target.value); if (Number.isFinite(x) && x >= 0) set(path, x); }} />
  );
  return (
    <div className="stack">
      {!inputs.boundary.restaurantsIncluded && <Notice kind="info">Restaurants are excluded from the organisational boundary (Boundary tab) — F&B procurement is not counted.</Notice>}
      <Card title="Menu and waste drivers">
        <div className="fields">
          <NumField path="food.vegetarianUptake" slider /><NumField path="food.overproductionShare" slider /><NumField path="food.plateWasteShare" /><NumField path="food.prepLossShare" />
          <NumField path="food.spoilageShare" /><NumField path="food.donationShareOfOverproduction" /><NumField path="food.banquetMealsPerAttendee" label="Banquet meals per attendee" unit="–" step={0.1} max={5} />
          <Toggle path="food.factorsIncludeTransport" label="Food factors include transport to retail" help="If unticked, transport is added from t·km/kg below (no double counting)." />
          {!f.factorsIncludeTransport && <NumField path="food.transportTkmPerKg" label="Transport per kg" unit="t·km/kg" step={0.001} />}
        </div>
        <p className="muted" style={{ fontSize: '.78rem' }}>Purchased = served × (1 + overproduction) ÷ (1 − preparation loss) ÷ (1 − spoilage). Food waste = purchased − eaten − donated; only its <em>treatment</em> emissions are added (production is already in purchases). “Local”, “organic” or “seasonal” labels are not given automatic reductions — change the basket or factor with evidence.</p>
      </Card>
      <Card title="Recipe baskets (kg or L per cover)" actions={<label className="toggle"><input type="checkbox" checked={measured} disabled={locked} onChange={(e) => set('food.measuredPurchasesKg', e.target.checked ? {} : null)} /> Use measured annual purchases where entered</label>}>
        <div className="table-wrap" tabIndex={0} role="region" aria-label="Scrollable table">
          <table className="edit-table">
            <thead><tr><th>Category</th>{BASKETS.map((b) => <th key={b.key}>{b.label}</th>)}{measured && <th>Measured kg/yr</th>}<th>Price €/kg</th><th className="num">Factor kgCO2e/kg</th></tr></thead>
            <tbody>{FOOD_CATEGORIES.map((c) => (
              <tr key={c}><th scope="row">{c.replace('_', ' ')}</th>
                {BASKETS.map((b) => <td key={b.key}>{cell(`food.${b.key}.${c}`, (f as any)[b.key][c], `${b.label} ${c}`)}</td>)}
                {measured && <td>{cell(`food.measuredPurchasesKg.${c}`, f.measuredPurchasesKg?.[c as FoodCategory], `Measured ${c}`)}</td>}
                <td>{cell(`food.foodPricePerKg.${c}`, f.foodPricePerKg[c as FoodCategory], `Price ${c}`)}</td>
                <td className="num">{num(lib.factors[`food_${c}`]?.value, 3)} <Badge status={lib.factors[`food_${c}`]?.verification ?? 'missing'} /></td></tr>
            ))}</tbody>
          </table>
        </div>
      </Card>
      <div className="grid grid-2">
        <Card title={`Food & drink purchases — ${tco2e(sum(food.filter((l) => l.s3cat === 1).map((l) => l.kg)))}`}>
          <BarList items={food.filter((l) => l.s3cat === 1).map((l) => ({ label: `${l.label.replace('Food & drink purchases — ', '')} (${num(l.activity)} ${l.activityUnit})`, value: l.kg }))} unit={tco2e} />
        </Card>
        <Card title="Food waste">
          <p>Modelled food waste: <strong>{num((fw?.activity ?? 0) / 1000)} t/yr</strong> → treatment emissions {kgco2e(fw?.kg ?? 0)} (Scope 3 cat. 5).</p>
          <p className="muted" style={{ fontSize: '.8rem' }}>The upstream production of this wasted food is already inside the purchase line above.</p>
        </Card>
      </div>
      <Section title="Kitchen equipment" open={adv}>
        <div className="fields">
          <NumField path="food.cookingKWhPerCover" label="Cooking energy" unit="kWh/cover" step={0.05} /><NumField path="food.cookingGasShare" label="Gas share of cooking" percent />
          <NumField path="food.refrigerationKWhPerDay" label="Cold rooms & refrigerators" unit="kWh/day" /><NumField path="food.extractionKW" label="Extraction fans" unit="kW" step={0.5} />
          <NumField path="food.extractionHoursPerOpenDay" label="Extraction hours" unit="h/day" max={24} /><NumField path="food.dishwasherKWhPerRack" label="Dishwasher" unit="kWh/rack" step={0.01} />
          <NumField path="food.iceMachineKWhPerDay" label="Ice machines" unit="kWh/day" />
        </div>
      </Section>
    </div>
  );
}

const legsToText = (legs: TransportLeg[]) => legs.map((l) => `${l.mode}:${l.km}`).join('; ');
const MODES = ['road_truck', 'road_van', 'rail', 'sea', 'ferry_freight', 'air'];
function parseLegs(s: string): TransportLeg[] | null {
  const parts = s.split(';').map((x) => x.trim()).filter(Boolean);
  const legs: TransportLeg[] = [];
  for (const p of parts) {
    const [m, k] = p.split(':').map((x) => x.trim());
    const km = Number(k);
    if (!MODES.includes(m) || !Number.isFinite(km) || km < 0) return null;
    legs.push({ mode: m as TransportLeg['mode'], km });
  }
  return legs;
}

export function MobilityTab({ res, adv }: { res: PropertyResults; adv: boolean }) {
  const { inputs, set, locked } = useProp();
  const gt = res.scenario.lines.filter((l) => l.department === 'Guest travel');
  const settings = useStore((s) => s.data.settings);
  const PT = [{ value: 'diesel', label: 'Diesel' }, { value: 'petrol', label: 'Petrol' }, { value: 'bev', label: 'Battery electric' }, { value: 'lpg', label: 'LPG' }, { value: 'boat_diesel', label: 'Boat diesel' }, { value: 'boat_petrol', label: 'Boat petrol' }];
  return (
    <div className="stack">
      <Card title="Hotel fleet (Scope 1 fuel / Scope 2 charging)">
        <EditTable path="vehicles" caption="Vehicles" columns={[
          { key: 'name', label: 'Vehicle', type: 'text', width: 170 }, { key: 'count', label: 'Count' }, { key: 'powertrain', label: 'Powertrain', type: 'select', options: PT },
          { key: 'kmPerYear', label: 'km/yr (or h/yr)' }, { key: 'usesHours', label: 'Uses hours', type: 'bool' }, { key: 'fuelLPer100Km', label: 'L/100 km (or L/h)', step: 0.1 }, { key: 'kWhPer100Km', label: 'kWh/100 km', step: 0.5 },
          { key: 'chargedOnSite', label: 'Charged on site', type: 'bool' },
          ...(adv ? [{ key: 'chargingLoss', label: 'Charging loss %', type: 'percent' }, { key: 'acquisitionYear', label: 'Acquired', min: 1950, max: 2100 }, { key: 'lifeYears', label: 'Life yr' }, { key: 'purchaseCostEUR', label: 'Purchase €' }, { key: 'embodiedKg', label: 'Embodied kgCO2e' }, { key: 'maintenanceEURPerYear', label: 'Maint. €/yr' }] as any : []),
        ]} newRow={() => ({ id: `v-${Date.now()}`, name: 'New vehicle', role: 'other', count: 1, powertrain: 'diesel', kmPerYear: 10000, usesHours: false, fuelLPer100Km: 8, kWhPer100Km: 0, chargingLoss: 0.1, chargedOnSite: true, purchaseCostEUR: 40000, embodiedKg: 8000, acquisitionYear: 2020, lifeYears: 8, maintenanceEURPerYear: 1000, replacement: null })} />
        <h4 style={{ marginTop: 12 }}>Scheduled replacements</h4>
        <div className="table-wrap" tabIndex={0} role="region" aria-label="Scrollable table">
          <table className="edit-table">
            <thead><tr><th>Vehicle</th><th>Replace?</th><th>Year</th><th>New powertrain</th><th>kWh/100 km</th><th>L/100 km</th><th>Purchase €</th><th>Embodied kgCO2e</th></tr></thead>
            <tbody>{inputs.vehicles.map((v, i) => {
              const r = v.replacement;
              const upd = (k: string, val: unknown) => set(`vehicles.${i}.replacement`, { ...(r ?? { year: inputs.boundary.reportingYear + 1, powertrain: 'bev', fuelLPer100Km: 0, kWhPer100Km: 20, purchaseCostEUR: 55000, embodiedKg: 11000, maintenanceEURPerYear: v.maintenanceEURPerYear * 0.7 }), [k]: val });
              return (
                <tr key={v.id}><td>{v.name}</td>
                  <td><input type="checkbox" aria-label={`Schedule replacement for ${v.name}`} disabled={locked} checked={!!r} onChange={(e) => set(`vehicles.${i}.replacement`, e.target.checked ? { year: inputs.boundary.reportingYear + 1, powertrain: 'bev', fuelLPer100Km: 0, kWhPer100Km: 20, purchaseCostEUR: 55000, embodiedKg: 11000, maintenanceEURPerYear: v.maintenanceEURPerYear * 0.7 } : null)} /></td>
                  {r ? <>
                    <td><input type="number" aria-label={`Replacement year ${v.name}`} disabled={locked} value={r.year} min={2000} max={2100} onChange={(e) => upd('year', Number(e.target.value))} /></td>
                    <td><select aria-label={`New powertrain ${v.name}`} disabled={locked} value={r.powertrain} onChange={(e) => upd('powertrain', e.target.value)}>{PT.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></td>
                    <td><input type="number" aria-label={`kWh per 100 km ${v.name}`} disabled={locked} value={r.kWhPer100Km} min={0} onChange={(e) => upd('kWhPer100Km', Number(e.target.value))} /></td>
                    <td><input type="number" aria-label={`L per 100 km ${v.name}`} disabled={locked} value={r.fuelLPer100Km} min={0} onChange={(e) => upd('fuelLPer100Km', Number(e.target.value))} /></td>
                    <td><input type="number" aria-label={`Purchase cost ${v.name}`} disabled={locked} value={r.purchaseCostEUR} min={0} onChange={(e) => upd('purchaseCostEUR', Number(e.target.value))} /></td>
                    <td><input type="number" aria-label={`Embodied ${v.name}`} disabled={locked} value={r.embodiedKg} min={0} onChange={(e) => upd('embodiedKg', Number(e.target.value))} /></td>
                  </> : <td colSpan={6} className="muted">Keep existing vehicle</td>}
                </tr>
              );
            })}</tbody>
          </table>
        </div>
        <p className="muted" style={{ fontSize: '.78rem' }}>A replacement takes effect from its year (multi-year analysis recalculates each year). Manufacturing emissions of the new vehicle are recognised in its acquisition year (Scope 3 cat. 2) and shown annualised only in the life-cycle view. Electric vehicles are not emission-free: charging electricity is Scope 2 and counted once.</p>
      </Card>
      <Card title="Guest travel (extended visitor-impact view)">
        <Notice kind="info">Independently arranged guest travel is disclosed separately and is not forced into a Scope 3 category. Travel is driven by <strong>arriving guests</strong> ({num(sum(res.scenario.activity.arrivingGuests))}/yr), one journey per stay — extra nights do not create extra journeys. Hotel-owned shuttle legs are excluded here (already Scope 1). Aviation non-CO2 convention: <strong>{settings.aviationNonCO2}</strong> (Settings).</Notice>
        <EditTable path="guestTravel.origins" caption="Guest origins" columns={[
          { key: 'label', label: 'Origin', type: 'text', width: 150 }, { key: 'shareOfArrivals', label: 'Share of arrivals %', type: 'percent' }, { key: 'oneWayKm', label: 'One-way km' },
          { key: 'ferryKm', label: 'Ferry km' },
          { key: 'arrangement', label: 'Arranged by', type: 'select', options: [{ value: 'independent', label: 'Guest (independent)' }, { value: 'hotel_sold', label: 'Sold by hotel' }, { value: 'hotel_purchased_transfer', label: 'Third-party transfer bought by hotel' }] },
        ]} newRow={() => ({ id: `o-${Date.now()}`, label: 'New origin', shareOfArrivals: 0, oneWayKm: 500, modes: { train: 0.5, car: 0.5, plane_short: 0, plane_long: 0, coach: 0 }, ferryKm: 0, arrangement: 'independent' })} />
        <h4 style={{ marginTop: 10 }}>Arrival mode distribution by origin (%)</h4>
        <div className="table-wrap" tabIndex={0} role="region" aria-label="Scrollable table">
          <table className="edit-table">
            <thead><tr><th>Origin</th><th>Train</th><th>Car</th><th>Short-haul flight</th><th>Long-haul flight</th><th>Coach</th><th className="num">Sum</th></tr></thead>
            <tbody>{inputs.guestTravel.origins.map((o, i) => {
              const total = o.modes.train + o.modes.car + o.modes.plane_short + o.modes.plane_long + o.modes.coach;
              return (
                <tr key={o.id}><th scope="row">{o.label}</th>
                  {(['train', 'car', 'plane_short', 'plane_long', 'coach'] as const).map((m) => <td key={m}><input type="number" aria-label={`${o.label} ${m} share`} min={0} max={100} step={1} disabled={locked} value={+(o.modes[m] * 100).toFixed(2)} onChange={(e) => { const v = Number(e.target.value) / 100; if (v >= 0 && v <= 1) set(`guestTravel.origins.${i}.modes.${m}`, v); }} /></td>)}
                  <td className="num" style={{ color: Math.abs(total - 1) > 0.01 ? 'var(--error)' : undefined }}>{num(total * 100)} %</td></tr>
              );
            })}</tbody>
          </table>
        </div>
        <div className="fields" style={{ marginTop: 10 }}>
          <NumField path="guestTravel.carOccupancy" /><NumField path="guestTravel.evShareOfCars" /><Toggle path="guestTravel.roundTrip" label="Count round trips" />
          <NumField path="guestTravel.multipurposeTripShare" /><NumField path="guestTravel.lastLegCoveredByHotelShuttle" label="Arrivals using the hotel's own shuttle" percent /><NumField path="guestTravel.lastLegKm" label="Shuttle leg length" unit="km" />
          <NumField path="guestTravel.excursionsKmPerStay" label="Excursions & local transport" unit="vehicle-km per stay" />
        </div>
        <div style={{ marginTop: 10 }}><BarList items={gt.map((l) => ({ label: l.label.replace('Guest travel ', ''), value: l.kg }))} unit={tco2e} /></div>
      </Card>
      <div className="grid grid-2">
        <Section title="Staff commuting (Scope 3 cat. 7)" open={adv}>
          <div className="fields">
            <NumField path="commuting.oneWayKm" /><NumField path="commuting.onSiteDaysPerFTE" label="On-site days per FTE" unit="days/yr" max={366} /><NumField path="commuting.remoteWorkShare" label="Remote work" percent />
            <NumField path="commuting.carOccupancy" label="Car occupancy" unit="persons" step={0.1} min={1} max={9} />
            {(['car', 'car_ev', 'train', 'bus', 'bike_walk', 'employer_shuttle'] as const).map((m) => <NumField key={m} path={`commuting.modes.${m}`} label={`Mode share — ${m.replace('_', ' ')}`} percent />)}
            <Toggle path="commuting.shuttleCoveredByFleet" label="Employer shuttle is in the hotel fleet (avoid double count)" />
          </div>
        </Section>
        <Section title="Business travel (Scope 3 cat. 6)" open={adv}>
          <div className="fields">
            <NumField path="businessTravel.trainPkm" label="Rail" unit="passenger-km" /><NumField path="businessTravel.shortFlightPkm" label="Short-haul flights" unit="passenger-km" />
            <NumField path="businessTravel.longFlightPkm" label="Long-haul flights" unit="passenger-km" /><NumField path="businessTravel.carKm" label="Car, rental & taxi" unit="km" />
            <NumField path="businessTravel.hotelNightsElsewhere" label="Hotel nights elsewhere" unit="nights" />
          </div>
        </Section>
      </div>
      <Card title="Supplier logistics (Scope 3 cat. 4)">
        <EditTable path="deliveries" caption="Delivery flows" columns={[
          { key: 'supplier', label: 'Supplier', type: 'text', width: 160 }, { key: 'productGroup', label: 'Products', type: 'text' }, { key: 'deliveriesPerYear', label: 'Deliveries/yr' }, { key: 'kgPerDelivery', label: 'kg/delivery' },
          { key: 'method', label: 'Method', type: 'select', options: [{ value: 'tonne_km', label: 'Tonne-km legs' }, { value: 'dedicated_vehicle', label: 'Dedicated vehicle trips' }] },
          { key: 'dedicatedRoundTripKm', label: 'Trip km (dedicated)' }, { key: 'routeAllocationShare', label: 'Route share %', type: 'percent' }, { key: 'refrigerated', label: 'Cold chain', type: 'bool' }, { key: 'refrigerationUplift', label: 'Cold-chain uplift %', type: 'percent' },
          { key: 'includedInProductFactor', label: 'Freight in product factor', type: 'bool' }, { key: 'costPerDeliveryEUR', label: '€/delivery' },
        ]} newRow={() => ({ id: `d-${Date.now()}`, supplier: 'New supplier', productGroup: '', deliveriesPerYear: 12, kgPerDelivery: 100, method: 'tonne_km', legs: [{ mode: 'road_truck', km: 100 }], dedicatedRoundTripKm: 0, dedicatedVehicleFactorId: 'van_diesel_vkm', routeAllocationShare: 1, refrigerated: false, refrigerationUplift: 0, includedInProductFactor: false, costPerDeliveryEUR: 0 })} />
        <h4 style={{ marginTop: 10 }}>Transport legs (tonne-km method) — format <code>mode:km; mode:km</code></h4>
        <div className="fields">
          {inputs.deliveries.map((d, i) => <LegsField key={d.id} label={`${d.supplier} — legs`} value={legsToText(d.legs)} disabled={locked || d.method !== 'tonne_km'} onCommit={(legs) => set(`deliveries.${i}.legs`, legs)} />)}
        </div>
        <p className="muted" style={{ fontSize: '.78rem' }}>Modes: {MODES.join(', ')}. Delivery frequency matters for dedicated-vehicle trips (vehicle-km), not for tonne-km legs (same mass moved). Freight already embedded in a product factor is suppressed and listed in Data quality.</p>
      </Card>
    </div>
  );
}

function LegsField({ label, value, disabled, onCommit }: { label: string; value: string; disabled: boolean; onCommit: (l: TransportLeg[]) => void }) {
  return (
    <div className="field">
      <label>{label}</label>
      <input type="text" defaultValue={value} disabled={disabled} key={value} onBlur={(e) => { const l = parseLegs(e.target.value); if (l) onCommit(l); else e.target.value = value; }} aria-label={label} />
    </div>
  );
}

export function RefrigerantsWasteAssetsTab({ res, adv }: { res: PropertyResults; adv: boolean }) {
  const lib = useStore((s) => s.data.library);
  const gases = Object.keys(lib.gwp).filter((g) => g.startsWith('R-')).map((g) => ({ value: g, label: `${g}` }));
  const wasteFactors = Object.values(lib.factors).filter((f) => f.id.startsWith('waste_')).map((f) => ({ value: f.id, label: f.name }));
  const spend = Object.values(lib.factors).filter((f) => f.id.startsWith('spend_')).map((f) => ({ value: f.id, label: f.name }));
  return (
    <div className="stack">
      <Card title="Refrigerant equipment register (Scope 1)">
        <EditTable path="refrigerants" caption="Refrigerant equipment" columns={[
          { key: 'name', label: 'Equipment', type: 'text', width: 170 }, { key: 'refrigerant', label: 'Refrigerant', type: 'select', options: gases }, { key: 'chargeKg', label: 'Charge kg', step: 0.1 },
          { key: 'measuredTopUpKg', label: 'Measured top-ups kg (mass balance)', nullable: true, step: 0.1 }, { key: 'annualLeakRate', label: 'Default leak %/yr (if no top-ups)', type: 'percent' },
          { key: 'retiredThisYear', label: 'Retired this year', type: 'bool' }, { key: 'recoveryEfficiency', label: 'Recovery at retirement %', type: 'percent' }, { key: 'serviceCostEURPerYear', label: 'Service €/yr' },
        ]} newRow={() => ({ id: `r-${Date.now()}`, name: 'New equipment', refrigerant: 'R-32', chargeKg: 5, annualLeakRate: 0.05, measuredTopUpKg: null, retiredThisYear: false, recoveryEfficiency: 0.9, serviceCostEURPerYear: 0 })} />
        <p className="muted" style={{ fontSize: '.78rem' }}>When top-ups are recorded, they replace the default leak estimate for that unit — never both. GWP set: {useStore.getState().data.settings.gwpSet} (Settings).</p>
        <div className="fields"><NumField path="fireSuppressionReleaseKg" label="Fire-suppression gas released" unit="kg" step={0.1} /><SelectField path="fireSuppressionAgent" label="Agent" options={[{ value: 'HFC-227ea', label: 'HFC-227ea' }, { value: 'R-744', label: 'CO2 (R-744)' }]} /></div>
      </Card>
      <Card title="Waste register (Scope 3 cat. 5 — treatment only, no recycling credits)">
        <EditTable path="waste" caption="Waste streams" columns={[
          { key: 'name', label: 'Stream', type: 'text', width: 170 }, { key: 'kgPerYear', label: 'kg/yr', nullable: true }, { key: 'kgPerGuestNight', label: 'or kg/guest-night', nullable: true, step: 0.01 },
          { key: 'measurement', label: 'Measurement', type: 'select', options: [{ value: 'weighed', label: 'Weighed' }, { value: 'volume_estimate', label: 'Volume estimate' }, { value: 'benchmark', label: 'Benchmark' }, { value: 'missing', label: 'Missing' }] },
          { key: 'factorId', label: 'Treatment factor', type: 'select', options: wasteFactors }, { key: 'feePerTonneEUR', label: '€/t' }, { key: 'liftsPerYear', label: 'Lifts/yr' }, { key: 'feePerLiftEUR', label: '€/lift' },
          { key: 'linkedToFoodModule', label: 'From F&B mass balance', type: 'bool' },
        ]} newRow={() => ({ id: `w-${Date.now()}`, name: 'New stream', kgPerYear: null, kgPerGuestNight: null, measurement: 'missing', treatment: 'incineration_energy_recovery', factorId: 'waste_residual_incineration', feePerTonneEUR: 0, liftsPerYear: 0, feePerLiftEUR: 0, linkedToFoodModule: false })} />
        <div style={{ marginTop: 8 }}><BarList items={Object.entries(res.scenario.wasteKg).map(([k, v]) => ({ label: k, value: v }))} unit={(v) => `${num(v / 1000)} t`} /></div>
        <p className="muted" style={{ fontSize: '.78rem' }}>Avoided-emission estimates for recycling are not included in the inventory (cut-off approach).</p>
      </Card>
      <Card title="Capital goods register">
        <EditTable path="assets" caption="Capital assets" columns={[
          { key: 'name', label: 'Asset', type: 'text', width: 180 }, { key: 'category', label: 'Category', type: 'text' }, { key: 'quantity', label: 'Qty' }, { key: 'unitEmbodiedKg', label: 'kgCO2e/unit', nullable: true },
          { key: 'unitCostEUR', label: '€/unit' }, { key: 'acquisitionYear', label: 'Acquired', min: 1900, max: 2100 }, { key: 'usefulLifeYears', label: 'Useful life yr', min: 1 }, { key: 'embodiedSource', label: 'Embodied source', type: 'text' },
        ]} newRow={() => ({ id: `as-${Date.now()}`, name: 'New asset', category: 'Furniture', quantity: 1, unitEmbodiedKg: null, unitCostEUR: 0, acquisitionYear: 2025, usefulLifeYears: 10, embodiedSource: '' })} />
        <p className="muted" style={{ fontSize: '.78rem' }}>Corporate inventory: cradle-to-gate emissions recognised in the acquisition year (cat. 2). The annualised indicator (embodied ÷ useful life) appears only in the life-cycle view. Lengthening useful life changes future replacement and the annualised indicator — never the historical emissions of assets already owned.</p>
      </Card>
      <Section title="Other purchased services (spend-based fallback)" open={adv}>
        <EditTable path="services" caption="Purchased services" columns={[
          { key: 'name', label: 'Service', type: 'text', width: 180 }, { key: 'spendEUR', label: 'Spend € (ex VAT)' }, { key: 'spendYear', label: 'Spend year', min: 2000, max: 2100 },
          { key: 'factorId', label: 'Spend factor', type: 'select', options: spend }, { key: 'physicallyModelledElsewhere', label: 'Already modelled physically', type: 'bool' },
        ]} newRow={() => ({ id: `s-${Date.now()}`, name: 'New service', spendEUR: 0, spendYear: 2025, factorId: 'spend_services_generic', physicallyModelledElsewhere: false })} />
        <p className="muted" style={{ fontSize: '.78rem' }}>Spend is converted to the factor's price year with French CPI (recalled approximations — verify with INSEE). Never used to estimate the whole hotel.</p>
      </Section>
    </div>
  );
}
