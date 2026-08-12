/**
 * Fetches real cover art for the curated library. **No API key required.**
 *
 *   npm run data:art
 *
 * Sources, in priority order:
 *
 *   1. STEAM — for anything released on PC. Steam serves publisher-supplied
 *      `library_600x900` portrait box art, which is exactly the shape of a
 *      Ludex card, plus a wide header for the detail hero and real
 *      screenshots. Entirely public, no key, no signup.
 *
 *   2. WIKIPEDIA — for console exclusives Steam cannot have (Mario Kart World,
 *      Metroid Prime 4, Spider-Man 2 …). Returns the official box art from the
 *      article's infobox.
 *
 *   3. NOTHING — the game keeps its generated accent-gradient cover, which is
 *      a designed fallback rather than a failure state.
 *
 * Why RAWG is no longer used: its API returns HTTP 522 (origin unreachable),
 * and it required a key even when it worked. Steam covers ~85% of the library
 * with better-shaped art.
 *
 * Flags:
 *   --dry          report what would change, write nothing
 *   --force        re-fetch games that already have a cached cover
 *   --limit=N      stop after N games
 *   --only=slug    just one game, for debugging the matcher
 *
 * Resolved Steam app IDs are written back into the dataset so later runs are
 * exact lookups instead of fuzzy searches.
 */

import path from 'node:path';
import fs from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve(import.meta.dirname, '../..');
const GAMES_DIR = path.join(ROOT, 'src/data/games');
const UA = 'LudexDev/0.1 (personal game-discovery project)';

/** Every shard except the barrel — discovered, so splitting files later just works. */
const SHARDS = (await fs.readdir(GAMES_DIR))
  .filter((f) => f.endsWith('.ts') && f !== 'index.ts')
  .sort();

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  }),
);
const DRY = Boolean(args.dry);
const FORCE = Boolean(args.force);
const LIMIT = args.limit ? Number(args.limit) : Infinity;
const ONLY = typeof args.only === 'string' ? args.only : null;

/* ------------------------------------------------------------------ helpers */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const normalize = (s) =>
  s
    .toLowerCase()
    .replace(/[''’]/g, '')
    .replace(/\b(the|a|an)\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/**
 * Fetch JSON with a short backoff.
 *
 * Wikipedia in particular starts refusing requests part-way through a long run,
 * and a single swallowed failure used to silently drop a game's cover — a whole
 * batch of Switch titles lost their box art that way. One retry recovers nearly
 * all of them.
 */
async function getJSON(url, timeout = 20_000, attempts = 3) {
  let lastError;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': UA, Accept: 'application/json' },
        signal: AbortSignal.timeout(timeout),
      });
      if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    } catch (error) {
      lastError = error;
      if (i < attempts - 1) await sleep(800 * (i + 1));
    }
  }
  throw lastError;
}

/** Confirms an image URL actually exists before caching it. */
async function imageExists(url) {
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'User-Agent': UA, Range: 'bytes=0-256' },
      signal: AbortSignal.timeout(12_000),
    });
    return res.ok && (res.headers.get('content-type') ?? '').startsWith('image/');
  } catch {
    return false;
  }
}

/* -------------------------------------------------------------------- steam */

/**
 * Steam's search is loose and full of DLC, soundtracks, demos and bundles.
 * Requiring a normalized title match keeps "Hollow Knight" from resolving to
 * "Hollow Knight: Silksong" — caching the wrong game's cover is worse than
 * showing the generated one.
 */
async function findSteamAppId(game) {
  const results = await getJSON(
    `https://steamcommunity.com/actions/SearchApps/${encodeURIComponent(game.title)}`,
  );
  const target = normalize(game.title);
  const noise = /(soundtrack|demo|dlc|bundle|pack|beta|server|sdk|artbook|art book|upgrade)/i;

  const exact = results.filter((r) => normalize(r.name) === target && !noise.test(r.name));
  if (exact.length) return Number(exact[0].appid);

  // Accept a prefix match only when the extra words are edition noise, so
  // "Disco Elysium" can still find "Disco Elysium - The Final Cut".
  const prefixed = results.filter((r) => {
    const n = normalize(r.name);
    if (noise.test(r.name)) return false;
    if (!n.startsWith(target)) return false;
    const extra = n.slice(target.length).trim();
    return extra === '' || /^(the )?(final cut|definitive|complete|remaster|remastered|edition|goty|game of the year|director s cut|revision|ultimate)/.test(extra);
  });
  return prefixed.length ? Number(prefixed[0].appid) : null;
}

