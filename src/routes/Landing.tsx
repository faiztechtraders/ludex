import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { GAMES } from '@/data/games/index.ts';
import { TIERS, TIER_LABELS } from '@/data/schema.ts';
import { dailyFeatured, todaySeed } from '@/engine/index.ts';
import { useLudexStore, selectHasSpunToday } from '@/store/useLudexStore.ts';
import { GameCard, GameGrid } from '@/components/game/GameCard.tsx';
import { ButtonLink } from '@/components/ui/Button.tsx';
import { PlatformPicker, platformSummary } from '@/components/platform/PlatformPicker.tsx';
import { usePrefersReducedMotion } from '@/lib/useReducedMotion.ts';
import { Logo } from '@/components/layout/Logo.tsx';

export default function Landing() {
  const reduced = usePrefersReducedMotion();
  const platforms = useLudexStore((s) => s.platforms);
  const togglePlatform = useLudexStore((s) => s.togglePlatform);
  const quizCompleted = useLudexStore((s) => s.quizCompleted);
  const hasSpunToday = useLudexStore(selectHasSpunToday);

  // Stable for the whole day, identical for every visitor.
  const featured = useMemo(() => dailyFeatured(GAMES, platforms, 4, todaySeed()), [platforms]);

  return (
    <div className="space-y-20">
      {/* ------------------------------------------------------------ hero */}
      <section className="relative text-center">
        <motion.div
          initial={reduced ? false : { opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="mx-auto mb-6 w-fit">
            <Logo className="h-16 w-16" />
          </div>

          <h1 className="brand-gradient-text mx-auto max-w-3xl font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
            Find your next game.
          </h1>

          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-text-secondary lg:text-lg">
            Answer a few questions about the kind of evening you want. Get {GAMES.length}{' '}
            hand-tagged games filtered to hardware you own — blockbusters, indie darlings, and
            things almost nobody has played.
          </p>

          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <ButtonLink to="/vibe-check" size="lg">
              {quizCompleted ? 'Redo the Vibe Check' : 'Start the Vibe Check'}
            </ButtonLink>
            <ButtonLink to="/spin" variant="secondary" size="lg">
              {hasSpunToday ? '🎁 Spin again' : '🎁 Just pick something'}
            </ButtonLink>
            {quizCompleted && (
              <ButtonLink to="/results" variant="ghost" size="lg">
                My matches →
              </ButtonLink>
            )}
          </div>
        </motion.div>
      </section>

      {/* -------------------------------------------------- platform picker */}
      <section>
        <SectionHeading
          eyebrow="Step one"
          title="What do you play on?"
          description="Every recommendation in Ludex is hard-filtered to your hardware. Switch 2 titles are labelled honestly — native, Switch 2 Edition, or backward compatible."
        />
        <PlatformPicker selected={platforms} onToggle={togglePlatform} />
        <p className="mt-3 text-center text-xs text-text-muted">
          Currently showing: <span className="text-neon-cyan">{platformSummary(platforms)}</span>
        </p>
      </section>

      {/* --------------------------------------------------- the three modes */}
      <section>
        <SectionHeading
          eyebrow="Three ways in"
          title="However you like to decide"
          description="Some people want to be asked. Some people want to be told. Some people want to browse."
        />
        <div className="grid gap-4 md:grid-cols-3">
          <ModeCard
            to="/vibe-check"
            glyph="🎛️"
            title="Vibe Check"
            body="Seven skippable questions about pace, tone, challenge and company. Every match comes with the reason it was chosen."
            accent="var(--color-neon-magenta)"
          />
          <ModeCard
            to="/spin"
            glyph="🎁"
            title="Daily Spin"
            body="A gacha reel that hands you one game right now. One official spin a day, unlimited chaos rerolls. Hidden gems drop as legendary."
            accent="var(--color-tier-gem)"
          />
          <ModeCard
            to="/browse"
            glyph="🗂️"
            title="Browse"
            body="The whole library with platform, genre, tier and playtime filters. For when you would rather steer yourself."
            accent="var(--color-neon-cyan)"
          />
        </div>
      </section>

      {/* ----------------------------------------------------- daily rotation */}
      <section>
        <SectionHeading
          eyebrow={`Today · ${todaySeed()}`}
          title="Today's rotation"
          description="A fresh set every day, weighted toward the lesser-known end of the library. Blockbusters do not need the front page."
        />
        <GameGrid>
          {featured.map((game) => (
            <GameCard key={game.slug} game={game} />
          ))}
        </GameGrid>
      </section>

      {/* ------------------------------------------------------- library mix */}
      <section>
        <SectionHeading
          eyebrow="The library"
          title="A deliberate mix"
          description="The library leans toward things you have not played — there are more hidden gems in it than blockbusters. Every result set is then composed rather than just ranked, so you always get some of each."
        />
        <div className="grid gap-4 sm:grid-cols-3">
          {TIERS.map((tier) => {
            const count = GAMES.filter((g) => g.tier === tier).length;
            const color =
              tier === 'mainstream'
                ? 'var(--color-tier-mainstream)'
                : tier === 'indie-darling'
                  ? 'var(--color-tier-indie)'
                  : 'var(--color-tier-gem)';
            return (
              <div
                key={tier}
                className="rounded-panel border border-hairline bg-surface/60 p-6 text-center"
                style={{ borderColor: `color-mix(in oklab, ${color} 28%, var(--color-hairline))` }}
              >
                <div className="font-display text-4xl font-bold" style={{ color }}>
                  {count}
                </div>
                <div className="mt-1 font-display text-sm font-semibold text-text">
                  {TIER_LABELS[tier]}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="mb-7 text-center">
      <p className="font-display text-xs font-semibold uppercase tracking-[0.18em] text-neon-cyan">
        {eyebrow}
      </p>
      <h2 className="mt-2 font-display text-2xl font-bold text-text lg:text-3xl">{title}</h2>
      <p className="mx-auto mt-2 max-w-2xl text-sm leading-relaxed text-text-secondary">
        {description}
      </p>
    </div>
  );
}

function ModeCard({
  to,
  glyph,
  title,
  body,
  accent,
}: {
  to: string;
  glyph: string;
  title: string;
  body: string;
  accent: string;
}) {
  return (
    <Link
      to={to}
      className="group flex flex-col gap-3 rounded-panel border border-hairline bg-surface/60 p-6 transition-all duration-[--dur-base] ease-[--ease-arrival] hover:-translate-y-1"
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = accent;
        e.currentTarget.style.boxShadow = `0 0 0 1px ${accent}44, 0 14px 44px -20px ${accent}`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = '';
        e.currentTarget.style.boxShadow = '';
      }}
    >
      <span className="text-3xl leading-none" aria-hidden="true">
        {glyph}
      </span>
      <h3 className="font-display text-lg font-semibold text-text">{title}</h3>
      <p className="text-sm leading-relaxed text-text-secondary">{body}</p>
      <span
        className="mt-auto pt-2 font-display text-xs font-semibold uppercase tracking-[0.14em] transition-transform group-hover:translate-x-1"
        style={{ color: accent }}
      >
        Open →
      </span>
    </Link>
  );
}
