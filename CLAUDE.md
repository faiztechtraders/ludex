# CLAUDE.md — Ludex

Guidance for Claude Code when working in this repository.

---

## What this project is

**Ludex** is a game discovery web app. Users answer a short vibe quiz (or hit a gacha button),
and get game recommendations filtered to the platforms they own — **PC, PS5, Nintendo Switch,
Nintendo Switch 2** — mixing mainstream hits, indie darlings, and hidden gems, with an explicit
justification per result.

It is a **client-only static SPA**. No backend, no database, no runtime API calls, no auth.
Everything ships in the bundle. If a change would introduce a server dependency, stop and
raise it first.

---

## Tech stack

| Concern | Choice | Notes |
|---|---|---|
| Build | **Vite 8** | `vite.config.ts`; aliases `@` → `src`, `@skills` → `skills`. |
| UI | **React 19 + TypeScript** | Function components only. No class components. |
| Styling | **Tailwind CSS v4** | ⚠️ CSS-first. See the Tailwind section below. |
| Animation | **motion** (v13, the Framer Motion successor) | Import from `motion/react`. |
| State | **Zustand 5** | Sliced stores in `src/store/`. |
| Routing | **react-router-dom 7** | Declarative routes in `src/App.tsx`. |
| Tests | **Vitest 4** | Engine tests only; config lives inside `vite.config.ts`. |
| Deploy | **Vercel** (static) | `vercel.json` at root. |

TypeScript is pinned to **5.9**, not 7.x, deliberately — 5.9 is the version the React/Vite plugin
ecosystem is best-tested against. Don't upgrade it as a drive-by.

---

## Commands

```bash
npm run dev            # dev server, auto-selects free port from 3000
npm run build          # tsc --noEmit && vite build
npm run preview        # serve dist/ locally
npm test               # vitest run
npm run data:validate  # validate every game record — run after ANY dataset edit
npm run data:stats     # platform/tier coverage report
npm run data:art       # optional RAWG art enrichment (needs RAWG_API_KEY)

# These three need `npm run dev` running. Use them in this order.
npm run check          # every route renders without console/page errors
npm run shot           # screenshots of all routes -> screenshot/
npm run flows          # drives real interactions and asserts they work
```

**`npm run check` before `npm run shot`.** A screenshot of a blank page only
tells you it's blank; `check` tells you why. It caught the bug that blanked
every route during development.

**After any change to `src/data/games/`, run `npm run data:validate`.** It is the cheapest way
to catch a malformed vibe vector or a dangling `similar` slug.

**Prices are a build-time snapshot, and that is not a shortcut.** Steam's price endpoint sends
no `Access-Control-Allow-Origin` header, so the browser cannot read it from the deployed origin —
a live price would require a proxy, and a proxy is a backend this app deliberately does not have.
`npm run data:prices` bakes `src/data/prices.ts`; `.github/workflows/refresh-prices.yml` refreshes
it daily and Vercel redeploys on the commit. Consequences worth remembering: the snapshot holds
**one region** (MYR), so the UI always prints the date and currency rather than implying the
figure is the reader's; and the fetcher refuses to overwrite a good snapshot with an empty one,
because a throttled run would otherwise strip pricing from the entire site.

**When adding games, check for duplicates by normalized *title*, not by slug.** During the
557 → 757 expansion four games were added twice under near-miss slugs (`chicory` alongside the
existing `chicory-a-colorful-tale`, `prince-of-persia-the-lost-crown` alongside
`prince-of-persia-lost-crown`). `data:validate` now fails on this, and on two games claiming the
same `steamAppId` — which is how one game ends up wearing another's screenshots.

---

## Tailwind v4 — read this before touching styles

Tailwind v4 is **not** configured the way v3 was. Getting this wrong is the single most likely
mistake in this repo.

- There is **no `tailwind.config.js`** and there must not be one.
- There is **no `postcss.config.js`** — Tailwind is wired through the `@tailwindcss/vite` plugin.
- `src/index.css` starts with `@import "tailwindcss";` — *not* the v3 `@tailwind` directives.
- Theme customization goes in an **`@theme { ... }`** block using CSS custom properties.
  A token declared as `--color-neon-magenta` automatically yields `bg-neon-magenta`,
  `text-neon-magenta`, `border-neon-magenta`, etc.