/**
 * Steam asset URLs are fully derivable from the app ID, so the dataset stores
 * almost nothing: no cover, no hero, and screenshots reduced to their content
 * hashes. See src/data/art.ts for the expansion. `cover` is written back only
 * when the app has no portrait capsule and we have to fall back to the wide
 * header image.
 */
async function steamArt(appId) {
  const asset = (name) =>
    `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${appId}/${name}`;

  const hasPortrait = await imageExists(asset('library_600x900.jpg'));
  // `library_hero.jpg` is what src/data/art.ts derives. Older apps lack it, so
  // check and store an explicit fallback rather than shipping a 404.
  const hasHero = await imageExists(asset('library_hero.jpg'));

  let shots;
  let headerFallback;
  try {
    const details = await getJSON(
      `https://store.steampowered.com/api/appdetails?appids=${appId}`,
    );
    const data = details?.[appId]?.data;
    if (data) {
      /**
       * Keep the path *relative to the app folder*, not just the hash. Newer
       * store assets nest each screenshot in its own directory
       * (`<hash>/ss_<hash>.1920x1080.jpg`), and assuming the flat layout
       * produced dead links for 58 games.
       */
      shots = (data.screenshots ?? [])
        .map((s) => {
          const full = (s.path_full ?? '').split('?')[0];
          const at = full.indexOf(`/apps/${appId}/`);
          return at === -1 ? null : full.slice(at + `/apps/${appId}/`.length);
        })
        .filter(Boolean)
        .slice(0, 4);
      if (!hasPortrait || !hasHero) headerFallback = data.header_image?.split('?')[0];
    }
  } catch {
    /* details are a bonus; a portrait cover alone is still a win */
  }

  if (!hasPortrait && !headerFallback) return null;

  return {
    // Omitted when derivable — that is the whole point of the compact form.
    cover: hasPortrait ? undefined : headerFallback,
    hero: hasHero ? undefined : headerFallback,
    shots: shots?.length ? shots : undefined,
    derived: hasPortrait,
  };
}

/* ----------------------------------------------------------------- nintendo */

/**
 * Nintendo's own store, for the ~90 Switch exclusives Steam cannot have.
 *
 * Wikipedia gives those games good portrait box art but never screenshots, so
 * their detail pages had no gallery at all. nintendo.com embeds a
 * `productGallery` of Cloudinary asset IDs in its Next.js payload, which is
 * public and needs no key.
 *
 * The store slug is guessed from the title — `-switch-2` first, since a game on
 * both generations has a separate newer listing with better art. Set
 * `nintendoSlug` on a game to pin it when the guess fails.
 */
/**
 * Nintendo's store slugs follow rules worth encoding rather than guessing at:
 * accents are stripped ("Pokémon" -> "pokemon"), and `+` is spelled out
 * ("Mario + Rabbids" -> "mario-plus-rabbids"). Apostrophes go both ways
 * depending on the title, so both forms are tried.
 */
function ninSlugVariants(title) {
  const base = title.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const clean = (s) =>
    s
      .replace(/\s*\+\s*/g, ' plus ')
      .replace(/[:.!?]/g, ' ')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  return [
    ...new Set([
      clean(base.replace(/['’']/g, '')), //          bowsers-fury
      clean(base.replace(/['’']/g, '-')), //         bowser-s-fury
      clean(base.replace(/\s*\+\s*/g, ' ')), //      dropped entirely
    ]),
  ];
}

