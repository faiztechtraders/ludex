import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import type { Game } from '@/data/schema.ts';
import { GameCover } from '@/components/game/GameCover.tsx';
import { TIER_COLORS } from '@/components/game/TierBadge.tsx';

/**
 * The gacha machine — crank, drop, bounce, open.
 *
 * Replaces the old vertical reel. A reel scrolls past 28 covers you are not
 * getting, which argues against the whole "one game, no questions" pitch; a
 * capsule is a single sealed drop, which is what the mechanic actually is.
 *
 * The capsule is tinted with the winner's **tier colour**, so rarity lands a
 * beat before identity — gold tells you it is a Legendary while the game is
 * still hidden. That tease is the reason this is worth more than the reel.
 *
 * **Stages are driven by timers, never by animation events.** The reel this
 * replaces hung forever on "Rolling…" because it advanced on `transitionend`,
 * which is not delivered when a tab is backgrounded mid-spin. Here the timeline
 * is the single authority and every visual is decorative: if the compositor
 * drops the whole animation, the sequence still completes on schedule.
 *
 * Under reduced motion the caller skips this component and reveals directly —
 * a collapsed 1ms animation communicates nothing and reads as broken.
 */

/**
 * Deliberately brisk. This runs once for delight and then many more times for
 * someone who just wants a game, so each stage has to earn its milliseconds.
 * Total ≈2.1s, and a click skips the remainder.
 */
const STAGE_MS = {
  crank: 620,
  drop: 500,
  bounce: 360,
  open: 700,
} as const;

const ORDER = ['crank', 'drop', 'bounce', 'open'] as const;
type Stage = (typeof ORDER)[number] | 'done';

/** How far the capsule falls from the chute into the tray, in px. */
const DROP_DISTANCE = 82;

/**
 * Capsules idling inside the dome. Hand-placed rather than generated: every
 * random draw in this app is seeded (see src/lib/rng.ts), and decorative
 * scatter is not worth a seed. Colours cycle the three tier colours so the
 * dome previews the rarity language before anything is won.
 */
const DOME_CAPSULES = [
  { x: 30, y: 96, tier: 'mainstream' },
  { x: 66, y: 104, tier: 'hidden-gem' },
  { x: 102, y: 98, tier: 'indie-darling' },
  { x: 138, y: 106, tier: 'mainstream' },
  { x: 48, y: 68, tier: 'indie-darling' },
  { x: 84, y: 72, tier: 'mainstream' },
  { x: 120, y: 66, tier: 'hidden-gem' },
  { x: 66, y: 42, tier: 'mainstream' },
  { x: 104, y: 40, tier: 'indie-darling' },
  { x: 86, y: 18, tier: 'hidden-gem' },
] as const;

