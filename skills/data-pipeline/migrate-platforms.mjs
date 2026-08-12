/**
 * ONE-OFF MIGRATION — adds PS4 / Xbox One / Xbox Series to existing records.
 *
 * Ludex originally shipped four platforms (PC, PS5, Switch, Switch 2). PS4 and
 * Xbox One are still in millions of living rooms, so leaving them out hid most
 * of the library from the people who most needed it.
 *
 * This script only ever *adds* platforms. It never touches `pc`, `switch`,
 * `switch2` or the existing `ps5` entries, which means `switch2Status` stays
 * valid by construction — the validator's Nintendo rules cannot be broken by a
 * run of this.
 *
 * Safe to re-run: platforms already present are skipped.
 *
 *   node skills/data-pipeline/migrate-platforms.mjs [--dry]
 *
 * Kept in the repo as the record of how the platform expansion was applied.
 * New games should be authored with their full platform list directly.
 */

import path from 'node:path';
import fs from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve(import.meta.dirname, '../..');
const GAMES_DIR = path.join(ROOT, 'src/data/games');
const DRY = process.argv.includes('--dry');

/* Shorthands for the combinations that come up over and over. */
const CURRENT = ['xbox-series']; //           current-gen Xbox only
const BOTH_XBOX = ['xbox-series', 'xbox-one']; //  both Xbox generations
const PS4_XBOX = ['ps4', 'xbox-series', 'xbox-one']; // full cross-gen
const PS4_ONLY = ['ps4']; //                  PlayStation cross-gen, no Xbox
const PS5_XS = ['ps5', 'xbox-series']; //     modern console pair

/**
 * slug -> platforms to add.
 *
 * Sony first-party titles deliberately get no Xbox entry, and Microsoft-
 * published ones get no PlayStation entry where that is genuinely the case.
 * Games absent from this map keep the platforms they were authored with.
 */
const ADD = {
  /* -- mainstream ------------------------------------------------------- */
  'elden-ring': PS4_XBOX,
  'baldurs-gate-3': CURRENT,
  'cyberpunk-2077': PS4_XBOX,
  'god-of-war-ragnarok': PS4_ONLY, // Sony first-party — never on Xbox
  hades: PS4_XBOX,
  'stardew-valley': PS4_XBOX,
  'it-takes-two': PS4_XBOX,
  'red-dead-redemption-2': PS4_XBOX,
  'resident-evil-4-remake': ['ps4', 'xbox-series'],
  'helldivers-2': [], // Sony first-party
  'the-witcher-3': PS4_XBOX,
  'split-fiction': CURRENT,
  'street-fighter-6': ['ps4', 'xbox-series'],
  'hogwarts-legacy': PS4_XBOX,
  'marvels-spider-man-2': [], // Sony first-party
  'sonic-racing-crossworlds': BOTH_XBOX,
  'overcooked-2': PS4_XBOX,

  /* -- mainstream, second shard ----------------------------------------- */
  minecraft: PS4_XBOX,
  'elder-scrolls-v-skyrim': PS4_XBOX,
  'grand-theft-auto-v': PS4_XBOX,
  'super-smash-bros-ultimate': [], // Nintendo first-party
  sekiro: PS4_XBOX,
  'dark-souls-iii': PS4_XBOX,
  'persona-5-royal': PS4_XBOX,
  'final-fantasy-vii-rebirth': [], // PlayStation + PC only
  'clair-obscur-expedition-33': CURRENT,
  'astro-bot': [], // Sony first-party
  'ghost-of-tsushima': PS4_ONLY, // Sony first-party
  'horizon-forbidden-west': PS4_ONLY, // Sony first-party
  'monster-hunter-wilds': CURRENT,
  'diablo-iv': PS4_XBOX,
  returnal: [], // Sony first-party
  'ratchet-and-clank-rift-apart': [], // Sony first-party
  'alan-wake-2': CURRENT,
  'resident-evil-village': PS4_XBOX,
  cuphead: PS4_XBOX,
  terraria: PS4_XBOX,
  'hollow-knight-silksong': PS4_XBOX,
  'doom-the-dark-ages': CURRENT,
  'among-us': PS4_XBOX,

  /* -- indie darlings ---------------------------------------------------- */
  'hollow-knight': PS4_XBOX,
  celeste: PS4_XBOX,
  'hades-ii': PS5_XS,
  'disco-elysium': PS4_XBOX,
  'outer-wilds': PS4_XBOX,
  'hyper-light-drifter': PS4_XBOX,
  tunic: PS4_XBOX,
  'dead-cells': PS4_XBOX,
  'cult-of-the-lamb': PS4_XBOX,
  'slay-the-spire': PS4_XBOX,
  inscryption: PS4_XBOX,
  'return-of-the-obra-dinn': PS4_XBOX,
  'a-short-hike': PS4_XBOX,
  spiritfarer: PS4_XBOX,
  undertale: PS4_XBOX,
  balatro: PS4_XBOX,
  'animal-well': CURRENT,
  'pizza-tower': PS4_XBOX,
  'chants-of-sennaar': PS4_XBOX,
  'blue-prince': CURRENT,
  'death-s-door': PS4_XBOX,
  'deep-rock-galactic': PS4_XBOX,
  'lethal-company': [], // PC only
  phasmophobia: CURRENT,
  'powerwash-simulator': PS4_XBOX,
  dredge: PS4_XBOX,

  /* -- hidden gems -------------------------------------------------------- */
  signalis: PS4_XBOX,
  sable: PS5_XS,
  'citizen-sleeper': PS4_XBOX,
  'the-forgotten-city': PS4_XBOX,
  'void-stranger': [], // PC + Switch only
  norco: PS4_XBOX,
  'lorelei-and-the-laser-eyes': [],
  pentiment: PS4_XBOX,
  immortality: PS5_XS,
  tinykin: PS4_XBOX,
  'the-case-of-the-golden-idol': PS4_XBOX,
  'rain-world': PS4_XBOX,
  '1000xresist': PS5_XS,
  'nine-sols': PS4_XBOX,
  'bomb-rush-cyberfunk': PS4_XBOX,
  venba: PS5_XS,
  'paradise-killer': PS4_XBOX,
  'astlibra-revision': ['ps5', 'ps4'],
  'moon-remix-rpg': [],
  unrailed: PS4_XBOX,
};

