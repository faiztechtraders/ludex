import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { QUIZ, QUIZ_LENGTH } from '@/data/quiz.ts';
import { useLudexStore, XP } from '@/store/useLudexStore.ts';
import { PlatformPicker, platformSummary } from '@/components/platform/PlatformPicker.tsx';
import { ChoiceGrid } from '@/components/quiz/ChoiceGrid.tsx';
import { VibeSlider } from '@/components/quiz/VibeSlider.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { usePrefersReducedMotion } from '@/lib/useReducedMotion.ts';

/**
 * The Vibe Check.
 *
 * Step 0 is the platform picker; steps 1..7 are one vibe question each.
 * Answers write straight to the persisted store as they are made, so a refresh
 * mid-quiz loses nothing and the user can leave and come back.
 */
export default function VibeCheck() {
  const navigate = useNavigate();
  const reduced = usePrefersReducedMotion();
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);

  const platforms = useLudexStore((s) => s.platforms);
  const togglePlatform = useLudexStore((s) => s.togglePlatform);
  const vibes = useLudexStore((s) => s.vibes);
  const setVibe = useLudexStore((s) => s.setVibe);
  const clearVibe = useLudexStore((s) => s.clearVibe);
  const completeQuiz = useLudexStore((s) => s.completeQuiz);
  const addXp = useLudexStore((s) => s.addXp);

  const isPlatformStep = step === 0;
  const question = isPlatformStep ? null : QUIZ[step - 1];
  const answered = question ? vibes[question.axis] !== undefined : true;
  const isLast = step === QUIZ_LENGTH;

  const go = (delta: number) => {
    setDirection(delta);
    setStep((s) => Math.min(QUIZ_LENGTH, Math.max(0, s + delta)));
  };

  const advance = () => {
    if (isLast) {
      completeQuiz();
      navigate('/results');
      return;
    }
    if (question && answered) addXp(XP.quizStep);
    go(1);
  };

  const skip = () => {
    // Skipping must actively clear the axis: a value left over from an earlier
    // attempt would silently keep influencing results the user did not choose.
    if (question) clearVibe(question.axis);
    if (isLast) {
      completeQuiz();
      navigate('/results');
      return;
    }
    go(1);
  };

  const answeredCount = QUIZ.filter((q) => vibes[q.axis] !== undefined).length;
  const progress = (step / QUIZ_LENGTH) * 100;

  const slide = reduced
    ? { initial: false, animate: {}, exit: {} }
    : {
        initial: { opacity: 0, x: direction * 60 },
        animate: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: direction * -60 },
      };

  return (
    <div className="mx-auto max-w-3xl">
      {/* -- progress -- */}
      <div className="mb-8">
        <div className="mb-2 flex items-baseline justify-between">
          <span className="font-display text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">
            {isPlatformStep ? 'Setup' : `Question ${step} of ${QUIZ_LENGTH}`}
          </span>
          <span className="text-xs text-text-muted">
            {answeredCount} answered · every step is optional
          </span>
        </div>
        <div
          className="h-1.5 overflow-hidden rounded-chip bg-surface"
          role="progressbar"
          aria-valuenow={step}
          aria-valuemin={0}
          aria-valuemax={QUIZ_LENGTH}
          aria-label="Quiz progress"
        >
          <div
            className="brand-gradient h-full rounded-chip transition-[width] duration-[--dur-slow] ease-[--ease-arrival]"
            style={{ width: `${Math.max(progress, 4)}%` }}
          />
        </div>
      </div>

      {/* -- step -- */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.section
          key={step}
          {...slide}
          transition={reduced ? { duration: 0 } : { duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
          className="panel p-6 lg:p-9"
        >
          {isPlatformStep ? (
            <>
              <h1 className="font-display text-2xl font-bold text-text lg:text-3xl">
                What are you playing on?
              </h1>
              <p className="mt-2 text-sm text-text-secondary">
                Everything after this is filtered to hardware you actually own. Pick as many as
                apply — or none, and we will show you everything.
              </p>
              <div className="mt-7">
                <PlatformPicker selected={platforms} onToggle={togglePlatform} />
              </div>
              <p className="mt-4 text-xs text-text-muted">
                Currently: <span className="text-neon-cyan">{platformSummary(platforms)}</span>
              </p>
            </>
          ) : (
            question && (
              <>
                <h1 className="font-display text-2xl font-bold text-text lg:text-3xl">
                  {question.prompt}
                </h1>
                <p className="mt-2 text-sm text-text-secondary">{question.help}</p>

                <div className="mt-8">
                  {question.kind === 'choice' && question.choices ? (
                    <ChoiceGrid
                      choices={question.choices}
                      value={vibes[question.axis]}
                      onSelect={(value) => setVibe(question.axis, value)}
                    />
                  ) : (
                    question.poles && (
                      <VibeSlider
                        label={question.prompt}
                        poles={question.poles}
                        ticks={question.ticks}
                        value={vibes[question.axis]}
                        onChange={(value) => setVibe(question.axis, value)}
                      />
                    )
                  )}
                </div>

                {answered && (
                  <button
                    type="button"
                    onClick={() => clearVibe(question.axis)}
                    className="mt-5 text-xs text-text-muted underline underline-offset-4 hover:text-neon-magenta"
                  >
                    Clear this answer
                  </button>
                )}
              </>
            )
          )}
        </motion.section>
      </AnimatePresence>

      {/* -- navigation -- */}
      <div className="mt-6 flex items-center gap-3">
        <Button variant="ghost" onClick={() => go(-1)} disabled={step === 0}>
          ← Back
        </Button>

        <div className="ml-auto flex items-center gap-3">
          {!isPlatformStep && (
            <Button variant="ghost" onClick={skip}>
              Skip
            </Button>
          )}
          <Button variant="primary" size="lg" onClick={advance}>
            {isLast ? 'See my matches →' : 'Next →'}
          </Button>
        </div>
      </div>

      {step > 2 && (
        <p className="mt-4 text-center text-xs text-text-muted">
          Had enough?{' '}
          <button
            type="button"
            onClick={() => {
              completeQuiz();
              navigate('/results');
            }}
            className="text-neon-cyan underline underline-offset-4 hover:text-neon-cyan-soft"
          >
            Show me results with what I have answered so far
          </button>
        </p>
      )}
    </div>
  );
}