export function GachaMachine({
  winner,
  onSettled,
}: {
  winner: Game;
  onSettled: () => void;
}) {
  const [stage, setStage] = useState<Stage>('crank');

  /**
   * Held in a ref because the caller passes an inline arrow: as an effect
   * dependency it would change identity every render and restart the sequence
   * from the crank forever.
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
    let elapsed = 0;
    const timers = ORDER.map((name, i) => {
      elapsed += STAGE_MS[name];
      const next: Stage = ORDER[i + 1] ?? 'done';
      return window.setTimeout(() => setStage(next), elapsed);
    });
    // A short beat on the open capsule before the card takes over, so the
    // reveal reads as caused by the machine rather than as a scene cut.
    timers.push(window.setTimeout(() => finishRef.current(), elapsed + 140));

    timersRef.current = timers;
    return () => timers.forEach(window.clearTimeout);
  }, []);

  const color = TIER_COLORS[winner.tier];
  const isLegendary = winner.tier === 'hidden-gem';
  const cranking = stage === 'crank';
  const opening = stage === 'open' || stage === 'done';

  /**
   * The capsule tumbles as it falls and lands upright, so the two halves split
   * on a clean vertical seam rather than at whatever angle the fall ended on.
   */
  const capsuleMotion =
    stage === 'crank'
      ? { y: 0, rotate: 0 }
      : stage === 'drop'
        ? { y: DROP_DISTANCE, rotate: 300 }
        : stage === 'bounce'
          ? { y: [DROP_DISTANCE, DROP_DISTANCE - 18, DROP_DISTANCE], rotate: 360 }
          : { y: DROP_DISTANCE, rotate: 360 };

  const capsuleTiming =
    stage === 'drop'
      ? { duration: STAGE_MS.drop / 1000, ease: [0.45, 0, 0.9, 0.55] as const }
      : stage === 'bounce'
        ? { duration: STAGE_MS.bounce / 1000, times: [0, 0.45, 1], ease: 'easeOut' as const }
        : { duration: 0 };

  return (
    <div
      className="relative mx-auto h-[400px] w-[260px] cursor-pointer select-none"
      // Skipping matters more than the animation does on the tenth reroll.
      onClick={finish}
      role="presentation"
      aria-hidden="true"
    >
      {/* ------------------------------------------------------------- tray */}
      {/* Behind the capsule (z-0) so the capsule sits *in* it. */}
      <div
        className="absolute left-1/2 top-[286px] h-[78px] w-[204px] -translate-x-1/2 rounded-b-[22px] border-2 border-t-0 border-hairline"
        style={{
          background:
            'linear-gradient(180deg, var(--color-void), var(--color-abyss) 60%, var(--color-surface))',
          boxShadow: 'inset 0 14px 24px -14px rgb(0 0 0 / 0.9)',
        }}
      />

      {/* ---------------------------------------------------------- capsule */}
      {/* z-5: hidden behind the machine body (z-10) until it clears the chute,
          which is what sells the "emerges from the machine" read without any
          clipping mask. */}
      <motion.div
        className="absolute left-1/2 top-[238px] z-[5] h-[58px] w-[58px] -translate-x-1/2"
        animate={capsuleMotion}
        transition={capsuleTiming}
      >
        {/* Rarity burst on open. Legendary gets a wider, brighter bloom. */}
        {opening && (
          <motion.div
            className="absolute -inset-8 rounded-full"
            style={{ background: `radial-gradient(circle, ${color}, transparent 68%)` }}
            initial={{ scale: 0.35, opacity: isLegendary ? 1 : 0.75 }}
            animate={{ scale: isLegendary ? 3.8 : 2.8, opacity: 0 }}
            transition={{ duration: 0.62, ease: 'easeOut' }}
          />
        )}

        {/* Top half — tier-coloured. This is the tell. */}
        <motion.div
          className="absolute inset-x-0 top-0 h-[29px] overflow-hidden rounded-t-full border-2 border-b-0"
          style={{
            borderColor: `color-mix(in oklab, ${color} 70%, white)`,
            background: `linear-gradient(150deg, color-mix(in oklab, ${color} 55%, white), ${color} 70%)`,
          }}
          animate={opening ? { y: -52, rotate: -26, opacity: 0 } : { y: 0, rotate: 0, opacity: 1 }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* Specular highlight — reads as plastic rather than as a flat swatch. */}
          <div
            className="absolute left-[9px] top-[6px] h-[9px] w-[16px] -rotate-[24deg] rounded-full"
            style={{ background: 'rgb(255 255 255 / 0.75)', filter: 'blur(1.5px)' }}
          />
        </motion.div>

        {/* Bottom half — frosted, so the coloured cap is the thing you read. */}
        <motion.div
          className="absolute inset-x-0 bottom-0 h-[29px] rounded-b-full border-2 border-t-0"
          style={{
            borderColor: 'color-mix(in oklab, var(--color-text) 45%, transparent)',
            background:
              'linear-gradient(180deg, color-mix(in oklab, var(--color-text) 82%, transparent), color-mix(in oklab, var(--color-text-secondary) 55%, transparent))',
          }}
          animate={opening ? { y: 34, opacity: 0 } : { y: 0, opacity: 1 }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        />

        {/* Seam. Splits with the halves. */}
        <motion.div
          className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full"
          style={{ background: 'rgb(0 0 0 / 0.35)' }}
          animate={{ opacity: opening ? 0 : 1 }}
          transition={{ duration: 0.2 }}
        />
      </motion.div>

      {/* ------------------------------------------------- the game emerging */}
      {/* z-20, above the machine: the cover rises *out* of the capsule toward
          the viewer, so the reveal reads as caused by the machine rather than
          as a scene cut. Without this the capsule split and then simply
          evaporated, leaving an empty tray at the most important moment. */}
      {opening && (
        <motion.div
          className="absolute left-1/2 top-[286px] z-20 w-[84px] -translate-x-1/2"
          initial={{ opacity: 0, scale: 0.3, y: 18 }}
          animate={{ opacity: 1, scale: 1, y: -22 }}
          transition={{ duration: 0.5, delay: 0.12, ease: [0.34, 1.56, 0.64, 1] }}
        >
          <div
            className="overflow-hidden rounded-card border-2"
            style={{
              borderColor: `color-mix(in oklab, ${color} 65%, transparent)`,
              boxShadow: `0 0 34px -4px ${color}, 0 18px 30px -14px rgb(0 0 0 / 0.9)`,
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
          className="relative mx-auto h-[150px] w-[196px] overflow-hidden rounded-t-[98px] border-2 border-hairline"
          style={{
            background:
              'radial-gradient(ellipse 70% 60% at 32% 22%, rgb(124 240 255 / 0.16), transparent 62%), linear-gradient(165deg, var(--color-surface-2), var(--color-abyss))',
          }}
        >
          {DOME_CAPSULES.map((c, i) => (
            <motion.span
              key={i}
              className="absolute h-[26px] w-[26px] rounded-full border"
              style={{
                left: c.x,
                top: c.y,
                borderColor: `color-mix(in oklab, ${TIER_COLORS[c.tier]} 60%, white)`,
                background: `linear-gradient(160deg, color-mix(in oklab, ${TIER_COLORS[c.tier]} 45%, white), ${TIER_COLORS[c.tier]})`,
                opacity: 0.85,
              }}
              // Jostle only while the crank turns — an idle machine is still.
              animate={cranking ? { y: [0, -4, 1, 0], rotate: [0, 8, -6, 0] } : { y: 0, rotate: 0 }}
              transition={
                cranking
                  ? { duration: 0.42, repeat: 1, delay: i * 0.035, ease: 'easeInOut' }
                  : { duration: 0.2 }
              }
            />
          ))}

          {/* Glass sheen over the capsules. */}
          <div
            className="pointer-events-none absolute inset-0 rounded-t-[98px]"
            style={{
              background:
                'linear-gradient(118deg, rgb(255 255 255 / 0.14) 0%, transparent 34%, transparent 66%, rgb(255 255 255 / 0.06) 100%)',
            }}
          />
        </div>

        {/* Body */}
        <div
          className="relative mx-auto -mt-[2px] h-[144px] w-[220px] rounded-b-[24px] border-2 border-hairline"
          style={{
            background: 'linear-gradient(180deg, var(--color-surface-3), var(--color-surface))',
          }}
        >
          {/* Collar where the dome meets the body. */}
          <div className="absolute inset-x-0 top-0 h-[10px] border-b border-hairline bg-surface-2" />

          {/* Brand plate */}
          <div
            className="absolute left-1/2 top-[20px] -translate-x-1/2 rounded-chip border px-3 py-[3px] font-display text-[10px] font-bold tracking-[0.22em]"
            style={{
              borderColor: 'color-mix(in oklab, var(--color-neon-cyan) 40%, transparent)',
              color: 'var(--color-neon-cyan)',
              background: 'color-mix(in oklab, var(--color-neon-cyan) 8%, transparent)',
            }}
          >
            LUDEX
          </div>

          {/* Crank knob */}
          <motion.div
            className="absolute left-1/2 top-[52px] h-[46px] w-[46px] -translate-x-1/2 rounded-full border-2"
            style={{
              borderColor: 'color-mix(in oklab, var(--color-neon-magenta) 55%, transparent)',
              background:
                'radial-gradient(circle at 34% 30%, var(--color-neon-magenta-soft), var(--color-neon-magenta) 55%, var(--color-neon-magenta-deep))',
              boxShadow: '0 0 22px -6px var(--color-neon-magenta)',
            }}
            animate={{ rotate: cranking ? 0 : 210 }}
            transition={{ duration: STAGE_MS.crank / 1000, ease: [0.34, 1.56, 0.64, 1] }}
          >
            {/* Handle slot, so the rotation is legible. */}
            <div className="absolute left-1/2 top-1/2 h-[4px] w-[26px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-void/70" />
          </motion.div>

          {/* Chute — the capsule falls out of here. */}
          <div
            className="absolute bottom-0 left-1/2 h-[38px] w-[74px] -translate-x-1/2 rounded-t-[10px] border-2 border-b-0 border-hairline"
            style={{
              background: 'linear-gradient(180deg, var(--color-void), #000)',
              boxShadow: 'inset 0 6px 12px -4px rgb(0 0 0 / 0.9)',
            }}
          />
        </div>
      </motion.div>
    </div>
  );
}
