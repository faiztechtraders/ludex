/**
 * Coverage report for the curated library.
 *
 * The question this answers: can any combination of filters a user might pick
 * dead-end into an empty or laughably short result set? A platform with four
 * games, or a platform where every title is mainstream, produces a bad
 * experience that no amount of engine tuning fixes.
 *
 *   npm run data:stats
 */

import { pathToFileURL } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '../..');
const PLATFORMS = ['pc', 'ps5', 'ps4', 'xbox-series', 'xbox-one', 'switch2', 'switch'];
const PLATFORM_LABELS = {
  pc: 'Windows PC',
  ps5: 'PS5',
  ps4: 'PS4',
  'xbox-series': 'Xbox X|S',
  'xbox-one': 'Xbox One',
  switch2: 'Switch 2',
  switch: 'Switch',
};
const TIERS = ['mainstream', 'indie-darling', 'hidden-gem'];
const VIBE_AXES = ['pace', 'depth', 'narrative', 'challenge', 'social', 'tone', 'session'];

const { GAMES } = await import(
  pathToFileURL(path.join(ROOT, 'src/data/games/index.ts')).href
);

const pad = (s, n) => String(s).padEnd(n);
const bar = (n, max, width = 24) =>
  '█'.repeat(Math.max(1, Math.round((n / Math.max(max, 1)) * width)));

console.log(`\n  LUDEX LIBRARY — ${GAMES.length} games\n`);

/* -- tier mix -- */
console.log('  BY TIER');
const tierCounts = TIERS.map((t) => [t, GAMES.filter((g) => g.tier === t).length]);
const maxTier = Math.max(...tierCounts.map(([, n]) => n));
for (const [tier, n] of tierCounts) {
  const pct = ((n / GAMES.length) * 100).toFixed(0);
  console.log(`    ${pad(tier, 15)} ${pad(n, 4)} ${pad(pct + '%', 5)} ${bar(n, maxTier)}`);
}

/* -- platform coverage, cross-tabbed by tier --
   The cross-tab is the important part: a platform that only carries
   blockbusters cannot serve a hidden-gem-hungry user. */
console.log('\n  BY PLATFORM (with tier breakdown)');
const maxPlat = Math.max(...PLATFORMS.map((p) => GAMES.filter((g) => g.platforms.includes(p)).length));
for (const p of PLATFORMS) {
  const on = GAMES.filter((g) => g.platforms.includes(p));
  const breakdown = TIERS.map((t) => on.filter((g) => g.tier === t).length).join(' / ');
  console.log(`    ${pad(PLATFORM_LABELS[p], 12)} ${pad(on.length, 4)} ${pad(breakdown, 14)} ${bar(on.length, maxPlat)}`);
}
console.log(`    ${' '.repeat(17)}(mainstream / indie / gem)`);

/* -- switch 2 honesty check -- */
const s2 = GAMES.filter((g) => g.platforms.includes('switch2'));
console.log('\n  SWITCH 2 BREAKDOWN');
for (const status of ['native', 'switch2-edition', 'backward-compatible']) {
  const n = s2.filter((g) => g.switch2Status === status).length;
  console.log(`    ${pad(status, 22)} ${n}`);
}
const nativeish = s2.filter((g) => g.switch2Status !== 'backward-compatible').length;
if (nativeish < 5) {
  console.log(`    ⚠  only ${nativeish} genuinely Switch 2-targeted titles — thin for a dedicated filter`);
}

/* -- vibe distribution --
   Flags axes where the library is lopsided. If nothing scores above 0.7 on
   `social`, a user who asks for co-op gets bad matches no matter what the
   engine does. */
console.log('\n  VIBE COVERAGE (games in each third of the axis)');
console.log(`    ${pad('axis', 12)} ${pad('low', 6)} ${pad('mid', 6)} ${pad('high', 6)}`);
for (const axis of VIBE_AXES) {
  const low = GAMES.filter((g) => g.vibes[axis] < 0.34).length;
  const mid = GAMES.filter((g) => g.vibes[axis] >= 0.34 && g.vibes[axis] <= 0.66).length;
  const high = GAMES.filter((g) => g.vibes[axis] > 0.66).length;
  const thin = low < 4 || high < 4 ? '  ⚠ thin at one end' : '';
  console.log(`    ${pad(axis, 12)} ${pad(low, 6)} ${pad(mid, 6)} ${pad(high, 6)}${thin}`);
}

/* -- misc -- */
const years = GAMES.map((g) => g.year);
const avgRating = (GAMES.reduce((s, g) => s + g.rating, 0) / GAMES.length).toFixed(1);
// Steam-sourced games store no cover URL — their art derives from steamAppId.
const noArt = GAMES.filter((g) => !(g.steamAppId || g.art.cover)).length;
console.log('\n  MISC');
console.log(`    year range          ${Math.min(...years)} – ${Math.max(...years)}`);
console.log(`    average rating      ${avgRating}`);
console.log(`    genres              ${new Set(GAMES.flatMap((g) => g.genres)).size}`);
console.log(`    using fallback art  ${noArt} / ${GAMES.length}  (run \`npm run data:art\` to cache covers)`);
console.log('');
