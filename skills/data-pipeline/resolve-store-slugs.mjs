/**
 * Resolve PlayStation and Nintendo store slugs for cross-platform games.
 *
 *   npm run data:store-slugs
 *   npm run data:store-slugs -- --store=playstation --limit=50
 *
 * Console slugs only ever got persisted for exclusives, because those are the
 * games the art pipeline had to scrape. A game on both Steam and PS5 therefore
 * had a Steam price and link and nothing else — which hides that the PlayStation
 * price is different, and it usually is.
 *
 * A slug is only written when the URL actually returns a product page, so a
 * wrong guess costs a 404 during this run rather than a dead link on the site.
 */

import fs from 'node:fs';
import path from 'node:path';
import { GAMES } from '../../src/data/games/index.ts';

const args = process.argv.slice(2);
const only = args.find((a) => a.startsWith('--store='))?.split('=')[1];
const limit = Number(args.find((a) => a.startsWith('--limit='))?.split('=')[1] ?? Infinity);
const DIR = 'src/data/games';
const UA = 'Mozilla/5.0';

/**
 * Candidate slugs, most likely first.
 *
 * The apostrophe is the interesting case: a naive slugify turns "Baldur's Gate
 * 3" into "baldur-s-gate-3", which 404s — the stores drop the apostrophe
 * entirely rather than treating it as a separator.
 */
function variants(title) {
  const strip = (s) =>
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

  const noApostrophe = title.replace(/['’]/g, '');
  const out = new Set([strip(noApostrophe), strip(title)]);
  // Subtitles are frequently dropped from the store URL.
  const head = noApostrophe.split(/[:–—]/)[0];
  if (head !== noApostrophe) out.add(strip(head));
  return [...out].filter(Boolean);
}

/**
 * The store's own full product name, borrowed from Steam.
 *
 * Ludex titles are deliberately short — "Dragon Quest XI S" — while console
 * store URLs use the full retail name,
 * `dragon-quest-xi-s-echoes-of-an-elusive-age-definitive-edition-switch`.
 * No amount of suffix guessing invents a subtitle the dataset never had, so
 * where a Steam id exists we ask Steam what the game is really called and
 * derive candidates from that too. Free of extra guessing: it is the
 * publisher's own name for the product.
 */
const steamNames = new Map();
async function steamName(appId) {
  if (steamNames.has(appId)) return steamNames.get(appId);
  let name = null;
  try {
    const res = await fetch(
      `https://store.steampowered.com/api/appdetails?appids=${appId}&filters=basic&l=en`,
      { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(15_000) },
    );
    const json = await res.json();
    if (json?.[appId]?.success) name = json[appId].data?.name ?? null;
  } catch {
    /* fall back to the dataset title */
  }
  steamNames.set(appId, name);
  return name;
}

async function resolves(url) {
  try {
    const res = await fetch(url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(15_000) });
    return res.status === 200;
  } catch {
    return false;
  }
}

const STORES = {
  playstation: {
    field: 'playstationSlug',
    platforms: ['ps5', 'ps4'],
    url: (s) => `https://www.playstation.com/en-my/games/${s}/`,
  },
  nintendo: {
    field: 'nintendoSlug',
    platforms: ['switch', 'switch2'],
    // Switch-2 listings are separate products; try the newer one first.
    url: (s) => `https://www.nintendo.com/us/store/products/${s}/`,
    suffixes: ['-switch-2', '-switch', ''],
  },
};

const resolved = new Map();

for (const [name, store] of Object.entries(STORES)) {
  if (only && only !== name) continue;

  const targets = GAMES.filter(
    (g) => !g[store.field] && g.platforms.some((p) => store.platforms.includes(p)),
  ).slice(0, limit);

  console.log(`\n  ${name}: trying ${targets.length} games…\n`);
  let hits = 0;

  for (const [i, game] of targets.entries()) {
    // Dataset title first — it is right most of the time and costs no request.
    const bases = variants(game.title);
    if (game.steamAppId) {
      const full = await steamName(game.steamAppId);
      if (full && full.toLowerCase() !== game.title.toLowerCase()) {
        for (const v of variants(full)) if (!bases.includes(v)) bases.push(v);
      }
    }

    const candidates = [];
    for (const base of bases) {
      for (const suffix of store.suffixes ?? ['']) candidates.push(`${base}${suffix}`);
    }

    for (const slug of candidates) {
      if (await resolves(store.url(slug))) {
        resolved.set(`${game.slug}::${store.field}`, slug);
        hits++;
        break;
      }
      await new Promise((r) => setTimeout(r, 120));
    }

    if ((i + 1) % 50 === 0 || i + 1 === targets.length) {
      console.log(`    …${i + 1}/${targets.length}  (${hits} resolved)`);
    }
  }
  console.log(`    ${name}: ${hits}/${targets.length}`);
}

/* ------------------------------------------------------------------ write */

let applied = 0;
for (const file of fs.readdirSync(DIR).filter((f) => f.endsWith('.ts') && f !== 'index.ts')) {
  const p = path.join(DIR, file);
  const original = fs.readFileSync(p, 'utf8');
  let src = original;

  for (const [key, slug] of resolved) {
    const [gameSlug, field] = key.split('::');
    const has = new RegExp(`slug: '${gameSlug}',[\\s\\S]{0,700}?${field}:`);
    if (has.test(src)) continue;
    const anchor = new RegExp(`(slug: '${gameSlug}',)`);
    if (!anchor.test(src)) continue;
    src = src.replace(anchor, `$1\n    ${field}: '${slug}',`);
    applied++;
  }

  if (src !== original) fs.writeFileSync(p, src);
}

console.log(`\n  Wrote ${applied} slug(s). Run data:prices next.\n`);
