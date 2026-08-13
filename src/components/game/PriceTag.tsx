import type { Game } from '@/data/schema.ts';
import { storeLinks } from '@/data/links.ts';
import { PRICE_SNAPSHOT } from '@/data/prices.ts';
import { approxInSnapshotCurrency, formatPrice, pricesFor } from '@/lib/price.ts';

/**
 * Where to buy, and what it costs, on every store we have a figure for.
 *
 * Three honesty rules, because a wrong price is worse than no price:
 *
 *  - The figures are a **snapshot**, so the date is always shown. Steam blocks
 *    browser-side price reads (no CORS), so a live number would need a backend
 *    this app does not have.
 *  - **One row per store.** A cross-platform game costs different amounts in
 *    different places; collapsing that to a single number picks a winner
 *    arbitrarily and misleads whoever owns the other console.
 *  - A converted figure is marked ≈ and never presented as the store's price.
 *    Shadow of the Colossus is RM 99 on PlayStation Malaysia while the
 *    converted US price is RM 81.71 — a fifth out.
 *
 * Renders nothing when there is neither a price nor a link, so a free-to-play
 * game shows no empty row that reads as broken.
 */
export function PriceTag({ game, className = '' }: { game: Game; className?: string }) {
  const prices = pricesFor(game.slug);
  const links = storeLinks(game);

  if (prices.length === 0 && links.length === 0) return null;

  /** Link for a store that has a price, so each row can be clickable. */
  const linkFor = (store: string) => links.find((l) => l.store === store && !l.search);

  // Stores we can link to but have no price for — still worth offering.
  const priced = new Set(prices.map((p) => p.store));
  const extraLinks = links.filter((l) => !priced.has(l.store));

  return (
    <div className={`space-y-2 ${className}`}>
      {prices.map((price) => {
        const approx = approxInSnapshotCurrency(price);
        const link = linkFor(price.store);
        const Row = link ? 'a' : 'div';
        return (
          <Row
            key={price.store}
            {...(link
              ? { href: link.url, target: '_blank', rel: 'noopener noreferrer' }
              : {})}
            className={`flex flex-wrap items-baseline gap-x-2 gap-y-1 ${
              link ? 'group/price -mx-1 rounded px-1 py-0.5 transition-colors hover:bg-surface-2' : ''
            }`}
          >
            <span className="min-w-[68px] text-xs text-text-muted">{price.store}</span>

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
              className="font-display text-base font-bold"
              style={{ color: price.discount > 0 ? 'var(--color-neon-lime)' : 'var(--color-text)' }}
            >
              {formatPrice(price.final, price.currency)}
            </span>

            {approx !== null && (
              <span className="text-xs text-text-muted">
                ≈ {formatPrice(approx, PRICE_SNAPSHOT.currency)}
              </span>
            )}

            {link && (
              <span
                aria-hidden="true"
                className="text-xs text-text-muted transition-colors group-hover/price:text-neon-cyan"
              >
                ↗
              </span>
            )}
            {link && <span className="sr-only">— open on {price.store} in a new tab</span>}
          </Row>
        );
      })}

      {extraLinks.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {extraLinks.map((link) => (
            <a
              key={link.store + link.url}
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
          ))}
        </div>
      )}
    </div>
  );
}

/** The snapshot caveat, shown once per page rather than on every row. */
export function PriceFootnote({ game }: { game: Game }) {
  const prices = pricesFor(game.slug);
  if (prices.length === 0) return null;
  const converted = prices.some((p) => approxInSnapshotCurrency(p) !== null);
  return (
    <p className="mt-2 text-[11px] leading-relaxed text-text-muted">
      Store prices as of {prices[0].asOf}.
      {converted
        ? ` ${PRICE_SNAPSHOT.currency} figures marked ≈ are rough conversions — the regional store sets its own price.`
        : ' Check the store for your region.'}
    </p>
  );
}
