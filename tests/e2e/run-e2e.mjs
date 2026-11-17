// End-to-end, responsive and accessibility checks using the pre-installed Playwright + axe-core.
// Usage: npm run build && (npx vite preview --port 4173 &) && node tests/e2e/run-e2e.mjs
import { createRequire } from 'module';
import { readFileSync, mkdirSync } from 'fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const BASE = process.env.BASE_URL ?? 'http://localhost:4173';
const axeSrc = readFileSync(new URL('../../node_modules/axe-core/axe.min.js', import.meta.url), 'utf8');
const shots = new URL('./screenshots/', import.meta.url).pathname;
mkdirSync(shots, { recursive: true });
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`); };

const browser = await chromium.launch();
const ROUTES = ['/city-hotel', '/island-resort', '/independent-bnb', '/compare', '/scenarios', '/data-library', '/methodology', '/settings', '/report/city-hotel'];
const WIDTHS = [360, 390, 768, 1024, 1440];

// 1. Every route renders without console errors, at every width, without page-wide horizontal overflow
for (const w of WIDTHS) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  for (const r of ROUTES) {
    await page.goto(BASE + r, { waitUntil: 'networkidle' });
    await page.waitForSelector('h1', { timeout: 10000 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check(`route ${r} @${w}px: no horizontal overflow`, overflow <= 1, `overflow ${overflow}px`);
    if (w === 390 || w === 1440) await page.screenshot({ path: `${shots}${r.replace(/\//g, '_')}_${w}.png`, fullPage: false });
  }
  check(`no console errors @${w}px`, errors.length === 0, errors.slice(0, 3).join(' | '));
  await ctx.close();
}

