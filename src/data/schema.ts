/**
 * Ludex data model.
 *
 * This is the contract between the curated dataset (src/data/games/) and the
 * recommendation engine (skills/recommendation/). Both sides import from here.
 */

/* ---------------------------------------------------------------- platforms */

/**
 * Two console generations per family, which is where the actual install base
 * is: PS4 and Xbox One are still in millions of living rooms, so filtering
 * them out would hide most of the library from the people who need it most.
 * Order here is the display order everywhere in the UI.
 */
export const PLATFORMS = [
  'pc',
  'ps5',
  'ps4',
  'xbox-series',
  'xbox-one',
  'switch2',
  'switch',
] as const;
export type Platform = (typeof PLATFORMS)[number];

export const PLATFORM_LABELS: Record<Platform, string> = {
  pc: 'Windows PC',
  ps5: 'PlayStation 5',
  ps4: 'PlayStation 4',
  'xbox-series': 'Xbox Series X|S',
  'xbox-one': 'Xbox One',
  switch2: 'Nintendo Switch 2',
  switch: 'Nintendo Switch',
};

export const PLATFORM_SHORT: Record<Platform, string> = {
  pc: 'PC',
  ps5: 'PS5',
  ps4: 'PS4',
  'xbox-series': 'Xbox X|S',
  'xbox-one': 'Xbox One',
  switch2: 'Switch 2',
  switch: 'Switch',
};

/**
 * Hardware families.
 *
 * With seven platforms, a card that printed one icon each would be a wall of
 * badges. Compact badges group by family and show the generations inside
 * ("PlayStation 4·5"), which is both shorter and easier to scan.
 */
export const PLATFORM_FAMILIES = ['pc', 'playstation', 'xbox', 'nintendo'] as const;
export type PlatformFamily = (typeof PLATFORM_FAMILIES)[number];

export const PLATFORM_FAMILY: Record<Platform, PlatformFamily> = {
  pc: 'pc',
  ps5: 'playstation',
  ps4: 'playstation',
  'xbox-series': 'xbox',
  'xbox-one': 'xbox',
  switch2: 'nintendo',
  switch: 'nintendo',
};

export const FAMILY_LABELS: Record<PlatformFamily, string> = {
  pc: 'PC',
  playstation: 'PlayStation',
  xbox: 'Xbox',
  nintendo: 'Nintendo',
};

/** Short generation marker shown inside a grouped family badge. */
export const PLATFORM_GEN: Record<Platform, string> = {
  pc: '',
  ps5: '5',
  ps4: '4',
  'xbox-series': 'X|S',
  'xbox-one': 'One',
  switch2: '2',
  switch: '1',
};

/**
 * How a game actually runs on Switch 2 — a distinction no public game API
 * models cleanly, and the main reason Ludex uses a curated dataset.
 *
 *  - `native`               built for Switch 2; does not run on Switch 1
 *  - `switch2-edition`      an enhanced re-release of a Switch 1 game
 *  - `backward-compatible`  the Switch 1 build, playable on Switch 2 hardware
 *
 * Only meaningful when 'switch2' is in `platforms`. Never label a
 * backward-compatible title as native — users filter on this.
 */
export type Switch2Status = 'native' | 'switch2-edition' | 'backward-compatible';

/* -------------------------------------------------------------------- tiers */

/**
 * Editorial tier. Decides the result quota and the gacha rarity, so it is a
 * visible, comparable label — not a private note.
 *
 * The rule, in order:
 *
 *  1. **`mainstream`** — a household name. Big-budget or major-publisher
 *     titles, plus the handful of independent games that genuinely crossed
 *     over to a general audience (Minecraft, Stardew Valley, Terraria).
 *  2. **`indie-darling`** — independently produced, critically adored, widely
 *     known *within gaming*. Hades and Hollow Knight are the archetypes.
 *  3. **`hidden-gem`** — excellent, and most people who follow games closely
 *     still have not heard of it. Roughly `popularity` under 35.
 *
 * Two rules that exist because they were broken once:
 *
 *  - **Popularity alone does not decide the tier.** Hades (82) and Hollow
 *    Knight (80) sit above several mainstream entries and are still indie
 *    darlings. Reach is evidence; production context is the deciding factor.
 *  - **A series does not straddle a tier boundary.** Hades and Hades II, or
 *    Hollow Knight and Silksong, must share a tier. Two cards side by side
 *    with different labels and no visible reason just looks broken.
 *    `data:validate` warns when a series splits.
 */
export const TIERS = ['mainstream', 'indie-darling', 'hidden-gem'] as const;
export type Tier = (typeof TIERS)[number];

export const TIER_LABELS: Record<Tier, string> = {
  mainstream: 'Mainstream',
  'indie-darling': 'Indie Darling',
  'hidden-gem': 'Hidden Gem',
};

/** Gacha rarity language for the spin. Hidden gem is the legendary drop. */
export const TIER_RARITY: Record<Tier, string> = {
  mainstream: 'Common',
  'indie-darling': 'Rare',
  'hidden-gem': 'Legendary',
};

