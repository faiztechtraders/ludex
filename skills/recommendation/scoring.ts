/**
 * The Ludex matching engine.
 *
 * Pure TypeScript — no React, no DOM, no browser globals. Runs under plain
 * Node so it can be unit-tested headlessly and reused outside the app.
 *
 * The pipeline, in order:
 *   1. hard platform filter    (a correctness guarantee, not a ranking nudge)
 *   2. weighted vibe distance  (skipped quiz steps carry zero weight)
 *   3. small quality prior     (breaks ties toward better-reviewed games)
 *   4. novelty penalty         (down-rank what the user already saw)
 *   5. seeded daily jitter     (same answers stay fresh day to day)
 *   6. tier quota composition  (~40/30/30 instead of a raw top-N)
 */

import type {
  Game,
  MatchReason,
  Platform,
  RecommendationQuery,
  ScoredGame,
  Tier,
  VibeAxis,
  VibePreferences,
} from '@/data/schema.ts';
import { VIBE_AXES } from '@/data/schema.ts';
import { reasonFor } from '@/data/vibes.ts';
import { seededFloat, seededShuffle, todaySeed } from './rng.ts';

/* ------------------------------------------------------------------ tuning */

/** How much the vibe match matters versus critical consensus. */
const WEIGHT_VIBE = 0.82;
const WEIGHT_QUALITY = 0.18;

/** Multiplier applied to games the user has already been shown or dismissed. */
const SEEN_PENALTY = 0.55;

/** Maximum size of the daily tie-break wobble, in score units (0-1). */
const JITTER = 0.03;

/**
 * The tier mix — 40% mainstream, 30% indie darling, 30% hidden gem. Expressed
 * as the draw pattern in `TIER_PATTERN` below rather than as raw ratios,
 * because the composition works by interleaving rather than by quota counts.
 *
 * Ludex exists to surface things you would not have found, so a
 * blockbuster-heavy taste profile still gets a third of its results from
 * genuine hidden gems. Tuned by feel, not derived.
 */

/**
 * An axis has to match this closely to be worth *saying out loud*. Below it,
 * the match is real but unremarkable, and claiming it would be flattery.
 */
const REASON_THRESHOLD = 0.72;
const MAX_REASONS = 3;

/**
 * How hard to punish an axis for being unsurprising.
 *
 * Most games are single-player, so "solo" matches almost everything — leaving
 * it purely closeness-ranked printed the identical sentence on two thirds of a
 * results page, which reads as a broken template rather than a reason. An axis
 * that separates this game from the rest of the shortlist is worth more than
 * one that everything shares, even if the latter matches more precisely.
 */
const COMMONALITY_PENALTY = 0.65;

/* ---------------------------------------------------------------- helpers */

const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n);

/** Does this game run on at least one platform the user selected? */
export function matchesPlatforms(game: Game, platforms?: Platform[]): boolean {
  if (!platforms || platforms.length === 0) return true;
  return game.platforms.some((p) => platforms.includes(p));
}

/**
 * Per-axis closeness, 0-1, where 1 is a perfect match.
 * Only axes the user actually answered are considered; skipped steps must not
 * drag a game down for having an opinion the user never expressed.
 */
function axisScores(
  game: Game,
  prefs: VibePreferences,
): Array<{ axis: VibeAxis; closeness: number; preference: number }> {
  const out: Array<{ axis: VibeAxis; closeness: number; preference: number }> = [];
  for (const axis of VIBE_AXES) {
    const preference = prefs[axis];
    if (preference === undefined) continue;
    const closeness = 1 - Math.abs(preference - game.vibes[axis]);
    out.push({ axis, closeness, preference });
  }
  return out;
}

/**
 * Fraction of the candidate pool that also matches the user on each answered
 * axis. An axis where nearly everything matches carries almost no information,
 * so this is used to demote it as a stated reason.
 */
export type AxisCommonality = Partial<Record<VibeAxis, number>>;

function computeCommonality(
  games: readonly Game[],
  prefs: VibePreferences,
): AxisCommonality {
  const out: AxisCommonality = {};
  if (games.length === 0) return out;
  for (const axis of VIBE_AXES) {
    const preference = prefs[axis];
    if (preference === undefined) continue;
    const matching = games.reduce(
      (n, g) => n + (1 - Math.abs(preference - g.vibes[axis]) >= REASON_THRESHOLD ? 1 : 0),
      0,
    );
    out[axis] = matching / games.length;
  }
  return out;
}

/**
 * Turn the best-matching axes into sentences. Returns at most MAX_REASONS,
 * and only axes that cleared REASON_THRESHOLD — an honest "no strong reason"
 * (empty array) is better than a generic one, and the UI falls back to the
 * game's editorial hooks in that case.
 *
 * Ranking is by closeness discounted by how common that match is across the
 * pool, so the reason shown first is the one that actually distinguishes this
 * game. `strength` still reports raw closeness — the discount decides ordering,
 * not what the UI displays as the match quality.
 */
