import type { Game, MatchReason } from '@/data/schema.ts';
import { VIBE_META, characterise } from '@/data/vibes.ts';

/**
 * The "why it fits your vibe" panel.
 *
 * One panel, one job — *this is what this game is like* — at whichever level of
 * personalisation the data supports:
 *
 *  - with quiz answers, the axes that actually drove the match;
 *  - without them, the same axes read off the game's own vibe vector.
 *
 * It used to fall back to `game.hooks`, which printed the identical three
 * bullets already shown in the sidebar's "What it is" panel — the same array,
 * twice on one page. The hooks are editorial feature bullets and belong there;
 * this panel is about fit, and now says something about fit either way.
 *
 * What it must never do is invent a personalized reason that does not exist.
 * The impersonal copy is deliberately impersonal, and the footnote says so.
 */
export function WhyItFits({
  game,
  reasons,
  accent,
}: {
  game: Game;
  reasons: MatchReason[];
  accent: string;
}) {
  const personalized = reasons.length > 0;
  // Read off the game's own vector. A game sitting near 0.5 on everything is
  // genuinely unremarkable and yields nothing — the panel then hides rather
  // than padding itself out.
  const traits = personalized ? [] : characterise(game.vibes);
  if (!personalized && traits.length === 0) return null;

  return (
    <section
      className="rounded-panel border p-5"
      style={{
        borderColor: `color-mix(in oklab, ${accent} 34%, var(--color-hairline))`,
        backgroundColor: `color-mix(in oklab, ${accent} 7%, var(--color-surface))`,
      }}
    >
      <h2 className="font-display text-sm font-semibold uppercase tracking-[0.16em]" style={{ color: accent }}>
        {personalized ? 'Why it fits your vibe' : "What it's like"}
      </h2>

      <ul className="mt-3 space-y-2.5">
        {personalized
          ? reasons.map((reason) => (
              // `items-start` is load-bearing: a flex row defaults to
              // `stretch`, which pulls the axis chip to the full height of the
              // reason beside it. That looks fine while the reason is one line
              // and turns the chip into a circle the moment it wraps to two.
              <li key={reason.axis} className="flex items-start gap-3 text-sm leading-relaxed text-text">
                <span
                  className="mt-0.5 shrink-0 rounded-chip border px-2 py-0.5 font-display text-[10px] font-semibold uppercase tracking-[0.1em]"
                  style={{ color: accent, borderColor: `color-mix(in oklab, ${accent} 45%, transparent)` }}
                >
                  {VIBE_META[reason.axis].label}
                </span>
                <span>{reason.text}</span>
              </li>
            ))
          : traits.map((trait) => (
              // Same row shape as the personalized case on purpose — it is the
              // same statement, just not yet addressed to anyone.
              <li key={trait.axis} className="flex items-start gap-3 text-sm leading-relaxed text-text">
                <span
                  className="mt-0.5 shrink-0 rounded-chip border px-2 py-0.5 font-display text-[10px] font-semibold uppercase tracking-[0.1em]"
                  style={{ color: accent, borderColor: `color-mix(in oklab, ${accent} 45%, transparent)` }}
                >
                  {trait.label}
                </span>
                <span>{trait.text}</span>
              </li>
            ))}
      </ul>

      {!personalized && (
        <p className="mt-4 border-t border-hairline pt-3 text-xs text-text-muted">
          That is the game itself, not a personalized match — take the{' '}
          <a href="/vibe-check" className="text-neon-cyan underline underline-offset-4">
            Vibe Check
          </a>{' '}
          and this panel will explain why <em>you</em> specifically were shown it.
        </p>
      )}
    </section>
  );
}
