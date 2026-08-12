/**
 * The single place Ludex touches localStorage.
 *
 * Centralized so the failure cases live in one spot: private browsing modes
 * throw on write, quota can be exceeded, and stored JSON can be from an older
 * shape of the app. None of those should ever crash a render — losing a saved
 * game list is annoying, a white screen is not acceptable.
 */

const PREFIX = 'ludex:';

export function readStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    // Corrupt or unparseable — treat it as absent rather than propagating.
    return fallback;
  }
}

export function writeStorage(key: string, value: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Quota exceeded or storage disabled. Preferences are a convenience, not a
    // requirement — the app stays fully usable without them.
  }
}

export function clearStorage(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(PREFIX + key);
  } catch {
    /* nothing useful to do */
  }
}
