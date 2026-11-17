import { Badge, Card, Notice } from '../components/ui';
import { BENCHMARK_MATRIX, RESEARCH_DATE } from '../data/sources';
import { MODEL_VERSION } from '../engine';

export const UNRESOLVED: [string, string, string, string][] = [
  ['ADEME Base Empreinte exact factor values & IDs', 'Database not opened (network policy); licence terms vary by dataset (Etalab vs ecoinvent).', 'Electricity 52 g/kWh life-cycle as reported; other factors recalled or demonstration.', 'Authorised user exports the needed elements and loads them with the factor CSV adapter.'],
  ['Scope 2 split (generation vs upstream) for French electricity', 'Derived from two sources with different vintages.', 'Generation 19.6 g (Scope 2), remainder 32.4 g (cat. 3).', 'Use Base Empreinte combustion/upstream decomposition for the same vintage.'],
  ['Market-based Scope 2 factors (supplier, residual mix)', 'Not researched; depend on contracts and AIB residual mix publication.', 'Market-based shown as "not available" unless entered.', 'Enter supplier disclosure or AIB French residual mix for the reporting year.'],
  ['Natural-gas combustion/upstream split', 'Combustion value recalled; total from secondary source.', 'Derived split, flagged.', 'Base Empreinte "gaz naturel" combustion & amont, PCS basis.'],
  ['Food factors (AGRIBALYSE v3.2)', 'Item-level values not downloaded.', 'Order-of-magnitude demonstration values per category.', 'Import AGRIBALYSE synthesis values per ingredient (Etalab licence, credit ADEME).'],
  ['Textile, amenity, lamp, asset embodied emissions', 'Product-specific EPD/PCF not available; INIES not accessed.', 'Demonstration values; mass-proportional scaling disclosed.', 'Supplier PCF/EPD, INIES FDES for building products.'],
  ['Commercial electricity & gas prices for hotels', 'No public hotel contract prices; CRE pages blocked.', 'Demonstration contract values; TRVE/PRVG residential references labelled.', 'Enter actual contract/tariff sheet.'],
  ['Paris water tariff split (potable vs sanitation)', 'Only a combined 2026 figure (4.23 €/m³ TTC) seen; values conflict.', 'Demonstration split of the combined HT price.', 'Eau de Paris 2026 tariff catalogue for non-domestic customers.'],
  ['Belle-Île 2026 water tariff', 'Only 2024 SISPEA values found.', 'Older observed price (2024).', 'Eau du Morbihan 2026 deliberation / RPQS.'],
  ['Dordogne commune utilities & INSEE code', 'Local syndicate tariff not researched; INSEE code not verified.', 'Demonstration values; INSEE "not verified".', 'Commune and syndicate documentation.'],
  ['Climate normals, degree-days, PV yields', 'Météo-France / PVGIS not downloaded.', 'Demonstration approximations.', 'Météo-France DJU and normals; PVGIS for yields.'],
  ['Ferry distance & emission factor (Quiberon–Le Palais)', 'Distance not found; operator data not available.', '15 km and demonstration factor.', 'Operator fuel data / route distance.'],
  ['Laundry supplier factor and boundary', 'Fictional supplier.', 'Demonstration 0.6 kgCO2e/kg incl. transport.', 'Request supplier declaration with explicit boundary.'],
  ['HCMI v2.0 exact allocation rules', 'Official methodology/workbook not accessed.', '"HCMI-aligned (partial)" view, clearly labelled.', 'Verify against official HCMI documentation before any HCMI claim.'],
  ['GWP AR5 values and EU F-gas reference values', 'AR5 recalled; F-gas regulation values not checked.', 'AR6 default (secondary references).', 'IPCC AR6 WG1 Table 7.SM.7 and Regulation (EU) 2024/573 annexes.'],
  ['French CPI index for spend deflation', 'INSEE series not downloaded.', 'Recalled approximate annual indices.', 'INSEE CPI annual averages.'],
  ['Grants & subsidies (CEE, Fonds Chaleur, etc.)', 'Eligibility not verified.', 'Not modelled.', 'Verify eligibility before adding as cash flows.'],
];

