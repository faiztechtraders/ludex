/**
 * Snapshot Steam prices into `src/data/prices.ts`.
 *
 *   npm run data:prices
 *   npm run data:prices -- --region=US
 *
 * **Why a snapshot and not a live lookup.** Steam's appdetails endpoint serves
 * exactly the data we want — original price, current price, discount percent —
 * but sends no `Access-Control-Allow-Origin` header, so a browser on the
 * deployed origin is blocked from calling it. Live prices would therefore
 * require a proxy, and a proxy is a backend; Ludex is deliberately a static
 * SPA that ships everything in the bundle.
 *
 * A daily refresh is not a compromise for the actual use case: Steam sales run
 * for days or weeks, so "is this discounted right now" is answered just as well
 * by a snapshot taken this morning. What it cannot do is show each visitor
 * their own currency — the snapshot has exactly one region, recorded in the
 * file so the UI can be honest about it.
 */

import fs from 'node:fs';
import { GAMES } from '../../src/data/games/index.ts';

const args = process.argv.slice(2);
const region = (args.find((a) => a.startsWith('--region='))?.split('=')[1] ?? 'MY').toUpperCase();
const dryRun = args.includes('--dry');

const OUT = 'src/data/prices.ts';
/** appdetails accepts a comma-separated list when `filters` is set. */
const BATCH = 40;
const DELAY_MS = 900;

const priced = GAMES.filter((g) => g.steamAppId);
console.log(`\n  Fetching ${region} prices for ${priced.length} Steam games…\n`);

/**
 * slug -> [{ store, final, initial, discount, currency }] — minor units.
 *
 * An array because a cross-platform game is sold at genuinely different prices
 * on each store, and collapsing that to one number picks a winner arbitrarily.
 */
const prices = new Map();

function addOffer(slug, offer) {
  const list = prices.get(slug) ?? [];
  // Re-running a store replaces its entry rather than duplicating it.
  const next = list.filter((o) => o.store !== offer.store);
  next.push(offer);
  prices.set(slug, next);
}
let currency = null;
let free = 0;
let unavailable = 0;
/** Games with no price_overview — checked individually for is_free later. */
const maybeFree = [];

/**
 * Console stores quote in USD, Steam in the requested region. Rather than
 * pretend they are the same number, each entry carries its own currency and
 * the UI converts for display using the rate recorded below.
 */
async function fxRate(from, to) {
  try {
    const res = await fetch(`https://open.er-api.com/v6/latest/${from}`);
    const json = await res.json();
    const rate = json?.rates?.[to];
    return typeof rate === 'number' ? rate : null;
  } catch {
    return null;
  }
}

/**
 * Nintendo embeds a structured price in the same Apollo payload the art
 * scraper already reads, resolved through ROOT_QUERY's urlKey so it is this
 * product's price and not a recommendation's.
 */
async function nintendoPrice(game) {
  const res = await fetch(`https://www.nintendo.com/us/store/products/${game.nintendoSlug}/`, {
    headers: { 'User-Agent': 'LudexDev/0.1 (personal game-discovery project)' },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) return null;
  const html = await res.text();
  const next = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!next) return null;

  const apollo = JSON.parse(next[1])?.props?.pageProps?.initialApolloState;
  const rootKey = Object.keys(apollo?.ROOT_QUERY ?? {}).find(
    (k) => k.startsWith('product(') && k.includes(`"urlKey":"${game.nintendoSlug}"`),
  );
  const product = rootKey ? apollo[apollo.ROOT_QUERY[rootKey]?.__ref] : null;
  const p = product?.['prices({"personalized":false})'];
  if (!p || typeof p.finalPrice !== 'number') return null;

  const final = Math.round(p.finalPrice * 100);
  const initial = Math.round((p.regularPrice ?? p.finalPrice) * 100);
  return {
    final,
    initial,
    discount: initial > final ? Math.round(((initial - final) / initial) * 100) : 0,
    currency: p.currency ?? 'USD',
  };
}

/**
 * PlayStation renders prices into the page as formatted strings.
 *
 * A product page carries several price blocks — one per edition, plus a PS Plus
 * entry whose `discountedPrice` is the literal string "Included". Taking the
 * first match got that one, failed to parse it as money, and returned nothing:
 * the same "first match is the wrong product" mistake the Nintendo gallery
 * scraper made. Every block is parsed and the cheapest genuine purchase price
 * wins, with subscription offers skipped outright.
 */
