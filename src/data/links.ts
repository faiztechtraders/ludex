import type { Game } from './schema.ts';

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

export function storeLinks(game: Game): StoreLink[] {
  const links: StoreLink[] = [];

  if (game.steamAppId) {
    links.push({ store: 'Steam', url: `https://store.steampowered.com/app/${game.steamAppId}/` });
  }
  if (game.nintendoSlug) {
    links.push({
      store: 'Nintendo',
      url: `https://www.nintendo.com/us/store/products/${game.nintendoSlug}/`,
    });
  }
  if (game.playstationSlug) {
    links.push({
      store: 'PlayStation',
      url: `https://www.playstation.com/en-us/games/${game.playstationSlug}/`,
    });
  }
  if (game.xboxStoreId) {
    // Microsoft ignores the slug segment and resolves on the id alone.
    links.push({ store: 'Xbox', url: `https://www.xbox.com/games/store/game/${game.xboxStoreId}` });
  }

  if (links.length > 0) return links;

  /**
   * Nothing resolvable — fall back to a search on whichever store the game is
   * actually sold in. Roughly 65 games land here: Nintendo first-party titles
   * whose store slug could not be guessed, and launcher-only games that have no
   * storefront page at all.
   *
   * Chosen by where the game exists, not by a fixed order: sending a Switch
   * exclusive to a Steam search would return nothing at all.
   */
  const q = encodeURIComponent(game.title);
  const onlyNintendo = game.platforms.every((p) => p === 'switch' || p === 'switch2');
  const onlyPlayStation = game.platforms.every((p) => p === 'ps5' || p === 'ps4');
  const onlyXbox = game.platforms.every((p) => p === 'xbox-series' || p === 'xbox-one');

  if (onlyNintendo) {
    return [{ store: 'Nintendo', url: `https://www.nintendo.com/us/search/#q=${q}`, search: true }];
  }
  if (onlyPlayStation) {
    return [
      { store: 'PlayStation', url: `https://www.playstation.com/en-us/search/?q=${q}`, search: true },
    ];
  }
  if (onlyXbox) {
    return [{ store: 'Xbox', url: `https://www.xbox.com/en-US/Search?q=${q}`, search: true }];
  }
  return [{ store: 'Steam', url: `https://store.steampowered.com/search/?term=${q}`, search: true }];
}

/** The single link worth showing when there is only room for one. */
export function primaryStoreLink(game: Game): StoreLink | undefined {
  return storeLinks(game)[0];
}
