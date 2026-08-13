/**
 * Validates the curated game library.
 *
 * Catches the failure modes that would otherwise corrupt recommendations
 * silently rather than throwing — a missing vibe axis skews every distance
 * calculation, a dangling `similar` slug renders an empty related-games row,
 * and a duplicate slug makes a detail route unreachable.
 *
 * Run after ANY edit to src/data/games/:
 *   npm run data:validate
 *
 * Exits non-zero on error so it can gate a build.
 */

import { pathToFileURL } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '../..');
const VIBE_AXES = ['pace', 'depth', 'narrative', 'challenge', 'social', 'tone', 'session'];
const PLATFORMS = ['pc', 'ps5', 'ps4', 'xbox-series', 'xbox-one', 'switch2', 'switch'];
const TIERS = ['mainstream', 'indie-darling', 'hidden-gem'];
const SWITCH2_STATUSES = ['native', 'switch2-edition', 'backward-compatible'];
const ART_STYLES = ['pixel', 'stylized', 'realistic', 'anime', 'lowpoly', 'handdrawn'];
const HEX = /^#[0-9a-fA-F]{6}$/;

const errors = [];
const warnings = [];

const err = (slug, msg) => errors.push(`${slug}: ${msg}`);
const warn = (slug, msg) => warnings.push(`${slug}: ${msg}`);

const { GAMES } = await import(
  pathToFileURL(path.join(ROOT, 'src/data/games/index.ts')).href
);

const slugs = new Set();
const ids = new Set();

for (const game of GAMES) {
  const at = game.slug ?? game.title ?? '<unknown>';

  /* -- identity -- */
  if (!game.slug) err(at, 'missing slug');
  else if (slugs.has(game.slug)) err(at, 'duplicate slug');
  else slugs.add(game.slug);

  if (!game.id) err(at, 'missing id');
  else if (ids.has(game.id)) err(at, `duplicate id "${game.id}"`);
  else ids.add(game.id);

  if (!game.title) err(at, 'missing title');
  if (!game.developer) err(at, 'missing developer');
  if (!Number.isInteger(game.year) || game.year < 1970 || game.year > 2100) {
    err(at, `implausible year: ${game.year}`);
  }

  /* -- platforms -- */
  if (!Array.isArray(game.platforms) || game.platforms.length === 0) {
    err(at, 'must have at least one platform');
  } else {
    for (const p of game.platforms) {
      if (!PLATFORMS.includes(p)) err(at, `unknown platform "${p}"`);
    }
  }

  // switch2Status is the honesty check: it is meaningless without the
  // platform, and a Switch 2 listing without it leaves users unable to tell a
  // native title from a backward-compatible one.
  const onSwitch2 = game.platforms?.includes('switch2');
  if (game.switch2Status && !SWITCH2_STATUSES.includes(game.switch2Status)) {
    err(at, `unknown switch2Status "${game.switch2Status}"`);
  }
  if (onSwitch2 && !game.switch2Status) {
    err(at, 'listed on switch2 but has no switch2Status');
  }
  if (!onSwitch2 && game.switch2Status) {
    err(at, 'has switch2Status but is not listed on switch2');
  }
  if (game.switch2Status === 'backward-compatible' && !game.platforms.includes('switch')) {
    err(at, 'marked backward-compatible but is not listed on switch');
  }
  if (game.switch2Status === 'native' && game.platforms.includes('switch')) {
    err(at, 'marked native to switch2 but also listed on switch — pick one');
  }

  /* -- tier & scores -- */
  if (!TIERS.includes(game.tier)) err(at, `unknown tier "${game.tier}"`);
  for (const field of ['popularity', 'rating']) {
    const v = game[field];
    if (typeof v !== 'number' || v < 0 || v > 100) {
      err(at, `${field} must be 0-100, got ${v}`);
    }
  }
  // Tier is editorial, but it has to stay defensible against reach.
  if (game.tier === 'hidden-gem' && game.popularity > 35) {
    warn(at, `tagged hidden-gem but popularity is ${game.popularity} — is it really hidden?`);
  }
  if (game.tier === 'mainstream' && game.popularity < 60) {
    warn(at, `tagged mainstream but popularity is only ${game.popularity}`);
  }

  /* -- vibes: the critical one -- */
  if (!game.vibes || typeof game.vibes !== 'object') {
    err(at, 'missing vibes');
  } else {
    for (const axis of VIBE_AXES) {
      const v = game.vibes[axis];
      if (typeof v !== 'number' || Number.isNaN(v)) {
        err(at, `vibes.${axis} missing or not a number`);
      } else if (v < 0 || v > 1) {
        err(at, `vibes.${axis} must be 0-1, got ${v}`);
      }
    }
    for (const key of Object.keys(game.vibes)) {
      if (!VIBE_AXES.includes(key)) err(at, `unknown vibe axis "${key}"`);
    }
  }

  /* -- presentation -- */
  if (!ART_STYLES.includes(game.artStyle)) err(at, `unknown artStyle "${game.artStyle}"`);
  if (typeof game.hoursToBeat !== 'number' || game.hoursToBeat <= 0) {
    err(at, `hoursToBeat must be positive, got ${game.hoursToBeat}`);
  }
  if (!game.blurb) err(at, 'missing blurb');
  else if (game.blurb.length > 220) warn(at, `blurb is ${game.blurb.length} chars — it will clip`);
  if (!Array.isArray(game.hooks) || game.hooks.length < 2) {
    err(at, 'needs at least 2 hooks');
  }
  if (!Array.isArray(game.genres) || game.genres.length === 0) err(at, 'needs at least one genre');

  /* -- art: accent is required, images are not -- */
  if (!game.art) err(at, 'missing art');
  else if (!HEX.test(game.art.accent ?? '')) {
    err(at, `art.accent must be a 6-digit hex, got "${game.art.accent}"`);
  }
}

