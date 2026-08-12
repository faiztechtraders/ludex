/**
 * Captures every Ludex route into screenshot/ for visual verification.
 *
 * The point of this script is the *feedback loop*: run it, then actually open
 * the PNGs and look at them. Screenshots that are generated and never read
 * provide no verification at all.
 *
 * Usage:
 *   npm run dev            # in one terminal
 *   npm run shot           # in another
 *
 * The dev server URL is read from LUDEX_URL (default http://localhost:3000),
 * since Vite auto-increments the port when 3000 is taken:
 *   LUDEX_URL=http://localhost:3001 npm run shot
 *
 * Optional flags:
 *   --only=landing,spin    capture just those routes
 *   --label=before         suffix the filenames, for before/after comparisons
 */

import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs/promises';

const ROOT = path.resolve(import.meta.dirname, '../..');
const OUT = path.join(ROOT, 'screenshot');
const BASE = process.env.LUDEX_URL ?? 'http://localhost:3000';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')),
);
const only = args.only ? args.only.split(',') : null;
const label = args.label ? `-${args.label}` : '';

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
];

const ROUTES = [
  { name: 'landing', path: '/' },
  { name: 'vibe-check', path: '/vibe-check' },
  { name: 'results', path: '/results' },
  { name: 'browse', path: '/browse' },
  { name: 'game-detail', path: '/game/tunic' },
  { name: 'daily-spin', path: '/spin' },
  { name: 'collection', path: '/collection' },
  { name: 'about', path: '/about' },
];

const targets = only ? ROUTES.filter((r) => only.includes(r.name)) : ROUTES;

await fs.mkdir(OUT, { recursive: true });

/* -- confirm the dev server is actually up before launching a browser -- */
try {
  const res = await fetch(BASE, { signal: AbortSignal.timeout(4000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
} catch (error) {
  console.error(`\n✖  No dev server at ${BASE}\n   ${error.message}`);
  console.error('   Start it with `npm run dev`, then set LUDEX_URL if it chose another port.\n');
  process.exit(1);
}

const browser = await chromium.launch();
console.log(`\n  Capturing ${targets.length} routes from ${BASE}\n`);

for (const viewport of VIEWPORTS) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 2,
    colorScheme: 'dark',
  });
  const page = await context.newPage();

  for (const route of targets) {
    await page.goto(`${BASE}${route.path}`, { waitUntil: 'networkidle' });

    // Let entrance animations settle — capturing mid-stagger produces
    // half-faded cards that look like rendering bugs.
    await page.waitForTimeout(900);

    const file = path.join(OUT, `${route.name}-${viewport.name}${label}.png`);

    /**
     * Chromium refuses to capture beyond roughly 16k device pixels, and Browse
     * at 557 games is far taller than that — a plain `fullPage: true` throws
     * "Unable to capture screenshot". Clip long pages to the top instead, which
     * is the part worth reviewing anyway.
     */
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    const maxCss = Math.floor(16000 / (2 * (viewport.name === 'mobile' ? 1 : 1)));
    const clipped = height > maxCss;

    await page.screenshot({
      path: file,
      ...(clipped
        ? { clip: { x: 0, y: 0, width: viewport.width, height: maxCss } }
        : { fullPage: true }),
    });
    console.log(
      `    ✔ ${path.basename(file)}${clipped ? `  (clipped from ${height}px)` : ''}`,
    );
  }

  await context.close();
}

await browser.close();
console.log(`\n  Written to screenshot/. Now open them and look.\n`);