const STATUS: [string, 'implemented' | 'approximate' | 'not implemented', string][] = [
  ['Activity metrics (room-nights, guest-nights, stays, arrivals)', 'implemented', 'Steady-state stays for non-integer length of stay.'],
  ['Building heating/cooling', 'approximate', 'Monthly degree-day balance with gains; no thermal mass, latent loads or simultaneous heating/cooling.'],
  ['Heat pumps (seasonal or temperature-dependent COP)', 'approximate', 'Carnot-fraction model on monthly mean temperature; backup & defrost as shares.'],
  ['Domestic hot water incl. losses & Legionella constraints', 'implemented', 'Thermal energy on mixed volume; storage & loop losses; safety warnings.'],
  ['Water end uses, wastewater billing basis, rainwater', 'implemented', 'Rainwater substitutes irrigation/toilets proportionally.'],
  ['Pools (evaporation, covers, make-up, dehumidification)', 'approximate', 'Evaporation rates are inputs; outdoor solar gains not modelled.'],
  ['Lighting incl. Weibull replacement & strategy comparator', 'implemented', 'Long-run renewal approximation.'],
  ['Textiles & laundry (in-house/outsourced/hybrid)', 'implemented', 'Mass-proportional textile factors disclosed.'],
  ['Housekeeping & amenities incl. refill break-even', 'implemented', ''],
  ['Food & beverage incl. waste mass balance', 'implemented', 'Category baskets, not ingredient recipes.'],
  ['Fleet incl. replacement timing & EV charging', 'implemented', ''],
  ['Staff commuting, business travel', 'implemented', ''],
  ['Guest travel (visitor view) incl. non-CO2 convention', 'implemented', 'Great-circle/route distance not computed; distances are inputs.'],
  ['Supplier logistics (t·km, dedicated trips, ferry legs)', 'implemented', 'Empty running embedded in factors.'],
  ['Refrigerants (mass balance or leak rate)', 'implemented', ''],
  ['Waste (treatment only)', 'implemented', 'Cut-off; no avoided-emission credits.'],
  ['Capital goods (acquisition year vs annualised)', 'implemented', ''],
  ['Spend-based services with CPI deflation', 'implemented', 'CPI values recalled.'],
  ['Solar PV & battery', 'approximate', 'Monthly balance with simultaneity share; no hourly profile.'],
  ['Measured-bill calibration (monthly)', 'implemented', 'Multiplicative scaling per month & carrier.'],
  ['Finance (NPV, IRR, payback, MAC, carbon break-even)', 'implemented', 'Real framework; no financing/grants.'],
  ['Sensitivity (tornado) & Monte Carlo', 'implemented', 'Triangular illustrative ranges; not confidence intervals.'],
  ['Optimisation', 'approximate', 'Greedy heuristic only — explicitly not optimal.'],
  ['Hourly time-of-use pricing / demand charges', 'not implemented', 'Peak/off-peak share only.'],
  ['Live data refresh from external APIs', 'not implemented', 'No integrations are connected; all data are local.'],
  ['PDF export', 'not implemented', 'Use the print-friendly report (browser “Save as PDF”).'],
  ['Server storage / multi-user', 'not implemented', 'Browser local storage only.'],
];

