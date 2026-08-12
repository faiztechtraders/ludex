import type { Game } from './schema.ts';

/**
 * Cover art URL derivation.
 *
 * Steam's asset URLs are entirely derivable from the app ID — only screenshot
 * filenames are opaque content hashes. So the dataset stores a `steamAppId`
 * and (at most) four 40-character hashes instead of four ~160-character URLs.
 *
 * That matters at this library size: storing full URLs cost roughly 800 bytes
 * per game, which across 500 games is most of a megabyte of pure boilerplate in
 * the bundle — and made the game records genuinely unreadable to edit.
 *
 * Games whose art came from Wikipedia (console exclusives Steam cannot have)
 * store an explicit `art.cover` instead, which always wins over derivation.
 */

const STEAM_ASSETS = 'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps';

/** Portrait box art, 600x900 — the shape every Ludex card expects. */
export function coverUrl(game: Game): string | undefined {
  if (game.art.cover) return game.art.cover;
  if (game.steamAppId) return `${STEAM_ASSETS}/${game.steamAppId}/library_600x900.jpg`;
  return undefined;
}

/**
 * Wide image for the detail-page hero band.
 *
 * Derives `library_hero.jpg`, which modern Steam apps have. Older apps do not,
 * and enrichment stores an explicit `hero` for those — deriving `page_bg_raw`
 * instead used to 404 on 135 games and paint a broken-image icon across the top
 * of their detail pages.
 */
export function heroUrl(game: Game): string | undefined {
  if (game.art.hero) return game.art.hero;
  if (game.steamAppId) return `${STEAM_ASSETS}/${game.steamAppId}/library_hero.jpg`;
  return coverUrl(game);
}

/**
 * Screenshot URLs for the detail gallery.
 *
 * An entry is one of three things:
 *  - a full URL (Nintendo, PlayStation, hand-added) — passed through
 *  - a path relative to the app's asset folder, e.g. `<hash>/ss_<hash>.1920x1080.jpg`
 *  - a bare legacy hash, kept working for records written before Steam started
 *    nesting newer screenshots inside a per-image folder
 *
 * The nested form is why this is not just a hash: assuming the flat layout
 * produced dead links for 58 games with newer store assets.
 */
export function shotUrls(game: Game): string[] {
  const shots = game.art.shots ?? [];
  if (shots.length === 0) return [];
  return shots
    .map((shot) => {
      if (shot.startsWith('http')) return shot;
      if (!game.steamAppId) return null;
      const suffix = shot.includes('/') || shot.includes('.')
        ? shot
        : `ss_${shot}.1920x1080.jpg`;
      return `${STEAM_ASSETS}/${game.steamAppId}/${suffix}`;
    })
    .filter((url): url is string => url !== null);
}

/** Whether this game will render real art rather than a generated cover. */
export function hasRealArt(game: Game): boolean {
  return coverUrl(game) !== undefined;
}
