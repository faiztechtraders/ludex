import { useMemo, useState } from 'react';
import { ALL_GENRES, GAMES } from '@/data/games/index.ts';
import { TIERS, TIER_LABELS } from '@/data/schema.ts';
import type { Tier } from '@/data/schema.ts';
import { matchesPlatforms } from '@/engine/index.ts';
import { useLudexStore } from '@/store/useLudexStore.ts';
import { GameCard, GameGrid } from '@/components/game/GameCard.tsx';
import { Chip } from '@/components/ui/Chip.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { TIER_COLORS } from '@/components/game/TierBadge.tsx';
import { platformSummary } from '@/components/platform/PlatformPicker.tsx';

type Sort = 'rating' | 'popularity' | 'obscurity' | 'newest' | 'shortest' | 'alpha';

const SORTS: Array<{ id: Sort; label: string }> = [
  { id: 'rating', label: 'Best reviewed' },
  { id: 'obscurity', label: 'Most obscure' },
  { id: 'popularity', label: 'Most popular' },
  { id: 'newest', label: 'Newest' },
  { id: 'shortest', label: 'Shortest' },
  { id: 'alpha', label: 'A–Z' },
];

/** How many genre chips to show before the "+N more" toggle. */
const GENRE_PREVIEW = 24;

/** Playtime buckets, in hours. */
const LENGTHS: Array<{ id: string; label: string; test: (h: number) => boolean }> = [
  { id: 'tiny', label: 'Under 5h', test: (h) => h < 5 },
  { id: 'short', label: '5–15h', test: (h) => h >= 5 && h <= 15 },
  { id: 'medium', label: '15–40h', test: (h) => h > 15 && h <= 40 },
  { id: 'long', label: '40h+', test: (h) => h > 40 },
];

