/**
 * The seven vibe axes — what each pole means, and the copy used to explain a
 * match back to the user.
 *
 * Every axis runs 0 -> 1. When tagging a game, ask "if I slid this all the way
 * to 1, what would that feel like?" and place it honestly. Most games land
 * between 0.25 and 0.75; reserve the extremes for genuinely extreme games.
 */

import type { VibeAxis } from './schema.ts';

export interface VibeAxisMeta {
  axis: VibeAxis;
  label: string;
  /** What 0 means. */
  low: string;
  /** What 1 means. */
  high: string;
  /** One-line explanation shown under the quiz question. */
  help: string;
  /**
   * Explanation fragments for "Why it fits your vibe". Chosen by which side of
   * the axis the user leaned toward. Written to complete the sentence
   * "This is ___" or to stand alone.
   */
  reasonLow: string;
  reasonHigh: string;
}

export const VIBE_META: Record<VibeAxis, VibeAxisMeta> = {
  pace: {
    axis: 'pace',
    label: 'Pace',
    low: 'Slow burn',
    high: 'Adrenaline',
    help: 'Do you want to sink in and drift, or do you want your heart rate up?',
    reasonLow: 'A slow burn you can sink into, exactly the tempo you asked for.',
    reasonHigh: 'Relentless and fast — it keeps the pressure on, like you wanted.',
  },
  depth: {
    axis: 'depth',
    label: 'Depth',
    low: 'Pick up & play',
    high: 'Deep systems',
    help: 'Simple and immediately readable, or a machine you learn for hours?',
    reasonLow: 'Immediately readable — no manual, no build guides, just play.',
    reasonHigh: 'A genuinely deep system with room to keep getting better at it.',
  },
  narrative: {
    axis: 'narrative',
    label: 'Story',
    low: 'Pure mechanics',
    high: 'Story-driven',
    help: 'Are you here for the gameplay loop, or to be told something?',
    reasonLow: 'Mechanics first — the loop is the point, not the plot.',
    reasonHigh: 'Story-led, with writing worth staying for.',
  },
  challenge: {
    axis: 'challenge',
    label: 'Challenge',
    low: 'Forgiving',
    high: 'Punishing',
    help: 'Should it let you through, or make you earn it?',
    reasonLow: 'Forgiving enough to relax into — it wants you to finish it.',
    reasonHigh: 'It makes you earn every win, which is what you signed up for.',
  },
  social: {
    axis: 'social',
    label: 'Company',
    low: 'Solo',
    high: 'Together',
    help: 'Playing alone tonight, or with other people?',
    reasonLow: 'A solo experience, best played alone with headphones on.',
    reasonHigh: 'Built for company — better with other people in the room or online.',
  },
  tone: {
    axis: 'tone',
    label: 'Tone',
    low: 'Cozy & bright',
    high: 'Dark & heavy',
    help: 'Somewhere warm, or somewhere that unsettles you?',
    reasonLow: 'Warm and low-stakes — the kind of place you want to be.',
    reasonHigh: 'Dark and heavy, and it does not lighten up.',
  },
  session: {
    axis: 'session',
    label: 'Session',
    low: 'Quick bursts',
    high: 'Long haul',
    help: 'Twenty minutes at a time, or a campaign you disappear into?',
    reasonLow: 'Works in short bursts — easy to start, easy to put down.',
    reasonHigh: 'A long campaign worth disappearing into.',
  },
};

export const VIBE_META_LIST = Object.values(VIBE_META);

/**
 * Pick the explanation for an axis given which way the user leaned.
 * `preference` is the user's 0-1 value on that axis.
 */
export function reasonFor(axis: VibeAxis, preference: number): string {
  const meta = VIBE_META[axis];
  return preference >= 0.5 ? meta.reasonHigh : meta.reasonLow;
}

/** Human-readable label for a position on an axis, used in summaries. */
export function positionLabel(axis: VibeAxis, value: number): string {
  const meta = VIBE_META[axis];
  if (value < 0.34) return meta.low;
  if (value > 0.66) return meta.high;
  return 'Balanced';
}