- Raw design tokens live in **`creative/tokens.css`**, imported by `src/index.css`. Treat
  `creative/tokens.css` as the single source of truth for color, spacing rhythm, and motion
  timing. Don't hardcode hex values in components — reach for a token.

---

## Architecture

### The layering rule

```
skills/recommendation/   pure TS · zero React · zero DOM · unit-tested
        ↑
src/engine/              one-line re-export
        ↑
src/store/               zustand — holds user state, calls the engine
        ↑
src/routes/ + components/  React — renders, never scores
```

**Scoring logic never goes in a component.** If a recommendation rule needs changing, it changes
in `skills/recommendation/` and gets a test. Components read results; they don't compute them.

### Data model

Defined in `src/data/schema.ts`. Key types:

```ts
type Platform = 'pc' | 'ps5' | 'ps4' | 'xbox-series' | 'xbox-one'
              | 'switch2' | 'switch';
type Tier     = 'mainstream' | 'indie-darling' | 'hidden-gem';
type VibeAxis = 'pace' | 'depth' | 'narrative' | 'challenge'
              | 'social' | 'tone' | 'session';        // every value 0..1
```

**Two console generations per family**, because PS4 and Xbox One are still in
millions of living rooms and filtering them out would hide most of the library
from the people who most need it. Platforms group into four families
(`PLATFORM_FAMILY`) so a card can show one badge per family — "PlayStation 4·5"
— instead of seven near-identical silhouettes.

Be accurate about exclusives: Sony first-party titles get no Xbox entry, Xbox
first-party gets no PlayStation entry, and Nintendo first-party is Switch-only.
`skills/data-pipeline/migrate-platforms.mjs` is the record of how the expansion
from four platforms to seven was applied.

Rules for game records:

- **All 7 vibe axes are required**, each in `0..1`. A missing axis breaks the distance math.
- **`art.accent` is required** — a hex color. It drives the card glow *and* the generated
  fallback cover. This is what lets the app work with no images at all.
- `switch2Status` is only meaningful when `'switch2'` is in `platforms`. Be honest with it:
  `'native'`, `'switch2-edition'`, and `'backward-compatible'` mean different things and users
  can filter on the distinction. **Never label a backward-compatible Switch 1 game as native.**
- `similar` holds slugs that must resolve to real games in the dataset.
- `tier` is editorial judgment. **Popularity alone does not decide it** — Hades (82) and Hollow
  Knight (80) out-rank several mainstream entries and are still indie darlings, because reach is
  evidence and production context is the deciding factor. `mainstream` means household name;
  `indie-darling` means independently produced and adored within gaming; `hidden-gem` means most
  people who follow games closely still have not heard of it. Full rule in `src/data/schema.ts`.
- **A series must not straddle a tier boundary.** Hades shipped as `mainstream` while Hades II was
  `indie-darling`, and Silksong as `mainstream` while Hollow Knight was `indie-darling` at the
  *same* popularity. Side by side those read as bugs. `data:validate` now warns when games sharing
  a developer and leading title word land in different tiers.

### Recommendation flow

1. **Hard platform filter** — a game not on a selected platform is *removed*, never merely
   down-ranked. This is a correctness guarantee, and there is a test for it.
2. Weighted distance across the 7 vibe axes; skipped quiz steps get weight 0.
3. Small `rating` prior to break ties.
4. Tier quota composes the final set (~40/30/30) rather than taking a raw top-N.
5. Novelty penalty for already-seen games.
6. Seeded daily jitter.
7. Each result carries the axes that drove it, which `WhyItFits` renders as prose.

### Determinism

All randomness goes through `src/lib/rng.ts` (mulberry32), seeded from a `YYYY-MM-DD` date
string. **Never call `Math.random()` directly** — the daily rotation and daily spin must be
identical for every user and stable within a day. Tests assert this.