/** The self-steering surface, for users who skip the quiz entirely. */
export default function Browse() {
  const platforms = useLudexStore((s) => s.platforms);

  const [tiers, setTiers] = useState<Tier[]>([]);
  const [genres, setGenres] = useState<string[]>([]);
  const [lengths, setLengths] = useState<string[]>([]);
  const [sort, setSort] = useState<Sort>('rating');
  const [query, setQuery] = useState('');
  const [showAllGenres, setAllGenres] = useState(false);

  /**
   * The library has 126 distinct genres. Rendering every chip pushed the
   * results themselves off the bottom of the screen, so show the most common
   * ones and let the rest be expanded. Anything already selected stays visible
   * regardless, so collapsing never hides an active filter.
   */
  const visibleGenres = useMemo(() => {
    if (showAllGenres) return ALL_GENRES;
    const counts = new Map<string, number>();
    for (const g of GAMES) for (const genre of g.genres) counts.set(genre, (counts.get(genre) ?? 0) + 1);
    const top = [...ALL_GENRES]
      .sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0))
      .slice(0, GENRE_PREVIEW);
    return ALL_GENRES.filter((g) => top.includes(g) || genres.includes(g));
  }, [showAllGenres, genres]);

  const toggle = <T,>(list: T[], set: (v: T[]) => void, value: T) =>
    set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const games = GAMES.filter((game) => {
      if (!matchesPlatforms(game, platforms)) return false;
      if (tiers.length && !tiers.includes(game.tier)) return false;
      if (genres.length && !game.genres.some((g) => genres.includes(g))) return false;
      if (lengths.length) {
        const buckets = LENGTHS.filter((l) => l.test(game.hoursToBeat)).map((l) => l.id);
        if (!buckets.some((b) => lengths.includes(b))) return false;
      }
      if (q) {
        const haystack =
          `${game.title} ${game.developer} ${game.genres.join(' ')} ${game.tags.join(' ')}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });

    const sorted = [...games];
    switch (sort) {
      case 'rating':
        sorted.sort((a, b) => b.rating - a.rating);
        break;
      case 'popularity':
        sorted.sort((a, b) => b.popularity - a.popularity);
        break;
      case 'obscurity':
        sorted.sort((a, b) => a.popularity - b.popularity);
        break;
      case 'newest':
        sorted.sort((a, b) => b.year - a.year);
        break;
      case 'shortest':
        sorted.sort((a, b) => a.hoursToBeat - b.hoursToBeat);
        break;
      case 'alpha':
        sorted.sort((a, b) => a.title.localeCompare(b.title));
        break;
    }
    return sorted;
  }, [platforms, tiers, genres, lengths, sort, query]);

  const hasFilters = tiers.length > 0 || genres.length > 0 || lengths.length > 0 || query !== '';

  return (
    <div>
      <header className="mb-8">
        <p className="font-display text-xs font-semibold uppercase tracking-[0.18em] text-neon-cyan">
          The library
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold text-text lg:text-4xl">
          Browse all {GAMES.length} games
        </h1>
        <p className="mt-2 text-sm text-text-secondary">
          Hand-tagged, honestly labelled, filtered to {platformSummary(platforms)}.
        </p>
      </header>

      {/* -------------------------------------------------------- controls */}
      <div className="panel mb-8 space-y-5 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="relative flex-1">
            <span className="sr-only">Search games</span>
            <svg
              viewBox="0 0 24 24"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
              <path d="m16 16 4.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search title, developer, genre or tag…"
              className="w-full rounded-chip border border-hairline bg-void py-2 pl-9 pr-4 text-sm text-text placeholder:text-text-muted focus:border-neon-cyan focus:outline-none"
            />
          </label>

          <label className="flex items-center gap-2 text-xs text-text-muted">
            Sort
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              className="rounded-chip border border-hairline bg-void px-3 py-2 text-sm text-text focus:border-neon-cyan focus:outline-none"
            >
              {SORTS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <FilterRow label="Tier">
          {TIERS.map((tier) => (
            <Chip
              key={tier}
              size="sm"
              selected={tiers.includes(tier)}
              accent={TIER_COLORS[tier]}
              onClick={() => toggle(tiers, setTiers, tier)}
            >
              {TIER_LABELS[tier]}
            </Chip>
          ))}
        </FilterRow>

        <FilterRow label="Length">
          {LENGTHS.map((l) => (
            <Chip
              key={l.id}
              size="sm"
              selected={lengths.includes(l.id)}
              onClick={() => toggle(lengths, setLengths, l.id)}
            >
              {l.label}
            </Chip>
          ))}
        </FilterRow>

        <FilterRow label="Genre">
          {visibleGenres.map((genre) => (
            <Chip
              key={genre}
              size="sm"
              selected={genres.includes(genre)}
              onClick={() => toggle(genres, setGenres, genre)}
            >
              {genre}
            </Chip>
          ))}
          {ALL_GENRES.length > GENRE_PREVIEW && (
            <button
              type="button"
              onClick={() => setAllGenres((v) => !v)}
              className="rounded-chip px-2.5 py-1 text-[11px] font-medium text-neon-cyan underline underline-offset-4 hover:text-neon-cyan-soft"
            >
              {showAllGenres
                ? 'Show fewer'
                : `+${ALL_GENRES.length - visibleGenres.length} more genres`}
            </button>
          )}
        </FilterRow>

        <div className="flex items-center justify-between border-t border-hairline pt-4">
          <p className="text-xs text-text-muted">
            <span className="font-display text-sm text-text">{filtered.length}</span> of{' '}
            {GAMES.length} games
          </p>
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setTiers([]);
                setGenres([]);
                setLengths([]);
                setQuery('');
              }}
            >
              Clear filters
            </Button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="panel p-12 text-center">
          <p className="text-4xl" aria-hidden="true">
            🔍
          </p>
          <h2 className="mt-4 font-display text-xl font-semibold text-text">No matches</h2>
          <p className="mt-2 text-sm text-text-secondary">
            Nothing in the library fits that combination. Try widening the filters.
          </p>
        </div>
      ) : (
        <GameGrid>
          {filtered.map((game, i) => (
            <GameCard key={game.slug} game={game} eager={i < 4} />
          ))}
        </GameGrid>
      )}
    </div>
  );
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-14 shrink-0 font-display text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted">
        {label}
      </span>
      {children}
    </div>
  );
}
