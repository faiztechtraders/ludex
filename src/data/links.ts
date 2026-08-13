import type { Game } from './schema.ts';
import { PRICE_SNAPSHOT } from './prices.ts';

/** Keep store links in the same region the prices were quoted for. */
const PS_LOCALE = `en-${PRICE_SNAPSHOT.region.toLowerCase()}`;

/**
 * Official store links, derived from the ids the art pipeline already resolves.
 *
 * Nothing is fetched here and nothing new is stored: a Steam app id is already
 * in the dataset because it points at the cover art, and the same number points
 * at the store page. 667 of 752 games get a link for free.
 *
 * Console links are thinner because their ids only exist where a slug had to be
 * pinned by hand — see the `nintendoSlug` / `playstationSlug` / `xboxStoreId`
 * notes in schema.ts.
 */

export interface StoreLink {
  store: 'Steam' | 'Nintendo' | 'PlayStation' | 'Xbox';
  url: string;
  /**
   * True when the link goes to the store's search results rather than the
   * product page. Still one click and lands on the right storefront, which
   * beats sending someone to a search engine — but the UI labels it honestly
   * rather than implying it opens the game itself.
   */
  search?: boolean;
}

/**
 * A link for **every platform the game is actually on**, never just the one we
 * happen to have an id for.
 *
 * Someone who owns only a Switch was previously shown a Steam price and nothing
 * else, because a direct Steam link suppressed the fallbacks entirely. Each
 * platform family the game supports now gets its own row: a direct product link
 * where the id resolved, a store search where it did not. A search is a weaker
 * answer than a price, but it is on the right storefront and it is one click —
 * silence is the only genuinely useless option.
 */
export function storeLinks(game: Game): StoreLink[] {
  const links: StoreLink[] = [];
  const q = encodeURIComponent(game.title);
  const on = (...ps: string[]) => ps.some((p) => game.platforms.includes(p as Game['platforms'][number]));

  if (game.steamAppId) {
    links.push({ store: 'Steam', url: `https://store.steampowered.com/app/${game.steamAppId}/` });
  } else if (on('pc')) {
    links.push({ store: 'Steam', url: `https://store.steampowered.com/search/?term=${q}`, search: true });
  }

  if (game.playstationSlug) {
    links.push({
      store: 'PlayStation',
      url: `https://www.playstation.com/${PS_LOCALE}/games/${game.playstationSlug}/`,
    });
  } else if (on('ps5', 'ps4')) {
    links.push({
      store: 'PlayStation',
      url: `https://www.playstation.com/${PS_LOCALE}/search/?q=${q}`,
      search: true,
    });
  }

  if (game.nintendoSlug) {
    links.push({
      store: 'Nintendo',
      url: `https://www.nintendo.com/us/store/products/${game.nintendoSlug}/`,
    });
  } else if (on('switch', 'switch2')) {
    links.push({ store: 'Nintendo', url: `https://www.nintendo.com/us/search/#q=${q}`, search: true });
  }

  if (game.xboxStoreId) {
    links.push({ store: 'Xbox', url: `https://www.xbox.com/games/store/game/${game.xboxStoreId}` });
  } else if (on('xbox-series', 'xbox-one')) {
    // Xbox ids cannot be resolved automatically — Microsoft's search page
    // renders them client-side, so pairing a title to an id would be guesswork.
    links.push({ store: 'Xbox', url: `https://www.xbox.com/en-US/Search?q=${q}`, search: true });
  }

  return links;
}

/** The single link worth showing when there is only room for one. */
export function primaryStoreLink(game: Game): StoreLink | undefined {
  return storeLinks(game)[0];
}