export default function MethodologyPage() {
  return (
    <div className="stack">
      <h1>Methodology</h1>
      <Notice kind="warn">Hotel Carbon Lab is a decision-support model (version {MODEL_VERSION}). It is <strong>not certified, audited or verified</strong> against any standard, and its results are estimates whose quality depends on the inputs. The three hotels are fictional demonstration properties.</Notice>
      <Card title="Research log">
        <p>Research date: <strong>{RESEARCH_DATE}</strong>. Web search was available; direct retrieval of most primary documents (e.g. cre.fr, sustainablehospitalityalliance.org) was blocked by the build environment's network policy. Values taken from search-result summaries are labelled <Badge status="secondary_report" />. Prior-knowledge values are labelled <Badge status="recalled_unverified" />; illustrative placeholders <Badge status="demonstration" />.</p>
        <ul>
          <li><strong>GHG Protocol Scope 2</strong>: 2015 guidance in force. A revision is in progress (consultation 20 Oct 2025 – 31 Jan 2026; feedback summary 29 Jul 2026; market-based method update 6 Oct 2026). Consultation proposals (e.g. hourly matching) are <em>not</em> implemented.</li>
          <li><strong>HCMI</strong>: v2.0 (Oct 2022) is the latest published version per search results; a v3.0 draft was under public consultation in 2026 — not implemented.</li>
          <li><strong>ADEME Base Empreinte</strong>: French electricity 2024 average consumption mix ≈52 gCO2e/kWh life-cycle (as reported, element 43642). Licence: Base Carbone data under Licence Ouverte; ecoinvent-based data under separate terms.</li>
          <li><strong>AGRIBALYSE 3.2</strong> (Nov 2024, Etalab licence) — structure supported; item values not bundled.</li>
          <li><strong>CRE</strong>: TRVE movement 1 Feb 2026 (deliberation 2026-06; CTA 15 %); PRVG gas reference Nov 2026 194.90 €/MWh TTC (residential). A 150-room hotel is not TRVE-eligible.</li>
          <li><strong>PV purchase obligation</strong>: single 1.1 c€/kWh tariff ≤100 kWc for requests from 5 Jun 2026 (as reported).</li>
          <li><strong>Belle-Île</strong>: submarine-cable connection (mainland mix applies); 2005 water shortage and 2006 desalination module (current operation unknown); Eau du Morbihan 2024 prices.</li>
          <li><strong>Regulation</strong>: Legionella order (1 Feb 2010) temperatures; chambres d'hôtes ≤5 rooms / 15 persons (Code du tourisme D.324-13).</li>
        </ul>
      </Card>
      <Card title="Accounting boundaries and views">
        <ul>
          <li><strong>Corporate inventory</strong> (GHG Protocol Corporate Standard, operational control by default): Scope 1, Scope 2 (location-based and, where a factor exists, market-based — alternatives, never added), Scope 3 categories calculated or screened. Capital goods in acquisition year (cat. 2).</li>
          <li><strong>HCMI-aligned (partial)</strong>: Scope 1 + Scope 2 location-based + outsourced laundry; meeting share by floor area; per occupied room and per m²·h meeting space. Not an HCMI calculation.</li>
          <li><strong>Extended visitor impact</strong>: hotel operations + guest travel + excursions (independent travel never forced into Scope 3).</li>
          <li><strong>Life-cycle decision view</strong>: operations incl. upstream energy + annualised embodied emissions of assets in service.</li>
          <li><strong>Outside all totals</strong>: biogenic CO2 (reported separately), aviation non-CO2 under the "separate" convention.</li>
        </ul>
      </Card>
      <Card title="Core formulas (canonical units)">
        <ul style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '.82rem' }}>
          <li>occupied room-nights = Σ types, months [rooms × open days × (1 − OOO) × occupancy]</li>
          <li>guest-nights = occupied room-nights × guests per occupied room</li>
          <li>stays = occupied room-nights ÷ length of stay; arriving guests = guest-nights ÷ length of stay</li>
          <li>lighting kWh = luminaires × (lamps × W + driver) × h × days × (1 − controls) ÷ 1000</li>
          <li>textile kg = (L/100)(W/100)(GSM/1000) — measured mass preferred</li>
          <li>hot-water kWh = litres(mixed) × 4.186 × (T_use − T_cold) ÷ 3600</li>
          <li>boiler fuel = thermal ÷ seasonal efficiency; heat-pump kWh = thermal ÷ COP</li>
          <li>HDD = days × σ × [zΦ(z) + φ(z)], z = (T_balance − T_mean)/σ; T_balance = T_set − gains/H</li>
          <li>pool heat = evaporation × 0.68 + U·A·ΔT·h + make-up × 4.186 × ΔT ÷ 3600</li>
          <li>refrigerant kgCO2e = (measured top-ups or charge × leak rate) + retirement losses) × GWP</li>
          <li>transport: vehicle-km × kg/vkm ÷ occupancy, or passenger-km × kg/pkm (occupancy embedded), or tonne-km × kg/tkm</li>
          <li>spend-based = spend × CPI(factor year)/CPI(spend year) × kg/€</li>
          <li>NPV = Σ (Δopex − capex + residual)/(1 + r_real)^t; MAC = −NPV ÷ cumulative abatement (only if abatement &gt; 0)</li>
        </ul>
      </Card>
      <Card title="Double-counting controls">
        <ul>
          <li>Each line carries activity ID, factor ID/version, scope/category, views and life-cycle stages; suppressed overlaps are listed in Data quality.</li>
          <li>Outsourced laundry factor that includes transport → collection transport not added. Product factors including freight → delivery legs suppressed.</li>
          <li>EV charging on site appears once in electricity (Scope 2); hotel shuttle legs excluded from guest travel; guest EV charging excluded from the visitor view (already in EV travel factor).</li>
          <li>Measured top-ups replace default leak rates. Food-waste lines carry treatment only. Spend-based lines skipped when the service is modelled physically. Weighed residual waste absorbs modelled packaging.</li>
          <li>In measured mode, end uses are scaled to bills — never added on top.</li>
        </ul>
      </Card>
      <Card title="Benchmark of existing tools (features as reported, not hands-on)">
        <div className="table-wrap" tabIndex={0} role="region" aria-label="Scrollable table"><table><thead><tr><th>Tool</th><th>User</th><th>Inputs</th><th>Outputs</th><th>Boundary</th><th>Strengths</th><th>Limitations</th><th>Idea adapted</th><th>Verification</th></tr></thead>
          <tbody>{BENCHMARK_MATRIX.map((b) => <tr key={b.tool}><td>{b.tool}</td><td>{b.user}</td><td>{b.inputs}</td><td>{b.outputs}</td><td>{b.boundary}</td><td>{b.strengths}</td><td>{b.limitations}</td><td>{b.idea}</td><td>{b.verified}</td></tr>)}</tbody></table></div>
      </Card>
      <Card title="Implementation status (implemented / approximate / not implemented)">
        <div className="table-wrap" tabIndex={0} role="region" aria-label="Scrollable table"><table><thead><tr><th>Module</th><th>Status</th><th>Notes</th></tr></thead>
          <tbody>{STATUS.map((s) => <tr key={s[0]}><td>{s[0]}</td><td><Badge status={s[1] === 'implemented' ? 'measured' : s[1] === 'approximate' ? 'estimated' : 'missing'}>{s[1]}</Badge></td><td>{s[2]}</td></tr>)}</tbody></table></div>
      </Card>
      <Card title="Assumptions & limitations register">
        <ul>
          <li>All three properties, their operations and their suppliers are fictional; seeded values are demonstration assumptions unless a source is shown.</li>
          <li>Monthly resolution only. Solar self-consumption uses a simultaneity share, not hourly profiles.</li>
          <li>Textile, amenity and lamp footprints scale with mass/units using demonstration factors; real products differ.</li>
          <li>Building physics simplified (see status table). Comfort, ventilation, humidity and freeze checks are rule-based warnings, not simulations.</li>
          <li>Recommendations are produced by the model for the property; no universal savings claims. Low-temperature laundry and any hot-water change require hygiene validation.</li>
          <li>Prices exclude VAT unless “VAT not recoverable” is selected. Labour costs are excluded unless enabled.</li>
          <li>Uncertainty ranges are illustrative scenario ranges, not statistical confidence intervals.</li>
        </ul>
      </Card>
      <Card title="Unresolved-data register">
        <div className="table-wrap" tabIndex={0} role="region" aria-label="Scrollable table"><table><thead><tr><th>Item</th><th>Why</th><th>Current treatment</th><th>Resolution</th></tr></thead><tbody>{UNRESOLVED.map((u) => <tr key={u[0]}>{u.map((c, i) => <td key={i}>{c}</td>)}</tr>)}</tbody></table></div>
      </Card>
    </div>
  );
}