/* -- cross-references, once every slug is known -- */
for (const game of GAMES) {
  if (!Array.isArray(game.similar)) {
    err(game.slug, 'similar must be an array');
    continue;
  }
  for (const ref of game.similar) {
    if (ref === game.slug) err(game.slug, 'lists itself in similar');
    else if (!slugs.has(ref)) err(game.slug, `similar references unknown slug "${ref}"`);
  }
}

/* -- `similar` must not repeat itself --
   `similarTo` dedupes and backfills from the vibe-nearest games, so a repeated
   entry costs nothing visible — it just quietly drops one curated pick in
   favour of an algorithmic one, which is the opposite of why the field exists.
   Eighteen arrays picked this up when a bulk repoint mapped a dangling slug
   onto a value already in the same list. */
for (const game of GAMES) {
  const dupes = game.similar.filter((s, i) => game.similar.indexOf(s) !== i);
  if (dupes.length) {
    warnings.push(
      `${game.slug}: similar lists ${[...new Set(dupes)].map((d) => `"${d}"`).join(', ')} more than once`,
    );
  }
}

/* -- two games must not claim the same Steam app --
   `steamAppId` drives cover, hero and screenshot URLs, so a copy-pasted id
   silently dresses one game in another's art. Placid Plastic Duck Simulator
   was given ZERO Sievert's id and inherited its screenshots. The shared-
   screenshot check below catches the symptom; this catches the cause, and
   catches it even before art has been enriched. */
const bySteamId = new Map();
for (const game of GAMES) {
  if (!game.steamAppId) continue;
  if (!bySteamId.has(game.steamAppId)) bySteamId.set(game.steamAppId, []);
  bySteamId.get(game.steamAppId).push(game);
}
for (const [id, entries] of bySteamId) {
  if (entries.length < 2) continue;
  errors.push(
    `steamAppId ${id} claimed by ${entries.map((g) => g.slug).join(' and ')} — one of them is wrong`,
  );
}

/* -- the same game must not appear twice under different slugs --
   Checking slugs alone does not catch this: `chicory` and
   `chicory-a-colorful-tale` are distinct slugs and the same game, as were
   `prince-of-persia-lost-crown` and `prince-of-persia-the-lost-crown`. Four
   pairs slipped in during the 557 -> 757 expansion because the collision check
   compared slugs rather than titles. Normalising the title catches the whole
   class: punctuation, articles and subtitle separators all fall away. */
const titleKey = (game) =>
  game.title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');

const byTitle = new Map();
for (const game of GAMES) {
  const key = titleKey(game);
  if (!byTitle.has(key)) byTitle.set(key, []);
  byTitle.get(key).push(game);
}
for (const [, entries] of byTitle) {
  if (entries.length < 2) continue;
  errors.push(
    `duplicate game: ${entries.map((g) => `"${g.title}" (${g.slug})`).join(' and ')} are the same game under different slugs`,
  );
}

/* -- a series must not straddle a tier boundary --
   Hades was `mainstream` while Hades II was `indie-darling`, and Silksong was
   `mainstream` while Hollow Knight was `indie-darling` at the identical
   popularity. Side by side those look like bugs, because they are. Games count
   as the same series when they share a developer and a leading title word. */
const seriesKey = (game) => {
  const root = game.title
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !['the', 'a', 'an'].includes(w))[0];
  return `${game.developer.toLowerCase()}::${root}`;
};

const series = new Map();
for (const game of GAMES) {
  const key = seriesKey(game);
  if (!series.has(key)) series.set(key, []);
  series.get(key).push(game);
}
for (const [, entries] of series) {
  if (entries.length < 2) continue;
  const tiers = new Set(entries.map((g) => g.tier));
  if (tiers.size > 1) {
    warnings.push(
      `series split across tiers: ${entries.map((g) => `${g.title} (${g.tier}, pop ${g.popularity})`).join(' vs ')}`,
    );
  }
}

/* -- no two games may share a screenshot --
   Nintendo product pages embed ~40 products, and the first scraper took the
   first gallery it found rather than the page's own — so Super Mario Odyssey
   showed Kirby screenshots. Shared image URLs are the fingerprint of that
   whole class of bug, whatever the source. */
const shotOwner = new Map();
for (const game of GAMES) {
  for (const shot of game.art?.shots ?? []) {
    const existing = shotOwner.get(shot);
    if (existing && existing !== game.slug) {
      err(game.slug, `shares a screenshot with "${existing}" — wrong product scraped?`);
    } else {
      shotOwner.set(shot, game.slug);
    }
  }
}

/* -- coverage: no filter combination may dead-end -- */
for (const p of PLATFORMS) {
  const n = GAMES.filter((g) => g.platforms.includes(p)).length;
  if (n === 0) errors.push(`coverage: no games on platform "${p}"`);
  else if (n < 5) warnings.push(`coverage: only ${n} games on "${p}"`);
}
for (const t of TIERS) {
  const n = GAMES.filter((g) => g.tier === t).length;
  if (n < 5) warnings.push(`coverage: only ${n} games in tier "${t}"`);
}

/* -- report -- */
console.log(`\nValidated ${GAMES.length} games.\n`);

if (warnings.length) {
  console.log(`⚠  ${warnings.length} warning(s):`);
  for (const w of warnings) console.log(`   ${w}`);
  console.log('');
}

if (errors.length) {
  console.error(`✖  ${errors.length} error(s):`);
  for (const e of errors) console.error(`   ${e}`);
  console.error('');
  process.exit(1);
}

console.log('✔  Dataset is valid.\n');
