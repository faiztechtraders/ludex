/**
 * Public surface of the recommendation skill.
 *
 * Consumed by the app through `src/engine/`, which is a one-line re-export.
 * Nothing here touches React or the DOM — see skills/README.md.
 */

export {
  recommend,
  scoreGame,
  matchesPlatforms,
  dailySpinPool,
  dailyFeatured,
  similarTo,
} from './scoring.ts';

export {
  hashString,
  mulberry32,
  seededRandom,
  seededFloat,
  seededShuffle,
  seededPick,
  todaySeed,
} from './rng.ts';
