import { describe, it, expect } from 'vitest';
import type { Game, Platform, VibeVector } from '@/data/schema.ts';
import { GAMES } from '@/data/games/index.ts';
import {
  recommend,
  scoreGame,
  matchesPlatforms,
  dailySpinPool,
  dailyFeatured,
  similarTo,
} from './scoring.ts';
import { seededShuffle, todaySeed } from './rng.ts';

/* ------------------------------------------------------------------ fixtures */

const vibes = (v: Partial<VibeVector> = {}): VibeVector => ({
  pace: 0.5,
  depth: 0.5,
  narrative: 0.5,
  challenge: 0.5,
  social: 0.5,
  tone: 0.5,
  session: 0.5,
  ...v,
});

let counter = 0;
function game(overrides: Partial<Game> = {}): Game {
  const n = counter++;
  return {
    id: `test-${n}`,
    slug: `test-${n}`,
    title: `Test Game ${n}`,
    year: 2020,
    developer: 'Test',
    platforms: ['pc'],
    tier: 'mainstream',
    popularity: 50,
    rating: 80,
    genres: ['Test'],
    tags: [],
    vibes: vibes(),
    artStyle: 'pixel',
    hoursToBeat: 10,
    blurb: 'A test game.',
    hooks: ['one', 'two'],
    similar: [],
    art: { accent: '#ffffff' },
    ...overrides,
  };
}

const SEED = '2026-01-15';

/* ------------------------------------------------------- platform filtering */

describe('platform filtering', () => {
  it('never returns a game the user cannot play', () => {
    // The single most important guarantee in the app: recommending a PS5
    // exclusive to a Switch-only owner is the one failure nobody forgives.
    for (const platform of ['pc', 'ps5', 'switch', 'switch2'] as Platform[]) {
      const results = recommend(GAMES, { platforms: [platform], limit: 40 });
      expect(results.length).toBeGreaterThan(0);
      for (const { game: g } of results) {
        expect(g.platforms).toContain(platform);
      }
    }
  });

  it('treats multiple platforms as a union, not an intersection', () => {
    const results = recommend(GAMES, { platforms: ['ps5', 'switch'], limit: 40 });
    for (const { game: g } of results) {
      expect(g.platforms.some((p) => p === 'ps5' || p === 'switch')).toBe(true);
    }
    // A PS5-only game should be reachable through this query.
    const ps5Only = GAMES.find((g) => g.platforms.includes('ps5') && !g.platforms.includes('switch'));
    expect(ps5Only).toBeDefined();
  });

  it('treats an empty or omitted platform list as "all platforms"', () => {
    expect(matchesPlatforms(game({ platforms: ['ps5'] }), [])).toBe(true);
    expect(matchesPlatforms(game({ platforms: ['ps5'] }), undefined)).toBe(true);
  });

  it('removes rather than down-ranks — a perfect vibe match on the wrong platform is gone', () => {
    const perfect = game({ slug: 'perfect', platforms: ['ps5'], rating: 100, vibes: vibes({ pace: 0.9 }) });
    const mediocre = game({ slug: 'mediocre', platforms: ['switch'], rating: 40, vibes: vibes({ pace: 0.1 }) });
    const results = recommend([perfect, mediocre], { platforms: ['switch'], vibes: { pace: 0.9 } });
    expect(results.map((r) => r.game.slug)).toEqual(['mediocre']);
  });
});

/* --------------------------------------------------------------- vibe scoring */

