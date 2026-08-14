/**
 * Find missing `steamAppId`s for PC games.
 *
 *   npm run data:steam-ids
 *
 * A game on Steam without its app id gets no price and no product link — only
 * a "Search store" fallback. Farming Simulator 25 was sitting on Steam the
 * whole time; nothing flagged it, because a missing id is indistinguishable
 * from a game that genuinely is not sold there.
 *
 * Matching is strict on purpose. A wrong id is far worse than a missing one:
 * it shows another game's price and links to the wrong store page, and this
 * project has already had Injustice 2 wearing Holy Potatoes' art. Only an
 * exact normalised title match, or a prefix whose remainder is edition noise,
 * is accepted — and the result is confirmed against the store before writing.
 */

import fs from 'node:fs';
import path from 'node:path';
import { GAMES } from '../../src/data/games/index.ts';

const args = process.argv.slice(2);
const limit = Number(args.find((a) => a.startsWith('--limit='))?.split('=')[1] ?? Infinity);
const dry = args.includes('--dry');
const DIR = 'src/data/games';
const UA = 'Mozilla/5.0';

const ROMAN = { ii: '2', iii: '3', iv: '4', v: '5', vi: '6', vii: '7', viii: '8', ix: '9', x: '10' };

const normalize = (s) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .map((w) => ROMAN[w] ?? w)
    .join('');

/** Editions and add-ons that must never be mistaken for the base game. */
const NOISE = /(soundtrack|demo|dlc|bundle|pack|beta|server|sdk|artbook|art book|upgrade|season pass|expansion|edition pass)/i;
/** Suffixes that still denote the same game. */
const EDITION =
  /^(the )?(final cut|definitive|complete|enhanced|remaster(ed)?|deluxe|ultimate|goty|game of the year|director s cut|anniversary|standard|s)( edition)?$/;

async function search(title) {
  try {
    const res = await fetch(
      `https://steamcommunity.com/actions/SearchApps/${encodeURIComponent(title)}`,
      { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(15_000) },
    );
    return res.ok ? await res.json() : [];
  } catch {
    return [];
  }
}

async function confirm(appId, title) {
  try {
    const res = await fetch(
      `https://store.steampowered.com/api/appdetails?appids=${appId}&filters=basic&l=en`,
      { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(15_000) },
    );
    const body = await res.json();
    const entry = body?.[String(appId)];
    if (!entry?.success) return false;
    const a = normalize(title);
    const b = normalize(entry.data?.name ?? '');
    return a === b || b.startsWith(a) || a.startsWith(b);
  } catch {
    // Indeterminate — refuse rather than write an unconfirmed id.
    return false;
  }
}

const targets = GAMES.filter((g) => g.platforms.includes('pc') && !g.steamAppId).slice(0, limit);
console.log(`\n  ${targets.length} PC games with no Steam app id\n`);

const found = new Map();
for (const game of targets) {
  const results = await search(game.title);
  const want = normalize(game.title);

  const match = results.find((r) => {
    if (NOISE.test(r.name)) return false;
    const n = normalize(r.name);
    if (n === want) return true;
    if (!n.startsWith(want)) return false;
    // Only edition wording may follow the title.
    const extra = r.name.toLowerCase().slice(game.title.length).replace(/[^a-z ]/g, ' ').trim();
    return extra === '' || EDITION.test(extra);
  });

  if (match && (await confirm(match.appid, game.title))) {
    found.set(game.slug, Number(match.appid));
    console.log(`    ✔ ${game.title} → ${match.appid} (${match.name})`);
  } else {
    console.log(`    ○ ${game.title}${match ? ' — candidate rejected on confirm' : ''}`);
  }
  await new Promise((r) => setTimeout(r, 400));
}

console.log(`\n  resolved ${found.size}/${targets.length}`);
if (dry || found.size === 0) process.exit(0);

let applied = 0;
for (const file of fs.readdirSync(DIR).filter((f) => f.endsWith('.ts') && f !== 'index.ts')) {
  const p = path.join(DIR, file);
  const original = fs.readFileSync(p, 'utf8');
  let src = original;
  for (const [slug, id] of found) {
    const has = new RegExp(`slug: '${slug}',[\\s\\S]{0,600}?steamAppId:`);
    if (has.test(src)) continue;
    const anchor = new RegExp(`(slug: '${slug}',)`);
    if (!anchor.test(src)) continue;
    src = src.replace(anchor, `$1\n    steamAppId: ${id},`);
    applied++;
  }
  if (src !== original) fs.writeFileSync(p, src);
}
console.log(`  wrote ${applied} id(s). Run data:prices next.\n`);