### Paging must be append-only

`recommend` composes the **whole** ranked list into a tier-mixed ordering and
then slices to `limit`. Both the tier composition and the reason-diversity pass
are **prefix-stable**: `recommend(limit: 24)` starts with exactly the same twelve
entries as `recommend(limit: 12)`.

This matters because the earlier version composed against `limit`, so clicking
"Show more" rebuilt the set and visibly reshuffled rows the user was already
reading. Anything that makes composition depend on list length reintroduces that
bug — the diversity pass therefore resets its counters every fixed block of 12
rather than scaling a cap by `items.length`. Tested.

The tradeoff, which is deliberate: results are **not** globally sorted by score.
Interleaving tiers necessarily puts a 60 above a 61 from another tier. The
guarantee is score-descending *within* each tier.

### Explanations are ranked by distinctiveness

Nearly every game in the library is single-player, so ranking match reasons by raw closeness
printed *"A solo experience…"* on two thirds of a results page. `computeCommonality` measures
how many candidates share each match and discounts accordingly, so the lead reason is the one
that actually separates this game from the others on screen. `strength` still reports
undiscounted closeness. Both halves have regression tests — don't "simplify" this back to a
plain sort.

---

## Conventions

- **Files:** components `PascalCase.tsx`; hooks/utils `camelCase.ts`; one component per file.
- **Imports:** use the `@/` alias for anything crossing a top-level folder; relative paths only
  within a folder.
- **Types over interfaces** for unions and props; `interface` only for extensible object shapes.
- **No default exports** except route components.
- **Comments explain *why*, not *what*.** The codebase is dense with editorial judgment
  (tier assignments, vibe values, quota ratios) — those deserve a line of reasoning. Mechanical
  code does not.
- **Accessibility is not a polish step.** Every interactive element is keyboard-reachable with a
  visible focus ring, every animation is gated on `prefers-reduced-motion` (use
  `useReducedMotion` from `src/lib/`), and text meets AA contrast against the near-black canvas.
  The neon palette makes it easy to fail this — check.
- **`localStorage` access goes through `src/lib/useLocalStorage.ts`**, never raw, so SSR-unsafe
  and quota-exceeded cases stay in one place.

---

## Working directories

| Directory | Purpose | When to touch it |
|---|---|---|
| `creative/` | Brand assets and the style guide. `tokens.css` is imported by the app. | Changing palette, adding icons, revising motion timing. |
| `screenshot/` | Committed PNGs of each route. | After any visual change — run `npm run shot`, then **read the PNGs back** to verify. This is the visual feedback loop; don't skip it when changing layout. |
| `skills/` | Reusable, framework-agnostic modules. | Engine changes, data scripts. Keep these free of React imports. |

---

## Gotchas that have already bitten

- **Zustand selectors must return a primitive or a stable reference.** Zustand 5 reads through
  `useSyncExternalStore`, which compares snapshots by identity. A selector like
  `s => levelFromXp(s.xp)` builds a new object every call, reports a change on every render, and
  React aborts the whole tree with *"getSnapshot should be cached"* — **every route goes blank**.
  Select the raw value and derive in the component; see `useLevel` in `src/store/`.
- **Never advance a sequence on an animation event.** The old gacha reel mounted with its final
  transform already applied, so no transition ran, `transitionend` never fired, and the spin hung
  forever on "Rolling…". `transitionend` is also simply not delivered when a tab is backgrounded
  mid-animation. `GachaMachine` (which replaced the reel) drives its five stages from **one
  timer chain** and treats every visual as decorative — if the compositor drops the whole
  animation, the sequence still completes on schedule. `flows.mjs` asserts both that it reveals
  and that tapping it skips in under 1.2s.
- **The machine is the control, not a picture next to one.** Its crank is a real `<button>`
  (58px, clearing the 44px touch minimum) and the Daily Spin has no separate button. Idle and
  spinning therefore share **one** `AnimatePresence` key — giving them separate keys remounts
  the machine at the exact moment you touch the crank, flashing it out and back in.