describe('vibe scoring', () => {
  it('ranks a closer vibe match higher', () => {
    const cozy = game({ slug: 'cozy', vibes: vibes({ tone: 0.05 }) });
    const grim = game({ slug: 'grim', vibes: vibes({ tone: 0.95 }) });
    const results = recommend([cozy, grim], { vibes: { tone: 0.0 }, enforceTierMix: false });
    expect(results[0].game.slug).toBe('cozy');
  });

  it('ignores axes the user skipped', () => {
    // Two games differing only on an axis the user never answered must score
    // identically apart from jitter — a skipped step is not an opinion.
    const a = game({ slug: 'a', vibes: vibes({ challenge: 0.0 }) });
    const b = game({ slug: 'b', vibes: vibes({ challenge: 1.0 }) });
    const sa = scoreGame(a, { vibes: { tone: 0.5 }, dateSeed: SEED });
    const sb = scoreGame(b, { vibes: { tone: 0.5 }, dateSeed: SEED });
    expect(Math.abs(sa.score - sb.score)).toBeLessThanOrEqual(7); // jitter only
  });

  it('falls back to critical consensus when the whole quiz is skipped', () => {
    const great = game({ slug: 'great', rating: 98 });
    const poor = game({ slug: 'poor', rating: 40 });
    const results = recommend([great, poor], { dateSeed: SEED, enforceTierMix: false });
    expect(results[0].game.slug).toBe('great');
  });

  it('down-ranks games the user has already seen', () => {
    const a = game({ slug: 'seen-one' });
    const b = game({ slug: 'fresh-one' });
    const results = recommend([a, b], { seen: ['seen-one'], dateSeed: SEED, enforceTierMix: false });
    expect(results[0].game.slug).toBe('fresh-one');
  });

  it('keeps scores within 0-100', () => {
    for (const g of GAMES) {
      const { score } = scoreGame(g, { vibes: { pace: 1, tone: 0 }, dateSeed: SEED });
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
  });
});

/* ------------------------------------------------------------------ reasons */

describe('match explanations', () => {
  it('only cites axes the user actually answered', () => {
    const results = recommend(GAMES, {
      vibes: { tone: 0.1, social: 0.0 },
      dateSeed: SEED,
      limit: 20,
    });
    for (const { reasons } of results) {
      for (const r of reasons) {
        expect(['tone', 'social']).toContain(r.axis);
      }
    }
  });

  it('returns no reasons at all when nothing was answered', () => {
    const results = recommend(GAMES, { dateSeed: SEED, limit: 10 });
    for (const { reasons } of results) expect(reasons).toHaveLength(0);
  });

  it('stays quiet rather than inventing a reason for a weak match', () => {
    // A game at the far end of the axis from the user must not claim a match.
    const opposite = game({ vibes: vibes({ tone: 1.0 }) });
    const { reasons } = scoreGame(opposite, { vibes: { tone: 0.0 }, dateSeed: SEED });
    expect(reasons).toHaveLength(0);
  });

  it('leads with a distinguishing reason, not the one every game shares', () => {
    // Regression guard: ranking reasons purely by closeness printed "A solo
    // experience..." on two thirds of a results page, because almost the whole
    // library is single-player. The lead reason must vary.
    const results = recommend(GAMES, {
      platforms: ['switch2'],
      vibes: { social: 0, tone: 0.05, pace: 0.1, session: 0.08, narrative: 0.08 },
      dateSeed: SEED,
      limit: 12,
    });
    const leads = results.filter((r) => r.reasons.length > 0).map((r) => r.reasons[0].text);
    expect(leads.length).toBeGreaterThan(6);

    const commonest = Math.max(
      ...[...new Set(leads)].map((t) => leads.filter((l) => l === t).length),
    );
    expect(commonest / leads.length).toBeLessThanOrEqual(0.5);
  });

  it('still reports raw closeness as strength, undiscounted', () => {
    // The commonality discount decides ordering only; `strength` is what the UI
    // would show as match quality and must stay honest.
    for (const { reasons } of recommend(GAMES, {
      vibes: { social: 0, tone: 0.05 },
      dateSeed: SEED,
      limit: 10,
    })) {
      for (const r of reasons) expect(r.strength).toBeGreaterThanOrEqual(0.72);
    }
  });

  it('cites at most three axes', () => {
    const results = recommend(GAMES, {
      vibes: { pace: 0.5, depth: 0.5, narrative: 0.5, challenge: 0.5, social: 0.5, tone: 0.5, session: 0.5 },
      dateSeed: SEED,
      limit: 20,
    });
    for (const { reasons } of results) {
      expect(reasons.length).toBeLessThanOrEqual(3);
      // No duplicate axes, and every reason carries real copy.
      expect(new Set(reasons.map((r) => r.axis)).size).toBe(reasons.length);
      for (const r of reasons) expect(r.text.length).toBeGreaterThan(0);
    }
  });
});

/* ---------------------------------------------------------------- tier mix */

describe('tier quota', () => {
  it('surfaces hidden gems even when mainstream games score better', () => {
    // Without the quota this returns twelve blockbusters. The whole point of
    // Ludex is that it does not.
    const pool = [
      ...Array.from({ length: 20 }, () => game({ tier: 'mainstream', rating: 95 })),
      ...Array.from({ length: 20 }, () => game({ tier: 'indie-darling', rating: 70 })),
      ...Array.from({ length: 20 }, () => game({ tier: 'hidden-gem', rating: 60 })),
    ];
    const results = recommend(pool, { limit: 10, dateSeed: SEED });
    const tiers = results.map((r) => r.game.tier);
    expect(tiers.filter((t) => t === 'hidden-gem').length).toBeGreaterThanOrEqual(2);
    expect(tiers.filter((t) => t === 'indie-darling').length).toBeGreaterThanOrEqual(2);
  });

  it('can be turned off for a raw top-N', () => {
    const pool = [
      ...Array.from({ length: 10 }, () => game({ tier: 'mainstream', rating: 99 })),
      ...Array.from({ length: 10 }, () => game({ tier: 'hidden-gem', rating: 30 })),
    ];
    const results = recommend(pool, { limit: 5, dateSeed: SEED, enforceTierMix: false });
    expect(results.every((r) => r.game.tier === 'mainstream')).toBe(true);
  });

  it('backfills instead of returning a short list when a tier runs dry', () => {
    const pool = Array.from({ length: 12 }, () => game({ tier: 'mainstream' }));
    expect(recommend(pool, { limit: 10, dateSeed: SEED })).toHaveLength(10);
  });

  it('paging is a pure append — a longer limit keeps the shorter prefix intact', () => {
    // Regression guard: composing against `limit` meant "Show more" rebuilt the
    // whole set, visibly reshuffling rows the user was already reading.
    const query = { platforms: ['pc'] as Platform[], vibes: { tone: 0.2, pace: 0.4 }, dateSeed: SEED };
    const first = recommend(GAMES, { ...query, limit: 12 });
    const second = recommend(GAMES, { ...query, limit: 24 });
    const third = recommend(GAMES, { ...query, limit: 48 });

    expect(second.slice(0, 12).map((r) => r.game.slug)).toEqual(first.map((r) => r.game.slug));
    expect(third.slice(0, 24).map((r) => r.game.slug)).toEqual(second.map((r) => r.game.slug));
  });

  it('keeps the shown explanation stable across paging too', () => {
    const query = { platforms: ['pc'] as Platform[], vibes: { tone: 0.1, social: 0 }, dateSeed: SEED };
    const first = recommend(GAMES, { ...query, limit: 12 });
    const second = recommend(GAMES, { ...query, limit: 36 });
    expect(second.slice(0, 12).map((r) => r.reasons[0]?.text ?? '')).toEqual(
      first.map((r) => r.reasons[0]?.text ?? ''),
    );
  });

  it('satisfies the tier quota at every page boundary, not just the first', () => {
    const results = recommend(GAMES, { dateSeed: SEED, limit: 60 });
    for (const cut of [12, 24, 36, 60]) {
      const tiers = results.slice(0, cut).map((r) => r.game.tier);
      for (const tier of ['mainstream', 'indie-darling', 'hidden-gem'] as const) {
        const share = tiers.filter((t) => t === tier).length / cut;
        expect(share).toBeGreaterThan(0.15);
        expect(share).toBeLessThan(0.55);
      }
    }
  });

  it('never returns duplicates', () => {
    const results = recommend(GAMES, { limit: 24, dateSeed: SEED });
    const slugs = results.map((r) => r.game.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('orders by score descending *within* each tier', () => {
    // Strict overall score ordering and a tier-mixed prefix are mutually
    // exclusive: interleaving tiers necessarily puts a 60 above a 61 from
    // another tier. The mix is the product promise, so the guarantee is
    // per-tier ordering — each tier still shows its best first.
    const results = recommend(GAMES, { limit: 40, dateSeed: SEED });
    for (const tier of ['mainstream', 'indie-darling', 'hidden-gem'] as const) {
      const scores = results.filter((r) => r.game.tier === tier).map((r) => r.score);
      expect([...scores].sort((a, b) => b - a)).toEqual(scores);
    }
  });

  it('still leads with a strong match overall', () => {
    // The mix must not bury a great match — the top entry should be close to
    // the best-scoring game available.
    const results = recommend(GAMES, { vibes: { tone: 0.1 }, limit: 12, dateSeed: SEED });
    const best = recommend(GAMES, {
      vibes: { tone: 0.1 },
      limit: 1,
      dateSeed: SEED,
      enforceTierMix: false,
    })[0];
    expect(results[0].score).toBeGreaterThanOrEqual(best.score - 6);
  });
});

/* -------------------------------------------------------------- determinism */

describe('determinism', () => {
  it('gives identical results for the same query and date', () => {
    const q = { platforms: ['switch2'] as Platform[], vibes: { tone: 0.2 }, dateSeed: SEED, limit: 8 };
    expect(recommend(GAMES, q).map((r) => r.game.slug)).toEqual(
      recommend(GAMES, q).map((r) => r.game.slug),
    );
  });

  it('shuffles the spin pool identically for every user on the same day', () => {
    const a = dailySpinPool(GAMES, ['pc'], SEED).map((g) => g.slug);
    const b = dailySpinPool(GAMES, ['pc'], SEED).map((g) => g.slug);
    expect(a).toEqual(b);
  });

  it('rotates the spin pool to a different order on a different day', () => {
    const a = dailySpinPool(GAMES, ['pc'], '2026-01-15').map((g) => g.slug);
    const b = dailySpinPool(GAMES, ['pc'], '2026-01-16').map((g) => g.slug);
    expect(a).not.toEqual(b);
  });

  it('keeps the daily featured set stable within a day and fresh across days', () => {
    expect(dailyFeatured(GAMES, undefined, 6, SEED).map((g) => g.slug)).toEqual(
      dailyFeatured(GAMES, undefined, 6, SEED).map((g) => g.slug),
    );
    expect(dailyFeatured(GAMES, undefined, 6, '2026-03-01').map((g) => g.slug)).not.toEqual(
      dailyFeatured(GAMES, undefined, 6, '2026-03-02').map((g) => g.slug),
    );
  });

  it('shuffles without losing or duplicating anything', () => {
    const shuffled = seededShuffle(GAMES, 'x');
    expect(shuffled).toHaveLength(GAMES.length);
    expect(new Set(shuffled.map((g) => g.slug)).size).toBe(GAMES.length);
  });

  it('formats today\'s seed as YYYY-MM-DD in local time', () => {
    expect(todaySeed(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(todaySeed()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

/* ------------------------------------------------------- daily & discovery */

describe('daily rotation', () => {
  it('respects the platform filter in the spin pool', () => {
    for (const g of dailySpinPool(GAMES, ['switch2'], SEED)) {
      expect(g.platforms).toContain('switch2');
    }
  });

  it('weights the featured row toward lesser-known games', () => {
    // The front page is prime real estate; blockbusters do not need the help.
    const featured = dailyFeatured(GAMES, undefined, 8, SEED);
    const featuredAvg = featured.reduce((s, g) => s + g.popularity, 0) / featured.length;
    const libraryAvg = GAMES.reduce((s, g) => s + g.popularity, 0) / GAMES.length;
    expect(featuredAvg).toBeLessThan(libraryAvg);
  });

  it('never fills the featured row with a single tier', () => {
    // An all-gold front page devalues gold and shows a first-time visitor
    // nothing they recognize. Regression guard for exactly that.
    for (const count of [4, 6, 8]) {
      const tiers = dailyFeatured(GAMES, undefined, count, SEED).map((g) => g.tier);
      expect(new Set(tiers).size).toBeGreaterThanOrEqual(3);
      for (const tier of new Set(tiers)) {
        expect(tiers.filter((t) => t === tier).length).toBeLessThan(count);
      }
    }
  });

  it('still returns a full featured row under a narrow platform filter', () => {
    expect(dailyFeatured(GAMES, ['switch2'], 6, SEED)).toHaveLength(6);
    expect(dailyFeatured(GAMES, ['ps5'], 6, SEED)).toHaveLength(6);
  });

  it('never repeats a game in the featured row', () => {
    const slugs = dailyFeatured(GAMES, undefined, 8, SEED).map((g) => g.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});

describe('similar games', () => {
  it('prefers the hand-curated list and never includes the game itself', () => {
    const target = GAMES.find((g) => g.slug === 'hollow-knight')!;
    const related = similarTo(target, GAMES, 4);
    expect(related.map((g) => g.slug)).not.toContain('hollow-knight');
    expect(related.slice(0, target.similar.length).map((g) => g.slug)).toEqual(target.similar);
  });

  it('tops up by vibe distance when curation runs short', () => {
    const sparse = game({ slug: 'sparse', similar: [] });
    const related = similarTo(sparse, [sparse, ...GAMES], 4);
    expect(related).toHaveLength(4);
    expect(new Set(related.map((g) => g.slug)).size).toBe(4);
  });

  it('honours the platform filter', () => {
    const target = GAMES.find((g) => g.slug === 'hollow-knight')!;
    for (const g of similarTo(target, GAMES, 4, ['switch2'])) {
      expect(g.platforms).toContain('switch2');
    }
  });
});

/* ------------------------------------------------------- real-library sanity */

describe('the real library', () => {
  it('returns a full page of results for every single-platform selection', () => {
    for (const p of ['pc', 'ps5', 'switch', 'switch2'] as Platform[]) {
      expect(recommend(GAMES, { platforms: [p], limit: 12 })).toHaveLength(12);
    }
  });

  it('never dead-ends on a narrow taste profile', () => {
    const extreme = recommend(GAMES, {
      platforms: ['switch2'],
      vibes: { pace: 1, depth: 1, narrative: 0, challenge: 1, social: 1, tone: 1, session: 0 },
      limit: 12,
    });
    expect(extreme.length).toBeGreaterThan(0);
  });

  it('resolves every `similar` slug in the dataset', () => {
    const slugs = new Set(GAMES.map((g) => g.slug));
    for (const g of GAMES) {
      for (const ref of g.similar) expect(slugs.has(ref), `${g.slug} -> ${ref}`).toBe(true);
    }
  });
});
