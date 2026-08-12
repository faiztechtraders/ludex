import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { PLATFORMS } from '@/data/schema.ts';
import { useLudexStore, useLevel } from '@/store/useLudexStore.ts';
import { PlatformPicker, platformSummary } from '@/components/platform/PlatformPicker.tsx';
import { Logo } from './Logo.tsx';

const NAV = [
  { to: '/vibe-check', label: 'Vibe Check' },
  { to: '/spin', label: 'Daily Spin' },
  { to: '/browse', label: 'Browse' },
  { to: '/collection', label: 'Collection' },
];

/**
 * Sticky header carrying the persistent platform filter.
 *
 * The filter lives here rather than on each page because it applies globally:
 * a user who owns only a Switch should never have to re-state that when moving
 * from Browse to the Daily Spin.
 */
export function Header() {
  const [filterOpen, setFilterOpen] = useState(false);
  const platforms = useLudexStore((s) => s.platforms);
  const togglePlatform = useLudexStore((s) => s.togglePlatform);
  const setPlatforms = useLudexStore((s) => s.setPlatforms);
  const streak = useLudexStore((s) => s.streak);
  const { level } = useLevel();

  return (
    <header className="sticky top-0 z-50 border-b border-hairline bg-void/80 backdrop-blur-xl">
      <div className="mx-auto flex h-[--header-height] max-w-[--width-content] items-center gap-3 px-5 lg:px-8">
        <Link to="/" className="flex shrink-0 items-center gap-2.5" aria-label="Ludex home">
          <Logo className="h-8 w-8" />
          <span className="brand-gradient-text font-display text-xl font-bold tracking-tight">
            LUDEX
          </span>
        </Link>

        <nav className="ml-4 hidden items-center gap-1 md:flex" aria-label="Main">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `rounded-chip px-3 py-1.5 text-sm font-medium transition-colors duration-[--dur-fast] ${
                  isActive
                    ? 'bg-surface-2 text-neon-cyan'
                    : 'text-text-secondary hover:bg-surface hover:text-text'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {streak > 0 && (
            <span
              className="hidden items-center gap-1 rounded-chip border border-neon-amber/40 bg-neon-amber/10 px-2.5 py-1 text-xs font-medium text-neon-amber sm:inline-flex"
              title={`${streak}-day visit streak`}
            >
              <span aria-hidden="true">🔥</span>
              {streak}
              <span className="sr-only">day streak</span>
            </span>
          )}

          <span
            className="hidden items-center rounded-chip border border-hairline px-2.5 py-1 font-display text-xs font-semibold text-text-secondary sm:inline-flex"
            title="Your Ludex level"
          >
            LV {level}
          </span>

          <button
            type="button"
            onClick={() => setFilterOpen((v) => !v)}
            aria-expanded={filterOpen}
            aria-controls="platform-filter-panel"
            className={`flex items-center gap-2 rounded-chip border px-3 py-1.5 text-xs font-medium transition-all duration-[--dur-fast] ${
              platforms.length > 0
                ? 'border-neon-cyan/50 bg-neon-cyan/10 text-neon-cyan'
                : 'border-hairline text-text-secondary hover:border-text-muted hover:text-text'
            }`}
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" aria-hidden="true">
              <path
                d="M3 5h18l-7 8v6l-4 2v-8L3 5Z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinejoin="round"
              />
            </svg>
            <span className="max-w-[9rem] truncate">{platformSummary(platforms)}</span>
          </button>
        </div>
      </div>

      {/* Mobile nav — the desktop row is hidden below md. */}
      <nav
        className="flex items-center gap-1 overflow-x-auto border-t border-hairline px-5 py-2 md:hidden"
        aria-label="Main"
      >
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `shrink-0 rounded-chip px-3 py-1.5 text-xs font-medium transition-colors ${
                isActive ? 'bg-surface-2 text-neon-cyan' : 'text-text-secondary'
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      {filterOpen && (
        <div
          id="platform-filter-panel"
          className="border-t border-hairline bg-abyss/95 backdrop-blur-xl"
        >
          <div className="mx-auto max-w-[--width-content] px-5 py-5 lg:px-8">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="font-display text-sm font-semibold text-text">Your platforms</h2>
                <p className="text-xs text-text-muted">
                  Recommendations are filtered to these. Select none to see everything.
                </p>
              </div>
              {platforms.length > 0 && (
                <button
                  type="button"
                  onClick={() => setPlatforms([])}
                  className="rounded-chip px-2.5 py-1 text-xs text-text-muted hover:text-neon-magenta"
                >
                  Clear
                </button>
              )}
            </div>

            <PlatformPicker selected={platforms} onToggle={togglePlatform} />

            <div className="mt-3 flex items-center justify-between">
              <p className="text-xs text-text-muted">
                {platforms.length === 0
                  ? `Showing all ${PLATFORMS.length} platforms.`
                  : `Filtering to ${platformSummary(platforms)}.`}
              </p>
              <button
                type="button"
                onClick={() => setFilterOpen(false)}
                className="rounded-chip border border-hairline px-3 py-1 text-xs text-text-secondary hover:border-neon-cyan hover:text-neon-cyan"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
