/**
 * Interaction flows — captures states you can only reach by clicking.
 *
 * Static route screenshots can only ever show idle states, so the spin reveal,
 * an answered quiz step, and a populated collection would go unverified. This
 * drives the real UI and asserts the outcome, then screenshots it.
 *
 *   npm run flows
 *
 * Exits non-zero if a flow fails to reach its expected state.
 */

import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs/promises';

const ROOT = path.resolve(import.meta.dirname, '../..');
const OUT = path.join(ROOT, 'screenshot');
const BASE = process.env.LUDEX_URL ?? 'http://localhost:3000';

await fs.mkdir(OUT, { recursive: true });

try {
  const res = await fetch(BASE, { signal: AbortSignal.timeout(4000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
} catch (error) {
  console.error(`\n✖  No dev server at ${BASE} — ${error.message}\n`);
  process.exit(1);
}

const browser = await chromium.launch();
const failures = [];

async function flow(name, viewport, fn) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 2, colorScheme: 'dark' });
  const page = await context.newPage();
  page.on('pageerror', (e) => failures.push(`${name}: pageerror ${e.message}`));
  try {
    await fn(page);
    console.log(`    ✔ ${name}`);
  } catch (error) {
    failures.push(`${name}: ${error.message}`);
    console.log(`    ✖ ${name} — ${error.message}`);
    await page.screenshot({ path: path.join(OUT, `FAILED-${name}.png`), fullPage: true });
  }
  await context.close();
}

const desktop = { width: 1440, height: 900 };
const mobile = { width: 390, height: 844 };

console.log(`\n  Running interaction flows against ${BASE}\n`);

/* -- the spin actually reveals a game -------------------------------------- */
await flow('spin-reveal', desktop, async (page) => {
  await page.goto(`${BASE}/spin`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /SPIN/i }).click();
  // The reel runs ~3.4s; wait generously for the result heading.
  await page.getByRole('heading', { name: 'Play this.' }).waitFor({ timeout: 12_000 });
  await page.getByRole('link', { name: /See the details/i }).waitFor();
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT, 'daily-spin-result.png'), fullPage: true });
});

/* -- the gacha animation can be skipped ------------------------------------ */
// The machine is ~2.3s of show. That is fine once and an obstacle by the tenth
// reroll, so tapping it must cut straight to the result. Asserting on the
// elapsed time is the point: a skip that still waits out the timeline passes a
// "did it reveal" check while being exactly the bug worth catching.
await flow('spin-animation-is-skippable', desktop, async (page) => {
  await page.goto(`${BASE}/spin`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /SPIN|ROLL AGAIN/i }).click();

  const machine = page.locator('[role="presentation"]');
  await machine.waitFor({ state: 'visible', timeout: 5000 });

  const t0 = Date.now();
  await machine.click();
  await page.getByRole('heading', { name: 'Play this.' }).waitFor({ timeout: 5000 });
  const ms = Date.now() - t0;

  if (ms > 1200) {
    throw new Error(`skip took ${ms}ms — it is sitting through the animation`);
  }
});

/* -- answering the quiz produces scored, explained results ----------------- */
await flow('quiz-to-results', desktop, async (page) => {
  await page.goto(`${BASE}/vibe-check`, { waitUntil: 'networkidle' });

  // Step 0: pick Switch 2 only — also the platform-filter end-to-end check.
  await page.getByRole('checkbox', { name: /Nintendo Switch 2/ }).click();
  await page.getByRole('button', { name: /Next/ }).click();

  // Step 1 is a choice question; answer it and capture the answered state.
  // Cards animate in on a stagger, so wait for the entrance to settle before
  // clicking — Playwright refuses to click a moving element.
  await page.waitForTimeout(700);
  await page.getByRole('radio').first().click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, 'vibe-check-answered.png'), fullPage: true });

  // Walk to the end rather than assuming a step count, so adding or removing
  // a question does not silently break this flow.
  for (let guard = 0; guard < 12 && !page.url().endsWith('/results'); guard++) {
    await page.waitForTimeout(500);
    const radios = page.getByRole('radio');
    if ((await radios.count()) > 0) await radios.first().click({ timeout: 5000 });
    await page.getByRole('button', { name: /Next|See my matches/ }).click({ timeout: 5000 });
  }

  await page.waitForURL('**/results', { timeout: 8000 });
  await page.getByRole('heading', { name: /Built for the vibe you described/ }).waitFor();

  // Every result must be playable on Switch 2 — the core guarantee, verified
  // through the real UI rather than only in the engine unit tests.
  const cards = page.locator('article');
  const count = await cards.count();
  if (count === 0) throw new Error('results page rendered no cards');
  for (let i = 0; i < count; i++) {
    const badges = await cards.nth(i).locator('span.sr-only').allTextContents();
    const ok = badges.some((t) => /Switch 2/i.test(t));
    if (!ok) {
      const title = await cards.nth(i).locator('h3').textContent();
      throw new Error(`"${title}" shown but has no Switch 2 badge`);
    }
  }

  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT, 'results-scored.png'), fullPage: true });
});

