# skills/data-pipeline

Node scripts for maintaining the curated library. All read `src/data/games/`
directly via Node's native TypeScript support — no build step.

| Script | Command | Purpose |
|---|---|---|
| `validate-dataset.mjs` | `npm run data:validate` | Correctness gate. Exits non-zero on error. |
| `stats.mjs` | `npm run data:stats` | Coverage report by platform, tier and vibe axis. |
| `enrich-art.mjs` | `npm run data:art` | *Optional.* Caches real cover art. No API key. |
| `verify-art.mjs` | `npm run data:verify-art` | Checks every cached art URL still resolves. `--fix` strips dead ones. |
| `fix-mojibake.mjs` | *(one-off)* | Repairs UTF-8 mangled by a PowerShell round trip. |
| `migrate-platforms.mjs` | *(one-off)* | Record of the four-platform → seven-platform expansion. |

## validate-dataset

**Run after every dataset edit.** It catches the failures that would otherwise
corrupt recommendations *silently* rather than throwing:

- a missing or out-of-range vibe axis (skews every distance calculation)
- a duplicate slug (makes a detail route unreachable)
- a `similar` slug that resolves to nothing (renders an empty related row)
- a missing `art.accent` (breaks the generated fallback cover)
- **Switch 2 honesty violations** — listed on `switch2` without a
  `switch2Status`, marked `backward-compatible` without being on `switch`, or
  marked `native` while also on Switch 1

It also *warns* where tier and popularity disagree — a "hidden gem" with
popularity 80 is a contradiction worth looking at. Warnings do not fail the run.

## stats

Answers one question: **can any filter combination a user might pick dead-end
into an empty or embarrassingly short result set?**

The vibe-coverage table is the part worth reading. It caught a real gap during
development — 56 games at the solo end of `social` against 7 at the co-op end,
meaning "I want to play with people" matched badly no matter what the engine
did. The fix was more co-op games, not more tuning.

## enrich-art

Strictly optional, and **needs no API key or signup**. Without it, every game
renders a deterministic accent-gradient cover generated from `art.accent`, and
no feature is lost.

```bash
npm run data:art

npm run data:art -- --dry          # report only, write nothing
npm run data:art -- --force        # re-fetch games that already have covers
npm run data:art -- --limit=5      # try the matcher on a handful first
npm run data:art -- --only=tunic   # debug a single game
```

### Sources, in priority order

1. **Steam** — for anything released on PC, which is most of the library.
   Serves `library_600x900` portrait box art (the exact shape of a Ludex card),
   a wide header for the detail hero, and real screenshots. Fully public.
2. **Wikipedia** — box art for console exclusives Steam cannot have (Mario Kart
   World, Metroid Prime 4, Astro Bot…), from the article infobox. A
   `WIKI_OVERRIDES` map handles titles whose article name differs.
3. **Nintendo** — *screenshots* for Switch exclusives. Wikipedia never has
   these, so those detail pages had no gallery at all. nintendo.com embeds a
   `productGallery` of Cloudinary asset IDs in its Next.js payload; the store
   slug is guessed from the title, trying `-switch-2` first (a cross-generation
   game has a separate, better-illustrated newer listing). Slugs strip accents
   and spell `+` as "plus". Pin with `nintendoSlug` when the guess fails.
4. **PlayStation** — screenshots for Sony exclusives, from the marketing site
   (`playstation.com/en-my/games/<slug>`), which renders its gallery
   server-side. Screenshots are consistently large JPEGs while logos and badges
   are PNG, so extension plus a size check separates them. Pin with
   `playstationSlug`.
5. **IMDb** — a last-resort *cover* source. It catalogues video games alongside
   films, and its public autocomplete endpoint returns a portrait poster with no
   key. This is what finally covered the launcher-only titles (Valorant, League
   of Legends, Hearthstone) that have no store page and only a wide logo on
   Wikipedia. Covers only — IMDb's media gallery is bot-blocked.
6. **None of them** — the game keeps its generated cover.