function buildReasons(
  scores: ReturnType<typeof axisScores>,
  commonality: AxisCommonality,
): MatchReason[] {
  return scores
    .filter((s) => s.closeness >= REASON_THRESHOLD)
    .map((s) => ({
      ...s,
      rank: s.closeness * (1 - (commonality[s.axis] ?? 0) * COMMONALITY_PENALTY),
    }))
    .sort((a, b) => b.rank - a.rank)
    .slice(0, MAX_REASONS)
    .map((s) => ({
      axis: s.axis,
      strength: s.closeness,
      text: reasonFor(s.axis, s.preference),
    }));
}

/* ----------------------------------------------------------------- scoring */

/**
 * Score a single game against a query.
 *
 * `commonality` is supplied by `recommend` from the candidate pool; when
 * scoring a game in isolation (a detail page) it is absent and reasons fall
 * back to pure closeness ordering, which is correct — there is no pool to be
 * distinctive against.
 */
export function scoreGame(
  game: Game,
  query: RecommendationQuery,
  commonality: AxisCommonality = {},
): ScoredGame {
  const prefs = query.vibes ?? {};
  const scores = axisScores(game, prefs);

  // With no answers at all, every game is equally "on-vibe" and ranking falls
  // through to the quality prior — which is the right behavior for a user who
  // skipped the whole quiz.
  const vibeScore =
    scores.length === 0
      ? 0.5
      : scores.reduce((sum, s) => sum + s.closeness, 0) / scores.length;

  const quality = clamp01(game.rating / 100);
  let score = WEIGHT_VIBE * vibeScore + WEIGHT_QUALITY * quality;

  if (query.seen?.includes(game.slug)) score *= SEEN_PENALTY;

  const seed = query.dateSeed ?? todaySeed();
  score += (seededFloat(`${seed}:${game.slug}`) - 0.5) * 2 * JITTER;

  return {
    game,
    score: Math.round(clamp01(score) * 100),
    reasons: buildReasons(scores, commonality),
  };
}

/**
 * A ten-slot draw pattern matching TIER_MIX (4 mainstream / 3 indie / 3 gem),
 * interleaved rather than blocked so even a short prefix looks mixed.
 */
const TIER_PATTERN: Tier[] = [
  'mainstream',
  'indie-darling',
  'hidden-gem',
  'mainstream',
  'indie-darling',
  'hidden-gem',
  'mainstream',
  'indie-darling',
  'mainstream',
  'hidden-gem',
];

/**
 * Compose the whole ranked list into a tier-mixed *ordering*, rather than
 * selecting a tier-mixed subset of a given size.
 *
 * This is the important property: **every prefix of the result satisfies the
 * quota.** The earlier version composed against `limit`, so asking for 24
 * results produced a different first twelve than asking for 12 — which made
 * "Show more" visibly reshuffle the rows the user was already reading.
 * Composing an ordering once means paging is a pure append.
 *
 * Tiers that run out are simply skipped, so a narrow platform filter still
 * returns a full list.
 */
function composeByTier(ranked: ScoredGame[]): ScoredGame[] {
  const queues: Record<Tier, ScoredGame[]> = {
    mainstream: [],
    'indie-darling': [],
    'hidden-gem': [],
  };
  for (const item of ranked) queues[item.game.tier].push(item);

  const out: ScoredGame[] = [];
  let slot = 0;
  while (out.length < ranked.length) {
    let drew = false;
    // Try the patterned tier first, then fall through to whatever is left so
    // an exhausted tier never stalls the sequence.
    for (let attempt = 0; attempt < TIER_PATTERN.length; attempt++) {
      const tier = TIER_PATTERN[(slot + attempt) % TIER_PATTERN.length];
      const next = queues[tier].shift();
      if (next) {
        out.push(next);
        drew = true;
        break;
      }
    }
    slot++;
    if (!drew) break; // every queue empty
  }
  return out;
}

/**
 * Spread the *lead* reason across the final set.
 *
 * Commonality is measured against the whole eligible pool, which is the right
 * baseline but misses a second problem: the top results are, by construction,
 * similar to each other. Ask for cozy, short and solo and every winner is cozy,
 * short and solo — so the same sentence leads a dozen cards even after the
 * commonality discount.
 *
 * This only *reorders* reasons a game already qualified for, never invents or
 * promotes one below the threshold. Every sentence shown remains true; the set
 * as a whole just stops reading like a broken template.
 */
function diversifyLeadReasons(items: ScoredGame[]): ScoredGame[] {
  // Counters reset every BLOCK items rather than scaling with list length.
  // A cap derived from `items.length` would change when the user pages in more
  // results, rewriting the explanation under rows already on screen.
  const BLOCK = 12;
  const CAP = 3;
  let usedLead = new Map<VibeAxis, number>();

  return items.map((item, i) => {
    if (i > 0 && i % BLOCK === 0) usedLead = new Map();
    if (item.reasons.length === 0) return item;

    // Prefer the highest-ranked reason whose axis has not been over-used.
    let index = item.reasons.findIndex((r) => (usedLead.get(r.axis) ?? 0) < CAP);
    if (index === -1) index = 0; // nothing left under the cap — keep the best one

    const axis = item.reasons[index].axis;
    usedLead.set(axis, (usedLead.get(axis) ?? 0) + 1);
    if (index === 0) return item;

    return {
      ...item,
      reasons: [item.reasons[index], ...item.reasons.filter((_, i2) => i2 !== index)],
    };
  });
}

