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
// The machine is ~2.9s of show. That is fine once and an obstacle by the tenth
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

/* -- going back to a list returns you to where you were ------------------- */
// Reproduces the real complaint: page through the results, open a game, press
// Back. Both halves have to survive — the number of revealed rows AND the
// scroll offset. Restoring only the offset does nothing, because a collapsed
// list is too short to scroll that far.
await flow('back-restores-list-position', desktop, async (page) => {
  await page.goto(`${BASE}/results`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);

  const more = page.getByRole('button', { name: /Show more/i });
  if ((await more.count()) === 0) throw new Error('no "Show more" button to test');
  await more.click();
  await page.waitForTimeout(400);
  await more.click();
  await page.waitForTimeout(600);

  const rowsBefore = await page.locator('article').count();
  await page.evaluate(() => window.scrollTo(0, 2600));
  await page.waitForTimeout(400);

  // Click a card that is ALREADY on screen. Playwright scrolls an off-screen
  // element into view before clicking, which moves the page and makes the
  // assertion measure the harness rather than the app.
  const clicked = await page.evaluate(() => {
    const link = [...document.querySelectorAll('article a')].find((a) => {
      const r = a.getBoundingClientRect();
      // Top edge on screen is enough — the browser will not scroll to click it.
      return r.top >= 0 && r.top < window.innerHeight - 40;
    });
    if (!link) return null;
    link.click();
    return window.scrollY;
  });
  if (clicked === null) throw new Error('no card fully visible at this scroll offset');
  const scrollBefore = clicked;
  if (scrollBefore < 1000) throw new Error(`page did not scroll (y=${scrollBefore})`);

  await page.waitForURL('**/game/**', { timeout: 8000 });
  await page.waitForTimeout(500);

  await page.goBack({ waitUntil: 'networkidle' });

  // Wait past useListPosition's 2s restore budget before measuring. An earlier
  // version polled for the scroll to "stop moving", which latched onto an
  // intermediate value between restore frames and failed roughly one run in
  // three — the flakiness was in the assertion, not the app.
  await page.waitForTimeout(2600);

  const rowsAfter = await page.locator('article').count();
  const scrollAfter = await page.evaluate(() => window.scrollY);

  if (rowsAfter < rowsBefore) {
    throw new Error(`list collapsed on back: ${rowsBefore} rows -> ${rowsAfter}`);
  }
  if (Math.abs(scrollAfter - scrollBefore) > 250) {
    throw new Error(`scroll not restored: was ${scrollBefore}, came back at ${scrollAfter}`);
  }
});

/* -- every game offers a store link, and sales show both prices ----------- */
// Prices are a build-time snapshot, so the risk is not staleness but silence:
// a broken import or an empty snapshot would render nothing at all and look
// exactly like "this game has no price", which is a legitimate state for
// free-to-play titles. Assert on a game known to be discounted instead.
await flow('price-and-store-link', desktop, async (page) => {
  /**
   * Pick a discounted game from the snapshot rather than naming one.
   *
   * This used to hardcode Ghost Recon Wildlands as "a game known to be
   * discounted", which was true the day it was written and false once the sale
   * ended — the test then failed for a reason that had nothing to do with the
   * code. Sales are the one thing in this dataset guaranteed to change.
   */
  const { PRICES } = await import('../../src/data/prices.ts');
  const onSale = Object.entries(PRICES).find(([, offers]) =>
    offers.some((o) => o[0] === 'Steam' && o[3] > 0),
  );
  if (!onSale) throw new Error('no discounted Steam game in the snapshot to test against');

  await page.goto(`${BASE}/game/${onSale[0]}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);

  const panel = page.locator('aside .panel').first();
  const text = (await panel.textContent()).replace(/\s+/g, ' ');

  if (!/−\d+%/.test(text)) throw new Error(`no discount badge rendered: ${text.slice(-120)}`);
  if (!/as of \d{4}-\d{2}-\d{2}/.test(text)) throw new Error('snapshot date is not disclosed');

  // Original price must be struck through, or the discount reads as the price.
  const struck = await panel.locator('s').count();
  if (struck === 0) throw new Error('original price is not struck through');

  const href = await panel.locator('a[target="_blank"]').first().getAttribute('href');
  if (!href?.startsWith('https://store.steampowered.com/app/')) {
    throw new Error(`store link is not a Steam product page: ${href}`);
  }

  // A Switch exclusive must reach Nintendo, not Steam, and must show its own
  // USD price with an approximate conversion — mixing the two currencies
  // silently would misprice ~90 games by a factor of four.
  await page.goto(`${BASE}/game/super-mario-odyssey`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  const panel2 = page.locator('aside .panel').first();
  const text2 = (await panel2.textContent()).replace(/\s+/g, ' ');

  const nin = await panel2.locator('a[target="_blank"]').first().getAttribute('href');
  if (!nin?.includes('nintendo.com')) throw new Error(`Switch exclusive linked to ${nin}`);
  if (!text2.includes('$')) throw new Error(`no USD price shown: ${text2.slice(-140)}`);
  if (!/≈\s*RM/.test(text2)) throw new Error(`no approximate conversion shown: ${text2.slice(-140)}`);
  if (!/rough conversion/.test(text2)) {
    throw new Error('conversion is not disclosed as approximate');
  }
});

/* -- the axis chips stay pills when a reason wraps ------------------------ */
// Run at mobile width on purpose. A flex row defaults to `align-items:
// stretch`, so the chip grows to whatever height the reason beside it needs.
// At desktop width every reason fits one line and the chip looks correct;
// wrap it to two and the chip becomes square, which `rounded-chip`'s 999px
// radius then draws as a circle. The bug is invisible at the width most
// checks run at, which is exactly how it shipped.
await flow('why-it-fits-chips-do-not-stretch', mobile, async (page) => {
  await page.goto(`${BASE}/vibe-check`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /Next/ }).click();
  for (let guard = 0; guard < 12 && !page.url().endsWith('/results'); guard++) {
    await page.waitForTimeout(400);
    const radios = page.getByRole('radio');
    if ((await radios.count()) > 0) await radios.first().click({ timeout: 5000 });
    await page.getByRole('button', { name: /Next|See my matches/ }).click({ timeout: 5000 });
  }
  await page.waitForURL('**/results', { timeout: 8000 });

  await page.locator('article a').first().click();
  await page.waitForTimeout(800);

  const panel = page.locator('section', { hasText: 'Why it fits your vibe' }).last();
  await panel.waitFor({ timeout: 5000 });

  const chips = panel.locator('li > span:first-child');
  const count = await chips.count();
  if (count === 0) throw new Error('no reason chips rendered');

  let sawWrap = false;
  for (let i = 0; i < count; i++) {
    const chip = await chips.nth(i).boundingBox();
    const row = await chips.nth(i).locator('..').boundingBox();
    if (row.height > 30) sawWrap = true;
    if (chip.height > 26) {
      const text = (await chips.nth(i).textContent()).trim();
      throw new Error(
        `chip "${text}" is ${Math.round(chip.height)}px tall — stretching to its ${Math.round(row.height)}px row`,
      );
    }
  }
  // Guard the guard: if nothing wrapped, this run proved nothing.
  if (!sawWrap) throw new Error('no reason wrapped at mobile width — test is not exercising the bug');
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
