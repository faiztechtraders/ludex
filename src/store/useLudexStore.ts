import { create } from 'zustand';
import type { Platform, VibeAxis, VibePreferences } from '@/data/schema.ts';
import { readStorage, writeStorage } from '@/lib/useLocalStorage.ts';
import { todaySeed } from '@/lib/rng.ts';

/**
 * All persistent user state.
 *
 * Deliberately one store rather than several: platform selection, quiz answers
 * and progress are read together on nearly every screen, and splitting them
 * would mean coordinating three separate localStorage writes on every change.
 *
 * Nothing here leaves the browser. There are no accounts.
 */

export interface Badge {
  id: string;
  label: string;
  description: string;
  earnedOn: string;
}

/** XP awarded per action. Small numbers, frequent payouts — it should feel generous. */
export const XP = {
  quizStep: 8,
  quizComplete: 60,
  spin: 12,
  save: 15,
  viewDetail: 3,
} as const;

/** Level curve: each level costs 100 more XP than the last. */
export function levelFromXp(xp: number): { level: number; into: number; needed: number } {
  let level = 1;
  let remaining = xp;
  let cost = 100;
  while (remaining >= cost) {
    remaining -= cost;
    level += 1;
    cost += 100;
  }
  return { level, into: remaining, needed: cost };
}

interface LudexState {
  /* -- preferences -- */
  platforms: Platform[];
  vibes: VibePreferences;
  quizCompleted: boolean;

  /* -- library -- */
  saved: string[];
  dismissed: string[];
  seen: string[];

  /* -- progression -- */
  xp: number;
  badges: Badge[];
  streak: number;
  lastVisit: string | null;
  lastSpinDate: string | null;
  /**
   * Monotonic spin counter. Persisted because it seeds each reroll — when this
   * lived in component state it reset on every refresh, so the "random" reroll
   * produced the identical game every time.
   */
  spinCount: number;
  /** Recently drawn slugs, newest first, so rerolls do not repeat themselves. */
  recentSpins: string[];

  /* -- actions -- */
  togglePlatform: (platform: Platform) => void;
  setPlatforms: (platforms: Platform[]) => void;
  setVibe: (axis: VibeAxis, value: number) => void;
  clearVibe: (axis: VibeAxis) => void;
  completeQuiz: () => void;
  resetQuiz: () => void;

  toggleSaved: (slug: string) => void;
  dismiss: (slug: string) => void;
  markSeen: (slug: string) => void;

  addXp: (amount: number) => void;
  recordSpin: (slug: string) => void;
  registerVisit: () => void;
  resetEverything: () => void;
}

/* --------------------------------------------------------------- persistence */

const KEY = 'state:v1';

type Persisted = Pick<
  LudexState,
  | 'platforms'
  | 'vibes'
  | 'quizCompleted'
  | 'saved'
  | 'dismissed'
  | 'seen'
  | 'xp'
  | 'badges'
  | 'streak'
  | 'lastVisit'
  | 'lastSpinDate'
  | 'spinCount'
  | 'recentSpins'
>;

/**
 * How many past draws the spin remembers. Kept modest so a narrow platform
 * filter with only a handful of eligible games cannot exhaust its own pool.
 */
export const RECENT_SPIN_MEMORY = 20;

const DEFAULTS: Persisted = {
  platforms: [],
  vibes: {},
  quizCompleted: false,
  saved: [],
  dismissed: [],
  seen: [],
  xp: 0,
  badges: [],
  streak: 0,
  lastVisit: null,
  lastSpinDate: null,
  spinCount: 0,
  recentSpins: [],
};

function loadPersisted(): Persisted {
  const stored = readStorage<Partial<Persisted>>(KEY, {});
  // Spread over defaults so a state shape from an older build still boots.
  return { ...DEFAULTS, ...stored };
}

/* -------------------------------------------------------------------- badges */

const BADGE_DEFINITIONS: Array<{
  id: string;
  label: string;
  description: string;
  earned: (s: Persisted) => boolean;
}> = [
  {
    id: 'first-steps',
    label: 'Calibrated',
    description: 'Completed your first Vibe Check.',
    earned: (s) => s.quizCompleted,
  },
  {
    id: 'collector',
    label: 'Collector',
    description: 'Saved five games to your collection.',
    earned: (s) => s.saved.length >= 5,
  },
  {
    id: 'hoarder',
    label: 'Backlog Architect',
    description: 'Saved twenty games. Be honest about your free time.',
    earned: (s) => s.saved.length >= 20,
  },
  {
    id: 'explorer',
    label: 'Explorer',
    description: 'Looked at twenty-five different games.',
    earned: (s) => s.seen.length >= 25,
  },
  {
    id: 'regular',
    label: 'Regular',
    description: 'Visited three days in a row.',
    earned: (s) => s.streak >= 3,
  },
  {
    id: 'devoted',
    label: 'Devoted',
    description: 'A seven-day streak.',
    earned: (s) => s.streak >= 7,
  },
];

/** Award any newly-qualified badges. Returns the full badge list. */
function reconcileBadges(state: Persisted): Badge[] {
  const owned = new Set(state.badges.map((b) => b.id));
  const gained = BADGE_DEFINITIONS.filter((d) => !owned.has(d.id) && d.earned(state)).map((d) => ({
    id: d.id,
    label: d.label,
    description: d.description,
    earnedOn: todaySeed(),
  }));
  return gained.length ? [...state.badges, ...gained] : state.badges;
}