async function playstationPrice(game) {
  // Sony localises the whole page, so the requested region's own currency comes
  // back directly — RM 99.00 rather than $19.99. Worth doing: the real Malaysian
  // price is RM 99 while converting the US price gives RM 81.71, so the
  // conversion was not merely imprecise, it was wrong by a fifth.
  const locale = region === 'MY' ? 'en-my' : `en-${region.toLowerCase()}`;
  const res = await fetch(`https://www.playstation.com/${locale}/games/${game.playstationSlug}/`, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) return null;
  const html = await res.text();

  const money = (s) => {
    /**
     * "Free" is a price, not an absence of one.
     *
     * Discarding it meant Fortnite's own listing — `basePrice: "Free"` — was
     * thrown away, and the cheapest *numeric* block won instead: a RM 16
     * cosmetic bundle, shown as the price of a free game. Anything else without
     * digits ("Included", "Pre-order") is still not a purchase price.
     */
    if (/free/i.test(String(s))) return 0;
    if (!/\d/.test(String(s))) return null;
    // Strip thousands separators before parsing, or "RM 1,299.00" becomes 1.299.
    const n = Number(String(s).replace(/[^0-9.,]/g, '').replace(/,(?=\d{3}\b)/g, ''));
    return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null;
  };

  /** Read the currency off the symbol rather than assuming the region's. */
  const currencyOf = (s) => {
    if (/RM/i.test(s)) return 'MYR';
    if (/S\$/.test(s)) return 'SGD';
    if (/£/.test(s)) return 'GBP';
    if (/€/.test(s)) return 'EUR';
    return 'USD';
  };
  let detected = null;

  const offers = [];
  for (const m of html.matchAll(/"price":\{([^}]*)\}/g)) {
    const block = m[1];
    if (/"serviceBranding":\[[^\]]*PS_PLUS/.test(block)) continue;
    const baseRaw = block.match(/"basePrice":"([^"]*)"/)?.[1] ?? '';
    const discRaw = block.match(/"discountedPrice":"([^"]*)"/)?.[1] ?? '';
    const base = money(baseRaw);
    const disc = money(discRaw);
    if (base === null && disc === null) continue;
    detected ??= currencyOf(baseRaw || discRaw);
    const final = disc ?? base;
    const initial = base ?? disc;
    if (final === null || initial === null) continue;
    offers.push({ final, initial });
  }
  if (offers.length === 0) return null;

  /**
   * The Standard edition is the one with the lowest **list** price, not the
   * lowest sale price.
   *
   * Assassin's Creed Shadows lists Standard at RM 299 and a Gold edition at
   * RM 379 discounted to RM 189.50. Picking the cheapest final price therefore
   * quoted a premium edition as if it were the base game — RM 189.50 against
   * the RM 299 the store actually shows. A discount on a fancier edition can
   * always dip under the standard price, so `final` is the wrong key; `initial`
   * identifies the edition, and its own discount is then reported honestly.
   */
  const best = offers.reduce((a, b) =>
    b.initial < a.initial || (b.initial === a.initial && b.final < a.final) ? b : a,
  );
  return {
    final: best.final,
    initial: best.initial,
    discount:
      best.initial > best.final
        ? Math.round(((best.initial - best.final) / best.initial) * 100)
        : 0,
    currency: detected ?? 'USD',
  };
}

