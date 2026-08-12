import type { VibeAxis } from './schema.ts';

/**
 * The Vibe Check.
 *
 * Seven questions, one per vibe axis, plus a platform setup step. Every step is
 * skippable and a skipped axis carries zero weight in the engine — so a user
 * who only answers two questions gets recommendations built on exactly those
 * two, rather than on six defaults they never chose.
 *
 * Input types are deliberately mixed: sliders where the axis is genuinely
 * continuous, cards where the poles are qualitatively different things. A
 * seven-slider form would be accurate and joyless.
 */

export type QuizInputKind = 'choice' | 'slider';

export interface QuizChoice {
  label: string;
  description: string;
  /** Position on the axis, 0-1. */
  value: number;
  /** Emoji used as the card's visual anchor. */
  glyph: string;
}

export interface QuizQuestion {
  axis: VibeAxis;
  prompt: string;
  help: string;
  kind: QuizInputKind;
  /** For `choice` questions. */
  choices?: QuizChoice[];
  /** For `slider` questions: [what 0 means, what 1 means]. */
  poles?: [string, string];
  /** Labels shown at slider stops, low -> high. */
  ticks?: string[];
}

export const QUIZ: QuizQuestion[] = [
  {
    axis: 'tone',
    prompt: 'Where do you want to spend the evening?',
    help: 'The single biggest factor in whether a game fits your mood.',
    kind: 'choice',
    choices: [
      {
        glyph: '🌻',
        label: 'Somewhere warm',
        description: 'Bright, low-stakes, nothing bad happens.',
        value: 0.05,
      },
      {
        glyph: '🌤️',
        label: 'Somewhere pleasant',
        description: 'Light overall, with the occasional edge.',
        value: 0.32,
      },
      {
        glyph: '🌑',
        label: 'Somewhere heavy',
        description: 'Serious, weighty, willing to sit with darkness.',
        value: 0.72,
      },
      {
        glyph: '🩸',
        label: 'Somewhere that unsettles me',
        description: 'Bleak or frightening, and it does not let up.',
        value: 0.95,
      },
    ],
  },
  {
    axis: 'pace',
    prompt: 'What speed are you after?',
    help: 'Do you want to drift, or do you want your heart rate up?',
    kind: 'choice',
    choices: [
      {
        glyph: '🕯️',
        label: 'Slow burn',
        description: 'Let me sink in and take my time.',
        value: 0.1,
      },
      {
        glyph: '🚶',
        label: 'Steady',
        description: 'Moving forward without being rushed.',
        value: 0.45,
      },
      {
        glyph: '⚡',
        label: 'Adrenaline',
        description: 'Fast, loud, constant pressure.',
        value: 0.92,
      },
    ],
  },
  {
    axis: 'session',
    prompt: 'How long is a typical sitting?',
    help: 'Be honest about your actual free time, not your aspirational free time.',
    kind: 'choice',
    choices: [
      {
        glyph: '☕',
        label: 'Twenty minutes',
        description: 'Something I can start and stop cleanly.',
        value: 0.08,
      },
      {
        glyph: '🎧',
        label: 'An evening',
        description: 'A couple of hours at a time.',
        value: 0.5,
      },
      {
        glyph: '🏔️',
        label: 'The long haul',
        description: 'Give me a campaign to disappear into.',
        value: 0.95,
      },
    ],
  },
  {
    axis: 'challenge',
    prompt: 'How hard should it push back?',
    help: 'There is no wrong answer here, and no prize for picking the right-hand side.',
    kind: 'slider',
    poles: ['Let me through', 'Make me earn it'],
    ticks: ['Forgiving', 'Fair', 'Demanding', 'Punishing'],
  },
  {
    axis: 'depth',
    prompt: 'How much do you want to learn?',
    help: 'Immediately readable, or a machine you get better at over weeks?',
    kind: 'slider',
    poles: ['Pick up and play', 'Deep systems'],
    ticks: ['Instant', 'Light', 'Involved', 'Bottomless'],
  },
  {
    axis: 'narrative',
    prompt: 'Are you here for the story?',
    help: 'Some of the best games have almost none. Some are almost nothing else.',
    kind: 'choice',
    choices: [
      {
        glyph: '🎛️',
        label: 'The loop is the point',
        description: 'Give me mechanics. Skip the cutscenes.',
        value: 0.08,
      },
      {
        glyph: '⚖️',
        label: 'A bit of both',
        description: 'Story as motivation, not as the main event.',
        value: 0.5,
      },
      {
        glyph: '📖',
        label: 'Tell me something',
        description: 'I want writing worth staying for.',
        value: 0.95,
      },
    ],
  },
  {
    axis: 'social',
    prompt: 'Are you playing alone?',
    help: 'Co-op recommendations only work if you actually have someone to play with.',
    kind: 'choice',
    choices: [
      {
        glyph: '🎧',
        label: 'Just me',
        description: 'Solo, headphones on, door closed.',
        value: 0.0,
      },
      {
        glyph: '🛋️',
        label: 'One other person',
        description: 'Someone on the couch or on a call.',
        value: 0.75,
      },
      {
        glyph: '🎉',
        label: 'A whole group',
        description: 'Three or four of us, and it should be chaos.',
        value: 1.0,
      },
    ],
  },
];

/** Total user-facing question count, excluding the platform setup step. */
export const QUIZ_LENGTH = QUIZ.length;

export function questionFor(axis: VibeAxis): QuizQuestion | undefined {
  return QUIZ.find((q) => q.axis === axis);
}