/* -- rerolling the spin does not hand back the same game ------------------ */
await flow('spin-does-not-repeat', desktop, async (page) => {
  await page.goto(`${BASE}/spin`, { waitUntil: 'networkidle' });
  const seen = [];

  for (let i = 0; i < 4; i++) {
    // Reload between draws — the repeat bug only showed up once the in-memory
    // attempt counter was thrown away.
    if (i > 0) await page.reload({ waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /SPIN|ROLL AGAIN/i }).click();
    await page.getByRole('heading', { name: 'Play this.' }).waitFor({ timeout: 12_000 });
    const title = await page.locator('h2').first().textContent();
    seen.push((title ?? '').trim());
  }

  // The first draw is today's deterministic pick; every reroll after it must
  // be something new.
  const rerolls = seen.slice(1);
  if (new Set(rerolls).size !== rerolls.length) {
    throw new Error(`reroll repeated a game: ${seen.join(' -> ')}`);
  }
});

/* -- paging results never moves the rows already on screen ---------------- */
await flow('show-more-is-append-only', desktop, async (page) => {
  await page.goto(`${BASE}/results`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);

  const titlesOf = () => page.locator('article h3').allTextContents();
  const before = await titlesOf();
  if (before.length === 0) throw new Error('results page rendered no cards');

  const more = page.getByRole('button', { name: /Show more/i });
  if ((await more.count()) === 0) throw new Error('no "Show more" button to test');
  await more.click();
  await page.waitForTimeout(600);

  const after = await titlesOf();
  if (after.length <= before.length) throw new Error('Show more added no rows');

  const prefix = after.slice(0, before.length);
  for (let i = 0; i < before.length; i++) {
    if (prefix[i] !== before[i]) {
      throw new Error(`row ${i} moved: "${before[i]}" became "${prefix[i]}"`);
    }
  }
});

/* -- saving persists across a reload -------------------------------------- */
await flow('save-persists', desktop, async (page) => {
  await page.goto(`${BASE}/browse`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Save to collection' }).first().click();
  await page.goto(`${BASE}/collection`, { waitUntil: 'networkidle' });
  await page.reload({ waitUntil: 'networkidle' });
  const cards = page.locator('article');
  if ((await cards.count()) === 0) throw new Error('saved game did not survive a reload');
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, 'collection-populated.png'), fullPage: true });
});

/* -- mobile viewport, above the fold, no horizontal overflow -------------- */
for (const route of [
  ['landing', '/'],
  ['vibe-check', '/vibe-check'],
  ['browse', '/browse'],
  ['game-detail', '/game/tunic'],
]) {
  await flow(`mobile-fold-${route[0]}`, mobile, async (page) => {
    await page.goto(`${BASE}${route[1]}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(700);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    if (overflow > 1) throw new Error(`horizontal overflow of ${overflow}px`);
    // Viewport-only, not fullPage — this is the above-the-fold check.
    await page.screenshot({ path: path.join(OUT, `${route[0]}-mobile-fold.png`) });
  });
}

await browser.close();

if (failures.length) {
  console.error(`\n  ${failures.length} flow failure(s):`);
  for (const f of failures) console.error(`    ${f}`);
  console.error('');
  process.exit(1);
}
console.log('\n  All flows passed.\n');