**Xbox** is also wired in (`xboxStoreId`) — Microsoft's display catalog serves
4K screenshots, keyless, and is the only source that covers a launcher-only game
which happens to also ship on Xbox. Its search endpoints are closed, so the
12-character Store ID has to be copied by hand from an
`xbox.com/games/store/<slug>/<ID>` URL.

### Sources evaluated and rejected

| Source | Verdict |
|---|---|
| **RAWG** | API returns HTTP 522 (origin down) *and* needs a key. |
| **IGDB** | Would be ideal — covers *and* screenshots in one call. `igdb.com` is 403 behind Cloudflare, and the API needs Twitch OAuth credentials. Adding those is the single best future upgrade here. |
| **MobyGames** | Has screenshots for nearly everything, but serves a Cloudflare challenge — 403 even from a real headless browser. |
| **SteamGridDB** | Loads fine, but only hosts Grids, Heroes, Logos and Icons. No gameplay screenshots, so it cannot fill the remaining gap. |
| **Publisher sites** (Riot, Blizzard) | Only ultra-wide marketing banners, not gallery stills. |

Wikipedia's portrait box art is kept as the cover wherever it exists — it is the
right shape for a card — while Nintendo and Sony supply hero and gallery.

> **Resolve the page's own product, not the first one you find.** A Nintendo
> store page embeds ~40 products (the game plus every recommendation), each with
> its own gallery. Taking the first match put *Kirby* screenshots on Super Mario
> Odyssey. The scraper now parses the Apollo state and follows `ROOT_QUERY`'s
> `urlKey` reference. `data:validate` fails if two games share a screenshot URL,
> which is the fingerprint of that whole class of bug.

RAWG was the original plan and was dropped: it required an API key *and* its API
now returns HTTP 522 (origin unreachable). Steam plus Nintendo covers the
library with better-shaped art and no key at all.

Storage is compact: Steam URLs derive from `steamAppId` (only screenshot hashes
are stored), while Nintendo and Wikipedia URLs are stored in full because
nothing about them is derivable. See `src/data/art.ts`.

### Two deliberate behaviours

- **`accent` always survives.** It is hand-authored editorial data that drives
  every card glow and the fallback cover; enrichment must never overwrite it.
- **A weak match is skipped, not guessed.** Steam's search happily returns DLC,
  soundtracks and sequels, so a result must match on normalized title, with only
  edition suffixes ("The Final Cut", "Definitive Edition") tolerated. Wikipedia
  results wider than 1.3:1 are rejected as logos rather than box art. Showing
  the wrong game's cover is worse than showing the generated one.

Resolved Steam app IDs are written back into the dataset, so later runs are exact
lookups. Set `steamAppId` by hand to pin an ambiguous title — that is how
Disco Elysium (listed on Steam without its subtitle) and Spiritfarer (listed as
"Farewell Edition") are handled.

## verify-art

Derived URLs are a liability: they are built from an ID rather than observed, so
they can be confidently wrong. Two real cases, both invisible until someone
opened a page:

- **Heroes.** `page_bg_raw.jpg` does not exist for every Steam app, so 135 games
  painted a broken-image icon across the top of their detail page. Derivation
  now uses `library_hero.jpg` and enrichment stores an explicit fallback for the
  older apps that lack it.
- **Screenshots.** Newer store assets nest each image in its own folder
  (`<hash>/ss_<hash>.1920x1080.jpg`). Storing only the hash and assuming the flat
  layout produced dead links for 58 games. `art.shots` now holds the path
  relative to the app folder, with bare hashes still honoured for older records.

```bash
npm run data:verify-art          # report
npm run data:verify-art -- --fix # strip dead heroes/shots, then re-run data:art
```

Covers are reported but never stripped: a card falls back to generated art
either way, and losing a good URL is worse than reporting a bad one.

The UI also defends itself — `GameCover`, `GameHero` and the detail gallery all
fall back or hide on an image error, so rot degrades quietly rather than
rendering broken.

## migrate-platforms

A one-off, kept as the record of how Ludex went from four platforms to seven.
It only ever *adds* platforms and never touches `pc`, `switch` or `switch2`,
which means `switch2Status` stays valid by construction. Safe to re-run.

New games should be authored with their full platform list directly — don't
extend the migration map.
