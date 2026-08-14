import { PRICES, PRICE_SNAPSHOT } from '@/data/prices.ts';

/**
 * Reading the baked price snapshot.
 *
 * Prices are a build-time snapshot, not a live lookup — Steam sends no CORS
 * header, so the browser cannot ask it directly and a live figure would need a
 * proxy Ludex deliberately does not have. Everything here therefore reports a
 * price *as of* a date, and the UI says so rather than implying it is current.
 */

export interface GamePrice {
  /** 'Steam' | 'PlayStation' | 'Nintendo' … */
  store: string;
  /** Current price, in the currency's minor unit. */
  final: number;
  /** Price before any discount. Equal to `final` when not on sale. */
  original: number;
  /** 0 when not discounted. */
  discount: number;
  currency: string;
  /** ISO date the snapshot was taken. */
  asOf: string;
}

/**
 * Every store this game has a price on, in a stable display order.
 *
 * A cross-platform game genuinely costs different amounts on different stores,
 * so showing one number would hide that a Switch owner pays something else.
 */
export function pricesFor(slug: string): GamePrice[] {
  const rows = PRICES[slug];
  if (!rows?.length) return [];
  return rows.map(([store, final, original, discount, currency]) => ({
    store,
    final,
    original,
    discount,
    currency,
    asOf: PRICE_SNAPSHOT.fetchedAt,
  }));
}

/** The headline price — the store the reader is most likely to buy on. */
export function priceFor(slug: string): GamePrice | null {
  return pricesFor(slug)[0] ?? null;
}

/** The best discount across all stores, for the card badge. */
export function bestDiscount(slug: string): number {
  return pricesFor(slug).reduce((best, p) => Math.max(best, p.discount), 0);
}

/**
 * Free on at least one store.
 *
 * Checked ahead of the discount badge: "−100%" would be technically true for a
 * free-to-play game and completely the wrong thing to say, and free is a
 * stronger reason to click than any percentage.
 */
export function isFree(slug: string): boolean {
  return pricesFor(slug).some((p) => p.final === 0);
}

/**
 * Approximate the snapshot currency for a price quoted in another one.
 *
 * Nintendo publishes USD only, so a Malaysian reader would otherwise have to do
 * the sum themselves — which is the click this feature exists to remove.
 * Returns null when no rate was captured, so the UI shows the real figure alone
 * rather than inventing a number.
 *
 * Deliberately approximate, and the UI marks it with ≈: a regional store sets
 * its own price and it is often not the converted one. PlayStation Malaysia
 * charges RM 99 for Shadow of the Colossus where the converted US price is
 * RM 81.71 — which is exactly why PlayStation is now fetched per-region and
 * only Nintendo still needs converting.
 */
export function approxInSnapshotCurrency(price: GamePrice): number | null {
  if (price.currency === PRICE_SNAPSHOT.currency) return null;
  if (price.currency !== 'USD' || !PRICE_SNAPSHOT.usdRate) return null;
  return Math.round(price.final * PRICE_SNAPSHOT.usdRate);
}

/**
 * Format a minor-unit amount.
 *
 * `Intl` throws on an unrecognised currency code, and a bad snapshot should not
 * be able to blank a page — fall back to printing the code alongside the number.
 */
export function formatPrice(amount: number, currency: string): string {
  const value = amount / 100;
  try {
    // Format for the currency's own home locale, not the reader's. Malaysian
    // prices should read "RM 72"; the reader's locale would render the same
    // figure as "MYR 72.00", which looks vaguer than what the store shows.
    const locale = currency === PRICE_SNAPSHOT.currency ? `en-${PRICE_SNAPSHOT.region}` : 'en-US';
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

/** Free-to-play and unpriced games are simply absent from the snapshot. */
export const priceCount = Object.keys(PRICES).length;
