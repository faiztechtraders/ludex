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
  const [final, original, discount, currency] = row;
  return {
    final,
    original,
    discount,
    // Absent means "same as the snapshot" — see the note in prices.ts.
    currency: currency ?? PRICE_SNAPSHOT.currency,
    asOf: PRICE_SNAPSHOT.fetchedAt,
  };
}

/**
 * Approximate the snapshot currency for a price quoted in another one.
 *
 * Nintendo and PlayStation only publish USD, so a Malaysian reader would
 * otherwise have to do the sum themselves — which is exactly the click this
 * feature exists to remove. Returns null when no rate was captured, so the UI
 * shows the real USD figure alone rather than inventing a number.
 *
 * Deliberately approximate: the regional eShop price is set by Nintendo and is
 * usually *not* the converted US price, so this is a rough guide and the UI
 * marks it with ≈.
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
    // figure as "MYR 72.00", which looks vaguer than what Steam actually shows.
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
