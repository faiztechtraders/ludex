import type { Game } from '@/data/schema.ts';
import { primaryStoreLink } from '@/data/links.ts';
import { approxInSnapshotCurrency, formatPrice, priceFor } from '@/lib/price.ts';
import { PRICE_SNAPSHOT } from '@/data/prices.ts';

/**
 * Price, discount, and a link to the store page.
 *
 * Two honesty rules, because a wrong price is worse than no price:
 *
 *  - The figure is a **snapshot**, so the date it was taken is always shown.
 *    Steam blocks browser-side price reads (no CORS), so a live number would
 *    need a backend this app does not have.
 *  - The currency is whatever region the snapshot was taken in, which is not
 *    necessarily the reader's. The store link is the authority; this is a
 *    signal, mainly "is it on sale right now".
 *
 * Renders nothing when the game is not in the snapshot — free-to-play titles
 * and anything Steam does not sell in that region. An empty price row invites
 * the reader to wonder whether it is broken.
 */
export function PriceTag({ game, className = '' }: { game: Game; className?: string }) {
  const price = priceFor(game.slug);
  const link = primaryStoreLink(game);
  const approx = price ? approxInSnapshotCurrency(price) : null;
  const snapshotCurrency = PRICE_SNAPSHOT.currency;

  if (!price && !link) return null;

  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 ${className}`}>
      {price && (
        <>
          {price.discount > 0 && (
            <>
              <span
                className="rounded-chip px-1.5 py-0.5 font-display text-[11px] font-bold text-text-inverse"
                style={{ background: 'var(--color-neon-lime)' }}
              >
                −{price.discount}%
              </span>
              <s className="text-sm text-text-muted">
                {formatPrice(price.original, price.currency)}
              </s>
            </>
          )}
          <span
            className="font-display text-lg font-bold"
            style={{ color: price.discount > 0 ? 'var(--color-neon-lime)' : 'var(--color-text)' }}
          >
            {formatPrice(price.final, price.currency)}
          </span>

          {/* Console stores publish USD only. Converting saves the reader doing
              the sum, which is the whole point — but the regional eShop price is
              set by the publisher and is usually not the converted US price, so
              it is marked approximate rather than stated as fact. */}
          {approx !== null && (
            <span className="text-sm text-text-muted">
              ≈ {formatPrice(approx, snapshotCurrency)}
            </span>
          )}
        </>
      )}

      {link && (
        <a
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded-chip border border-hairline px-2.5 py-1 text-xs text-text-secondary transition-colors hover:border-neon-cyan hover:text-neon-cyan"
        >
          {link.search ? `Find on ${link.store}` : link.store}
          <span aria-hidden="true">↗</span>
          <span className="sr-only">
            {link.search
              ? `— search results on ${link.store}, opens in a new tab`
              : '(opens in a new tab)'}
          </span>
        </a>
      )}
    </div>
  );
}

/** The snapshot caveat, for use once per page rather than on every card. */
export function PriceFootnote({ game }: { game: Game }) {
  const price = priceFor(game.slug);
  if (!price) return null;
  const link = primaryStoreLink(game);
  const store = link && !link.search ? link.store : 'the store';
  const converted = approxInSnapshotCurrency(price) !== null;
  return (
    <p className="mt-2 text-[11px] leading-relaxed text-text-muted">
      {price.currency} price on {store} as of {price.asOf}.
      {converted
        ? ` The ${PRICE_SNAPSHOT.currency} figure is a rough conversion — your regional store sets its own price.`
        : ' Check the store for your region.'}
    </p>
  );
}
