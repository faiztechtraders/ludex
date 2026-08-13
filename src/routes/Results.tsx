import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useListPosition } from '@/lib/useListPosition.ts';
import { GAMES } from '@/data/games/index.ts';
import { VIBE_META, positionLabel } from '@/data/vibes.ts';
import { VIBE_AXES } from '@/data/schema.ts';
import { recommend } from '@/engine/index.ts';
import { useLudexStore } from '@/store/useLudexStore.ts';
import { GameCard, GameGrid } from '@/components/game/GameCard.tsx';
import { Button, ButtonLink } from '@/components/ui/Button.tsx';
import { platformSummary } from '@/components/platform/PlatformPicker.tsx';
import { Chip } from '@/components/ui/Chip.tsx';

/**
 * Twelve to start — a full screen without an overwhelming wall — then 24 per
 * page after that. At ~500 eligible games, paging 12 at a time meant forty
 * clicks to reach the end.
 */
const FIRST_PAGE = 12;
const NEXT_PAGE = 24;

/**
 * Ranked recommendations from the current taste profile.
 *
 * Also the honest-empty-state page: if a user answered nothing at all, this
 * says so plainly rather than presenting rating-ordered results as if they
 * were personalized.
 */
export default function Results() {
  const platforms = useLudexStore((s) => s.platforms);
  const vibes = useLudexStore((s) => s.vibes);
  const dismissed = useLudexStore((s) => s.dismissed);
  // Survives navigation: opening a game and pressing Back returns you to the
  // row you clicked, with the same number of rows revealed. See useListPosition.
  const { limit, showMore } = useListPosition('results', FIRST_PAGE);

  const answeredAxes = VIBE_AXES.filter((axis) => vibes[axis] !== undefined);
  const hasProfile = answeredAxes.length > 0;

  // Rank the whole library once and slice for display. The engine composes a
  // prefix-stable ordering, so paging only ever appends — the rows already on
  // screen never move. Recomputing per page would also mean re-scoring 500+
  // games on every click.
  const ranked = useMemo(
    () => recommend(GAMES, { platforms, vibes, seen: dismissed, limit: GAMES.length }),
    [platforms, vibes, dismissed],
  );

  const results = useMemo(() => ranked.slice(0, limit), [ranked, limit]);
  const total = ranked.length;

  return (
    <div>
      <header className="mb-8">
        <p className="font-display text-xs font-semibold uppercase tracking-[0.18em] text-neon-cyan">
          Your matches
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold text-text lg:text-4xl">
          {hasProfile ? 'Built for the vibe you described' : 'The best of the library'}
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-text-secondary">
          {hasProfile ? (
            <>
              Ranked across {total} games on <span className="text-text">{platformSummary(platforms)}</span>
              , with a deliberate mix of blockbusters, indie darlings and hidden gems.
            </>
          ) : (
            <>
              You have not answered any Vibe Check questions yet, so this is simply the
              highest-rated part of the library on{' '}
              <span className="text-text">{platformSummary(platforms)}</span> — not a personalized
              list.
            </>
          )}
        </p>

        {/* -- taste profile summary -- */}
        {hasProfile && (
          <div className="mt-5 flex flex-wrap items-center gap-2">
            {answeredAxes.map((axis) => (
              <Chip key={axis} size="sm">
                <span className="text-text-muted">{VIBE_META[axis].label}:</span>
                <span className="ml-1 text-text">{positionLabel(axis, vibes[axis]!)}</span>
              </Chip>
            ))}
            <Link
              to="/vibe-check"
              className="ml-1 text-xs text-neon-cyan underline underline-offset-4 hover:text-neon-cyan-soft"
            >
              Adjust
            </Link>
          </div>
        )}

        {!hasProfile && (
          <div className="mt-5">
            <ButtonLink to="/vibe-check" size="md">
              Take the Vibe Check →
            </ButtonLink>
          </div>
        )}
      </header>

      {results.length === 0 ? (
        <EmptyResults />
      ) : (
        <>
          <GameGrid>
            {results.map((r, i) => (
              <GameCard
                key={r.game.slug}
                game={r.game}
                score={hasProfile ? r.score : undefined}
                reasons={r.reasons}
                eager={i < 4}
              />
            ))}
          </GameGrid>

          {limit < total && (
            <div className="mt-10 flex justify-center">
              <Button variant="secondary" size="lg" onClick={() => showMore(NEXT_PAGE)}>
                Show more ({total - limit} left)
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function EmptyResults() {
  const setPlatforms = useLudexStore((s) => s.setPlatforms);
  return (
    <div className="panel flex flex-col items-center gap-4 p-12 text-center">
      <span className="text-4xl" aria-hidden="true">
        🕳️
      </span>
      <h2 className="font-display text-xl font-semibold text-text">Nothing matches that</h2>
      <p className="max-w-md text-sm text-text-secondary">
        Every game in the library was filtered out. This almost always means the platform
        selection is narrower than intended.
      </p>
      <div className="flex gap-3">
        <Button variant="secondary" onClick={() => setPlatforms([])}>
          Show all platforms
        </Button>
        <ButtonLink to="/vibe-check" variant="primary">
          Redo the Vibe Check
        </ButtonLink>
      </div>
    </div>
  );
}
