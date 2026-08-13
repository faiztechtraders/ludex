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

/** slug -> [finalCents, initialCents, discountPercent] */
const prices = new Map();
let currency = null;
let free = 0;
let unavailable = 0;

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
      prices.set(game.slug, [p.final, p.initial, p.discount_percent]);
    }
  }

  const done = Math.min(i + BATCH, priced.length);
  if (done % 200 === 0 || done === priced.length) console.log(`    …${done}/${priced.length}`);
  await new Promise((r) => setTimeout(r, DELAY_MS));
}

const discounted = [...prices.values()].filter(([, , d]) => d > 0);
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

const rows = [...prices.entries()]
  .sort(([a], [b]) => (a < b ? -1 : 1))
  .map(([slug, [final, initial, discount]]) => `  '${slug}': [${final}, ${initial}, ${discount}],`)
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
  /** ISO 4217 code, e.g. MYR. */
  currency: '${currency ?? 'MYR'}',
} as const;

/** slug -> [final, original, discountPercent]. Absent means no price known. */
export const PRICES: Record<string, readonly [number, number, number]> = {
${rows}
};
`;

fs.writeFileSync(OUT, file);
console.log(`  Wrote ${OUT} (${(Buffer.byteLength(file) / 1024).toFixed(0)} KB)\n`);
