import type { Game, MatchReason } from '@/data/schema.ts';
import { VIBE_META } from '@/data/vibes.ts';

/**
 * The "why it fits your vibe" panel.
 *
 * When the engine produced no strong reasons — because the user skipped the
 * quiz, or because the match is real but unremarkable — this falls back to the
 * game's editorial hooks and says so. Inventing a personalized reason that
 * does not exist is the fastest way to lose a user's trust in every other
 * recommendation on the page.
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

  return (
    <section
      className="rounded-panel border p-5"
      style={{
        borderColor: `color-mix(in oklab, ${accent} 34%, var(--color-hairline))`,
        backgroundColor: `color-mix(in oklab, ${accent} 7%, var(--color-surface))`,
      }}
    >
      <h2 className="font-display text-sm font-semibold uppercase tracking-[0.16em]" style={{ color: accent }}>
        {personalized ? 'Why it fits your vibe' : 'Why people love it'}
      </h2>

      <ul className="mt-3 space-y-2.5">
        {personalized
          ? reasons.map((reason) => (
              <li key={reason.axis} className="flex gap-3 text-sm leading-relaxed text-text">
                <span
                  className="mt-0.5 shrink-0 rounded-chip border px-2 py-0.5 font-display text-[10px] font-semibold uppercase tracking-[0.1em]"
                  style={{ color: accent, borderColor: `color-mix(in oklab, ${accent} 45%, transparent)` }}
                >
                  {VIBE_META[reason.axis].label}
                </span>
                <span>{reason.text}</span>
              </li>
            ))
          : game.hooks.map((hook) => (
              <li key={hook} className="flex gap-2.5 text-sm leading-relaxed text-text">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full" style={{ background: accent }} />
                <span>{hook}</span>
              </li>
            ))}
      </ul>

      {!personalized && (
        <p className="mt-4 border-t border-hairline pt-3 text-xs text-text-muted">
          These are editorial notes, not a personalized match — take the{' '}
          <a href="/vibe-check" className="text-neon-cyan underline underline-offset-4">
            Vibe Check
          </a>{' '}
          and this panel will explain why <em>you</em> specifically were shown it.
        </p>
      )}
    </section>
  );
}
