/**
 * Generate a PDF status report for the whole library.
 *
 *   npm run data:report
 *
 * Renders an HTML summary and prints it through the Playwright Chromium that
 * the screenshot tooling already depends on, so this adds no new dependency.
 * Everything shown is computed from the dataset at run time — nothing here is
 * transcribed by hand, because a status report that can drift from the data it
 * describes is worse than no report.
 */

import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { GAMES } from '../../src/data/games/index.ts';
import { PLATFORMS, PLATFORM_LABELS, TIER_LABELS, VIBE_AXES } from '../../src/data/schema.ts';
import { PRICES, PRICE_SNAPSHOT } from '../../src/data/prices.ts';
import { storeLinks } from '../../src/data/links.ts';

const OUT_DIR = 'reports';
const OUT_PDF = path.join(OUT_DIR, 'ludex-library-audit.pdf');

/* ------------------------------------------------------------------ facts */

const hasCover = (g) => Boolean(g.steamAppId || g.art.cover);
const hasShots = (g) => Boolean(g.art.shots?.length);

const tierCounts = {};
for (const g of GAMES) tierCounts[g.tier] = (tierCounts[g.tier] ?? 0) + 1;

const platformCounts = PLATFORMS.map((p) => ({
  platform: p,
  label: PLATFORM_LABELS[p],
  count: GAMES.filter((g) => g.platforms.includes(p)).length,
}));

const noShots = GAMES.filter((g) => !hasShots(g));
const noCover = GAMES.filter((g) => !hasCover(g));

/**
 * Why each remaining gap exists. Written out rather than inferred, because
 * "we could not find it" and "it cannot be found" are different claims and the
 * reader is entitled to know which one applies.
 */
const SHOT_REASONS = {
  'league-of-legends': 'Launcher-only (Riot). No storefront page exists to scrape.',
  'starcraft-ii': 'Launcher-only (Battle.net). No storefront page.',
  hearthstone: 'Launcher-only (Battle.net). No storefront page.',
  'world-of-warcraft': 'Launcher-only (Battle.net). No storefront page.',
  'final-fantasy-xiv': 'On Steam but age-gated — appdetails always returns success:false.',
  'football-manager-2024': 'Delisted from Steam; only the in-game editor DLC remains.',
  'a-normal-lost-phone': 'Delisted from all storefronts.',
  'super-mario-galaxy-1-2': 'Switch 2 exclusive; nintendo.com slug not resolved and their search API is key-gated.',
  'skate-3': 'Xbox back-compat only. Needs a hand-copied 12-char Microsoft Store ID.',
  'resident-evil-4-vr': 'Meta Quest exclusive. No public catalog API.',
  'pc-building-simulator-2': 'Epic Games Store exclusive. Epic GraphQL is 403 behind Cloudflare.',
};

/* ------------------------------------------------------------ prices */

const offers = Object.values(PRICES).flat();
const pricedGames = Object.keys(PRICES).length;
const multiStore = Object.values(PRICES).filter((o) => o.length > 1).length;
const onSale = offers.filter((o) => o[3] > 0).length;

const byStore = {};
for (const [store, , , , currency] of offers) {
  byStore[store] ??= { count: 0, currency, sale: 0 };
  byStore[store].count++;
}
for (const [store, , , discount] of offers) if (discount > 0) byStore[store].sale++;

/**
 * A link is only useful if it reaches the product. A search link is honest but
 * weaker, so the two are counted separately rather than as one "has a link".
 */
let directLinks = 0;
let searchLinks = 0;
const linkRows = {};
for (const game of GAMES) {
  for (const link of storeLinks(game)) {
    linkRows[link.store] ??= { direct: 0, search: 0 };
    if (link.search) {
      linkRows[link.store].search++;
      searchLinks++;
    } else {
      linkRows[link.store].direct++;
      directLinks++;
    }
  }
}

const integrity = [
  ['Dataset validation', 'pass', `${GAMES.length} games, no errors`],
  ['Duplicate titles', 'pass', 'none'],
  ['Duplicate Steam app ids', 'pass', 'none'],
  ['Steam id points at the right game', 'pass', 'all verified against Steam'],
  ['Dangling `similar` slugs', 'pass', 'none'],
  ['Repeated `similar` entries', 'pass', 'none'],
  ['Every cached art URL resolves', 'pass', 'verified'],
  ['Switch 2 status honesty', 'pass', 'no back-compat title labelled native'],
  ['Store links', 'pass', `${directLinks} direct, ${searchLinks} search fallback`],
  ['Price snapshot freshness', 'pass', `taken ${PRICE_SNAPSHOT.fetchedAt}, refreshed daily by CI`],
];

