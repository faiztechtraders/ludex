<div align="center">

# ◆ LUDEX

**Find your next game.**

A vibe-driven game discovery hub for **PC · PS5 · PS4 · Xbox Series X|S · Xbox One ·
Nintendo Switch · Switch 2** — mixing blockbusters, indie darlings, and genuine hidden gems.

</div>

---

## What is Ludex?

Game discovery today is either opaque (store algorithms guessing at you) or overwhelming
(500,000-entry databases with a search box). Ludex takes a third path: it asks about your
**taste**, filters hard on the **hardware you actually own**, and hands back a curated set of
games — each one with an explicit reason *why it fits your vibe*.

It's built to feel like a game itself: card flips, neon sliders, a gacha-style spin, XP and
streaks.

### The four ways in

| | Mode | What it does |
|---|---|---|
| 🎛️ | **Vibe Check** | A 7-step, fully skippable quiz. Pick your platforms, then answer visual questions about pace, depth, story, challenge, company, and tone. Get a ranked, explained set of matches. |
| 🎰 | **Daily Spin / Chaos Button** | A gacha reel that hands you one game, right now, no questions asked. One "official" spin per day plus unlimited chaos rerolls, and it never re-serves the last twenty games it showed you. Hidden gems drop as *legendary*. |
| 🗂️ | **Browse** | The full library with platform, genre, tier, and playtime filters — for when you'd rather steer yourself. |
| 🏆 | **Collection** | Games you've saved, plus XP, level, daily streak, and badges. |

### What makes the recommendations different

- **Every game is hand-tagged on 7 vibe axes** — pace, depth, narrative, challenge, social,
  tone, session length. No public API exposes this; it's the actual product.
- **A deliberate tier mix.** Results are composed, not just top-N: roughly 40% mainstream /
  30% indie darling / 30% hidden gem. Even a blockbuster-heavy taste profile surfaces gems.
- **Two console generations per family.** PS4 and Xbox One are still in millions of living
  rooms, so they're first-class filters rather than an afterthought.
- **Honest Switch 2 data.** Games are marked `native`, `switch2-edition`, or
  `backward-compatible` — a distinction no public game API models cleanly, and the main
  reason Ludex uses a curated dataset.
- **Explained matches.** Each result names the axes that actually drove it — and picks the
  reason that *distinguishes* the game, not the one that applies to half the library.

---

## Quick start

**Requirements:** Node.js 20.19+ (22+ recommended — this repo is developed on Node 24) and npm 10+.

```bash
npm install
npm run dev
```

Open **http://localhost:3000**.

> **Port conflicts are handled automatically.** Vite is configured with `strictPort: false`,
> so if 3000 is busy it walks upward — 3001, 3002, and so on — and prints the actual URL it
> bound to. `npm run dev` will not fail because a port was taken.

**No API keys, no `.env`, no backend, no database are required to run Ludex.** The entire game
library is a typed dataset compiled into the bundle. It works offline.

---

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server with hot reload (auto-selects a free port from 3000). |
| `npm run build` | Type-check with `tsc --noEmit`, then build the production bundle into `dist/`. |
| `npm run preview` | Serve the production build locally — use this to sanity-check before deploying. |
| `npm test` | Run the recommendation-engine test suite once. |
| `npm run test:watch` | Same, in watch mode. |
| `npm run data:validate` | Validate every game record: all 7 vibe axes present and in 0–1, at least one platform, an accent color, and `similar` slugs that resolve. |
| `npm run data:stats` | Print coverage by platform and tier — confirms no filter combination dead-ends into an empty result. |
| `npm run data:art` | *(Optional)* Fetch and cache real cover art. **No API key needed.** |
| `npm run data:verify-art` | Check every cached art URL still resolves. `-- --fix` strips dead ones. |
| `npm run check` | Load every route in a headless browser and report console errors, page errors, or an empty render. |
| `npm run shot` | Capture UI screenshots of every route (desktop + mobile) into `screenshot/`. |
| `npm run flows` | Drive real interactions — spin, quiz, save — and assert they work. |

The last three need the dev server running. Run them in that order: `check`
tells you *why* something is broken, `shot` shows you what it looks like, and
`flows` proves the interactive parts actually function.

---

## Project layout

```
Ludex/
├─ creative/            Brand + design source of truth
│  ├─ STYLE_GUIDE.md    Palette, type scale, motion rules, component anatomy
│  ├─ tokens.css        Design tokens — imported by src/index.css
│  ├─ brand/            Logo, wordmark, favicon
│  └─ icons/            Platform + vibe icons (hand-authored SVG)
│
├─ screenshot/          UI captures for visual verification (committed)
│
├─ skills/              Modular utilities, framework-agnostic
│  ├─ recommendation/   The scoring engine — pure TypeScript, zero React
│  ├─ data-pipeline/    Dataset validation, stats, and art enrichment scripts
│  └─ screenshot/       Playwright capture driver
│
└─ src/
   ├─ data/             Game dataset, schema, vibe axes, quiz definitions
   ├─ engine/           Thin re-export of skills/recommendation
   ├─ store/            Zustand state (prefs, platforms, collection, progress)
   ├─ routes/           Landing, VibeCheck, Results, Browse, GameDetail, DailySpin
   ├─ components/       ui/ platform/ quiz/ game/ spin/ layout/
   └─ lib/              Hooks + seeded RNG
```