// 1b. Every property tab at phone width keeps overflow local (tables scroll inside their container)
for (const prop of ['/city-hotel', '/island-resort', '/independent-bnb']) {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 800 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(BASE + prop, { waitUntil: 'networkidle' });
  const tabs = await page.getByRole('tab').allInnerTexts();
  for (const t of tabs) {
    await page.getByRole('tab', { name: t, exact: true }).click();
    await page.waitForTimeout(250);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check(`${prop} tab "${t}" @360px: no page-wide overflow`, overflow <= 1, `overflow ${overflow}px`);
    if (prop === '/city-hotel' && ['Linen & laundry', 'Finance & decisions', 'Lighting'].includes(t)) await page.screenshot({ path: `${shots}city_${t.replace(/\W+/g, '_')}_360.png` });
  }
  check(`${prop}: no runtime errors across tabs`, errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// 2. Functional scenario flow on the city hotel
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/city-hotel', { waitUntil: 'networkidle' });
  const summary = async () => (await page.locator('.summary-bar').innerText()).replace(/\s+/g, ' ');
  const before = await summary();
  check('summary shows no delta initially', /vs baseline: ±0/.test(before), before);
  await page.getByRole('tab', { name: 'Water & hot water' }).click();
  const flow = page.getByLabel(/^Shower flow rate/).first();
  await flow.fill('7');
  await page.waitForTimeout(600);
  const after = await summary();
  check('editing shower flow changes scenario vs baseline', /vs baseline: −/.test(after), after);
  check('water saving shown', /Water: −/.test(after), after);
  // baseline unchanged: Overview "What changed" lists the parameter
  await page.getByRole('tab', { name: 'Overview' }).click();
  const wc = await page.locator('text=Inputs changed').first().isVisible();
  check('What-changed panel lists changed inputs', wc);
  // undo restores
  await page.getByRole('button', { name: /Undo/ }).click();
  await page.waitForTimeout(500);
  check('undo restores baseline values', /vs baseline: ±0/.test(await summary()), await summary());
  // apply LED preset via quick start
  await page.getByRole('button', { name: /Replace lighting/ }).click();
  await page.waitForTimeout(600);
  const led = await summary();
  check('LED preset adds CAPEX and changes emissions', /CAPEX: €/.test(led) && !/vs baseline: ±0/.test(led), led);
  // explain drawer
  await page.getByRole('button', { name: 'Explain Scope 1' }).click();
  const drawer = page.getByRole('dialog');
  await drawer.locator('summary').first().click();
  check('Explain drawer opens with formula, factor and source', await drawer.locator('dt:has-text("Formula")').first().isVisible().catch(() => false) && await drawer.locator('dt:has-text("Source")').first().isVisible().catch(() => false));
  await page.keyboard.press('Escape');
  // switching hotels does not leak
  await page.goto(BASE + '/island-resort', { waitUntil: 'networkidle' });
  check('island resort unaffected by city edits', /vs baseline: ±0/.test(await summary()), await summary());
  // persistence across reload
  await page.goto(BASE + '/city-hotel', { waitUntil: 'networkidle' });
  check('scenario persisted after reload', /CAPEX: €/.test(await summary()), await summary());
  // towel length → laundry
  await page.getByRole('tab', { name: 'Linen & laundry' }).click();
  const lenInput = page.getByLabel('Length cm — Bath towel', { exact: true });
  await lenInput.fill('120');
  await page.waitForTimeout(700);
  const warn = await page.locator('text=below the minimum service standard').count();
  await page.getByRole('tab', { name: 'Overview' }).click();
  const warnOv = await page.locator('text=Bath towel: length 120 cm').count();
  check('shorter towel triggers service-standard warning', warnOv > 0 || warn > 0);
  // finance tab renders multi-year KPIs
  await page.getByRole('tab', { name: 'Finance & decisions' }).click();
  await page.waitForTimeout(1500);
  check('finance NPV computed', await page.locator('text=NPV (').first().isVisible());
  await page.getByRole('button', { name: 'Evaluate against baseline' }).click();
  await page.waitForTimeout(2500);
  check('decision table rendered', await page.locator('text=Heuristic package').first().isVisible());
  await page.getByRole('button', { name: /Run Monte Carlo/ }).click();
  await page.waitForSelector('text=Modelled uncertainty range', { timeout: 60000 }).catch(() => null);
  check('Monte Carlo in web worker completes', await page.locator('text=Modelled uncertainty range').first().isVisible().catch(() => false));
  await page.screenshot({ path: `${shots}finance_1440.png`, fullPage: false });
  // CSV import flow
  await page.getByRole('tab', { name: 'Energy & water supply' }).click();
  await page.getByRole('button', { name: 'Load example format' }).click();
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: /Import 2 valid row/ }).click();
  await page.waitForTimeout(500);
  check('CSV import applies measured bills', await page.locator('text=row(s) imported').first().isVisible());
  // keyboard navigation of tabs
  await page.getByRole('tab', { name: 'Energy & water supply' }).focus();
  await page.keyboard.press('ArrowRight');
  const sel = await page.getByRole('tab', { selected: true }).innerText();
  check('tabs keyboard-navigable', sel.includes('Boundary'), sel);
  // reset to demo data for later runs
  page.on('dialog', (d) => d.accept());
  await page.goto(BASE + '/settings', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Reset to demonstration data' }).click();
  await ctx.close();
}

// 3. Accessibility scan (axe-core) on main routes
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  for (const r of ['/city-hotel', '/independent-bnb', '/compare', '/data-library', '/methodology', '/settings']) {
    await page.goto(BASE + r, { waitUntil: 'networkidle' });
    await page.addScriptTag({ content: axeSrc });
    const res = await page.evaluate(async () => (window).axe.run(document, { runOnly: ['wcag2a', 'wcag2aa'] }));
    const serious = res.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    check(`axe ${r}: no serious/critical WCAG A/AA violations`, serious.length === 0, serious.map((v) => `${v.id}(${v.nodes.length})`).join(', '));
  }
  // reduced motion
  const rm = await browser.newContext({ reducedMotion: 'reduce' });
  const p2 = await rm.newPage();
  await p2.goto(BASE + '/city-hotel', { waitUntil: 'networkidle' });
  check('renders with prefers-reduced-motion', await p2.locator('h1').isVisible());
  await rm.close();
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
