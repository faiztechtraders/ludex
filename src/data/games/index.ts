/**
 * The Ludex library.
 *
 * Sharded by tier purely for authoring sanity — the engine treats it as one
 * flat list. After editing any shard, run `npm run data:validate`.
 */

import type { Game, Platform, Tier } from '../schema.ts';
import { MAINSTREAM_GAMES } from './mainstream.ts';
import { MAINSTREAM_GAMES_2 } from './mainstream-2.ts';
import { MAINSTREAM_GAMES_3 } from './mainstream-3.ts';
import { MAINSTREAM_GAMES_4 } from './mainstream-4.ts';
import { MAINSTREAM_GAMES_5 } from './mainstream-5.ts';
import { MAINSTREAM_GAMES_6 } from './mainstream-6.ts';
import { MAINSTREAM_GAMES_7 } from './mainstream-7.ts';
import { MAINSTREAM_GAMES_8 } from './mainstream-8.ts';
import { MAINSTREAM_GAMES_9 } from './mainstream-9.ts';
import { MAINSTREAM_GAMES_10 } from './mainstream-10.ts';
import { INDIE_GAMES } from './indie.ts';
import { INDIE_GAMES_2 } from './indie-2.ts';
import { INDIE_GAMES_3 } from './indie-3.ts';
import { INDIE_GAMES_4 } from './indie-4.ts';
import { INDIE_GAMES_5 } from './indie-5.ts';
import { INDIE_GAMES_6 } from './indie-6.ts';
import { RECENT_GAMES } from './recent-2025.ts';
import { HIDDEN_GEMS } from './hidden-gems.ts';
import { HIDDEN_GEMS_2 } from './hidden-gems-2.ts';
import { HIDDEN_GEMS_3 } from './hidden-gems-3.ts';
import { HIDDEN_GEMS_4 } from './hidden-gems-4.ts';
import { HIDDEN_GEMS_5 } from './hidden-gems-5.ts';
import { HIDDEN_GEMS_6 } from './hidden-gems-6.ts';

export const GAMES: Game[] = [
  ...MAINSTREAM_GAMES,
  ...MAINSTREAM_GAMES_2,
  ...MAINSTREAM_GAMES_3,
  ...MAINSTREAM_GAMES_4,
  ...MAINSTREAM_GAMES_5,
  ...MAINSTREAM_GAMES_6,
  ...MAINSTREAM_GAMES_7,
  ...MAINSTREAM_GAMES_8,
  ...MAINSTREAM_GAMES_9,
  ...MAINSTREAM_GAMES_10,
  ...INDIE_GAMES,
  ...INDIE_GAMES_2,
  ...INDIE_GAMES_3,
  ...INDIE_GAMES_4,
  ...INDIE_GAMES_5,
  ...INDIE_GAMES_6,
  ...RECENT_GAMES,
  ...HIDDEN_GEMS,
  ...HIDDEN_GEMS_2,
  ...HIDDEN_GEMS_3,
  ...HIDDEN_GEMS_4,
  ...HIDDEN_GEMS_5,
  ...HIDDEN_GEMS_6,
];

/** Slug -> game, for O(1) lookups by route param and by `similar` resolution. */
export const GAMES_BY_SLUG: ReadonlyMap<string, Game> = new Map(
  GAMES.map((game) => [game.slug, game]),
);

export function getGame(slug: string | undefined): Game | undefined {
  return slug ? GAMES_BY_SLUG.get(slug) : undefined;
}

/** Every genre present in the library, sorted — powers the Browse filter. */
export const ALL_GENRES: string[] = [
  ...new Set(GAMES.flatMap((g) => g.genres)),
].sort();

export function countByPlatform(platform: Platform): number {
  return GAMES.filter((g) => g.platforms.includes(platform)).length;
}

export function countByTier(tier: Tier): number {
  return GAMES.filter((g) => g.tier === tier).length;
}

export {
  MAINSTREAM_GAMES,
  MAINSTREAM_GAMES_2,
  MAINSTREAM_GAMES_3,
  MAINSTREAM_GAMES_4,
  MAINSTREAM_GAMES_5,
  MAINSTREAM_GAMES_6,
  MAINSTREAM_GAMES_7,
  INDIE_GAMES,
  INDIE_GAMES_2,
  INDIE_GAMES_3,
  INDIE_GAMES_4,
  HIDDEN_GEMS,
  HIDDEN_GEMS_2,
  HIDDEN_GEMS_3,
  HIDDEN_GEMS_4,
};