async function fetchBatch(batch, attempt = 0) {
  const ids = batch.map((g) => g.steamAppId).join(',');
  /**
   * `filters=price_overview` and nothing else.
   *
   * Steam only honours multiple app ids for a *single* filter. Asking for
   * `basic,price_overview` returns an empty object for the whole batch — no
   * error, just `{}` — which silently wiped every Steam price and cost two
   * full runs that I misread as throttling, because the loss looked plausible.
   * `is_free` is fetched separately below, one call per game, and only for the
   * handful that come back without a price.
   */
  const url = `https://store.steampowered.com/api/appdetails?appids=${ids}&filters=price_overview&cc=${region}&l=en`;
  try {
    const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' } });
    if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (error) {
    // Throttling here is silent in a different way to appdetails' success:false
    // — it answers with a status code — so a plain backoff is enough.
    if (attempt < 3) {
      await new Promise((r) => setTimeout(r, 2500 * (attempt + 1)));
      return fetchBatch(batch, attempt + 1);
    }
    console.log(`    ✖ batch failed after retries: ${error.message}`);
    return null;
  }
}

for (let i = 0; i < priced.length; i += BATCH) {
  const batch = priced.slice(i, i + BATCH);
  const body = await fetchBatch(batch);

  if (body) {
    for (const game of batch) {
      const entry = body[String(game.steamAppId)];
      const p = entry?.data?.price_overview;
      if (!entry?.success) {
        unavailable++;
        continue;
      }
      if (!p) {
        // Free-to-play and "not sold in this region" both arrive as a missing
        // price_overview. Checked individually after the batch loop, since the
        // filter that distinguishes them cannot be batched.
        maybeFree.push(game);
        free++;
        continue;
      }
      currency ??= p.currency;
      addOffer(game.slug, {
        store: 'Steam',
        final: p.final,
        initial: p.initial,
        discount: p.discount_percent,
        currency: p.currency,
      });
    }
  }

  const done = Math.min(i + BATCH, priced.length);
  if (done % 200 === 0 || done === priced.length) console.log(`    …${done}/${priced.length}`);
  await new Promise((r) => setTimeout(r, DELAY_MS));
}

/* ------------------------------------------------------------ free to play */
/**
 * Which of the priceless games are actually free.
 *
 * One request each, but only for the ~30 that came back without a price — the
 * `basic` filter carries `is_free` and cannot be combined with a batch.
 * Showing "Free" is worth this; showing "Check price" on a free game is not.
 */
if (maybeFree.length) {
  console.log(`\n  Checking ${maybeFree.length} priceless games for free-to-play…`);
  let freeFound = 0;
  for (const game of maybeFree) {
    try {
      const res = await fetch(
        `https://store.steampowered.com/api/appdetails?appids=${game.steamAppId}&filters=basic&l=en`,
        { headers: { 'user-agent': 'Mozilla/5.0' } },
      );
      const body = await res.json();
      if (body?.[String(game.steamAppId)]?.data?.is_free) {
        addOffer(game.slug, {
          store: 'Steam',
          final: 0,
          initial: 0,
          discount: 0,
          currency: currency ?? 'MYR',
        });
        freeFound++;
      }
    } catch {
      /* a missed free flag just leaves the game priceless, as before */
    }
    await new Promise((r) => setTimeout(r, 350));
  }
  console.log(`    ${freeFound} free-to-play`);
}

/* --------------------------------------------------------- console stores */
/**
 * Every store a game is actually listed on, not just the first one found.
 *
 * A multi-platform game is bought at different prices on different stores, and
 * showing only Steam hides that a Switch owner pays something else entirely.
 * Console stores are queried for *any* game with a resolved slug, including
 * ones that already have a Steam price.
 */
const consoles = GAMES.filter((g) => g.nintendoSlug || g.playstationSlug);
console.log(`\n  Fetching console prices for ${consoles.length} games…\n`);

let consoleHits = 0;
for (const [i, game] of consoles.entries()) {
  for (const [store, fetcher] of [
    ['Nintendo', game.nintendoSlug ? nintendoPrice : null],
    ['PlayStation', game.playstationSlug ? playstationPrice : null],
  ]) {
    if (!fetcher) continue;
    try {
      const found = await fetcher(game);
      if (found) {
        addOffer(game.slug, { store, ...found });
        consoleHits++;
      }
    } catch {
      /* a missing price is a normal outcome, not a failure */
    }
    await new Promise((r) => setTimeout(r, 350));
  }
  if ((i + 1) % 25 === 0 || i + 1 === consoles.length) {
    console.log(`    …${i + 1}/${consoles.length}`);
  }
}
console.log(`    resolved ${consoleHits}`);

/* ---------------------------------------------------------------- fx rate */
// Only needed if something is quoted in a currency other than the snapshot's.
const all = [...prices.values()].flat();
const foreign = all.some((p) => p.currency !== currency);
const usdRate = foreign ? await fxRate('USD', currency ?? 'MYR') : null;
if (foreign) {
  console.log(`\n  USD -> ${currency}: ${usdRate ?? 'unavailable (prices stay in USD)'}`);
}

const discounted = all.filter((p) => p.discount > 0);
const multi = [...prices.values()].filter((l) => l.length > 1).length;
console.log(
  `\n  priced: ${prices.size} games / ${all.length} offers  ·  multi-store: ${multi}  ·  on sale: ${discounted.length}  ·  free/unpriced: ${free}  ·  unavailable: ${unavailable}`,
);

if (dryRun) {
  console.log('\n  --dry: nothing written.\n');
  process.exit(0);
}

/**
 * Never replace a good snapshot with a worse one.
 *
 * Guarding only against *zero* prices was not enough. Console prices come from
 * scraping ~700 web pages, and a run that gets throttled part-way loses a slice
 * of them silently — one refresh dropped 1,338 offers to 1,294 and reduced
 * multi-store games from 477 to 441 while reporting success. Nothing errored;
 * the site would simply have shown fewer prices than the day before.
 *
 * Losses happen legitimately (a game is delisted, a store stops selling it), so
 * a small dip is allowed. A large one is a failed run, not news about the world.
 */
const LOSS_TOLERANCE = 0.05;

if (prices.size === 0) {
  console.log('\n  ✖ No prices resolved; leaving the existing snapshot alone.\n');
  process.exit(1);
}

let previousOffers = 0;
try {
  previousOffers = (fs.readFileSync(OUT, 'utf8').match(/\['(?:Steam|PlayStation|Nintendo|Xbox)'/g) ?? [])
    .length;
} catch {
  /* first run — nothing to compare against */
}

const newOffers = all.length;
if (previousOffers > 0 && newOffers < previousOffers * (1 - LOSS_TOLERANCE)) {
  const lost = previousOffers - newOffers;
  console.log(
    `\n  ⚠ This run resolved ${newOffers} offers against ${previousOffers} already on disk` +
      ` — ${lost} fewer (${((lost / previousOffers) * 100).toFixed(1)}%).` +
      `\n    That is a throttled run, not a real price change. Snapshot left alone;` +
      `\n    re-run when the stores are responding, or pass --force to overwrite.\n`,
  );
  /**
   * Exit 0, not 1.
   *
   * This runs nightly in CI. Declining to write is the guard doing its job —
   * the snapshot on disk stays correct and the site is unaffected — so failing
   * the workflow would paint the Actions tab red on any throttled night and
   * train the reader to ignore it. A red run should mean something is broken,
   * not that Steam was busy. Real errors below still exit non-zero.
   */
  if (!args.includes('--force')) process.exit(0);
}

const base = currency ?? 'MYR';
const ORDER = { Steam: 0, PlayStation: 1, Nintendo: 2, Xbox: 3 };
const rows = [...prices.entries()]
  .sort(([a], [b]) => (a < b ? -1 : 1))
  .map(([slug, offers]) => {
    const list = [...offers]
      .sort((a, b) => (ORDER[a.store] ?? 9) - (ORDER[b.store] ?? 9))
      .map((o) => `['${o.store}', ${o.final}, ${o.initial}, ${o.discount}, '${o.currency}']`)
      .join(', ');
    return `  '${slug}': [${list}],`;
  })
  .join('\n');

const file = `/**
 * Steam price snapshot — GENERATED, do not edit by hand.
 *
 * Written by \`npm run data:prices\`. Steam sends no CORS header, so prices
 * cannot be read from the browser; they are baked in at build time instead and
 * refreshed by a scheduled job. See skills/data-pipeline/fetch-prices.mjs.
 *
 * Amounts are in the currency's minor unit (cents/sen) to keep them exact —
 * formatting is the UI's job, in src/lib/price.ts.
 */

export const PRICE_SNAPSHOT = {
  /** ISO date the snapshot was taken. Shown to the user, so it stays honest. */
  fetchedAt: '${new Date().toISOString().slice(0, 10)}',
  /** Steam store region the prices were quoted for. */
  region: '${region}',
  /** ISO 4217 code the Steam prices are quoted in, e.g. MYR. */
  currency: '${base}',
  /**
   * USD -> snapshot currency, for the console stores which only quote in USD.
   * Null when unavailable, in which case the UI shows the USD figure alone
   * rather than an invented conversion.
   */
  usdRate: ${usdRate ?? 'null'},
} as const;

/**
 * slug -> one entry per store: [store, final, original, discountPercent, currency]
 *
 * Amounts are minor units. A cross-platform game is sold at genuinely different
 * prices on different stores, so collapsing them to a single number would pick
 * a winner arbitrarily — and each carries its own currency, because Nintendo
 * quotes USD while Steam and PlayStation quote the requested region. Treating
 * $59.99 as RM 59.99 would misprice those games fourfold.
 */
export type PriceOffer = readonly [string, number, number, number, string];

export const PRICES: Record<string, readonly PriceOffer[]> = {
${rows}
};
`;

fs.writeFileSync(OUT, file);
console.log(`  Wrote ${OUT} (${(Buffer.byteLength(file) / 1024).toFixed(0)} KB)\n`);
