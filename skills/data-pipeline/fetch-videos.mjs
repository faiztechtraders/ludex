/**
 * Snapshot Steam trailer ids into `src/data/videos.ts`.
 *
 *   npm run data:videos
 *
 * A short video answers "what is this actually like" faster than any blurb,
 * and matters most for the games with no screenshots at all.
 *
 * Only the **movie id** is stored. Both the webm and the poster derive from it,
 * exactly as screenshot paths derive from `steamAppId` — see src/data/art.ts
 * for the same trick. Storing full URLs would triple the payload for no gain.
 *
 * Steam's own hosted trailer is used rather than YouTube: it is the publisher's
 * footage, needs no API key, and loads no third-party script into a site that
 * otherwise ships everything itself. Games with no Steam listing fall back to a
 * YouTube *search link* in the UI — a link never picks the wrong video, which a
 * scraped "best guess" absolutely would.
 */

import fs from 'node:fs';
import { GAMES } from '../../src/data/games/index.ts';

const OUT = 'src/data/videos.ts';
const targets = GAMES.filter((g) => g.steamAppId);
console.log(`\n  Fetching trailers for ${targets.length} games…\n`);

const found = new Map();
let checked = 0;

for (const game of targets) {
  try {
    const res = await fetch(
      `https://store.steampowered.com/api/appdetails?appids=${game.steamAppId}&filters=movies&l=en`,
      { headers: { 'user-agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(15_000) },
    );
    const body = await res.json();
    const movie = body?.[String(game.steamAppId)]?.data?.movies?.[0];
    if (movie?.id) found.set(game.slug, movie.id);
  } catch {
    /* a missing trailer is a normal outcome */
  }
  if (++checked % 100 === 0) console.log(`    …${checked}/${targets.length} (${found.size} found)`);
  await new Promise((r) => setTimeout(r, 260));
}

console.log(`\n  ${found.size} trailers of ${targets.length}`);

if (found.size === 0) {
  console.log('  ✖ Nothing resolved; leaving the existing file alone.\n');
  process.exit(1);
}

const rows = [...found.entries()]
  .sort(([a], [b]) => (a < b ? -1 : 1))
  .map(([slug, id]) => `  '${slug}': ${id},`)
  .join('\n');

fs.writeFileSync(
  OUT,
  `/**
 * Steam trailer ids — GENERATED, do not edit by hand.
 *
 * Written by \`npm run data:videos\`. Only the id is stored; the video and its
 * poster are derived in src/lib/video.ts, the same way screenshot paths derive
 * from steamAppId. Games absent from this map show a YouTube search link.
 */

/** slug -> Steam movie id */
export const VIDEOS: Record<string, number> = {
${rows}
};
`,
);
console.log(`  Wrote ${OUT}\n`);
