import { GAMES } from '@/data/games/index.ts';
import { VIBE_META_LIST } from '@/data/vibes.ts';
import { ButtonLink } from '@/components/ui/Button.tsx';

/** How Ludex actually works — stated plainly, because the honesty is the point. */
export default function About() {
  const s2 = GAMES.filter((g) => g.platforms.includes('switch2'));
  const native = s2.filter((g) => g.switch2Status !== 'backward-compatible').length;

  return (
    <div className="mx-auto max-w-2xl space-y-10">
      <header>
        <p className="font-display text-xs font-semibold uppercase tracking-[0.18em] text-neon-cyan">
          Under the hood
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold text-text lg:text-4xl">
          How Ludex works
        </h1>
      </header>

      <Section title="The library is hand-tagged, not scraped">
        <p>
          All {GAMES.length} games were entered by hand. Every one carries a position on seven
          vibe axes, an honest tier, an approximate playtime, and an editorial pitch. No public
          games API exposes any of that — it is the actual product, and it is why the library is
          this size rather than fifty thousand.
        </p>
      </Section>

      <Section title="The seven axes">
        <dl className="space-y-3">
          {VIBE_META_LIST.map((meta) => (
            <div key={meta.axis} className="grid grid-cols-[90px_1fr] gap-3">
              <dt className="font-display text-sm font-semibold text-neon-cyan">{meta.label}</dt>
              <dd className="text-sm leading-relaxed">
                <span className="text-text-muted">
                  {meta.low} → {meta.high}.
                </span>{' '}
                {meta.help}
              </dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section title="Platform filtering is absolute">
        <p>
          A game you cannot play is removed from the results, never merely ranked lower.
          Recommending a PS5 exclusive to someone who only owns a Switch is the one failure that
          would make every other suggestion suspect, so there is a test that asserts it for every
          platform.
        </p>
      </Section>

      <Section title="Switch 2 is labelled honestly">
        <p>
          {s2.length} games in the library run on Switch 2, but only {native} are native titles or
          dedicated Switch 2 Editions — the rest are Switch 1 games playing through backward
          compatibility. Ludex marks the difference on every badge rather than padding a Switch 2
          count. Public APIs do not model this distinction cleanly, which is a large part of why
          the dataset is curated.
        </p>
      </Section>

      <Section title="Results are composed, not just ranked">
        <p>
          Taking a straight top-twelve would return blockbusters almost every time, because
          blockbusters review well. Instead each result set is built to roughly 40% mainstream, 30%
          indie darling and 30% hidden gem. That quota is the reason you will see something you
          have not heard of even when your taste profile points squarely at the big releases.
        </p>
        <p>
          The library itself is weighted the other way — {GAMES.filter((g) => g.tier === 'hidden-gem').length}{' '}
          of the {GAMES.length} games are hidden gems, against{' '}
          {GAMES.filter((g) => g.tier === 'mainstream').length} mainstream. There has to be
          more to discover than there is to recognize.
        </p>
      </Section>

      <Section title="Two console generations, on purpose">
        <p>
          Ludex covers PC, PS5, PS4, Xbox Series X|S, Xbox One, Switch and Switch 2. Dropping the
          previous generation would have been simpler, but PS4 and Xbox One are still in millions
          of living rooms, and a discovery tool that ignores the hardware people actually own is
          not much of a discovery tool.
        </p>
      </Section>

      <Section title="Skipping a question really does skip it">
        <p>
          A skipped step carries zero weight. It is not silently treated as &ldquo;neutral&rdquo;,
          because neutral is an opinion and you did not give one. Answer two questions and your
          matches are built on exactly those two.
        </p>
      </Section>

      <Section title="Explanations are earned or absent">
        <p>
          The &ldquo;why it fits your vibe&rdquo; panel names the specific axes that drove a
          match. When nothing matched strongly enough to be worth stating, it shows editorial
          notes instead and says so. Generic flattery on a weak match would make the strong ones
          worthless.
        </p>
      </Section>

      <Section title="Today's picks hold still, and never repeat">
        <p>
          The daily rotation on the front page is seeded from the date, so it is the same for
          every visitor and holds still until your local midnight. Nothing rerolls behind your
          back.
        </p>
        <p>
          The Daily Spin is seeded the same way, but it also skips the last twenty games it showed
          you — so reloading the page will not hand back the same pick, and neither will a chaos
          reroll. That makes your spin personal rather than universal, which is the right trade:
          being shown the same game twice is worse than not matching a stranger.
        </p>
      </Section>

      <Section title="Nothing leaves your browser">
        <p>
          There are no accounts, no server and no analytics. Your platforms, answers, saved games,
          XP and streak live in this browser&apos;s local storage and nowhere else. Clearing site
          data erases all of it, and the reset button in your Collection does the same on purpose.
        </p>
      </Section>

      <div className="flex flex-wrap gap-3 border-t border-hairline pt-8">
        <ButtonLink to="/vibe-check">Take the Vibe Check</ButtonLink>
        <ButtonLink to="/browse" variant="secondary">
          Browse all {GAMES.length} games
        </ButtonLink>
      </div>

      <p className="text-xs leading-relaxed text-text-muted">
        Game titles, descriptions and artwork belong to their respective developers and
        publishers. Ludex is unaffiliated with Microsoft, Sony or Nintendo; the platform icons are
        generic hardware silhouettes rather than trademarks. Vibe tags, blurbs and match copy are
        original editorial work.
      </p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 font-display text-lg font-semibold text-text">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-text-secondary">{children}</div>
    </section>
  );
}
