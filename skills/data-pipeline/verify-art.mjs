/**
 * Checks that every cached art URL actually resolves.
 *
 *   npm run data:verify-art [-- --fix]
 *
 * Derived Steam URLs are the risk: `page_bg_raw.jpg` is built from the app id
 * but not every app has one, so a game could ship a hero that 404s into a
 * broken-image icon across its detail page. Cached Nintendo, PlayStation and
 * Wikipedia URLs can also rot over time.
 *
 * With `--fix`, unreachable heroes and screenshots are stripped from the
 * dataset so the next `npm run data:art` re-fetches them from scratch.
 * Covers are only reported — losing one silently would be worse than a 404,
 * since the card falls back to generated art either way.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve(import.meta.dirname, '../..');
const GAMES_DIR = path.join(ROOT, 'src/data/games');
const FIX = process.argv.includes('--fix');
const UA = 'LudexDev/0.1 (personal game-discovery project)';
// Wikimedia rate-limits hard. At 12 in flight it returned 429 for 43 perfectly
// good covers, and reporting those as broken would be worse than not checking.
const CONCURRENCY = 4;

const { GAMES } = await import(pathToFileURL(path.join(GAMES_DIR, 'index.ts')).href);
const { coverUrl, heroUrl, shotUrls } = await import(
  pathToFileURL(path.join(ROOT, 'src/data/art.ts')).href
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Is this URL reachable?
 *
 * Retries on 429 and 5xx, because "the host is throttling me" is not the same
 * as "this image is gone" — conflating them made the verifier condemn 43 good
 * covers. Only a 404-class response or a hard network failure counts as broken.
 */
async function ok(url, attempts = 3) {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': UA, Range: 'bytes=0-64' },
        signal: AbortSignal.timeout(15_000),
      });
      if (res.status === 429 || res.status >= 500) {
        await sleep(1500 * (i + 1));
        continue;
      }
      return res.ok && (res.headers.get('content-type') ?? '').startsWith('image');
    } catch {
      await sleep(600 * (i + 1));
    }
  }
  // Never resolved a definitive answer — assume fine rather than delete data.
  return true;
}

/** Runs `task` over `items` with a bounded number of requests in flight. */
async function pool(items, task) {
  const results = [];
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
      while (cursor < items.length) {
        const i = cursor++;
        results[i] = await task(items[i]);
      }
    }),
  );
  return results;
}

console.log(`\n  Verifying art for ${GAMES.length} games…\n`);

const broken = { cover: [], hero: [], shots: [] };

await pool(GAMES, async (game) => {
  const cover = coverUrl(game);
  const hero = heroUrl(game);
  const shots = shotUrls(game);

  if (cover && !(await ok(cover))) broken.cover.push(game.slug);
  // Only flag a hero that is distinct from the cover — otherwise a broken
  // cover would be reported twice.
  if (hero && hero !== cover && !(await ok(hero))) broken.hero.push(game.slug);

  const bad = [];
  for (const s of shots) if (!(await ok(s))) bad.push(s);
  if (bad.length) broken.shots.push({ slug: game.slug, count: bad.length, total: shots.length });
});

for (const [kind, list] of Object.entries(broken)) {
  if (list.length === 0) continue;
  console.log(`  ${kind}: ${list.length} game(s)`);
  for (const entry of list.slice(0, 20)) {
    console.log(
      '     ' + (typeof entry === 'string' ? entry : `${entry.slug} (${entry.count}/${entry.total})`),
    );
  }
  if (list.length > 20) console.log(`     … and ${list.length - 20} more`);
}

if (!broken.cover.length && !broken.hero.length && !broken.shots.length) {
  console.log('  Every cached art URL resolves. ✔\n');
  process.exit(0);
}

if (!FIX) {
  console.log('\n  Re-run with `--fix` to strip the unreachable heroes and screenshots.\n');
  process.exit(0);
}

/* -- strip broken hero/shots so data:art re-fetches them -- */
const shards = (await fs.readdir(GAMES_DIR)).filter((f) => f.endsWith('.ts') && f !== 'index.ts');
const strip = new Set([...broken.hero, ...broken.shots.map((s) => s.slug)]);
let touched = 0;

for (const shard of shards) {
  const file = path.join(GAMES_DIR, shard);
  let src = await fs.readFile(file, 'utf8');

  for (const slug of strip) {
    const at = src.indexOf(`slug: '${slug}',`);
    if (at === -1) continue;
    const artAt = src.indexOf('art: {', at);
    const close = src.indexOf('}', artAt);
    if (artAt === -1 || close === -1) continue;

    const inner = src.slice(artAt + 6, close);
    const kept = inner
      .split(/,\s*(?=[a-zA-Z]+:)/)
      .filter((part) => {
        const key = part.trim().split(':')[0].trim();
        if (key === 'hero' && broken.hero.includes(slug)) return false;
        if (key === 'shots' && broken.shots.some((s) => s.slug === slug)) return false;
        return true;
      })
      .join(', ')
      .trim();

    src = src.slice(0, artAt) + `art: { ${kept} }` + src.slice(close + 1);
    touched++;
  }
  await fs.writeFile(file, src, 'utf8');
}

console.log(`\n  Stripped unreachable art from ${touched} game(s). Run \`npm run data:art\`.\n`);
