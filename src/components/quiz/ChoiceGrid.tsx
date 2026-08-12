import { motion } from 'motion/react';
import type { QuizChoice } from '@/data/quiz.ts';
import { usePrefersReducedMotion } from '@/lib/useReducedMotion.ts';

/**
 * Card-based answer picker.
 *
 * Cards flip in on a stagger and lift under the cursor. Under reduced motion
 * they simply appear — the flip is decoration, so removing it costs nothing.
 */
export function ChoiceGrid({
  choices,
  value,
  onSelect,
}: {
  choices: QuizChoice[];
  value?: number;
  onSelect: (value: number) => void;
}) {
  const reduced = usePrefersReducedMotion();
  const columns = choices.length === 4 ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-3';

  return (
    <div className={`grid grid-cols-1 gap-3 ${columns}`} role="radiogroup">
      {choices.map((choice, index) => {
        const selected = value === choice.value;
        return (
          <motion.button
            key={choice.label}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onSelect(choice.value)}
            initial={reduced ? false : { opacity: 0, rotateY: -35, y: 14 }}
            animate={{ opacity: 1, rotateY: 0, y: 0 }}
            transition={
              reduced
                ? { duration: 0 }
                : { delay: index * 0.06, duration: 0.42, ease: [0.16, 1, 0.3, 1] }
            }
            whileHover={reduced ? undefined : { y: -5 }}
            whileTap={reduced ? undefined : { y: 0 }}
            style={{ transformPerspective: 900 }}
            className={[
              'flex flex-col items-start gap-2 rounded-panel border p-5 text-left',
              'transition-colors duration-[--dur-fast]',
              selected
                ? 'border-neon-magenta bg-neon-magenta/10 shadow-[--glow-magenta]'
                : 'border-hairline bg-surface/70 hover:border-neon-cyan/60 hover:bg-surface-2',
            ].join(' ')}
          >
            <span className="text-3xl leading-none" aria-hidden="true">
              {choice.glyph}
            </span>
            <span
              className={`font-display text-base font-semibold ${selected ? 'text-neon-magenta' : 'text-text'}`}
            >
              {choice.label}
            </span>
            <span className="text-sm leading-relaxed text-text-secondary">
              {choice.description}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}
