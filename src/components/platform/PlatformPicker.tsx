import type { Platform } from '@/data/schema.ts';
import { PLATFORMS, PLATFORM_LABELS, PLATFORM_SHORT } from '@/data/schema.ts';
import { countByPlatform } from '@/data/games/index.ts';
import { PlatformIcon } from './PlatformIcon.tsx';
import { PLATFORM_COLORS } from './PlatformBadge.tsx';

/**
 * The hardware picker.
 *
 * The most consequential control in the app — everything downstream is a hard
 * filter on it — so it is rendered as large, physical-feeling cards rather
 * than a dropdown, and selection is indicated by border, fill, glow AND a
 * check, never by color alone.
 *
 * Selecting nothing means "show me everything", which is stated explicitly in
 * the UI rather than left for the user to infer from an empty state.
 */
export function PlatformPicker({
  selected,
  onToggle,
  size = 'lg',
}: {
  selected: Platform[];
  onToggle: (platform: Platform) => void;
  size?: 'lg' | 'sm';
}) {
  const large = size === 'lg';

  return (
    <div
      role="group"
      aria-label="Select your platforms"
      // Seven platforms: 2 up on phones, 4 on tablets, all 7 on one desktop row.
      className={`grid gap-3 ${
        large ? 'grid-cols-2 sm:grid-cols-4 lg:grid-cols-7' : 'grid-cols-4 sm:grid-cols-7'
      }`}
    >
      {PLATFORMS.map((platform) => {
        const isOn = selected.includes(platform);
        const color = PLATFORM_COLORS[platform];
        return (
          <button
            key={platform}
            type="button"
            role="checkbox"
            aria-checked={isOn}
            onClick={() => onToggle(platform)}
            className={[
              'group relative flex flex-col items-center justify-center gap-2 rounded-card border',
              'transition-all duration-[--dur-base] ease-[--ease-arrival]',
              large ? 'px-4 py-6' : 'px-2 py-3',
              isOn
                ? 'bg-surface-2'
                : 'border-hairline bg-surface/50 text-text-muted hover:border-text-muted hover:text-text-secondary hover:-translate-y-0.5',
            ].join(' ')}
            style={
              isOn
                ? {
                    borderColor: color,
                    color,
                    boxShadow: `0 0 0 1px ${color}, 0 0 28px -10px ${color}`,
                    backgroundColor: `color-mix(in oklab, ${color} 10%, var(--color-surface))`,
                  }
                : undefined
            }
          >
            {isOn && (
              <span
                className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full"
                style={{ backgroundColor: color }}
                aria-hidden="true"
              >
                <svg viewBox="0 0 16 16" className="h-3 w-3 text-text-inverse">
                  <path
                    d="M3.5 8.5 6.5 11.5 12.5 4.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
            )}

            <PlatformIcon platform={platform} className={large ? 'h-8 w-8' : 'h-5 w-5'} />

            <span
              className={`text-center font-display font-semibold leading-tight ${
                large ? 'text-[13px]' : 'text-[11px]'
              }`}
            >
              {large ? PLATFORM_LABELS[platform] : PLATFORM_SHORT[platform]}
            </span>

            {large && (
              <span className="text-[11px] text-text-muted">
                {countByPlatform(platform)} games
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Plain-language summary of the current selection. */
export function platformSummary(selected: Platform[]): string {
  if (selected.length === 0) return 'All platforms';
  if (selected.length === PLATFORMS.length) return 'All platforms';
  return selected.map((p) => PLATFORM_SHORT[p]).join(' · ');
}
