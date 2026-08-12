import { GAMES_BY_SLUG } from '@/data/games/index.ts';
import { useLudexStore, useLevel, XP } from '@/store/useLudexStore.ts';
import { GameCard, GameGrid } from '@/components/game/GameCard.tsx';
import { Button, ButtonLink } from '@/components/ui/Button.tsx';

/** Saved games plus the progression readout. */
export default function Collection() {
  const saved = useLudexStore((s) => s.saved);
  const seen = useLudexStore((s) => s.seen);
  const badges = useLudexStore((s) => s.badges);
  const streak = useLudexStore((s) => s.streak);
  const xp = useLudexStore((s) => s.xp);
  const resetEverything = useLudexStore((s) => s.resetEverything);
  const { level, into, needed } = useLevel();

  const games = saved.map((slug) => GAMES_BY_SLUG.get(slug)).filter((g) => g !== undefined);

  return (
    <div className="space-y-12">
      <header>
        <p className="font-display text-xs font-semibold uppercase tracking-[0.18em] text-neon-cyan">
          Your Ludex
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold text-text lg:text-4xl">Collection</h1>
        <p className="mt-2 text-sm text-text-secondary">
          Everything you have saved, plus what you have unlocked along the way. Stored in this
          browser only.
        </p>
      </header>

      {/* ------------------------------------------------------- progression */}
      <section className="panel p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-baseline gap-2">
              <span className="brand-gradient-text font-display text-4xl font-bold">
                LV {level}
              </span>
              <span className="text-sm text-text-muted">{xp} XP total</span>
            </div>
            <p className="mt-1 text-xs text-text-muted">
              {needed - into} XP to level {level + 1}
            </p>
          </div>

          <div className="flex gap-6 text-center">
            <Stat value={saved.length} label="Saved" />
            <Stat value={seen.length} label="Explored" />
            <Stat value={streak} label="Day streak" accent="var(--color-neon-amber)" />
            <Stat value={badges.length} label="Badges" />
          </div>
        </div>

        <div className="mt-5 h-2 overflow-hidden rounded-chip bg-surface">
          <div
            className="brand-gradient h-full rounded-chip transition-[width] duration-[--dur-slow] ease-[--ease-arrival]"
            style={{ width: `${Math.max((into / needed) * 100, 2)}%` }}
          />
        </div>

        <p className="mt-3 text-[11px] text-text-muted">
          XP comes from answering questions (+{XP.quizStep}), finishing the Vibe Check (+
          {XP.quizComplete}), spinning (+{XP.spin}), saving a game (+{XP.save}) and opening
          something new (+{XP.viewDetail}).
        </p>
      </section>

      {/* ------------------------------------------------------------ badges */}
      {badges.length > 0 && (
        <section>
          <h2 className="mb-4 font-display text-xl font-bold text-text">Badges</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {badges.map((badge) => (
              <div
                key={badge.id}
                className="flex items-start gap-3 rounded-panel border border-neon-amber/30 bg-neon-amber/5 p-4"
              >
                <span className="text-2xl" aria-hidden="true">
                  🏅
                </span>
                <div>
                  <h3 className="font-display text-sm font-semibold text-neon-amber">
                    {badge.label}
                  </h3>
                  <p className="mt-0.5 text-xs leading-relaxed text-text-secondary">
                    {badge.description}
                  </p>
                  <p className="mt-1 text-[10px] text-text-muted">Earned {badge.earnedOn}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ------------------------------------------------------- saved games */}
      <section>
        <h2 className="mb-4 font-display text-xl font-bold text-text">
          Saved games {games.length > 0 && <span className="text-text-muted">({games.length})</span>}
        </h2>

        {games.length === 0 ? (
          <div className="panel flex flex-col items-center gap-4 p-12 text-center">
            <span className="text-4xl" aria-hidden="true">
              🔖
            </span>
            <h3 className="font-display text-lg font-semibold text-text">Nothing saved yet</h3>
            <p className="max-w-sm text-sm text-text-secondary">
              Hit the bookmark on any game card and it will show up here. This is your backlog,
              such as it is.
            </p>
            <div className="flex gap-3">
              <ButtonLink to="/vibe-check">Take the Vibe Check</ButtonLink>
              <ButtonLink to="/browse" variant="secondary">
                Browse the library
              </ButtonLink>
            </div>
          </div>
        ) : (
          <GameGrid>
            {games.map((game) => (
              <GameCard key={game.slug} game={game} />
            ))}
          </GameGrid>
        )}
      </section>

      {/* -------------------------------------------------------------- reset */}
      <section className="border-t border-hairline pt-8">
        <h2 className="font-display text-sm font-semibold text-text">Reset</h2>
        <p className="mt-1 max-w-lg text-xs text-text-secondary">
          Clears your platforms, Vibe Check answers, saved games, XP, badges and streak from this
          browser. There is no undo and nothing is stored anywhere else.
        </p>
        <Button
          variant="danger"
          size="sm"
          className="mt-3"
          onClick={() => {
            if (window.confirm('Erase all Ludex data in this browser? This cannot be undone.')) {
              resetEverything();
            }
          }}
        >
          Erase everything
        </Button>
      </section>
    </div>
  );
}

function Stat({ value, label, accent }: { value: number; label: string; accent?: string }) {
  return (
    <div>
      <div className="font-display text-2xl font-bold" style={{ color: accent ?? 'var(--color-text)' }}>
        {value}
      </div>
      <div className="text-[10px] uppercase tracking-[0.14em] text-text-muted">{label}</div>
    </div>
  );
}
