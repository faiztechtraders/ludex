/**
 * App-facing re-export of the seeded RNG.
 *
 * Never call `Math.random()` anywhere in Ludex — the daily rotation and daily
 * spin must be identical for every user and stable within a day. Import from
 * here instead.
 */
export {
  hashString,
  mulberry32,
  seededRandom,
  seededFloat,
  seededShuffle,
  seededPick,
  todaySeed,
} from '@skills/recommendation/rng.ts';