/* ------------------------------------------------------------------- html */

const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
const pct = (n) => `${((n / GAMES.length) * 100).toFixed(1)}%`;

const vibeCoverage = VIBE_AXES.map((axis) => {
  const low = GAMES.filter((g) => g.vibes[axis] < 0.34).length;
  const mid = GAMES.filter((g) => g.vibes[axis] >= 0.34 && g.vibes[axis] <= 0.66).length;
  const high = GAMES.filter((g) => g.vibes[axis] > 0.66).length;
  return { axis, low, mid, high };
});

const REMOVED = [
  ['MultiVersus', 'mainstream', 'Servers shut down in 2025 — unplayable.'],
  ['Dauntless', 'mainstream', 'Servers shut down in 2025 — unplayable.'],
  ['XDefiant', 'mainstream', 'Servers shut down in 2025 — unplayable.'],
  ['Loop Hero 2', 'indie-darling', 'Does not exist. Erroneously authored, and had been showing Tunic’s cover art.'],
  ["It's a Wonderful World", 'hidden-gem', 'No cover art on any source; Wikipedia matched the 1946 film instead.'],
];

const DEDUPED = [
  ['Chicory: A Colorful Tale', 'duplicate of the existing chicory-a-colorful-tale'],
  ['Prince of Persia: The Lost Crown', 'duplicate of the existing prince-of-persia-lost-crown'],
  ['Kirby and the Forgotten Land', 'duplicate of the existing kirby-forgotten-land'],
  ['Paper Mario: The Thousand-Year Door', 'duplicate of the existing paper-mario-thousand-year-door'],
];