/* -- canonical ordering, matching PLATFORMS in src/data/schema.ts -- */
const ORDER = ['pc', 'ps5', 'ps4', 'xbox-series', 'xbox-one', 'switch2', 'switch'];
const sortPlatforms = (list) =>
  [...new Set(list)].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));

const shards = (await fs.readdir(GAMES_DIR)).filter((f) => f.endsWith('.ts') && f !== 'index.ts');
const { GAMES } = await import(pathToFileURL(path.join(GAMES_DIR, 'index.ts')).href);

const sources = new Map();
for (const shard of shards) {
  sources.set(shard, await fs.readFile(path.join(GAMES_DIR, shard), 'utf8'));
}

let changed = 0;
let skipped = 0;
const unmapped = [];

for (const game of GAMES) {
  const additions = ADD[game.slug];
  if (additions === undefined) {
    unmapped.push(game.slug);
    continue;
  }

  const next = sortPlatforms([...game.platforms, ...additions]);
  if (next.length === game.platforms.length) {
    skipped++;
    continue;
  }

  const literal = `platforms: [${next.map((p) => `'${p}'`).join(', ')}]`;

  for (const shard of shards) {
    const src = sources.get(shard);
    const at = src.indexOf(`slug: '${game.slug}'`);
    if (at === -1) continue;

    const pAt = src.indexOf('platforms: [', at);
    const close = src.indexOf(']', pAt);
    if (pAt === -1 || close === -1) break;

    sources.set(shard, src.slice(0, pAt) + literal + src.slice(close + 1));
    changed++;
    break;
  }
}

if (!DRY && changed > 0) {
  for (const shard of shards) {
    await fs.writeFile(path.join(GAMES_DIR, shard), sources.get(shard), 'utf8');
  }
}

console.log(`
  ${changed} games gained platforms
  ${skipped} already up to date
  ${unmapped.length} not in the migration map${unmapped.length ? `: ${unmapped.join(', ')}` : ''}

  ${DRY ? 'Dry run — nothing written.' : 'Done. Run `npm run data:validate` next.'}
`);
