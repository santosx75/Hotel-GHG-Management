# Hotel Carbon Lab

Greenhouse-gas accounting and operational scenario simulation for French hotels. It is a working, local-first web application with three fictional demonstration properties, a shared, pure TypeScript calculation engine, and transparent, replaceable reference data.

> **Status:** decision-support prototype (model v0.1.0). It is **not** certified, audited or verified against any standard. All three hotels are fictional. Many reference values are demonstration placeholders or were read from secondary sources without the primary document being opened (see *Data library → Unresolved data*). Results are estimates.

## Quick start

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # 42 engine/accounting unit tests (Vitest)
npm run build        # type-check + production build into dist/
npm run preview      # serve dist/ on http://localhost:4173
node tests/e2e/run-e2e.mjs   # browser checks against the preview server (Playwright + axe-core)
```

Routes: `/city-hotel`, `/island-resort`, `/independent-bnb`, `/compare`, `/scenarios`, `/data-library`, `/methodology`, `/settings`, `/report/:propertyId`.

Data are stored only in the browser (localStorage). There is no server, authentication or live data feed.

## Architecture

```
src/
  types/            domain types (inputs, factors, prices, results)
  data/             source register, emission factors, prices, climate, GWP, parameter registry, seeds/
  engine/           pure deterministic calculation (no UI, no I/O)
    activity, building (degree-day balance), heat (boilers/heat pumps), water (+DHW, pools, spa, irrigation),
    lighting (Weibull replacement, strategy comparator), laundry (textile flows, in-house/outsourced),
    housekeeping (+amenities break-even), food, mobility (fleet, commuting, business & guest travel, logistics),
    other (refrigerants, waste, assets, spend-based services, generator, septic CH4, guest EV charging),
    supply (calibration to bills, B&B allocation, PV/battery, Scope 2 LB/MB, energy & water costs),
    accounting (totals, views, Scope 3 matrix), finance (multi-year NPV/IRR/payback/MAC), sensitivity (tornado, Monte Carlo)
  scenarios/        intervention presets, isolated evaluation, greedy package heuristic
  state/            pure state model (baseline, scenarios, undo/redo, audit trail) + Zustand store
  lib/              CSV importer (unit conversion, validation), exports, formatting
  components/, pages/  React UI (Recharts, accessible fields/tables/drawers)
tests/unit          Vitest suites (all 28 required tests + integrity/invariant tests)
tests/e2e           Playwright script: routes × widths, scenario flows, CSV import, Monte Carlo worker, axe scans
```

Every result is a list of `CalcLine`s carrying activity ID, factor ID/version, scope/category, analytical views, life-cycle stages, data status, formula and inputs. Totals, charts and breakdowns are aggregations of these lines, so they reconcile by construction.

## Analytical views (overlapping, never added together)

1. **Corporate inventory**: Scope 1, Scope 2 (location-based; market-based only if a contractual/residual factor is entered), and the assessed Scope 3 categories. Capital goods are counted in their acquisition year.
2. **HCMI-aligned (partial)**: Scope 1, Scope 2 location-based and outsourced laundry, with a floor-area split between rooms and meeting space. This is *not* an HCMI calculation.
3. **Extended visitor impact**: hotel operations plus guest travel and excursions.
4. **Life-cycle decision view**: operations including upstream emissions, plus annualised embodied emissions.

## Extending the data

- **Emission factors:** use Data library → Emission factors. You can edit a factor (each edit creates a new version, with an impact preview and a change log), pin a version, or import from CSV using the adapter format `factor_id,value,unit`. Licensed datasets (Base Empreinte, AGRIBALYSE, INIES) are not bundled. Authorised users can load extracts with the adapter.
- **Prices:** library records are references only. Each property's contract prices are entered on its *Energy & water supply* tab, and library updates never overwrite them.
- **Measured data:** enter monthly bills or import a CSV (column mapping, units, date formats, decimal separators, validation preview and duplicate detection). Measured mode scales the bottom-up end uses to the bills and shows the calibration residual.
- **New interventions:** add a `Preset` in `src/scenarios/presets.ts` (a pure function of the inputs).

## What is verified

- **Unit tests:** 42 passing, covering the 28 required mathematical/accounting tests plus checks on refrigerant mass balance, Weibull group replacement, biogenic CO2, GOs, Corsica revalidation, B&B allocation, calibration, finance edge cases, multi-year refrigerant retirement, decision categories and a randomised invariant test.
- **Browser checks:** 117 passing (`tests/e2e/run-e2e.mjs`):
  - 9 routes at 360/390/768/1024/1440 px, with no page-wide horizontal overflow and no console errors;
  - every property tab at 360 px;
  - scenario flows: edit, undo, presets, explain drawer, persistence, no cross-property leakage, towel constraint, finance, decision evaluation, Monte Carlo in a Web Worker, CSV import, keyboard tab navigation;
  - axe-core WCAG A/AA scans with no serious or critical violations;
  - rendering with reduced motion.

## Limitations

Read the full register in the app (*Methodology*). Key points:

- **Time resolution:** monthly only. Building physics is a degree-day heat balance, with no thermal mass, latent loads or simultaneous heating and cooling. PV uses a simultaneity share instead of hourly profiles.
- **Reference data:** food, textile, amenity, lamp, asset, transport (partly), waste, water and spend factors are demonstration or recalled values. Hotel energy prices are demonstration contract values. Climate data are approximations.
- **HCMI:** the official HCMI methodology/workbook was not accessed.
- **Not implemented:** GHG Protocol Scope 2 revision proposals (still under consultation), live data integrations, PDF export (use print → "Save as PDF"), server storage, grants, and hourly tariffs.
- **Optimisation:** a greedy heuristic package builder only. It is explicitly not optimal.