/* -------------------------------------------------------------- vibe axes */

export const VIBE_AXES = [
  'pace',
  'depth',
  'narrative',
  'challenge',
  'social',
  'tone',
  'session',
] as const;
export type VibeAxis = (typeof VIBE_AXES)[number];

/**
 * Every axis runs 0 -> 1. See src/data/vibes.ts for what each pole means and
 * for the quiz questions that map onto them.
 *
 * All seven are REQUIRED on every game — a missing axis silently corrupts the
 * distance math rather than throwing, which is why `data:validate` checks it.
 */
export type VibeVector = Record<VibeAxis, number>;

export const ART_STYLES = [
  'pixel',
  'stylized',
  'realistic',
  'anime',
  'lowpoly',
  'handdrawn',
] as const;
export type ArtStyle = (typeof ART_STYLES)[number];

/* --------------------------------------------------------------------- game */

/**
 * Art references. Resolve these through `src/data/art.ts`, never directly —
 * most games store nothing here but an accent, because their URLs are derived
 * from `steamAppId`.
 */
export interface GameArt {
  /**
   * REQUIRED hex color sampled from the game's key art. Drives the card glow
   * and the generated fallback cover, which is what lets Ludex run with no
   * images cached at all. Hand-authored — enrichment must never overwrite it.
   */
  accent: string;

  /**
   * Explicit cover URL. Only set when the art did not come from Steam (a
   * Wikipedia box art for a console exclusive) or when the Steam app has no
   * portrait capsule. Always wins over derivation.
   */
  cover?: string;
  /** Explicit wide hero URL. Same rules as `cover`. */
  hero?: string;
  /**
   * Detail-gallery screenshots. Steam content hashes when `steamAppId` is set
   * — `coverUrl`/`shotUrls` expand them — or full URLs otherwise.
   */
  shots?: string[];
}

export interface Game {
  id: string;
  /** URL segment — must be unique and stable; `similar` references it. */
  slug: string;
  title: string;
  year: number;
  developer: string;
  publisher?: string;

  platforms: Platform[];
  switch2Status?: Switch2Status;

  /**
   * Resolved by `npm run data:art` so later runs are an exact lookup instead
   * of a fuzzy title search. Hand-set it to pin a game whose name is ambiguous.
   */
  steamAppId?: number;

  /**
   * nintendo.com store slug, for Switch exclusives whose screenshots come from
   * Nintendo rather than Steam. Only set by hand when the slug guessed from the
   * title fails — see skills/data-pipeline/enrich-art.mjs.
   */
  nintendoSlug?: string;

  /**
   * playstation.com slug, for Sony exclusives whose screenshots come from
   * PlayStation rather than Steam. Same rules as `nintendoSlug`.
   */
  playstationSlug?: string;

  /**
   * 12-character Microsoft Store ID, from an `xbox.com/games/store/<slug>/<ID>`
   * URL. Microsoft's catalog serves 4K screenshots keyed on this, but its
   * search endpoints are closed, so it can only be set by hand.
   */
  xboxStoreId?: string;

  /** Editorial judgment, cross-checked against `popularity` by data:validate. */
  tier: Tier;
  /** 0-100 cultural reach. Drives the tier mix and the "how known is this" copy. */
  popularity: number;
  /** 0-100 critical consensus. Used only as a small tie-breaking prior. */
  rating: number;

  genres: string[];
  tags: string[];
  vibes: VibeVector;
  artStyle: ArtStyle;
  /** Rough hours to finish the main story//loop. Powers the playtime filter. */
  hoursToBeat: number;

  /** One or two sentences. The pitch, in Ludex's voice. */
  blurb: string;
  /** 2-4 short bullets — raw material for "Why it fits your vibe". */
  hooks: string[];
  /** Slugs of related games. Must resolve to real records. */
  similar: string[];

  art: GameArt;
}

/* ------------------------------------------------------------- engine types */

/** A user's taste profile. Axes the user skipped are simply absent. */
export type VibePreferences = Partial<Record<VibeAxis, number>>;

export interface RecommendationQuery {
  /** Empty or omitted means "all platforms". */
  platforms?: Platform[];
  vibes?: VibePreferences;
  /** Slugs to down-rank because the user already saw or dismissed them. */
  seen?: string[];
  /** How many results to return. */
  limit?: number;
  /** `YYYY-MM-DD`. Seeds the daily jitter so results are stable within a day. */
  dateSeed?: string;
  /** Set false to disable the 40/30/30 tier quota and take a raw top-N. */
  enforceTierMix?: boolean;
}

/** One axis that meaningfully drove a match, with a human-readable reason. */
export interface MatchReason {
  axis: VibeAxis;
  /** 0-1, how strongly this axis contributed. */
  strength: number;
  /** Rendered sentence, e.g. "Slow and atmospheric, exactly as you asked." */
  text: string;
}

export interface ScoredGame {
  game: Game;
  /** 0-100, shown as the match ring. */
  score: number;
  /** The 2-3 axes that actually drove this match. May be empty if all skipped. */
  reasons: MatchReason[];
}
