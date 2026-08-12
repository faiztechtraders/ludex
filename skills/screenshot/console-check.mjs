/**
 * Loads every route and reports console errors, page errors and failed
 * requests. A companion to capture.mjs: screenshots show you a blank page,
 * this tells you why it was blank.
 *
 *   npm run check
 *
 * Exits non-zero if any route logged an error.
 */

import { chromium } from 'playwright';

const BASE = process.env.LUDEX_URL ?? 'http://localhost:3000';
const ROUTES = ['/', '/vibe-check', '/results', '/browse', '/game/tunic', '/spin', '/collection', '/about'];

try {
  const res = await fetch(BASE, { signal: AbortSignal.timeout(4000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
} catch (error) {
  console.error(`\n✖  No dev server at ${BASE} — ${error.message}\n`);
  process.exit(1);
}

const browser = await chromium.launch();
const problems = [];
const thirdParty = new Set();

console.log(`\n  Checking ${ROUTES.length} routes at ${BASE}\n`);

for (const route of ROUTES) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const found = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      found.push(`${msg.type()}: ${msg.text()}`);
    }
  });
  page.on('pageerror', (error) => found.push(`pageerror: ${error.message}`));

  /**
   * Only our own assets are fatal.
   *
   * Cover art is hotlinked from Steam and Wikipedia and fonts come from Google,
   * all of which flake occasionally and all of which the app degrades from
   * gracefully — generated gradient covers, system font stacks. Failing the
   * check on those makes it cry wolf, and a check nobody trusts is worse than
   * no check. Third-party failures are reported as notes instead.
   */
  page.on('requestfailed', (req) => {
    const url = req.url();
    if (url.startsWith(BASE)) found.push(`requestfailed: ${url}`);
    else thirdParty.add(new URL(url).host);
  });

  await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);

  // A route that rendered nothing into #root is broken even without a thrown
  // error — this catches silent suspense/render failures.
  const rendered = await page.evaluate(() => document.getElementById('root')?.childElementCount ?? 0);
  if (rendered === 0) found.push('render: #root is empty');

  if (found.length) {
    problems.push({ route, found });
    console.log(`    ✖ ${route}`);
    for (const f of found) console.log(`        ${f}`);
  } else {
    console.log(`    ✔ ${route}`);
  }

  await context.close();
}

await browser.close();

if (thirdParty.size) {
  console.log(
    `\n  note: some third-party requests failed (${[...thirdParty].join(', ')}).` +
      `\n  Not fatal — art and fonts both have local fallbacks.`,
  );
}

if (problems.length) {
  console.error(`\n  ${problems.length} route(s) with problems.\n`);
  process.exit(1);
}
console.log('\n  All routes render clean.\n');