/** Days between two YYYY-MM-DD strings. */
function daysBetween(from: string, to: string): number {
  const a = Date.UTC(+from.slice(0, 4), +from.slice(5, 7) - 1, +from.slice(8, 10));
  const b = Date.UTC(+to.slice(0, 4), +to.slice(5, 7) - 1, +to.slice(8, 10));
  return Math.round((b - a) / 86_400_000);
}

/* --------------------------------------------------------------------- store */

export const useLudexStore = create<LudexState>()((set, get) => {
  /**
   * Persist and re-check badges after every mutation. Wrapping `set` keeps
   * every action from having to remember to do both.
   */
  const commit = (partial: Partial<Persisted>) => {
    set((state) => {
      const merged: Persisted = {
        platforms: partial.platforms ?? state.platforms,
        vibes: partial.vibes ?? state.vibes,
        quizCompleted: partial.quizCompleted ?? state.quizCompleted,
        saved: partial.saved ?? state.saved,
        dismissed: partial.dismissed ?? state.dismissed,
        seen: partial.seen ?? state.seen,
        xp: partial.xp ?? state.xp,
        badges: partial.badges ?? state.badges,
        streak: partial.streak ?? state.streak,
        lastVisit: partial.lastVisit !== undefined ? partial.lastVisit : state.lastVisit,
        lastSpinDate:
          partial.lastSpinDate !== undefined ? partial.lastSpinDate : state.lastSpinDate,
        spinCount: partial.spinCount ?? state.spinCount,
        recentSpins: partial.recentSpins ?? state.recentSpins,
      };
      merged.badges = reconcileBadges(merged);
      writeStorage(KEY, merged);
      return merged;
    });
  };

  return {
    ...loadPersisted(),

    togglePlatform: (platform) => {
      const current = get().platforms;
      commit({
        platforms: current.includes(platform)
          ? current.filter((p) => p !== platform)
          : [...current, platform],
      });
    },

    setPlatforms: (platforms) => commit({ platforms }),

    setVibe: (axis, value) => commit({ vibes: { ...get().vibes, [axis]: value } }),

    clearVibe: (axis) => {
      // Delete rather than set to 0.5 — "skipped" and "neutral" are different
      // inputs to the engine, and a skipped axis must carry zero weight.
      const next = { ...get().vibes };
      delete next[axis];
      commit({ vibes: next });
    },

    completeQuiz: () => commit({ quizCompleted: true, xp: get().xp + XP.quizComplete }),

    resetQuiz: () => commit({ vibes: {}, quizCompleted: false }),

    toggleSaved: (slug) => {
      const saved = get().saved;
      const isSaved = saved.includes(slug);
      commit({
        saved: isSaved ? saved.filter((s) => s !== slug) : [...saved, slug],
        xp: isSaved ? get().xp : get().xp + XP.save,
      });
    },

    dismiss: (slug) => {
      const dismissed = get().dismissed;
      if (dismissed.includes(slug)) return;
      commit({ dismissed: [...dismissed, slug] });
    },

    markSeen: (slug) => {
      const seen = get().seen;
      if (seen.includes(slug)) return;
      commit({ seen: [...seen, slug], xp: get().xp + XP.viewDetail });
    },

    addXp: (amount) => commit({ xp: get().xp + amount }),

    recordSpin: (slug) => {
      const { recentSpins, spinCount, xp } = get();
      commit({
        lastSpinDate: todaySeed(),
        // Monotonic and persisted, so each reroll draws a genuinely new seed
        // even across a page refresh.
        spinCount: spinCount + 1,
        recentSpins: [slug, ...recentSpins.filter((s) => s !== slug)].slice(
          0,
          RECENT_SPIN_MEMORY,
        ),
        xp: xp + XP.spin,
      });
    },

    registerVisit: () => {
      const today = todaySeed();
      const { lastVisit, streak } = get();
      if (lastVisit === today) return;

      // Consecutive day extends the streak; any longer gap restarts it at 1.
      const gap = lastVisit ? daysBetween(lastVisit, today) : null;
      const nextStreak = gap === 1 ? streak + 1 : 1;
      commit({ lastVisit: today, streak: nextStreak });
    },

    resetEverything: () => commit({ ...DEFAULTS }),
  };
});

/* ------------------------------------------------------------------ selectors */

/**
 * Selectors must return a primitive or a stable reference.
 *
 * Zustand 5 reads through `useSyncExternalStore`, which compares snapshots by
 * identity. A selector that builds a fresh object each call — `s => ({...})`,
 * or anything derived like `levelFromXp(s.xp)` — reports a change on every
 * render and React aborts with "getSnapshot should be cached". Select the raw
 * value and derive in the component instead; see `useLevel` below.
 */
export const selectHasSpunToday = (s: LudexState): boolean => s.lastSpinDate === todaySeed();

/** Level derived from XP. Safe because the object is built during render, not in a selector. */
export function useLevel() {
  const xp = useLudexStore((s) => s.xp);
  return levelFromXp(xp);
}
