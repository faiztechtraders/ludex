import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import type { Game } from '@/data/schema.ts';
import { TIER_RARITY } from '@/data/schema.ts';
import { GAMES } from '@/data/games/index.ts';
import { dailySpinPool, todaySeed, seededFloat } from '@/engine/index.ts';
import { useLudexStore, selectHasSpunToday } from '@/store/useLudexStore.ts';
import { GachaReel } from '@/components/spin/GachaReel.tsx';
import { GameCover } from '@/components/game/GameCover.tsx';
import { TierBadge, TIER_COLORS, TIER_GLOW } from '@/components/game/TierBadge.tsx';
import { SaveButton } from '@/components/game/SaveButton.tsx';
import { PlatformBadgeRow } from '@/components/platform/PlatformBadge.tsx';
import { Button, ButtonLink } from '@/components/ui/Button.tsx';
import { platformSummary } from '@/components/platform/PlatformPicker.tsx';
import { usePrefersReducedMotion } from '@/lib/useReducedMotion.ts';

type Phase = 'idle' | 'spinning' | 'revealed';

/**
 * The Daily Spin / Chaos Button.
 *
 * Two distinct draws:
 *  - The **daily spin** is deterministic and shared: everyone on the same
 *    platforms sees the same game today. That is what makes it worth coming
 *    back for rather than being a reroll button.
 *  - **Chaos rerolls** are unlimited and seeded per-attempt, for people who
 *    just want something right now.
 */