- **The front page must not be all one tier.** Weighting the daily rotation purely by obscurity
  produced four gold "Hidden Gem" cards, which devalues gold and shows a first-time visitor
  nothing they recognize. `dailyFeatured` draws round-robin from a tier pattern. Tested.
- **Anything seeding a draw must be persisted, not component state.** The Daily Spin's reroll
  counter lived in `useState`, so it reset to `0` on every refresh and `chaos:<date>:1` returned
  the identical game forever — it only appeared to work when you changed platform, because that
  changed the seed string. `spinCount` and `recentSpins` now live in the store, and both draws
  skip recently-shown games. There is a `flows.mjs` case that reloads between spins.

## Gotchas

- **Vite dev port** is `3000` with `strictPort: false`. Don't set `strictPort: true` — port
  auto-detection is an explicit product requirement.
- **`vercel.json` rewrites** send non-asset paths to `index.html`. Removing that rule breaks a
  hard refresh on any route like `/game/tunic`.
- **Art enrichment needs no API key.** `npm run data:art` pulls from Steam (portrait
  `library_600x900` box art, hero, screenshots — for anything on PC), Wikipedia (box art for
  console exclusives) and nintendo.com / playstation.com (screenshots those exclusives otherwise
  have none of). RAWG was dropped: it required a key *and* its API now returns HTTP 522.
  `art.accent` is hand-authored and must survive enrichment — it drives every card glow and the
  generated fallback cover.
- **When scraping a store page, resolve the page's own product.** Nintendo pages embed ~40
  products; taking the first `productGallery` put Kirby screenshots on Super Mario Odyssey.
  Follow the Apollo `ROOT_QUERY` `urlKey` reference. `data:validate` now errors if two games
  share a screenshot URL.
- **Derived URLs must be verified, not assumed.** Building a URL from an ID is compact but can
  be confidently wrong: `page_bg_raw.jpg` is missing on many Steam apps (135 broken heroes) and
  newer screenshots are nested one folder deeper (58 broken galleries). Run
  `npm run data:verify-art` after any enrichment change. Every image component also falls back
  on error, so rot degrades quietly instead of rendering a broken icon.
- **Never rewrite source files with PowerShell.** `Get-Content -Raw | Set-Content -Encoding utf8`
  on PowerShell 5.1 re-encodes every non-ASCII character, silently turning "Pokémon" into
  mojibake across four data files. Use Node or the editor. `fix-mojibake.mjs` repairs it if it
  happens again.
- **Cover art is 2:3**, matching Steam's box art. Changing the card aspect ratio will letterbox
  or crop every cover in the library.
- **Dataset size drives bundle size.** At 757 games the dataset is ~865 KB raw / ~264 KB
  gzipped, and the built app chunk is 296 KB gzipped (plus a 113 KB vendor chunk that caches
  separately). Art storage is already compact — Steam URLs derive from `steamAppId` and only
  screenshot path-suffixes are stored (`src/data/art.ts`).

  **Do the code-split before growing the library again.** `art.shots` and `hooks` together are
  296 KB raw — **34% of the dataset** — and are used *only* on the detail page. Moving them into
  a module that `GameDetail` imports dynamically would cut roughly a third off the initial
  payload. It splits the `Game` type across two files, which is a real maintenance cost, but at
  757 games the main chunk is already 296 KB gzipped and that is the point where the cost is
  worth paying.

- **Growing the library gets harder, not easier.** Reaching 757 meant sweeping ~400 candidate
  titles to find 200 that were not already present — **185 of them already were**. The
  well-known catalogue is largely covered, so further growth digs into genuinely obscure
  territory and pulls against the 40/30/30 ratio, because there is no supply of unused
  *household names* left. Expansions from here should be driven by a **coverage gap**
  (`npm run data:stats`) rather than by a target count. The 557 → 757 batch was aimed at
  `social`, which went from 80 games at the co-op end to 167.
- The library must stay **genuinely mixed**. If a change makes results skew toward blockbusters
  or toward obscurities, the tier quota is broken — check `npm run data:stats`.
