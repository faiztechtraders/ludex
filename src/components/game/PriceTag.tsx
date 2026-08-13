import type { Game } from '@/data/schema.ts';
import { storeLinks } from '@/data/links.ts';
import { PRICE_SNAPSHOT } from '@/data/prices.ts';
import { approxInSnapshotCurrency, formatPrice, pricesFor } from '@/lib/price.ts';
import type { GamePrice } from '@/lib/price.ts';

/**
 * Where to buy, and what it costs, on every store we know about.
 *
 * **One row shape for every store**, whether or not a price was found. Priced
 * stores used to render as rows and unpriced ones as chips, which made a
 * missing price look like a different kind of thing rather than the same thing
 * with one column empty.
 *
 * Three honesty rules, because a wrong price is worse than no price:
 *
 *  - The figures are a **snapshot**, so the date is always shown. Steam blocks
 *    browser-side price reads (no CORS), so a live number would need a backend
 *    this app does not have.
 *  - **One row per store.** A cross-platform game costs different amounts in
 *    different places; collapsing that to a single number misleads whoever owns
 *    the other console.
 *  - A converted figure is marked ≈ and never presented as the store's price.
 *    Shadow of the Colossus is RM 99 on PlayStation Malaysia while the
 *    converted US price is RM 81.71 — a fifth out.
 */

interface StoreRow {
  store: string;
  url?: string;
  price?: GamePrice;
  /** The link goes to search results rather than the product page. */
  search?: boolean;
}

export function PriceTag({ game, className = '' }: { game: Game; className?: string }) {
  const prices = pricesFor(game.slug);
  const links = storeLinks(game);

  // Union of both, priced stores first, so the order does not jump about as
  // the snapshot gains and loses stores.
  const rows: StoreRow[] = prices.map((price) => ({
    store: price.store,
    price,
    url: links.find((l) => l.store === price.store && !l.search)?.url,
  }));
  for (const link of links) {
    if (rows.some((r) => r.store === link.store)) continue;
    rows.push({ store: link.store, url: link.url, search: link.search });
  }

  if (rows.length === 0) return null;

  return (
    <div className={`space-y-1 ${className}`}>
      {rows.map((row) => (
        <StoreRowView key={row.store + (row.url ?? '')} row={row} />
      ))}
    </div>
  );
}

function StoreRowView({ row }: { row: StoreRow }) {
  const { price, url } = row;
  const approx = price ? approxInSnapshotCurrency(price) : null;
  const Wrapper = url ? 'a' : 'div';

  return (
    <Wrapper
      {...(url ? { href: url, target: '_blank', rel: 'noopener noreferrer' } : {})}
      // A three-column grid, not a wrapping flex row. As one row the discount
      // badge, struck original, price and conversion overflowed and pushed the
      // arrow onto its own line, so a discounted row looked broken next to a
      // plain one. The middle column now wraps inside itself while the store
      // name and the arrow stay put.
      className={`group/price -mx-1.5 grid grid-cols-[72px_1fr_auto] items-baseline gap-x-2 rounded px-1.5 py-1 ${
        url ? 'transition-colors hover:bg-surface-2' : ''
      }`}
    >
      <span className="text-xs text-text-muted">{row.store}</span>

      <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
      {price && price.final === 0 ? (
        // A zero price is free-to-play, recorded deliberately. Showing "Free"
        // is more useful than any number, and far better than the "Check price"
        // these games used to fall through to.
        <span className="font-display text-base font-bold" style={{ color: 'var(--color-neon-lime)' }}>
          Free
        </span>
      ) : price ? (
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
        </>
      ) : (
        // Says what the reader can do, rather than a dash that could be read as
        // "free" or "unavailable".
        <span className="text-sm text-text-secondary">
          {row.search ? 'Search store' : 'Check price'}
        </span>
      )}
      </span>

      {url && (
        <>
          <span
            aria-hidden="true"
            className="text-xs text-text-muted transition-colors group-hover/price:text-neon-cyan"
          >
            ↗
          </span>
          <span className="sr-only">
            {row.search
              ? `— search results on ${row.store}, opens in a new tab`
              : `— open on ${row.store} in a new tab`}
          </span>
        </>
      )}
    </Wrapper>
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
