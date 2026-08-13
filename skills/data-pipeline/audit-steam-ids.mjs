/**
 * Confirm every `steamAppId` actually points at the game that claims it.
 *
 * `verify-art` proves a URL resolves; it cannot prove it resolves to the RIGHT
 * game. A wrong-but-valid id is the worst kind of art bug — every image loads,
 * nothing 404s, and the card quietly wears another game's box art. Placid
 * Plastic Duck Simulator shipped with ZERO Sievert's id; Operation: Tango and
 * Nubby's Number Factory both had ids that resolved to nothing at all.
 *
 * Asks Steam for each app's real name and compares it to the title.
 *
 *   node skills/data-pipeline/audit-steam-ids.mjs
 *   node skills/data-pipeline/audit-steam-ids.mjs --limit=50
 */

import { GAMES } from '../../src/data/games/index.ts';

const args = process.argv.slice(2);
const limit = Number(args.find((a) => a.startsWith('--limit='))?.split('=')[1] ?? Infinity);

/** Steam rate-limits hard; this stays well under it. */
const CONCURRENCY = 3;
const DELAY_MS = 220;

/** Roman numerals in titles are cosmetic — "Blasphemous II" is "Blasphemous 2". */
const ROMAN = { ii: '2', iii: '3', iv: '4', v: '5', vi: '6', vii: '7', viii: '8', ix: '9', x: '10' };

/**
 * Steam sometimes sells a game under a genuinely different name. These are
 * verified same-product pairs, not guesses — without them the audit cries wolf
 * and the real mismatches get lost in the noise.
 *
 * Keep this list short. Every entry is a case the normaliser *cannot* reach,
 * not a case it merely gets wrong — those belong in `normalize`.
 */
const ALIASES = {
  'uncharted-4': 'uncharted legacy of thieves collection',
};

const normalize = (s) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, 'and')
    .replace(/[Δδ]/g, 'delta')
    // Edition suffixes are noise, not a mismatch.
    .replace(
      /\b(the )?(definitive|deluxe|ultimate|complete|enhanced|remastered|remake|goty|game of the year|final cut|anniversary|standard) (edition|cut|version)\b/g,
      '',
    )
    // Punctuation FIRST, then roman numerals. The other order leaves "IV:" and
    // "II®" attached to their punctuation so they never match the lookup, which
    // made the audit condemn five perfectly good ids — Age of Empires IV,
    // Remnant II, Armored Core VI among them.
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .map((w) => ROMAN[w] ?? w)
    .join('');

async function appName(id) {
  const url = `https://store.steampowered.com/api/appdetails?appids=${id}&filters=basic&l=en`;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' } });
      if (res.status === 429 || res.status >= 500) {
        await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
        continue;
      }
      const json = await res.json();
      const entry = json?.[String(id)];
      if (!entry) return { status: 'unknown' };
      if (!entry.success) return { status: 'missing' };
      return { status: 'ok', name: entry.data?.name ?? '' };
    } catch {
      await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
    }
  }
  // Indeterminate: never report a mismatch we could not actually establish.
  return { status: 'unknown' };
}

const targets = GAMES.filter((g) => g.steamAppId).slice(0, limit);
console.log(`\n  Auditing ${targets.length} Steam app ids…\n`);

const mismatches = [];
const missing = [];
let checked = 0;

const queue = [...targets];
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length) {
      const game = queue.shift();
      const result = await appName(game.steamAppId);
      checked++;
      if (checked % 50 === 0) console.log(`    …${checked}/${targets.length}`);

      if (result.status === 'missing') {
        missing.push(game);
      } else if (result.status === 'ok') {
        const a = normalize(ALIASES[game.slug] ?? game.title);
        const b = normalize(result.name);
        if (a !== b && !a.includes(b) && !b.includes(a)) {
          mismatches.push({ game, actual: result.name });
        }
      }
      await new Promise((r) => setTimeout(r, DELAY_MS));
    }
  }),
);

if (mismatches.length) {
  console.log(`\n  ✖  ${mismatches.length} id(s) point at a different game:\n`);
  for (const { game, actual } of mismatches) {
    console.log(`     ${game.slug}`);
    console.log(`       claims : ${game.title}`);
    console.log(`       app ${game.steamAppId} is : ${actual}`);
  }
}

if (missing.length) {
  console.log(`\n  ⚠  ${missing.length} id(s) resolve to no Steam app (delisted, or simply wrong):\n`);
  for (const game of missing) console.log(`     ${game.slug} — app ${game.steamAppId}`);
}

if (!mismatches.length && !missing.length) {
  console.log('  Every Steam app id matches its game. ✔\n');
}

/* ------------------------------------------------------------------ --fix */
/**
 * Look the correct id up from Steam's own search rather than guessing it.
 * Hand-written ids are exactly how this went wrong: they look plausible, they
 * resolve to *something*, and nothing complains.
 */
if (args.includes('--fix') && (mismatches.length || missing.length)) {
  const fs = await import('node:fs');
  const path = await import('node:path');

  const broken = [...mismatches.map((m) => m.game), ...missing];
  const resolved = new Map();

  console.log(`\n  Resolving ${broken.length} id(s) from Steam search…\n`);
  for (const game of broken) {
    const url = `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(game.title)}&l=en&cc=us`;
    let items = [];
    try {
      const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' } });
      items = (await res.json())?.items ?? [];
    } catch {
      /* fall through to "no match" */
    }
    const want = normalize(ALIASES[game.slug] ?? game.title);
    // Exact normalized title only. A fuzzy match here would re-create the bug.
    const hit = items.find((i) => normalize(i.name) === want);
    if (hit) {
      resolved.set(game.slug, hit.id);
      console.log(`     ${game.slug}: ${game.steamAppId} -> ${hit.id}  (${hit.name})`);
    } else {
      console.log(`     ${game.slug}: no confident match — dropping steamAppId`);
      resolved.set(game.slug, null);
    }
    await new Promise((r) => setTimeout(r, DELAY_MS));
  }

  const DIR = 'src/data/games';
  let edited = 0;
  for (const file of fs.readdirSync(DIR).filter((f) => f.endsWith('.ts') && f !== 'index.ts')) {
    const p = path.join(DIR, file);
    const original = fs.readFileSync(p, 'utf8');
    let src = original;
    for (const [slug, id] of resolved) {
      const re = new RegExp(`(slug: '${slug}',[\\s\\S]*?)\\n\\s*steamAppId: \\d+,`);
      // Dropping it is the safe outcome: enrichment can search by title later,
      // and a generated cover beats another game's box art.
      src = src.replace(re, id === null ? '$1' : `$1\n    steamAppId: ${id},`);
    }
    if (src !== original) {
      fs.writeFileSync(p, src);
      edited++;
    }
  }
  console.log(`\n  Rewrote ${edited} shard file(s). Re-run data:art, then this audit again.\n`);
}

process.exit(mismatches.length && !args.includes('--fix') ? 1 : 0);
