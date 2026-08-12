import type { Game, Platform, PlatformFamily, Switch2Status } from '@/data/schema.ts';
import {
  PLATFORMS,
  PLATFORM_FAMILY,
  PLATFORM_GEN,
  PLATFORM_LABELS,
  PLATFORM_SHORT,
} from '@/data/schema.ts';
import { FamilyIcon, PlatformIcon } from './PlatformIcon.tsx';

export const PLATFORM_COLORS: Record<Platform, string> = {
  pc: 'var(--color-platform-pc)',
  ps5: 'var(--color-platform-ps5)',
  ps4: 'var(--color-platform-ps4)',
  'xbox-series': 'var(--color-platform-xbox-series)',
  'xbox-one': 'var(--color-platform-xbox-one)',
  switch2: 'var(--color-platform-switch2)',
  switch: 'var(--color-platform-switch)',
};

/** The brighter, current-generation hue represents its family. */
export const FAMILY_COLORS: Record<PlatformFamily, string> = {
  pc: 'var(--color-platform-pc)',
  playstation: 'var(--color-platform-ps5)',
  xbox: 'var(--color-platform-xbox-series)',
  nintendo: 'var(--color-platform-switch2)',
};

const SWITCH2_LABEL: Record<Switch2Status, string> = {
  native: 'Switch 2 exclusive — built for the new hardware',
  'switch2-edition': 'Switch 2 Edition — enhanced version of the Switch 1 release',
  'backward-compatible': 'Runs on Switch 2 via backward compatibility',
};

const SWITCH2_SHORT: Record<Switch2Status, string> = {
  native: 'Native',
  'switch2-edition': 'S2 Edition',
  'backward-compatible': 'Compatible',
};

/** A single, specific platform. Used on the detail page where space allows. */
export function PlatformBadge({
  platform,
  status,
  showLabel = false,
  className = '',
}: {
  platform: Platform;
  status?: Switch2Status;
  showLabel?: boolean;
  className?: string;
}) {
  const color = PLATFORM_COLORS[platform];
  const isCompatOnly = platform === 'switch2' && status === 'backward-compatible';

  const title =
    platform === 'switch2' && status
      ? SWITCH2_LABEL[status]
      : `Available on ${PLATFORM_LABELS[platform]}`;

  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 rounded-chip border px-1.5 py-0.5 text-[10px] font-medium ${className}`}
      style={{
        color,
        borderColor: isCompatOnly
          ? 'var(--color-hairline)'
          : `color-mix(in oklab, ${color} 55%, transparent)`,
        backgroundColor: isCompatOnly
          ? 'transparent'
          : `color-mix(in oklab, ${color} 12%, transparent)`,
        opacity: isCompatOnly ? 0.7 : 1,
      }}
    >
      <PlatformIcon platform={platform} className="h-3.5 w-3.5" />
      {showLabel && <span>{PLATFORM_SHORT[platform]}</span>}
      {showLabel && platform === 'switch2' && status && (
        <span className="opacity-70">· {SWITCH2_SHORT[status]}</span>
      )}
      <span className="sr-only">{title}</span>
    </span>
  );
}

/**
 * Compact badge covering every generation a game runs on within one family,
 * e.g. a PlayStation icon reading "4·5".
 *
 * With seven platforms, one badge per console turned a card into a wall of
 * near-identical silhouettes. Grouping is shorter, scans faster, and matches
 * how people actually think about hardware ("I have a PlayStation").
 */
function FamilyBadge({
  family,
  platforms,
  game,
}: {
  family: PlatformFamily;
  platforms: Platform[];
  game: Game;
}) {
  const color = FAMILY_COLORS[family];
  const gens = platforms.map((p) => PLATFORM_GEN[p]).filter(Boolean);

  // Switch 2 via backward compatibility is not the same as a Switch 2 release,
  // and users filter on the difference — so say it, even in the compact badge.
  const compatOnly =
    family === 'nintendo' &&
    platforms.includes('switch2') &&
    game.switch2Status === 'backward-compatible';

  const title =
    platforms.map((p) => PLATFORM_LABELS[p]).join(', ') +
    (compatOnly ? ' (Switch 2 via backward compatibility)' : '');

  return (
    <span
      title={title}
      className="inline-flex items-center gap-1 rounded-chip border px-1.5 py-0.5 text-[10px] font-medium leading-none"
      style={{
        color,
        borderColor: `color-mix(in oklab, ${color} ${compatOnly ? 30 : 50}%, transparent)`,
        backgroundColor: `color-mix(in oklab, ${color} ${compatOnly ? 7 : 12}%, transparent)`,
      }}
    >
      <FamilyIcon family={family} className="h-3.5 w-3.5" />
      {gens.length > 0 && <span className="tabular-nums">{gens.join('·')}</span>}
      <span className="sr-only">{title}</span>
    </span>
  );
}

/**
 * The platform row on a game card.
 *
 * `showLabels` switches from grouped family badges (cards, tight space) to one
 * fully-labelled badge per console (detail page, where precision matters).
 */
export function PlatformBadgeRow({
  game,
  showLabels = false,
  className = '',
}: {
  game: Game;
  showLabels?: boolean;
  className?: string;
}) {
  const ordered = PLATFORMS.filter((p) => game.platforms.includes(p));

  if (showLabels) {
    return (
      <div className={`flex flex-wrap items-center gap-1 ${className}`}>
        {ordered.map((p) => (
          <PlatformBadge
            key={p}
            platform={p}
            status={p === 'switch2' ? game.switch2Status : undefined}
            showLabel
          />
        ))}
      </div>
    );
  }

  // Group into families, preserving the canonical platform order.
  const families: Array<{ family: PlatformFamily; platforms: Platform[] }> = [];
  for (const p of ordered) {
    const family = PLATFORM_FAMILY[p];
    const existing = families.find((f) => f.family === family);
    if (existing) existing.platforms.push(p);
    else families.push({ family, platforms: [p] });
  }

  return (
    <div className={`flex flex-wrap items-center gap-1 ${className}`}>
      {families.map(({ family, platforms }) => (
        <FamilyBadge key={family} family={family} platforms={platforms} game={game} />
      ))}
    </div>
  );
}