async function nintendoArt(game) {
  const candidates = [];
  if (game.nintendoSlug) candidates.push(game.nintendoSlug);
  for (const base of ninSlugVariants(game.title)) {
    if (game.platforms.includes('switch2')) candidates.push(`${base}-switch-2`);
    candidates.push(`${base}-switch`, base);
  }

  for (const slug of candidates) {
    let html;
    try {
      const res = await fetch(`https://www.nintendo.com/us/store/products/${slug}/`, {
        headers: { 'User-Agent': UA },
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) continue;
      html = await res.text();
    } catch {
      continue;
    }

    const next = html.match(
      /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/,
    );
    if (!next) continue;

    /**
     * A Nintendo product page embeds ~40 products — the one being viewed plus
     * every "you may also like" recommendation, all with their own galleries.
     * Regexing for the first `productGallery` therefore returned a *different
     * game's* screenshots; Super Mario Odyssey's page showed Kirby.
     *
     * `ROOT_QUERY` names the page's own product by urlKey, so resolve through
     * that rather than guessing at document order.
     */
    let apollo;
    try {
      apollo = JSON.parse(next[1])?.props?.pageProps?.initialApolloState;
    } catch {
      continue;
    }
    if (!apollo) continue;

    const rootKey = Object.keys(apollo.ROOT_QUERY ?? {}).find(
      (k) => k.startsWith('product(') && k.includes(`"urlKey":"${slug}"`),
    );
    const ref = rootKey ? apollo.ROOT_QUERY[rootKey]?.__ref : null;
    const product = ref ? apollo[ref] : null;
    if (!product) continue;

    // Videos share the gallery array; keep only image assets.
    const ids = (product.productGallery ?? [])
      .filter((a) => a?.resourceType === 'image' && a.publicId)
      .map((a) => a.publicId);
    if (ids.length === 0) continue;

    const url = (id, w, h) =>
      `https://assets.nintendo.com/image/upload/c_fill,w_${w}${h ? `,h_${h}` : ''},f_auto,q_auto/${id.replace(/^\//, '')}`;

    // The store's own key art, used as a cover when Wikipedia has no box art —
    // cropped to portrait so it fills a card rather than letterboxing.
    const productImage = product.productImage?.publicId;

    return {
      cover: productImage ? url(productImage, 600, 900) : undefined,
      shots: ids.slice(0, 4).map((id) => url(id, 1280)),
      hero: url(ids[0], 1920),
      slug,
    };
  }
  return null;
}

/* ------------------------------------------------------------- playstation */

/**
 * playstation.com game pages, for Sony exclusives Steam cannot have.
 *
 * The marketing site (not the storefront) renders its media server-side, so the
 * gallery is in the initial HTML. Screenshots are consistently JPEG and large;
 * logos, badges and key art are PNG, and thumbnails carry a `?w=` query — so
 * filtering on extension and size cleanly separates them.
 *
 * Set `playstationSlug` on a game to pin it when the title-derived slug fails.
 */
async function playstationArt(game) {
  const base = game.playstationSlug ?? ninSlugVariants(game.title)[0];

  let html;
  try {
    const res = await fetch(`https://www.playstation.com/en-my/games/${base}/`, {
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(25_000),
    });
    if (!res.ok) return null;
    html = await res.text();
  } catch {
    return null;
  }

  // Trailing HTML entities would otherwise produce near-duplicate URLs.
  const urls = [
    ...new Set(
      [...html.matchAll(/https:\/\/image\.api\.playstation\.com\/[^"'\\ )]+/g)]
        .map((m) => m[0].split(/[&"'\\]/)[0])
        .filter((u) => u.endsWith('.jpg')),
    ),
  ];
  if (urls.length === 0) return null;

  // Confirm size — a screenshot is a few hundred KB, a UI asset is a few.
  const big = [];
  for (const url of urls) {
    if (big.length >= 4) break;
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': UA, Range: 'bytes=0-64' },
        signal: AbortSignal.timeout(12_000),
      });
      const total = Number(/\/(\d+)$/.exec(res.headers.get('content-range') ?? '')?.[1] ?? 0);
      if (total > 200_000) big.push(url);
    } catch {
      /* skip */
    }
  }
  if (big.length === 0) return null;

  return { shots: big, hero: big[0], slug: base };
}

/* --------------------------------------------------------------------- xbox */

/**
 * Microsoft's display catalog — screenshots for Xbox/PC-store titles.
 *
 * Public and keyless, and returns 4K stills tagged `Screenshot`. The catch is
 * that it is keyed by a 12-character Store ID which their search endpoints
 * refuse to serve programmatically, so `xboxStoreId` has to be set by hand from
 * an `xbox.com/games/store/<slug>/<ID>` URL.
 *
 * Worth having anyway: it is the only source that covers launcher-only games
 * which happen to also ship on Xbox, such as Valorant.
 */
async function xboxArt(game) {
  if (!game.xboxStoreId) return null;

  let data;
  try {
    data = await getJSON(
      `https://displaycatalog.mp.microsoft.com/v7.0/products?bigIds=${game.xboxStoreId}` +
        `&market=US&languages=en-US&MS-CV=ludex`,
    );
  } catch {
    return null;
  }

  const images = data.Products?.[0]?.LocalizedProperties?.[0]?.Images ?? [];
  const seen = new Set();
  const shots = [];
  for (const image of images) {
    if (!/screenshot/i.test(image.ImagePurpose) || (image.Width ?? 0) < 1280) continue;
    const url = image.Uri?.startsWith('//') ? `https:${image.Uri}` : image.Uri;
    if (!url || seen.has(url)) continue;
    seen.add(url);
    shots.push(url);
    if (shots.length === 4) break;
  }
  if (shots.length === 0) return null;

  const tall = images.find((i) => /poster|boxart|brandedkeyart/i.test(i.ImagePurpose));
  return {
    cover: tall?.Uri ? (tall.Uri.startsWith('//') ? `https:${tall.Uri}` : tall.Uri) : undefined,
    shots,
    hero: shots[0],
  };
}

/* --------------------------------------------------------------------- imdb */

/**
 * IMDb, as a last-resort *cover* source.
 *
 * It catalogues video games alongside films, and its public autocomplete
 * endpoint returns a portrait poster with no key required — which is exactly
 * what the launcher-only titles (Valorant, League of Legends, Hearthstone) lack
 * everywhere else. IGDB would be the obvious choice but sits behind Cloudflare
 * and needs Twitch OAuth for its API.
 *
 * Covers only: IMDb's media gallery is bot-blocked, so no screenshots.
 */
async function imdbArt(game) {
  let data;
  try {
    data = await getJSON(
      `https://v3.sg.media-imdb.com/suggestion/x/${encodeURIComponent(game.title)}.json?includeVideos=0`,
    );
  } catch {
    return null;
  }

  const target = normalize(game.title);
  const games = (data.d ?? []).filter((h) => h.qid === 'videoGame' && h.i?.imageUrl);
  const hit =
    games.find((h) => normalize(h.l ?? '') === target) ??
    games.find((h) => normalize(h.l ?? '').startsWith(target)) ??
    games.find((h) => target.startsWith(normalize(h.l ?? '')));
  if (!hit) return null;

  // Reject anything that is not portrait — a wide still is not a cover.
  const { imageUrl, width, height } = hit.i;
  if (width && height && width / height > 1.05) return null;

  // The raw asset can be several megabytes; ask Amazon for a card-sized one.
  return { cover: imageUrl.replace(/\._V1_.*?\.jpg$/, '._V1_QL75_UX600_.jpg'), derived: false };
}

/* ---------------------------------------------------------------- wikipedia */

const WIKI_OVERRIDES = {
  'starcraft-ii': 'StarCraft II: Wings of Liberty',
  'zelda-tears-of-the-kingdom': 'The Legend of Zelda: Tears of the Kingdom',
  'zelda-breath-of-the-wild': 'The Legend of Zelda: Breath of the Wild',
  'marvels-spider-man-2': "Marvel's Spider-Man 2",
  'pokemon-legends-z-a': 'Pokémon Legends: Z-A',
  'super-mario-party-jamboree': 'Super Mario Party Jamboree',
  'metroid-prime-4-beyond': 'Metroid Prime 4: Beyond',
  'god-of-war-ragnarok': 'God of War Ragnarök',
  'resident-evil-4-remake': 'Resident Evil 4 (2023 video game)',
  'moon-remix-rpg': 'Moon: Remix RPG Adventure',
};

async function wikipediaArt(game) {
  const title = WIKI_OVERRIDES[game.slug] ?? game.title;

  // Resolve the article first — search tolerates punctuation and disambiguation
  // suffixes that a direct summary lookup would miss.
  let page = title;
  try {
    const search = await getJSON(
      `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
        `${title} video game`,
      )}&srlimit=5&format=json&origin=*`,
    );
    const hits = search?.query?.search ?? [];
    const target = normalize(title);
    const hit =
      hits.find((h) => normalize(h.title.replace(/\s*\(.*\)$/, '')) === target) ?? hits[0];
    if (hit) page = hit.title;
  } catch {
    /* fall through to the literal title */
  }

  try {
    const summary = await getJSON(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(page.replace(/ /g, '_'))}`,
    );
    const raw = summary.originalimage?.source ?? summary.thumbnail?.source;
    if (!raw) return null;

    // Strip the analytics query the REST API appends.
    const cover = raw.split('?')[0];

    // Reject article images that clearly are not box art (logos, screenshots
    // of people, etc. tend to be very wide).
    const w = summary.originalimage?.width ?? summary.thumbnail?.width ?? 0;
    const h = summary.originalimage?.height ?? summary.thumbnail?.height ?? 0;
    if (w && h && w / h > 1.3) return null;

    return { cover, shots: undefined, derived: false };
  } catch {
    return null;
  }
}

/* ------------------------------------------------------- dataset rewriting */

/**
 * Replaces a game's `art: { ... }` literal, preserving `accent`.
 *
 * `accent` is hand-authored editorial data driving every card glow and the
 * generated fallback, so enrichment must never overwrite it. Anchored on the
 * slug so the right record is edited.
 */
function writeArt(source, slug, art, accent, steamAppId) {
  const at = source.indexOf(`slug: '${slug}'`);
  if (at === -1) return null;

  const artAt = source.indexOf('art: {', at);
  if (artAt === -1) return null;
  const close = source.indexOf('}', artAt);
  if (close === -1) return null;

  const esc = (s) => String(s).replace(/'/g, "\\'");
  const parts = [`accent: '${accent}'`];
  if (art.cover) parts.push(`cover: '${esc(art.cover)}'`);
  // Steam heroes are derived from the app id; Nintendo's must be stored.
  if (art.hero) parts.push(`hero: '${esc(art.hero)}'`);
  if (art.shots?.length) parts.push(`shots: [${art.shots.map((s) => `'${esc(s)}'`).join(', ')}]`);

  let next = source.slice(0, artAt) + `art: { ${parts.join(', ')} }` + source.slice(close + 1);

  // Record the resolved app id so later runs skip the fuzzy search.
  if (steamAppId && !next.slice(at, artAt + 200).includes('steamAppId')) {
    next = next.slice(0, at) + `slug: '${slug}',\n    steamAppId: ${steamAppId},` +
      next.slice(at + `slug: '${slug}',`.length);
  }
  return next;
}

/* -------------------------------------------------------------------- main */

const { GAMES } = await import(pathToFileURL(path.join(GAMES_DIR, 'index.ts')).href);

const sources = new Map();
for (const shard of SHARDS) {
  sources.set(shard, await fs.readFile(path.join(GAMES_DIR, shard), 'utf8'));
}

// A Steam-sourced game stores no cover URL at all — its art is derived from
// `steamAppId` — so "already has art" means either of those, not just a URL.
// A game is only "done" once it has a cover *and* a screenshot gallery; a
// cover-only record leaves an empty detail page.
const needsArt = (g) => !(g.steamAppId || g.art.cover) || !(g.art.shots?.length > 0);

let todo = GAMES.filter((g) => FORCE || needsArt(g));
if (ONLY) todo = GAMES.filter((g) => g.slug === ONLY);
todo = todo.slice(0, LIMIT);

console.log(`\n  Fetching art for ${todo.length} of ${GAMES.length} games${DRY ? ' (dry run)' : ''}\n`);

const tally = { steam: 0, wikipedia: 0, nintendo: 0, playstation: 0, xbox: 0, imdb: 0, none: 0 };
const unmatched = [];

for (const game of todo) {
  let art = null;
  let via = null;
  let appId = game.steamAppId ?? null;

  // Steam first, but only for games actually released on PC.
  if (game.platforms.includes('pc')) {
    try {
      if (!appId) appId = await findSteamAppId(game);
      if (appId) art = await steamArt(appId);
      if (art) via = 'steam';
    } catch (error) {
      console.log(`    ! ${game.title} — Steam lookup failed (${error.message})`);
    }
  }

  if (!art) {
    try {
      art = await wikipediaArt(game);
      if (art) via = 'wikipedia';
    } catch {
      /* falls through to the generated cover */
    }
  }

  /**
   * The platform holders supply the screenshots Wikipedia never has. Wikipedia's
   * box art is kept as the cover where we already have it — it is portrait,
   * which is the shape a Ludex card wants — and Nintendo or Sony fill in the
   * hero and gallery.
   */
  if (!art || !art.shots?.length) {
    // Not restricted to console exclusives: a PC game that simply is not on
    // Steam (Fortnite, Rocket League, Overwatch 2 — own launchers) still has a
    // perfectly good gallery on the console storefronts it does appear on.
    const onNintendo = game.platforms.some((p) => p === 'switch' || p === 'switch2');
    const onPlayStation = game.platforms.some((p) => p === 'ps5' || p === 'ps4');

    for (const [source, fetcher] of [
      ...(onNintendo ? [['nintendo', nintendoArt]] : []),
      ...(onPlayStation ? [['playstation', playstationArt]] : []),
      ...(game.xboxStoreId ? [['xbox', xboxArt]] : []),
    ]) {
      try {
        const found = await fetcher(game);
        if (!found) continue;
        art = {
          // Never let a fresh run drop a cover we already had. A failed
          // Wikipedia lookup mid-run used to leave this undefined, silently
          // stripping the box art off a batch of Switch games.
          cover: art?.cover ?? game.art.cover ?? found.cover,
          hero: found.hero,
          shots: found.shots,
          derived: false,
        };
        via = art.cover ? 'wikipedia' : source;
        tally[source]++;
        break;
      } catch {
        /* screenshots are a bonus, never a requirement */
      }
    }
  }

  /**
   * Last resort for a cover. Runs after the storefronts so their art always
   * wins, but before giving up — launcher-only games have no store page and no
   * Wikipedia box art, only a logo.
   */
  if (!art?.cover && !game.steamAppId) {
    try {
      const imdb = await imdbArt(game);
      if (imdb) {
        art = { ...(art ?? {}), cover: imdb.cover, derived: false };
        via = 'imdb';
        tally.imdb++;
      }
    } catch {
      /* a generated cover is an acceptable outcome */
    }
  }

  if (!art) {
    tally.none++;
    unmatched.push(game.title);
    console.log(`    ○ ${game.title} — keeping generated cover`);
  } else {
    tally[via]++;
    console.log(`    ✔ ${game.title}  [${via}]`);
    if (!DRY) {
      for (const shard of SHARDS) {
        const next = writeArt(
          sources.get(shard),
          game.slug,
          art,
          game.art.accent,
          via === 'steam' ? appId : null,
        );
        if (next) {
          sources.set(shard, next);
          break;
        }
      }
    }
  }

  await sleep(320); // be a good citizen on both APIs
}

if (!DRY && tally.steam + tally.wikipedia > 0) {
  for (const shard of SHARDS) {
    await fs.writeFile(path.join(GAMES_DIR, shard), sources.get(shard), 'utf8');
  }
}

console.log(`
  Steam:       ${tally.steam}
  Wikipedia:   ${tally.wikipedia}
  Nintendo:    ${tally.nintendo}   (screenshots)
  PlayStation: ${tally.playstation}   (screenshots)
  Xbox:        ${tally.xbox}   (screenshots)
  IMDb:        ${tally.imdb}   (covers only)
  Generated:   ${tally.none}${unmatched.length ? `  (${unmatched.slice(0, 8).join(', ')}${unmatched.length > 8 ? ', …' : ''})` : ''}

  ${DRY ? 'Dry run — no files written.' : 'Dataset updated. Run `npm run data:validate` next.'}
`);
