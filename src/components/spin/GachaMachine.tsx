import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import type { Game } from '@/data/schema.ts';
import { GameCover } from '@/components/game/GameCover.tsx';
import { TIER_COLORS } from '@/components/game/TierBadge.tsx';
import { usePrefersReducedMotion } from '@/lib/useReducedMotion.ts';

/**
 * The gacha machine — the whole Daily Spin interaction, not just its animation.
 *
 * It sits idle waiting to be used and you turn its crank to play, rather than
 * a separate button standing in for it. The machine is the object; a button
 * next to it was a proxy for the object.
 *
 * Replaces the old vertical reel. A reel scrolls past 28 covers you are not
 * getting, which argues against the "one game, no questions" pitch; a capsule
 * is a single sealed drop, which is what the mechanic actually is.
 *
 * **Stages are driven by timers, never by animation events.** The reel this
 * replaces hung forever on "Rolling…" because it advanced on `transitionend`,
 * which is not delivered when a tab is backgrounded mid-spin. Here the timeline
 * is the single authority and every visual is decorative: if the compositor
 * drops the animation entirely, the sequence still completes on schedule.
 */

/**
 * The pull, beat by beat.
 *
 * `charge` is the gacha beat proper: the hold *before* the reveal where the
 * light building behind the capsule tells you the rarity while the game itself
 * is still hidden. Character-banner pulls are built on this — the payoff is
 * knowing what you got a moment before you see what it is. Without it the
 * capsule simply popped and the tier colour never had time to register.
 */
const STAGE_MS = {
  crank: 620,
  drop: 500,
  bounce: 360,
  charge: 520,
  open: 700,
} as const;

const ORDER = ['crank', 'drop', 'bounce', 'charge', 'open'] as const;
type Stage = 'idle' | (typeof ORDER)[number] | 'done';

/**
 * How far the capsule falls from the chute into the tray, in px.
 *
 * Paired with the capsule's resting `top`: at rest it must sit *entirely*
 * above the body's lower edge, or a sliver of it shows below the chute on the
 * idle machine and gives away that a capsule is already loaded.
 */
const DROP_DISTANCE = 102;

/**
 * Capsules idling inside the dome. Hand-placed rather than generated: every
 * random draw in this app is seeded (see src/lib/rng.ts), and decorative
 * scatter is not worth a seed. Colours cycle the three tier colours so the
 * dome previews the rarity language before anything is won.
 */
const DOME_CAPSULES = [
  { x: 34, y: 110, tier: 'mainstream' },
  { x: 76, y: 120, tier: 'hidden-gem' },
  { x: 117, y: 113, tier: 'indie-darling' },
  { x: 159, y: 122, tier: 'mainstream' },
  { x: 55, y: 78, tier: 'indie-darling' },
  { x: 97, y: 83, tier: 'mainstream' },
  { x: 138, y: 76, tier: 'hidden-gem' },
  { x: 76, y: 48, tier: 'mainstream' },
  { x: 120, y: 46, tier: 'indie-darling' },
  { x: 99, y: 21, tier: 'hidden-gem' },
] as const;

