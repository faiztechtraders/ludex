import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { GAMES, getGame } from '@/data/games/index.ts';
import { shotUrls } from '@/data/art.ts';
import { VIBE_META_LIST } from '@/data/vibes.ts';
import { TIER_LABELS } from '@/data/schema.ts';
import { scoreGame, similarTo } from '@/engine/index.ts';
import { useLudexStore } from '@/store/useLudexStore.ts';
import { GameCover } from '@/components/game/GameCover.tsx';
import { GameHero } from '@/components/game/GameHero.tsx';
import { GameCard, GameGrid } from '@/components/game/GameCard.tsx';
import { TierBadge } from '@/components/game/TierBadge.tsx';
import { MatchRing } from '@/components/game/MatchRing.tsx';
import { SaveButton } from '@/components/game/SaveButton.tsx';
import { WhyItFits } from '@/components/game/WhyItFits.tsx';
import { PlatformBadgeRow } from '@/components/platform/PlatformBadge.tsx';
import { ButtonLink } from '@/components/ui/Button.tsx';
import { Chip } from '@/components/ui/Chip.tsx';

export default function GameDetail() {
  const { slug } = useParams<{ slug: string }>();
  const game = getGame(slug);

  const platforms = useLudexStore((s) => s.platforms);
  const vibes = useLudexStore((s) => s.vibes);
  const markSeen = useLudexStore((s) => s.markSeen);

  useEffect(() => {
    if (game) markSeen(game.slug);
  }, [game, markSeen]);

  const scored = useMemo(() => (game ? scoreGame(game, { vibes }) : null), [game, vibes]);
  const related = useMemo(
    () => (game ? similarTo(game, GAMES, 4, platforms) : []),
    [game, platforms],
  );

  if (!game) return <NotFoundGame />;

  const accent = game.art.accent;
  const hasProfile = Object.keys(vibes).length > 0;
  const shots = shotUrls(game);

  return (
    <article>
      {/* ------------------------------------------------------------- hero */}
      <div className="relative -mx-5 -mt-10 mb-8 overflow-hidden lg:-mx-8 lg:-mt-16">
        {/* Taller than it needs to be for the title, because the lower third is
            spent on the fade — a short band left almost no image visible. */}
        <div className="relative h-56 sm:h-72 lg:h-[22rem]">
          <GameHero game={game} />
          {/* Light scrim only: GameHero's mask does the blending into the page,
              so this just keeps the back link and title legible over bright art. */}
          <div className="absolute inset-0 bg-gradient-to-b from-void/70 via-transparent to-transparent" />
          <div
            className="absolute inset-0 opacity-30"
            style={{
              background:
                'repeating-linear-gradient(to bottom, rgb(255 255 255 / 0.04) 0 1px, transparent 1px 3px)',
              maskImage: 'linear-gradient(to bottom, black 45%, transparent 100%)',
            }}
          />
        </div>

        {/* Back link sits over the hero band so it never pushes the title down. */}
        <div className="absolute inset-x-0 top-4 mx-auto max-w-[--width-content] px-5 lg:px-8">
          <button
            type="button"
            onClick={() => window.history.back()}
            className="inline-flex items-center gap-1.5 rounded-chip border border-hairline bg-void/60 px-3 py-1.5 text-xs text-text-secondary backdrop-blur transition-colors hover:border-neon-cyan hover:text-neon-cyan"
          >
            ← Back
          </button>
        </div>

        <div className="mx-auto max-w-[--width-content] px-5 lg:px-8">
          <div className="-mt-24 flex flex-col gap-5 sm:-mt-28 sm:flex-row sm:items-end">
            <div
              className="w-32 shrink-0 overflow-hidden rounded-card border shadow-2xl sm:w-44"
              style={{ borderColor: `color-mix(in oklab, ${accent} 45%, transparent)` }}
            >
              <div className="aspect-[2/3]">
                <GameCover game={game} eager />
              </div>
            </div>

            <div className="flex-1 pb-1">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <TierBadge tier={game.tier} />
                <span className="text-xs text-text-muted">
                  {game.year} · {game.developer}
                  {game.publisher && game.publisher !== game.developer && ` · ${game.publisher}`}
                </span>
              </div>

              <h1 className="font-display text-3xl font-bold leading-tight text-text lg:text-5xl">
                {game.title}
              </h1>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <PlatformBadgeRow game={game} showLabels />
                <SaveButton slug={game.slug} accent={accent} size="md" />
              </div>
            </div>

            {hasProfile && scored && (
              <div className="flex shrink-0 flex-col items-center gap-1 pb-2">
                <MatchRing score={scored.score} size={64} />
                <span className="font-display text-[10px] uppercase tracking-[0.16em] text-text-muted">
                  Match
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------ body */}
      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="space-y-8">
          <p className="text-lg leading-relaxed text-text-secondary">{game.blurb}</p>

          {scored && <WhyItFits game={game} reasons={scored.reasons} accent={accent} />}

          {/* Vibe fingerprint — where this game actually sits on each axis. */}
          <section>
            <h2 className="mb-4 font-display text-sm font-semibold uppercase tracking-[0.16em] text-text-muted">
              Vibe fingerprint
            </h2>
            <dl className="space-y-3">
              {VIBE_META_LIST.map((meta) => {
                const value = game.vibes[meta.axis];
                const userValue = vibes[meta.axis];
                return (
                  <div key={meta.axis} className="grid grid-cols-[88px_1fr] items-center gap-3">
                    <dt className="text-xs font-medium text-text-secondary">{meta.label}</dt>
                    <dd>
                      <div className="relative h-2 overflow-hidden rounded-chip bg-surface">
                        {/* Floor the width so a genuine 0 still renders as a
                            visible nub. A bar with nothing in it reads as
                            missing data rather than as "none of this". */}
                        <div
                          className="h-full rounded-chip"
                          style={{
                            width: `max(${value * 100}%, 6px)`,
                            background: accent,
                            opacity: value === 0 ? 0.45 : 1,
                          }}
                        />
                        {/* The user's own answer, marked on the same scale. */}
                        {userValue !== undefined && (
                          <span
                            className="absolute top-1/2 h-4 w-0.5 -translate-y-1/2 rounded bg-neon-cyan"
                            style={{ left: `calc(${userValue * 100}% - 1px)` }}
                            title={`You asked for ${Math.round(userValue * 100)}%`}
                          />
                        )}
                      </div>
                      <div className="mt-1 flex justify-between text-[10px] text-text-muted">
                        <span>{meta.low}</span>
                        <span>{meta.high}</span>
                      </div>
                    </dd>
                  </div>
                );
              })}
            </dl>
            {hasProfile && (
              <p className="mt-3 text-xs text-text-muted">
                <span className="inline-block h-2.5 w-0.5 translate-y-0.5 bg-neon-cyan" /> marks
                what you asked for.
              </p>
            )}
          </section>

          {/* Screenshots, when art has been cached. */}
          {shots.length > 0 && (
            <section>
              <h2 className="mb-4 font-display text-sm font-semibold uppercase tracking-[0.16em] text-text-muted">
                Screenshots
              </h2>
              <div className="grid grid-cols-2 gap-3">
                {shots.slice(0, 4).map((shot) => (
                  <Screenshot key={shot} src={shot} />
                ))}
              </div>
            </section>
          )}
        </div>

        {/* ---------------------------------------------------------- facts */}
        <aside className="space-y-6">
          <div className="panel p-5">
            <h2 className="mb-4 font-display text-sm font-semibold uppercase tracking-[0.16em] text-text-muted">
              At a glance
            </h2>
            <dl className="space-y-3 text-sm">
              <Fact label="Time to beat" value={`≈ ${game.hoursToBeat} hours`} />
              <Fact label="Critical score" value={`${game.rating} / 100`} />
              <Fact label="Tier" value={TIER_LABELS[game.tier]} />
              <Fact label="Art style" value={game.artStyle} />
              <Fact label="Released" value={String(game.year)} />
            </dl>
          </div>

          <div className="panel p-5">
            <h2 className="mb-3 font-display text-sm font-semibold uppercase tracking-[0.16em] text-text-muted">
              Genres & tags
            </h2>
            <div className="flex flex-wrap gap-1.5">
              {game.genres.map((genre) => (
                <Chip key={genre} size="sm" selected accent={accent}>
                  {genre}
                </Chip>
              ))}
              {game.tags.map((tag) => (
                <Chip key={tag} size="sm">
                  {tag}
                </Chip>
              ))}
            </div>
          </div>

          <div className="panel p-5">
            <h2 className="mb-3 font-display text-sm font-semibold uppercase tracking-[0.16em] text-text-muted">
              What it is
            </h2>
            <ul className="space-y-2">
              {game.hooks.map((hook) => (
                <li key={hook} className="flex gap-2.5 text-sm leading-relaxed text-text-secondary">
                  <span
                    className="mt-1.5 h-1 w-1 shrink-0 rounded-full"
                    style={{ background: accent }}
                  />
                  {hook}
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>

      {/* --------------------------------------------------------- similar */}
      {related.length > 0 && (
        <section className="mt-16">
          <h2 className="mb-6 font-display text-2xl font-bold text-text">
            If you like this, try
          </h2>
          <GameGrid>
            {related.map((g) => (
              <GameCard key={g.slug} game={g} />
            ))}
          </GameGrid>
        </section>
      )}
    </article>
  );
}

/**
 * A gallery image that removes itself if the URL 404s, rather than leaving a
 * broken-image placeholder in the grid. Cached art URLs can rot, and a missing
 * screenshot should simply not be there.
 */
function Screenshot({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
      className="aspect-video w-full rounded-card border border-hairline object-cover"
    />
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-text-muted">{label}</dt>
      <dd className="text-right font-medium capitalize text-text">{value}</dd>
    </div>
  );
}

function NotFoundGame() {
  return (
    <div className="panel mx-auto max-w-lg p-12 text-center">
      <h1 className="font-display text-2xl font-bold text-text">No such game</h1>
      <p className="mt-3 text-sm text-text-secondary">
        That link does not point to anything in the Ludex library. It may have been renamed.
      </p>
      <div className="mt-6 flex justify-center gap-3">
        <ButtonLink to="/browse" variant="primary">
          Browse the library
        </ButtonLink>
        <Link
          to="/"
          className="inline-flex items-center px-4 text-sm text-text-secondary hover:text-text"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}
