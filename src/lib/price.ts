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

export function priceFor(slug: string): GamePrice | null {
  const row = PRICES[slug];
  if (!row) return null;
  const [final, original, discount] = row;
  return {
    final,
    original,
    discount,
    currency: PRICE_SNAPSHOT.currency,
    asOf: PRICE_SNAPSHOT.fetchedAt,
  };
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
    // Format for the snapshot's own region, not the reader's. These are
    // Malaysian prices, so they should read "RM 72" — the reader's locale would
    // render the same figure as "MYR 72.00", which looks like a different,
    // vaguer thing than the number Steam actually shows.
    return new Intl.NumberFormat(`en-${PRICE_SNAPSHOT.region}`, {
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
