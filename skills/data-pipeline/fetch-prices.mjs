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

/** slug -> { final, initial, discount, currency } — all amounts in minor units. */
const prices = new Map();
let currency = null;
let free = 0;
let unavailable = 0;

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
  const res = await fetch(`https://www.playstation.com/en-us/games/${game.playstationSlug}/`, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) return null;
  const html = await res.text();

  const money = (s) => {
    if (!/\d/.test(String(s))) return null; // "Included", "Free", "Pre-order"
    const n = Number(String(s).replace(/[^0-9.]/g, ''));
    return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null;
  };

  const offers = [];
  for (const m of html.matchAll(/"price":\{([^}]*)\}/g)) {
    const block = m[1];
    if (/"serviceBranding":\[[^\]]*PS_PLUS/.test(block)) continue;
    const base = money(block.match(/"basePrice":"([^"]*)"/)?.[1]);
    const disc = money(block.match(/"discountedPrice":"([^"]*)"/)?.[1]);
    if (base === null && disc === null) continue;
    const final = disc ?? base;
    const initial = base ?? disc;
    if (final === null || initial === null) continue;
    offers.push({ final, initial });
  }
  if (offers.length === 0) return null;

  // Standard edition, not the deluxe bundle the page may list first.
  const best = offers.reduce((a, b) => (b.final < a.final ? b : a));
  return {
    final: best.final,
    initial: best.initial,
    discount:
      best.initial > best.final
        ? Math.round(((best.initial - best.final) / best.initial) * 100)
        : 0,
    currency: 'USD',
  };
}

async function fetchBatch(batch, attempt = 0) {
  const ids = batch.map((g) => g.steamAppId).join(',');
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
        // Free-to-play, or a region where it simply is not sold.
        free++;
        continue;
      }
      currency ??= p.currency;
      prices.set(game.slug, {
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

/* --------------------------------------------------------- console stores */
/**
 * Games with no Steam listing were previously priceless in the UI, which meant
 * clicking through to the store just to see a number. Nintendo and PlayStation
 * both expose one; they quote in USD, so each entry records its own currency.
 */
const consoles = GAMES.filter(
  (g) => !prices.has(g.slug) && (g.nintendoSlug || g.playstationSlug),
);
console.log(`\n  Fetching console prices for ${consoles.length} games…\n`);

let consoleHits = 0;
for (const [i, game] of consoles.entries()) {
  try {
    const found = game.nintendoSlug ? await nintendoPrice(game) : await playstationPrice(game);
    if (found) {
      prices.set(game.slug, found);
      consoleHits++;
    }
  } catch {
    /* a missing price is a normal outcome, not a failure */
  }
  if ((i + 1) % 25 === 0 || i + 1 === consoles.length) {
    console.log(`    …${i + 1}/${consoles.length}`);
  }
  await new Promise((r) => setTimeout(r, 350));
}
console.log(`    resolved ${consoleHits}`);

/* ---------------------------------------------------------------- fx rate */
// Only needed if something is quoted in a currency other than the snapshot's.
const foreign = [...prices.values()].some((p) => p.currency !== currency);
const usdRate = foreign ? await fxRate('USD', currency ?? 'MYR') : null;
if (foreign) {
  console.log(`\n  USD -> ${currency}: ${usdRate ?? 'unavailable (prices stay in USD)'}`);
}

const discounted = [...prices.values()].filter((p) => p.discount > 0);
console.log(`\n  priced: ${prices.size}  ·  on sale: ${discounted.length}  ·  free/unpriced: ${free}  ·  unavailable: ${unavailable}`);

if (dryRun) {
  console.log('\n  --dry: nothing written.\n');
  process.exit(0);
}

if (prices.size === 0) {
  // Never overwrite a good snapshot with an empty one — a throttled run that
  // wrote zero prices would silently strip pricing from the whole site.
  console.log('\n  ✖ No prices resolved; leaving the existing snapshot alone.\n');
  process.exit(1);
}

const base = currency ?? 'MYR';
const rows = [...prices.entries()]
  .sort(([a], [b]) => (a < b ? -1 : 1))
  .map(([slug, p]) => {
    // Fourth element only when the currency differs from the snapshot's, which
    // keeps the common case (every Steam row) to three numbers.
    const tail = p.currency === base ? '' : `, '${p.currency}'`;
    return `  '${slug}': [${p.final}, ${p.initial}, ${p.discount}${tail}],`;
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
 * slug -> [final, original, discountPercent, currency?]
 *
 * Amounts are minor units. The currency is present only when it differs from
 * PRICE_SNAPSHOT.currency — console stores quote USD while Steam quotes the
 * requested region, and silently mixing the two would misprice 90 games.
 */
export const PRICES: Record<string, readonly [number, number, number, string?]> = {
${rows}
};
`;

fs.writeFileSync(OUT, file);
console.log(`  Wrote ${OUT} (${(Buffer.byteLength(file) / 1024).toFixed(0)} KB)\n`);
