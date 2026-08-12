# skills/recommendation

The Ludex matching engine. **Pure TypeScript — no React, no DOM, no browser
globals.** Runs under plain Node so it can be unit-tested headlessly and reused
in a CLI, a bot, or a serverless function.

The app reaches it through `src/engine/`, a one-line re-export. Nothing in
`src/` should import from here directly.

## Files

| File | What it does |
|---|---|
| `scoring.ts` | The pipeline: platform filter → vibe distance → quality prior → novelty → jitter → tier quota → explanations. |
| `rng.ts` | Seeded PRNG (FNV-1a + mulberry32). **The only source of randomness in Ludex.** |
| `scoring.test.ts` | The suite. Run with `npm test`. |

## API

```ts
recommend(games, query)          // ScoredGame[] — the main entry point
scoreGame(game, query, common?)  // score one game
matchesPlatforms(game, platforms)
dailySpinPool(games, platforms?, dateSeed?)
dailyFeatured(games, platforms?, count?, dateSeed?)
similarTo(game, games, count?, platforms?)
```

## The pipeline

1. **Hard platform filter.** A game not on a selected platform is *removed*,
   never down-ranked. This is a correctness guarantee with a test per platform.
2. **Weighted vibe distance** across the seven axes. Axes the user skipped carry
   **zero** weight — skipped is not the same as neutral.
3. **Small quality prior** (`rating`), enough to break ties, not enough to
   override taste.
4. **Novelty penalty** for games already seen or dismissed.
5. **Seeded daily jitter** so the same answers stay fresh day to day.
6. **Tier quota** composes the result set to roughly 40/30/30 mainstream /
   indie-darling / hidden-gem, rather than taking a raw top-N. Under-filled
   tiers backfill, so a narrow platform selection never returns a short list.
7. **Explanations** — the axes that actually drove the match, as sentences.

## Two things that are easy to get wrong

**Reasons are ranked by distinctiveness, not just closeness.** Nearly the whole
library is single-player, so ranking by raw closeness printed *"A solo
experience…"* on two thirds of a results page. `computeCommonality` measures how
many candidates share each match and discounts accordingly, so the lead reason
is the one that actually separates this game from the others on screen.
`strength` still reports undiscounted closeness — the discount decides ordering
only. There is a regression test for both halves of this.

**Determinism is not optional.** Every random draw goes through `rng.ts` seeded
on a `YYYY-MM-DD` string. The daily rotation and daily spin must be identical
for every user and stable until local midnight. **Never call `Math.random()`.**

## Tuning

Constants at the top of `scoring.ts`: `WEIGHT_VIBE`, `WEIGHT_QUALITY`,
`SEEN_PENALTY`, `JITTER`, `TIER_MIX`, `REASON_THRESHOLD`, `COMMONALITY_PENALTY`.
They were tuned by looking at real result pages, not derived — change them, then
run `npm test` and re-read a results screenshot.