export default function DailySpin() {
  const reduced = usePrefersReducedMotion();
  const platforms = useLudexStore((s) => s.platforms);
  const recordSpin = useLudexStore((s) => s.recordSpin);
  const hasSpunToday = useLudexStore(selectHasSpunToday);
  const recentSpins = useLudexStore((s) => s.recentSpins);
  const spinCount = useLudexStore((s) => s.spinCount);

  const [phase, setPhase] = useState<Phase>('idle');
  const [result, setResult] = useState<Game | null>(null);

  const pool = useMemo(
    () => dailySpinPool(GAMES, platforms, todaySeed()),
    [platforms],
  );

  /**
   * Two different draws, and neither may hand back something you just saw.
   *
   *  - **Today's official spin** walks the date-seeded shuffle to the first
   *    game you have not been shown recently. Deterministic given the date,
   *    your platforms and your history, so it holds still across reloads within
   *    the day — but it will not re-serve yesterday's pick.
   *
   *  - **Chaos rerolls** are seeded from a persisted counter and skip
   *    `recentSpins` outright. The counter *has* to be persisted: when it lived
   *    in component state it reset on every refresh, so every reroll drew the
   *    identical game.
   *
   * Both fall back to the full pool if a narrow platform filter means you have
   * genuinely seen everything available.
   */
  const pick = useCallback(
    (official: boolean): Game => {
      if (pool.length === 0) return GAMES[0];

      const fresh = pool.filter((g) => !recentSpins.includes(g.slug));
      const candidates = fresh.length > 0 ? fresh : pool;

      if (official) return candidates[0];

      const r = seededFloat(`chaos:${todaySeed()}:${spinCount}:${platforms.join(',')}`);
      return candidates[Math.floor(r * candidates.length)];
    },
    [pool, platforms, recentSpins, spinCount],
  );

  const spin = useCallback(() => {
    const official = phase === 'idle' && !hasSpunToday;
    const winner = pick(official);
    setResult(winner);
    recordSpin(winner.slug);

    if (reduced) {
      // Cut straight to the answer. A collapsed reel conveys nothing.
      setPhase('revealed');
      return;
    }
    setPhase('spinning');
  }, [phase, hasSpunToday, pick, recordSpin, reduced]);

  if (pool.length === 0) {
    return (
      <div className="panel mx-auto max-w-lg p-12 text-center">
        <h1 className="font-display text-2xl font-bold text-text">Nothing to spin</h1>
        <p className="mt-3 text-sm text-text-secondary">
          No games in the library match your current platform selection.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="font-display text-xs font-semibold uppercase tracking-[0.18em] text-tier-gem">
        {todaySeed()}
      </p>
      <h1 className="mt-2 font-display text-3xl font-bold text-text lg:text-5xl">
        {phase === 'revealed' ? 'Play this.' : 'The Daily Spin'}
      </h1>
      <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-text-secondary">
        {phase === 'revealed'
          ? 'That is the pick. Take it or roll again — nobody is keeping score.'
          : `One game, right now, no questions. Drawing from ${pool.length} games on ${platformSummary(platforms)}.`}
      </p>

      {/* ------------------------------------------------------------ stage */}
      <div className="mt-10 flex min-h-[26rem] flex-col items-center justify-center">
        <AnimatePresence mode="wait">
          {phase === 'idle' && (
            <motion.div
              key="idle"
              initial={reduced ? false : { opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94 }}
              className="flex flex-col items-center gap-6"
            >
              <ChaosButton onClick={spin} label={hasSpunToday ? 'ROLL AGAIN' : 'SPIN'} />
              {hasSpunToday && (
                <p className="text-xs text-text-muted">
                  You have already taken today&apos;s official spin. Rerolls are unlimited.
                </p>
              )}
            </motion.div>
          )}

          {phase === 'spinning' && result && (
            <motion.div key="spinning" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <GachaReel
                pool={pool}
                winner={result}
                spinning
                onSettled={() => setPhase('revealed')}
              />
              <p className="mt-6 animate-[ludex-pulse_1.2s_ease-in-out_infinite] font-display text-sm uppercase tracking-[0.2em] text-text-muted">
                Rolling…
              </p>
            </motion.div>
          )}

          {phase === 'revealed' && result && (
            <SpinResult
              key={`result-${result.slug}-${spinCount}`}
              game={result}
              reduced={reduced}
              onReroll={spin}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- the button */

function ChaosButton({ onClick, label }: { onClick: () => void; label: string }) {
  const reduced = usePrefersReducedMotion();
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={reduced ? undefined : { scale: 1.05 }}
      whileTap={reduced ? undefined : { scale: 0.94 }}
      className="relative flex h-52 w-52 items-center justify-center rounded-full font-display text-2xl font-bold tracking-[0.14em] text-text-inverse"
      style={{
        background:
          'radial-gradient(circle at 32% 28%, var(--color-neon-magenta-soft), var(--color-neon-magenta) 42%, var(--color-neon-violet) 100%)',
        boxShadow:
          '0 0 0 2px rgb(255 62 165 / 0.5), 0 0 60px -10px rgb(255 62 165 / 0.8), inset 0 -10px 30px -8px rgb(0 0 0 / 0.5)',
      }}
    >
      {/* Halo, held back under reduced motion. */}
      {!reduced && (
        <motion.span
          className="absolute inset-0 rounded-full border-2 border-neon-magenta"
          animate={{ scale: [1, 1.28], opacity: [0.7, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
        />
      )}
      {label}
    </motion.button>
  );
}

/* -------------------------------------------------------------- the reveal */

function SpinResult({
  game,
  reduced,
  onReroll,
}: {
  game: Game;
  reduced: boolean;
  onReroll: () => void;
}) {
  const color = TIER_COLORS[game.tier];
  const isLegendary = game.tier === 'hidden-gem';

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={reduced ? { duration: 0 } : { duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
      className="w-full"
    >
      {/* Rarity call-out. Gold for hidden gems is the payoff of the whole mechanic. */}
      <motion.p
        initial={reduced ? false : { opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: reduced ? 0 : 0.18 }}
        className="mb-4 font-display text-sm font-bold uppercase tracking-[0.28em]"
        style={{ color, textShadow: isLegendary ? `0 0 22px ${color}` : undefined }}
      >
        {TIER_RARITY[game.tier]}
      </motion.p>

      <div
        className="mx-auto flex max-w-md flex-col items-center gap-5 rounded-panel border p-6"
        style={{
          borderColor: `color-mix(in oklab, ${color} 50%, transparent)`,
          boxShadow: TIER_GLOW[game.tier],
          backgroundColor: `color-mix(in oklab, ${color} 6%, var(--color-surface))`,
        }}
      >
        <Link
          to={`/game/${game.slug}`}
          className="w-40 overflow-hidden rounded-card border"
          style={{ borderColor: `color-mix(in oklab, ${game.art.accent} 55%, transparent)` }}
        >
          <div className="aspect-[2/3]">
            <GameCover game={game} eager />
          </div>
        </Link>

        <div className="space-y-2">
          <TierBadge tier={game.tier} />
          <h2 className="font-display text-2xl font-bold leading-tight text-text">{game.title}</h2>
          <p className="text-xs text-text-muted">
            {game.year} · {game.developer} · ≈{game.hoursToBeat}h
          </p>
        </div>

        <PlatformBadgeRow game={game} showLabels className="justify-center" />

        <p className="text-sm leading-relaxed text-text-secondary">{game.blurb}</p>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
          <ButtonLink to={`/game/${game.slug}`} variant="primary">
            See the details
          </ButtonLink>
          <SaveButton slug={game.slug} accent={game.art.accent} size="md" />
        </div>
      </div>

      <div className="mt-6 flex items-center justify-center gap-3">
        <Button variant="secondary" onClick={onReroll}>
          🎲 Chaos reroll
        </Button>
        <ButtonLink to="/vibe-check" variant="ghost">
          Or answer some questions instead
        </ButtonLink>
      </div>
    </motion.div>
  );
}