/**
 * The main entry point.
 *
 * Games not on a selected platform are *removed*, never merely down-ranked —
 * recommending a PS5 exclusive to someone who only owns a Switch is the one
 * failure users will never forgive. There is a test for exactly this.
 */
export function recommend(
  games: readonly Game[],
  query: RecommendationQuery = {},
): ScoredGame[] {
  const limit = query.limit ?? 12;
  const enforceTierMix = query.enforceTierMix ?? true;

  const eligible = games.filter((g) => matchesPlatforms(g, query.platforms));

  // Measured across the eligible pool, not the whole library — "solo" is
  // unremarkable in general but genuinely distinguishing inside a shortlist of
  // party games.
  const commonality = computeCommonality(eligible, query.vibes ?? {});

  const ranked = eligible
    .map((g) => scoreGame(g, query, commonality))
    .sort((a, b) => b.score - a.score);

  // Compose the *whole* list, then slice. Both passes are prefix-stable, so
  // recommend(limit: 24) begins with exactly the same twelve entries as
  // recommend(limit: 12) — which is what makes paging append cleanly.
  const composed = enforceTierMix ? composeByTier(ranked) : ranked;
  return diversifyLeadReasons(composed).slice(0, limit);
}

/* -------------------------------------------------------- daily & discovery */

/**
 * The pool the Daily Spin draws from — platform-filtered and deterministically
 * shuffled, so every user spinning on the same day sees the same reel.
 */
export function dailySpinPool(
  games: readonly Game[],
  platforms?: Platform[],
  dateSeed: string = todaySeed(),
): Game[] {
  const eligible = games.filter((g) => matchesPlatforms(g, platforms));
  return seededShuffle(eligible, `spin:${dateSeed}:${(platforms ?? []).join(',')}`);
}

/**
 * Today's featured rotation for the landing page.
 *
 * Drawn round-robin from a fixed tier pattern rather than by weighting alone.
 * Pure obscurity weighting produced an all-gold front page, which defeats the
 * point twice over: gold stops meaning "rare" when everything is gold, and a
 * visitor who wants a blockbuster sees nothing they recognize. The pattern
 * still leans toward discovery — two gems for every mainstream slot — but
 * guarantees visible variety.
 */
const FEATURED_PATTERN: Tier[] = ['hidden-gem', 'indie-darling', 'mainstream'];

export function dailyFeatured(
  games: readonly Game[],
  platforms?: Platform[],
  count = 6,
  dateSeed: string = todaySeed(),
): Game[] {
  const eligible = games.filter((g) => matchesPlatforms(g, platforms));

  // Shuffle each tier independently so the draw is stable within a day.
  const queues: Record<Tier, Game[]> = {
    mainstream: [],
    'indie-darling': [],
    'hidden-gem': [],
  };
  for (const tier of Object.keys(queues) as Tier[]) {
    queues[tier] = seededShuffle(
      eligible.filter((g) => g.tier === tier),
      `featured:${dateSeed}:${tier}:${(platforms ?? []).join(',')}`,
    );
  }

  const picked: Game[] = [];
  for (let i = 0; picked.length < count && i < count * FEATURED_PATTERN.length; i++) {
    const next = queues[FEATURED_PATTERN[i % FEATURED_PATTERN.length]].shift();
    if (next) picked.push(next);
  }

  // Backfill if a tier ran dry under a narrow platform filter.
  if (picked.length < count) {
    const taken = new Set(picked.map((g) => g.slug));
    for (const game of seededShuffle(eligible, `featured-fill:${dateSeed}`)) {
      if (picked.length >= count) break;
      if (!taken.has(game.slug)) picked.push(game);
    }
  }

  return picked;
}

/**
 * Related games for a detail page: the hand-curated `similar` list first
 * (editorial beats math), topped up with the nearest games by vibe distance
 * when curation runs short.
 */
export function similarTo(
  game: Game,
  games: readonly Game[],
  count = 4,
  platforms?: Platform[],
): Game[] {
  const bySlug = new Map(games.map((g) => [g.slug, g]));
  const out: Game[] = [];
  const seen = new Set<string>([game.slug]);

  for (const slug of game.similar) {
    const found = bySlug.get(slug);
    if (found && !seen.has(slug) && matchesPlatforms(found, platforms)) {
      out.push(found);
      seen.add(slug);
    }
  }
  if (out.length >= count) return out.slice(0, count);

  const nearest = games
    .filter((g) => !seen.has(g.slug) && matchesPlatforms(g, platforms))
    .map((g) => {
      const distance =
        VIBE_AXES.reduce((sum, axis) => sum + Math.abs(g.vibes[axis] - game.vibes[axis]), 0) /
        VIBE_AXES.length;
      return { game: g, distance };
    })
    .sort((a, b) => a.distance - b.distance);

  for (const { game: g } of nearest) {
    if (out.length >= count) break;
    out.push(g);
  }
  return out;
}
