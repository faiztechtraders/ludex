/**
 * Deterministic pseudo-randomness.
 *
 * Ludex must never call `Math.random()`. The daily rotation, the daily spin,
 * and the tie-break jitter all have to be *identical for every user* and
 * *stable within a day* — that's what makes "today's pick" a shared thing
 * worth coming back to rather than a reroll on every render.
 *
 * Everything random therefore flows through a seeded generator keyed on a
 * `YYYY-MM-DD` string plus some discriminator.
 */

/** FNV-1a. Turns an arbitrary seed string into a 32-bit integer. */
export function hashString(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    // 32-bit FNV prime multiply, via shifts to stay in int range.
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * mulberry32 — small, fast, good enough distribution for shuffling and jitter.
 * Returns a function producing floats in [0, 1).
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function next(): number {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Convenience: a generator seeded directly from a string. */
export function seededRandom(seed: string): () => number {
  return mulberry32(hashString(seed));
}

/**
 * A single deterministic float in [0, 1) for a seed string. Used for per-game
 * jitter, where creating a generator per game would be wasteful.
 */
export function seededFloat(seed: string): number {
  return mulberry32(hashString(seed))();
}

/** Fisher-Yates using a seeded generator. Does not mutate the input. */
export function seededShuffle<T>(items: readonly T[], seed: string): T[] {
  const out = items.slice();
  const rand = seededRandom(seed);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Deterministically pick one item. Returns undefined for an empty list. */
export function seededPick<T>(items: readonly T[], seed: string): T | undefined {
  if (items.length === 0) return undefined;
  return items[Math.floor(seededFloat(seed) * items.length)];
}

/**
 * Today's date as `YYYY-MM-DD` in the user's local timezone.
 *
 * Local, not UTC, on purpose: "today's pick" should roll over at the user's
 * midnight. The tradeoff is that two users in different timezones can briefly
 * see different days — which is correct behavior, not a bug.
 */
export function todaySeed(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