export function GachaMachine({
  winner,
  running,
  label,
  onSpin,
  onSettled,
}: {
  /** Null until a draw has been made — the machine idles without one. */
  winner: Game | null;
  running: boolean;
  /** Accessible name for the crank, e.g. "SPIN" or "ROLL AGAIN". */
  label: string;
  onSpin: () => void;
  onSettled: () => void;
}) {
  const [stage, setStage] = useState<Stage>('idle');
  const reduced = usePrefersReducedMotion();

  /**
   * Held in refs because the caller passes inline arrows: as effect
   * dependencies they would change identity every render and restart the
   * sequence from the crank forever.
   */
  const settleRef = useRef(onSettled);
  settleRef.current = onSettled;
  const doneRef = useRef(false);
  const timersRef = useRef<number[]>([]);

  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    timersRef.current.forEach(window.clearTimeout);
    settleRef.current();
  };
  const finishRef = useRef(finish);
  finishRef.current = finish;

  useEffect(() => {
    if (!running) return;

    doneRef.current = false;
    setStage(ORDER[0]);

    let elapsed = 0;
    const timers = ORDER.map((name, i) => {
      elapsed += STAGE_MS[name];
      const next: Stage = ORDER[i + 1] ?? 'done';
      return window.setTimeout(() => setStage(next), elapsed);
    });
    // A short beat on the revealed cover before the card takes over, so the
    // handoff reads as caused by the machine rather than as a scene cut.
    timers.push(window.setTimeout(() => finishRef.current(), elapsed + 160));

    timersRef.current = timers;
    return () => timers.forEach(window.clearTimeout);
  }, [running]);

  const color = winner ? TIER_COLORS[winner.tier] : 'var(--color-neon-cyan)';
  const isLegendary = winner?.tier === 'hidden-gem';
  const idle = stage === 'idle';
  const cranking = stage === 'crank';
  const charging = stage === 'charge';
  const opening = stage === 'open' || stage === 'done';

  /**
   * The capsule tumbles as it falls and lands upright, so the two halves split
   * on a clean vertical seam rather than at whatever angle the fall ended on.
   */
  const capsuleMotion =
    stage === 'idle' || stage === 'crank'
      ? { y: 0, rotate: 0 }
      : stage === 'drop'
        ? { y: DROP_DISTANCE, rotate: 300 }
        : stage === 'bounce'
          ? { y: [DROP_DISTANCE, DROP_DISTANCE - 20, DROP_DISTANCE], rotate: 360 }
          : stage === 'charge'
            ? { y: DROP_DISTANCE, rotate: 360, x: [0, -2.5, 2.5, -2, 2, 0] }
            : { y: DROP_DISTANCE, rotate: 360, x: 0 };

  const capsuleTiming =
    stage === 'drop'
      ? { duration: STAGE_MS.drop / 1000, ease: [0.45, 0, 0.9, 0.55] as const }
      : stage === 'bounce'
        ? { duration: STAGE_MS.bounce / 1000, times: [0, 0.45, 1], ease: 'easeOut' as const }
        : stage === 'charge'
          ? { duration: 0.16, repeat: Infinity, ease: 'linear' as const }
          : { duration: 0 };

  return (
    <div className="relative mx-auto h-[460px] w-[300px] select-none">
      {/* ------------------------------------------------------------- tray */}
      {/* Behind the capsule (z-0) so the capsule sits *in* it. */}
      <div
        className="absolute left-1/2 top-[329px] h-[90px] w-[235px] -translate-x-1/2 rounded-b-[25px] border-2 border-t-0 border-hairline"
        style={{
          background:
            'linear-gradient(180deg, var(--color-void), var(--color-abyss) 60%, var(--color-surface))',
          boxShadow: 'inset 0 16px 28px -16px rgb(0 0 0 / 0.9)',
        }}
      />

      {/* ---------------------------------------------------------- capsule */}
      {/* z-5: hidden behind the machine body (z-10) until it clears the chute,
          which sells the "emerges from the machine" read with no clipping mask. */}
      <motion.div
        className="absolute left-1/2 top-[266px] z-[5] h-[66px] w-[66px] -translate-x-1/2"
        animate={capsuleMotion}
        transition={capsuleTiming}
      >
        {/* The charge. Light swells behind the capsule in the tier colour, so
            rarity lands before identity — the whole point of the beat. */}
        {charging && (
          <motion.div
            className="absolute -inset-10 rounded-full"
            style={{ background: `radial-gradient(circle, ${color}, transparent 62%)` }}
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: isLegendary ? [0.4, 1.5, 1.2] : [0.4, 1.15, 0.95], opacity: [0, 0.85, 0.6] }}
            transition={{ duration: STAGE_MS.charge / 1000, ease: 'easeOut' }}
          />
        )}

        {/* Rarity burst on open. Legendary gets a wider, brighter bloom. */}
        {opening && (
          <motion.div
            className="absolute -inset-10 rounded-full"
            style={{ background: `radial-gradient(circle, ${color}, transparent 68%)` }}
            initial={{ scale: 0.5, opacity: isLegendary ? 1 : 0.8 }}
            animate={{ scale: isLegendary ? 4.2 : 3, opacity: 0 }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
          />
        )}

        {/* Top half — tier-coloured. This is the tell. */}
        <motion.div
          className="absolute inset-x-0 top-0 h-[33px] overflow-hidden rounded-t-full border-2 border-b-0"
          style={{
            borderColor: `color-mix(in oklab, ${color} 70%, white)`,
            background: `linear-gradient(150deg, color-mix(in oklab, ${color} 55%, white), ${color} 70%)`,
          }}
          animate={opening ? { y: -62, rotate: -28, opacity: 0 } : { y: 0, rotate: 0, opacity: 1 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* Specular highlight — reads as plastic rather than as a flat swatch. */}
          <div
            className="absolute left-[10px] top-[7px] h-[10px] w-[18px] -rotate-[24deg] rounded-full"
            style={{ background: 'rgb(255 255 255 / 0.75)', filter: 'blur(1.5px)' }}
          />
        </motion.div>

        {/* Bottom half — frosted, so the coloured cap is the thing you read. */}
        <motion.div
          className="absolute inset-x-0 bottom-0 h-[33px] rounded-b-full border-2 border-t-0"
          style={{
            borderColor: 'color-mix(in oklab, var(--color-text) 45%, transparent)',
            background:
              'linear-gradient(180deg, color-mix(in oklab, var(--color-text) 82%, transparent), color-mix(in oklab, var(--color-text-secondary) 55%, transparent))',
          }}
          animate={opening ? { y: 40, opacity: 0 } : { y: 0, opacity: 1 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        />

        {/* Seam. Light leaks through it as the capsule charges, then it splits. */}
        <motion.div
          className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full"
          animate={
            charging
              ? { background: color, boxShadow: `0 0 16px 3px ${color}`, opacity: 1 }
              : opening
                ? { opacity: 0 }
                : { background: 'rgb(0 0 0 / 0.35)', boxShadow: 'none', opacity: 1 }
          }
          transition={{ duration: charging ? STAGE_MS.charge / 1000 : 0.2 }}
        />
      </motion.div>

      {/* ------------------------------------------------- the game emerging */}
      {/* z-20, above the machine: the cover rises *out* of the capsule toward
          the viewer, so the reveal reads as caused by the machine rather than
          as a scene cut. Without this the capsule split and then simply
          evaporated, leaving an empty tray at the most important moment. */}
      {opening && winner && (
        <motion.div
          className="absolute left-1/2 top-[329px] z-20 w-[97px] -translate-x-1/2"
          initial={{ opacity: 0, scale: 0.3, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: -25 }}
          transition={{ duration: 0.55, delay: 0.14, ease: [0.34, 1.56, 0.64, 1] }}
        >
          <div
            className="overflow-hidden rounded-card border-2"
            style={{
              borderColor: `color-mix(in oklab, ${color} 65%, transparent)`,
              boxShadow: `0 0 38px -4px ${color}, 0 20px 34px -16px rgb(0 0 0 / 0.9)`,
            }}
          >
            <div className="aspect-[2/3]">
              <GameCover game={winner} eager />
            </div>
          </div>
        </motion.div>
      )}

      {/* ----------------------------------------------------------- machine */}
      <motion.div
        className="absolute inset-x-0 top-0 z-10"
        // A short rattle while the crank turns, so the machine feels driven.
        animate={cranking ? { x: [0, -1.5, 1.5, -1, 0] } : { x: 0 }}
        transition={cranking ? { duration: 0.24, repeat: 2, ease: 'linear' } : { duration: 0.2 }}
      >
        {/* Glass dome */}
        <div
          className="relative mx-auto h-[173px] w-[225px] overflow-hidden rounded-t-[113px] border-2 border-hairline"
          style={{
            background:
              'radial-gradient(ellipse 70% 60% at 32% 22%, rgb(124 240 255 / 0.16), transparent 62%), linear-gradient(165deg, var(--color-surface-2), var(--color-abyss))',
          }}
          aria-hidden="true"
        >
          {DOME_CAPSULES.map((c, i) => (
            <motion.span
              key={i}
              className="absolute h-[30px] w-[30px] rounded-full border"
              style={{
                left: c.x,
                top: c.y,
                borderColor: `color-mix(in oklab, ${TIER_COLORS[c.tier]} 60%, white)`,
                background: `linear-gradient(160deg, color-mix(in oklab, ${TIER_COLORS[c.tier]} 45%, white), ${TIER_COLORS[c.tier]})`,
                opacity: 0.85,
              }}
              // Jostle only while the crank turns — an idle machine is still.
              animate={cranking ? { y: [0, -5, 1, 0], rotate: [0, 8, -6, 0] } : { y: 0, rotate: 0 }}
              transition={
                cranking
                  ? { duration: 0.42, repeat: 1, delay: i * 0.035, ease: 'easeInOut' }
                  : { duration: 0.2 }
              }
            />
          ))}

          {/* Glass sheen over the capsules. */}
          <div
            className="pointer-events-none absolute inset-0 rounded-t-[113px]"
            style={{
              background:
                'linear-gradient(118deg, rgb(255 255 255 / 0.14) 0%, transparent 34%, transparent 66%, rgb(255 255 255 / 0.06) 100%)',
            }}
          />
        </div>

        {/* Body */}
        <div
          className="relative mx-auto -mt-[2px] h-[166px] w-[253px] rounded-b-[28px] border-2 border-hairline"
          style={{
            background: 'linear-gradient(180deg, var(--color-surface-3), var(--color-surface))',
          }}
        >
          {/* Collar where the dome meets the body. */}
          <div
            className="absolute inset-x-0 top-0 h-[12px] border-b border-hairline bg-surface-2"
            aria-hidden="true"
          />

          {/* Brand plate */}
          <div
            className="absolute left-1/2 top-[23px] -translate-x-1/2 rounded-chip border px-3 py-[3px] font-display text-[11px] font-bold tracking-[0.22em]"
            style={{
              borderColor: 'color-mix(in oklab, var(--color-neon-cyan) 40%, transparent)',
              color: 'var(--color-neon-cyan)',
              background: 'color-mix(in oklab, var(--color-neon-cyan) 8%, transparent)',
            }}
            aria-hidden="true"
          >
            LUDEX
          </div>

          {/* ------------------------------------------------------- the crank */}
          {/* The actual control. 58px clears the 44px touch-target minimum, and
              the global :focus-visible rule in index.css gives it a ring. */}
          <motion.button
            type="button"
            onClick={onSpin}
            disabled={!idle}
            aria-label={label}
            className="absolute left-1/2 top-[60px] h-[58px] w-[58px] -translate-x-1/2 rounded-full border-2 disabled:cursor-default"
            style={{
              borderColor: 'color-mix(in oklab, var(--color-neon-magenta) 55%, transparent)',
              background:
                'radial-gradient(circle at 34% 30%, var(--color-neon-magenta-soft), var(--color-neon-magenta) 55%, var(--color-neon-magenta-deep))',
              boxShadow: '0 0 26px -6px var(--color-neon-magenta)',
              cursor: idle ? 'pointer' : 'default',
            }}
            animate={{ rotate: idle || cranking ? 0 : 210 }}
            transition={{ duration: STAGE_MS.crank / 1000, ease: [0.34, 1.56, 0.64, 1] }}
            whileHover={idle && !reduced ? { scale: 1.08 } : undefined}
            whileTap={idle && !reduced ? { scale: 0.92 } : undefined}
          >
            {/* Handle slot, so the rotation is legible. */}
            <div className="absolute left-1/2 top-1/2 h-[5px] w-[32px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-void/70" />

            {/* Idle halo — the only thing moving on a resting machine, so the
                eye lands on the one part you are meant to touch. */}
            {idle && !reduced && (
              <motion.span
                className="pointer-events-none absolute -inset-1 rounded-full border-2 border-neon-magenta"
                animate={{ scale: [1, 1.35], opacity: [0.7, 0] }}
                transition={{ duration: 1.7, repeat: Infinity, ease: 'easeOut' }}
              />
            )}
          </motion.button>

          {/* Chute — the capsule falls out of here. */}
          <div
            className="absolute bottom-0 left-1/2 h-[44px] w-[85px] -translate-x-1/2 rounded-t-[12px] border-2 border-b-0 border-hairline"
            style={{
              background: 'linear-gradient(180deg, var(--color-void), #000)',
              boxShadow: 'inset 0 8px 14px -5px rgb(0 0 0 / 0.9)',
            }}
            aria-hidden="true"
          />
        </div>
      </motion.div>

      {/* -------------------------------------------------------- skip layer */}
      {/* Covers the machine while it runs: absorbs the click as a skip and
          keeps the crank from being turned twice mid-sequence. Skipping matters
          more than the animation does on the tenth reroll. */}
      {!idle && (
        <div
          className="absolute inset-0 z-30 cursor-pointer"
          onClick={finish}
          role="presentation"
          aria-hidden="true"
        />
      )}
    </div>
  );
}
