import { useEffect, useRef, useState } from 'react';
import type { Game } from '@/data/schema.ts';
import { GameCover } from '@/components/game/GameCover.tsx';
import { TIER_COLORS } from '@/components/game/TierBadge.tsx';

/**
 * The gacha reel.
 *
 * A vertical strip of covers that spins and decelerates onto the winner. The
 * winner is planted at a fixed index, so the landing position is deterministic
 * and the whole animation is one CSS transform — no per-frame work.
 *
 * Under reduced motion the caller skips this component entirely and shows the
 * result directly. A 1ms reel communicates nothing and looks broken.
 */

const REEL_LENGTH = 28;
const TARGET_INDEX = REEL_LENGTH - 3;
const ITEM_HEIGHT = 168;
const SPIN_MS = 3400;

export function GachaReel({
  pool,
  winner,
  spinning,
  onSettled,
}: {
  pool: Game[];
  winner: Game;
  spinning: boolean;
  onSettled: () => void;
}) {
  const [strip, setStrip] = useState<Game[]>([]);
  /**
   * The transform has to start at rest and only then move to the target,
   * otherwise the element mounts already at its final position, no transition
   * runs, `transitionend` never fires and the reel hangs forever. Two rAFs
   * guarantee the browser has painted the resting frame first.
   */
  const [running, setRunning] = useState(false);
  const settledRef = useRef(false);

  const settle = () => {
    if (settledRef.current) return;
    settledRef.current = true;
    onSettled();
  };
  const settleRef = useRef(settle);
  settleRef.current = settle;

  useEffect(() => {
    if (!spinning) {
      setRunning(false);
      return;
    }

    settledRef.current = false;
    setRunning(false);
    setStrip(
      Array.from({ length: REEL_LENGTH }, (_, i) =>
        i === TARGET_INDEX ? winner : pool[(i * 7 + 3) % pool.length],
      ),
    );

    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setRunning(true));
    });

    // Belt and braces: `transitionend` is not delivered if the tab is
    // backgrounded mid-spin, which would strand the user on a frozen reel.
    const failsafe = window.setTimeout(() => settleRef.current(), SPIN_MS + 900);

    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
      window.clearTimeout(failsafe);
    };
  }, [spinning, winner, pool]);

  if (strip.length === 0) return null;

  return (
    <div
      className="relative mx-auto overflow-hidden rounded-panel border border-hairline bg-abyss"
      style={{ height: ITEM_HEIGHT * 3, width: 148 }}
      aria-hidden="true"
    >
      <div
        className="flex flex-col will-change-transform"
        style={{
          transform: `translateY(${(running ? -(TARGET_INDEX * ITEM_HEIGHT) : 0) + ITEM_HEIGHT}px)`,
          // Long ease-out: quick at the start, a slow crawl into the final slot.
          transition: running ? `transform ${SPIN_MS}ms cubic-bezier(0.12, 0.72, 0.16, 1)` : 'none',
        }}
        onTransitionEnd={(e) => {
          if (e.propertyName === 'transform') settle();
        }}
      >
        {strip.map((game, i) => (
          <div
            key={`${game.slug}-${i}`}
            className="shrink-0 border-b border-hairline/40 p-2"
            style={{ height: ITEM_HEIGHT }}
          >
            <div className="h-full w-full overflow-hidden rounded-card">
              <GameCover game={game} />
            </div>
          </div>
        ))}
      </div>

      {/* Selection window — the slot the winner lands in. */}
      <div
        className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 border-y-2"
        style={{
          height: ITEM_HEIGHT,
          borderColor: TIER_COLORS[winner.tier],
          boxShadow: `0 0 24px -6px ${TIER_COLORS[winner.tier]}, inset 0 0 40px -18px ${TIER_COLORS[winner.tier]}`,
        }}
      />

      {/* Fade the strip at the edges so it reads as continuous. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-abyss to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-abyss to-transparent" />
    </div>
  );
}