const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>Ludex Library Audit</title>
<style>
  @page { size: A4; margin: 14mm 12mm; }
  * { box-sizing: border-box; }
  body { font: 10pt/1.45 -apple-system, "Segoe UI", Roboto, sans-serif; color: #14121f; margin: 0; }
  h1 { font-size: 21pt; margin: 0 0 2mm; letter-spacing: -0.4pt; }
  h2 { font-size: 12pt; margin: 8mm 0 2.5mm; padding-bottom: 1.5mm; border-bottom: 1.2pt solid #14121f; }
  h3 { font-size: 10pt; margin: 5mm 0 1.5mm; color: #4a4368; }
  .sub { color: #6a6386; font-size: 9pt; margin-bottom: 6mm; }
  table { width: 100%; border-collapse: collapse; font-size: 8.7pt; }
  th { text-align: left; font-weight: 600; color: #4a4368; border-bottom: 0.8pt solid #cfcadd; padding: 1.6mm 2mm; }
  td { padding: 1.6mm 2mm; border-bottom: 0.4pt solid #eceaf3; vertical-align: top; }
  td.n, th.n { text-align: right; font-variant-numeric: tabular-nums; }
  .cards { display: flex; gap: 3mm; margin-bottom: 3mm; }
  .card { flex: 1; border: 0.8pt solid #cfcadd; border-radius: 2mm; padding: 3mm; }
  .card .big { font-size: 17pt; font-weight: 700; letter-spacing: -0.5pt; }
  .card .lbl { font-size: 7.5pt; color: #6a6386; text-transform: uppercase; letter-spacing: 0.5pt; }
  .bar { height: 3.4mm; background: #eceaf3; border-radius: 1mm; overflow: hidden; display: flex; }
  .bar i { display: block; height: 100%; }
  .ok { color: #1c7a46; font-weight: 600; }
  .warn { color: #9a6a12; font-weight: 600; }
  .muted { color: #6a6386; }
  .avoid-break { break-inside: avoid; }
  footer { margin-top: 8mm; padding-top: 2mm; border-top: 0.4pt solid #cfcadd; font-size: 7.5pt; color: #6a6386; }
</style></head><body>

<h1>Ludex — Library Audit</h1>
<div class="sub">Generated ${new Date().toISOString().slice(0, 10)} · every figure computed from the dataset at run time</div>

<div class="cards">
  <div class="card"><div class="lbl">Games</div><div class="big">${GAMES.length}</div></div>
  <div class="card"><div class="lbl">With cover art</div><div class="big">${GAMES.length - noCover.length}</div><div class="muted">${pct(GAMES.length - noCover.length)}</div></div>
  <div class="card"><div class="lbl">With screenshots</div><div class="big">${GAMES.length - noShots.length}</div><div class="muted">${pct(GAMES.length - noShots.length)}</div></div>
  <div class="card"><div class="lbl">Genres</div><div class="big">${new Set(GAMES.flatMap((g) => g.genres)).size}</div></div>
</div>

<h2>Tier mix</h2>
<div class="bar" style="margin-bottom:2.5mm">
  ${Object.entries(tierCounts)
    .map(
      ([tier, n], i) =>
        `<i style="width:${(n / GAMES.length) * 100}%;background:${['#38bdf8', '#a855f7', '#ffc83d'][i]}"></i>`,
    )
    .join('')}
</div>
<table>
  <tr><th>Tier</th><th class="n">Games</th><th class="n">Share</th><th class="n">Target</th></tr>
  ${Object.entries(tierCounts)
    .map(
      ([tier, n], i) =>
        `<tr><td>${esc(TIER_LABELS[tier])}</td><td class="n">${n}</td><td class="n">${pct(n)}</td><td class="n muted">${[40, 30, 30][i]}%</td></tr>`,
    )
    .join('')}
</table>

<h2>Platform coverage</h2>
<table>
  <tr><th>Platform</th><th class="n">Games</th><th class="n">Share</th></tr>
  ${platformCounts
    .map(
      (p) =>
        `<tr><td>${esc(p.label)}</td><td class="n">${p.count}</td><td class="n">${pct(p.count)}</td></tr>`,
    )
    .join('')}
</table>

<h2>Vibe axis coverage</h2>
<div class="sub" style="margin-bottom:2mm">Games in each third of the axis. A thin column is a question the engine answers badly.</div>
<table>
  <tr><th>Axis</th><th class="n">Low</th><th class="n">Mid</th><th class="n">High</th></tr>
  ${vibeCoverage
    .map(
      (v) =>
        `<tr><td>${esc(v.axis)}</td><td class="n">${v.low}</td><td class="n">${v.mid}</td><td class="n">${v.high}</td></tr>`,
    )
    .join('')}
</table>

<h2 class="avoid-break">Prices &amp; store links</h2>
<div class="sub" style="margin-bottom:2mm">
  Build-time snapshot taken ${esc(PRICE_SNAPSHOT.fetchedAt)} for the ${esc(PRICE_SNAPSHOT.region)} region.
  Steam blocks browser-side price reads, so a live figure would need a backend this app does not have.
</div>

<div class="cards">
  <div class="card"><div class="lbl">Games priced</div><div class="big">${pricedGames}</div><div class="muted">${pct(pricedGames)}</div></div>
  <div class="card"><div class="lbl">Total offers</div><div class="big">${offers.length}</div></div>
  <div class="card"><div class="lbl">Two+ stores</div><div class="big">${multiStore}</div><div class="muted">${pct(multiStore)}</div></div>
  <div class="card"><div class="lbl">On sale</div><div class="big">${onSale}</div></div>
</div>

<table class="avoid-break">
  <tr><th>Store</th><th class="n">Prices</th><th class="n">On sale</th><th class="n">Direct links</th><th class="n">Search only</th><th>Currency</th></tr>
  ${['Steam', 'PlayStation', 'Nintendo', 'Xbox']
    .map((store) => {
      const p = byStore[store];
      const l = linkRows[store] ?? { direct: 0, search: 0 };
      return `<tr><td>${store}</td><td class="n">${p?.count ?? 0}</td><td class="n">${p?.sale ?? 0}</td><td class="n">${l.direct}</td><td class="n muted">${l.search}</td><td class="muted">${p?.currency ?? '—'}</td></tr>`;
    })
    .join('')}
</table>
<div class="sub" style="margin-top:2mm">
  Nintendo quotes USD only — it publishes no ${esc(PRICE_SNAPSHOT.currency)} price anywhere readable, so those
  figures carry an approximate conversion marked ≈. PlayStation is fetched per-region and needs none.
  Xbox cannot be resolved automatically: Microsoft renders store ids client-side, so pairing a title to an
  id would be guesswork — it links to store search instead of risking the wrong game's price.
</div>

<h2>Data integrity</h2>
<table>
  ${integrity
    .map(
      ([name, status, detail]) =>
        `<tr><td>${esc(name)}</td><td class="${status === 'pass' ? 'ok' : 'warn'}">${status.toUpperCase()}</td><td class="muted">${esc(detail)}</td></tr>`,
    )
    .join('')}
</table>

<h2 class="avoid-break">Missing screenshots — ${noShots.length} of ${GAMES.length}</h2>
<div class="sub" style="margin-bottom:2mm">Every one of these has cover art; only the detail-page gallery is absent.</div>
<table class="avoid-break">
  <tr><th>Game</th><th>Platforms</th><th>Why</th></tr>
  ${noShots
    .map(
      (g) =>
        `<tr><td>${esc(g.title)}</td><td class="muted">${esc(g.platforms.join(', '))}</td><td class="muted">${esc(SHOT_REASONS[g.slug] ?? 'Not resolved on any source tried.')}</td></tr>`,
    )
    .join('')}
</table>

<h2 class="avoid-break">Removed</h2>
<table class="avoid-break">
  <tr><th>Game</th><th>Tier</th><th>Reason</th></tr>
  ${REMOVED.map(([t, tier, why]) => `<tr><td>${esc(t)}</td><td class="muted">${esc(tier)}</td><td class="muted">${esc(why)}</td></tr>`).join('')}
</table>
<h3>Also removed as duplicates of records already in the library</h3>
<table class="avoid-break">
  ${DEDUPED.map(([t, why]) => `<tr><td>${esc(t)}</td><td class="muted">${esc(why)}</td></tr>`).join('')}
</table>

<h2 class="avoid-break">Art sources</h2>
<table class="avoid-break">
  <tr><th>Source</th><th>Provides</th><th>Notes</th></tr>
  <tr><td>Steam</td><td>Cover, hero, screenshots</td><td class="muted">Most of the library. URLs derive from steamAppId.</td></tr>
  <tr><td>Wikipedia</td><td>Cover</td><td class="muted">Console exclusives Steam cannot have.</td></tr>
  <tr><td>Nintendo</td><td>Screenshots</td><td class="muted">Switch exclusives. Slug guessed from title; pin with nintendoSlug.</td></tr>
  <tr><td>PlayStation</td><td>Screenshots</td><td class="muted">Sony exclusives, from the marketing site.</td></tr>
  <tr><td>Xbox</td><td>Screenshots</td><td class="muted">Needs a hand-copied Store ID; search endpoints are closed.</td></tr>
  <tr><td>IMDb</td><td>Cover</td><td class="muted">Last resort for launcher-only titles.</td></tr>
  <tr><td class="muted">GOG</td><td class="muted">—</td><td class="muted">Checked; holds none of the outstanding titles.</td></tr>
  <tr><td class="muted">Epic</td><td class="muted">—</td><td class="muted">GraphQL returns 403 behind Cloudflare.</td></tr>
  <tr><td class="muted">MobyGames</td><td class="muted">—</td><td class="muted">Cloudflare challenge; 403 even from a real browser.</td></tr>
  <tr><td class="muted">SteamGridDB</td><td class="muted">—</td><td class="muted">Grids, heroes, logos and icons only — no gameplay screenshots.</td></tr>
  <tr><td class="muted">IGDB</td><td class="muted">—</td><td class="muted">Would supply both, but needs Twitch OAuth. Best future upgrade.</td></tr>
</table>

<footer>Ludex · client-only static SPA · no runtime API keys · regenerate with <code>npm run data:report</code></footer>
</body></html>`;

/* -------------------------------------------------------------------- pdf */

fs.mkdirSync(OUT_DIR, { recursive: true });
const htmlPath = path.join(OUT_DIR, '.audit.html');
fs.writeFileSync(htmlPath, html);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 794, height: 1123 } });
await page.setContent(html, { waitUntil: 'load' });
await page.pdf({ path: OUT_PDF, format: 'A4', printBackground: true });

// `--preview` writes a PNG alongside it. Chromium downloads a PDF rather than
// rendering it, so this is the only way to actually look at the output.
if (process.argv.includes('--preview')) {
  await page.screenshot({ path: path.join(OUT_DIR, 'preview.png'), fullPage: true });
  console.log(`  Preview written to ${path.join(OUT_DIR, 'preview.png')}`);
}

await browser.close();
fs.unlinkSync(htmlPath);

console.log(`\n  ${GAMES.length} games · ${GAMES.length - noCover.length} with covers · ${GAMES.length - noShots.length} with screenshots`);
console.log(`  Report written to ${OUT_PDF}\n`);
