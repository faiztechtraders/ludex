import { Link } from 'react-router-dom';
import type { Game, ScoredGame } from '@/data/schema.ts';
import { useLudexStore } from '@/store/useLudexStore.ts';
import { PlatformBadgeRow } from '@/components/platform/PlatformBadge.tsx';
import { GameCover } from './GameCover.tsx';
import { TierBadge } from './TierBadge.tsx';
import { MatchRing } from './MatchRing.tsx';
import { priceFor } from '@/lib/price.ts';
import { SaveButton } from './SaveButton.tsx';

/**
 * The primary game tile.
 *
 * On hover the *cover* scales inside its overflow-hidden frame while the card
 * frame itself only lifts. Scaling the frame blurs the neon glow and makes the
 * grid feel rubbery, so the two are deliberately separated.
 */
export function GameCard({
  game,
  score,
  reasons,
  eager = false,
}: {
  game: Game;
  score?: number;
  reasons?: ScoredGame['reasons'];
  eager?: boolean;
}) {
  const accent = game.art.accent;
  const topReason = reasons?.[0]?.text;
  const discount = priceFor(game.slug)?.discount ?? 0;

  return (
    <article
      className="group relative flex flex-col overflow-hidden rounded-card border border-hairline bg-surface transition-all duration-[--dur-base] ease-[--ease-arrival] hover:-translate-y-1 focus-within:-translate-y-1"
      style={{ ['--card-accent' as string]: accent }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = accent;
        e.currentTarget.style.boxShadow = `0 0 0 1px ${accent}55, 0 12px 40px -16px ${accent}`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = '';
        e.currentTarget.style.boxShadow = '';
      }}
    >
      <Link
        to={`/game/${game.slug}`}
        className="flex flex-1 flex-col outline-none"
        aria-label={`${game.title} — view details`}
      >
        {/* 2:3 matches Steam's library_600x900 box art, the dominant art
            source, so covers fill the frame instead of being cropped. */}
        <div className="relative aspect-[2/3] overflow-hidden bg-abyss">
          <div className="h-full w-full transition-transform duration-500 ease-[--ease-arrival] group-hover:scale-[1.05]">
            <GameCover game={game} eager={eager} />
          </div>

          {/* Bottom scrim so the title stays legible over any artwork. */}
          <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-surface via-surface/70 to-transparent" />

          {score !== undefined && (
            <div className="absolute left-2 top-2">
              <MatchRing score={score} size={38} />
            </div>
          )}

          <div className="absolute right-2 top-2">
            <TierBadge tier={game.tier} overlay />
          </div>

          {/* Only the discount, and only when there is one. A price on every
              card would be noise; "this is on sale right now" is the single
              thing worth interrupting a browse for. */}
          {discount > 0 && (
            <div
              className="absolute bottom-2 left-2 rounded-chip px-1.5 py-0.5 font-display text-[11px] font-bold text-text-inverse"
              style={{ background: 'var(--color-neon-lime)' }}
            >
              −{discount}%
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-2 p-3">
          <h3 className="font-display text-[15px] font-semibold leading-snug text-text">
            {game.title}
          </h3>

          <div className="flex items-center gap-2 text-[11px] text-text-muted">
            <span>{game.year}</span>
            <span aria-hidden="true">·</span>
            <span className="truncate">{game.developer}</span>
          </div>

          <PlatformBadgeRow game={game} />

          {topReason ? (
            <p
              className="mt-auto line-clamp-2 border-l-2 pl-2 text-[11px] leading-relaxed text-text-secondary"
              style={{ borderColor: accent }}
            >
              {topReason}
            </p>
          ) : (
            <p className="mt-auto line-clamp-2 text-[11px] leading-relaxed text-text-muted">
              {game.blurb}
            </p>
          )}

          <div className="flex items-center gap-2 text-[11px] text-text-muted">
            <span title="Approximate hours to finish">≈{game.hoursToBeat}h</span>
            <span aria-hidden="true">·</span>
            <span title="Critical consensus">{game.rating}/100</span>
          </div>
        </div>
      </Link>

      <div className="absolute bottom-2 right-2">
        <SaveButton slug={game.slug} accent={accent} />
      </div>
    </article>
  );
}

/** Responsive grid wrapper, so every surface lays cards out identically. */
export function GameGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 lg:gap-5">{children}</div>
  );
}

/** Loading placeholder matching the card's aspect ratio, to avoid layout shift. */
export function GameCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-card border border-hairline bg-surface">
      <div className="aspect-[3/4] shimmer" />
      <div className="space-y-2 p-3">
        <div className="h-4 w-3/4 rounded shimmer" />
        <div className="h-3 w-1/2 rounded shimmer" />
      </div>
    </div>
  );
}

/** Small helper used by Collection and Similar rows. */
export function useIsSaved(slug: string): boolean {
  return useLudexStore((s) => s.saved.includes(slug));
}