The recommendation engine lives in `skills/recommendation/` as **pure TypeScript with no React
imports**, so it can be unit-tested headlessly and reused elsewhere (a CLI, a bot, a serverless
function) without dragging the UI along. `src/engine/` just re-exports it.

---

## Adding games to the library

The dataset is plain TypeScript in `src/data/games/`. To add a game, append a record:

```ts
{
  id: 'tunic',
  slug: 'tunic',
  title: 'Tunic',
  year: 2022,
  developer: 'Andrew Shouldice',
  platforms: ['pc', 'ps5', 'switch'],
  tier: 'indie-darling',
  popularity: 58,
  rating: 85,
  genres: ['Action-Adventure', 'Puzzle'],
  tags: ['isometric', 'secrets', 'zelda-like'],
  vibes: { pace: 0.45, depth: 0.75, narrative: 0.35,
           challenge: 0.7, social: 0.0, tone: 0.35, session: 0.5 },
  artStyle: 'stylized',
  hoursToBeat: 12,
  blurb: 'A tiny fox, a cryptic in-game manual, and one of the best secrets in games.',
  hooks: ['Rewards curiosity above all', 'Its manual is the real puzzle'],
  similar: ['hyper-light-drifter', 'death-s-door'],
  art: { accent: '#f0c453' },
}
```

Then run `npm run data:validate` to check it, and `npm run data:stats` to confirm coverage.
Every vibe axis runs **0 → 1**; see `src/data/vibes.ts` for what each pole means.

### Cover art

`npm run data:art` fetches real box art and needs **no API key and no signup**:

1. **Steam** for anything on PC — publisher-supplied `library_600x900` portrait box art (the
   exact shape of a Ludex card), plus a wide hero and real screenshots.
2. **Wikipedia** for console exclusives Steam can't have — official box art from the article.
3. **Nintendo and PlayStation** for those same exclusives' *screenshots*, which Wikipedia never
   carries. Their own product pages render galleries server-side, no key needed.
4. **IMDb** as a last resort for covers — it catalogues games too, and its public autocomplete
   returns portrait posters. This covers launcher-only titles (Valorant, League of Legends,
   Hearthstone) that have no store page anywhere.
5. **None of the above** → the game keeps a deterministic accent-gradient cover generated from
   `art.accent`. That's a designed fallback, not a failure: the app has no hard dependency on
   any image source.

**Every game in the library currently has real cover art**, and 549 of 557 have screenshot
galleries. The eight without are delisted or launcher-only titles with no public gallery.

A weak match is skipped rather than guessed — showing the wrong game's cover is worse than
showing the generated one. If a title is ambiguous, pin it by hand with `steamAppId`.

```bash
npm run data:art -- --dry       # report only
npm run data:art -- --force     # re-fetch everything
npm run data:art -- --only=tunic
```

---

## Deploying to Vercel

Ludex is a static SPA — no serverless functions, no runtime environment variables.

### Option A — Git (recommended)

1. Push the repo to GitHub/GitLab/Bitbucket.
2. In Vercel, **Add New → Project**, and import the repository.
3. Vercel auto-detects the settings from `vercel.json`. Confirm they read:
   - **Framework Preset:** Vite
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
   - **Install Command:** `npm install`
4. Leave **Environment Variables empty** — Ludex needs none at runtime.
5. **Deploy.** Every push to the default branch ships to production; every PR gets a preview URL.

### Option B — CLI

```bash
npm i -g vercel
vercel          # preview deployment
vercel --prod   # production
```

### Before you deploy

```bash
npm run data:validate   # dataset is well-formed
npm test                # engine behaves
npm run build           # type-check + production bundle

npm run dev             # then, in another terminal:
npm run check           # every route renders clean
npm run flows           # spin, quiz and save all work

npm run preview         # finally, click through the production build
```

The `rewrites` rule in `vercel.json` sends all non-asset paths to `index.html` so client-side
routes like `/game/tunic` survive a hard refresh. Don't remove it.

---

## Design & data notes

- **Visual identity:** neon arcade / synthwave — near-black canvas, electric magenta and cyan,
  glow and scanline treatments. Full spec in [`creative/STYLE_GUIDE.md`](creative/STYLE_GUIDE.md).
- **Motion:** every animation is gated on `prefers-reduced-motion`. The app is fully usable —
  spin included — with animation disabled.
- **Art enrichment is strictly optional and keyless.** `npm run data:art` caches image URLs
  from Steam and Wikipedia at build time. Without it, generated accent gradients are used and no
  feature is lost. Images are hotlinked from those CDNs rather than copied into the repo, so the
  app needs a network connection to show real art — everything else works offline.
- **Persistence is local.** Preferences, collection, XP and streak live in `localStorage`. There
  are no accounts and nothing leaves your browser.

---

## License & attribution

Game titles, descriptions, and artwork belong to their respective developers and publishers.
Ludex's curated vibe tags, blurbs, and "why it fits" copy are original editorial work.
Optional art enrichment is sourced from the [RAWG Video Games Database API](https://rawg.io/apidocs).
