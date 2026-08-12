import type { Tier } from '@/data/schema.ts';
import { TIER_LABELS, TIER_RARITY } from '@/data/schema.ts';

export const TIER_COLORS: Record<Tier, string> = {
  mainstream: 'var(--color-tier-mainstream)',
  'indie-darling': 'var(--color-tier-indie)',
  'hidden-gem': 'var(--color-tier-gem)',
};

export const TIER_GLOW: Record<Tier, string> = {
  mainstream: 'var(--glow-cyan)',
  'indie-darling': '0 0 0 1px rgb(168 85 247 / 0.5), 0 0 18px -4px rgb(168 85 247 / 0.6)',
  'hidden-gem': 'var(--glow-gold)',
};

/**
 * Tier ribbon. Uses rarity language ("Legendary") in gacha contexts and plain
 * language ("Hidden Gem") everywhere else — the spin is the one place the
 * loot-drop framing earns its keep.
 */
export function TierBadge({
  tier,
  rarity = false,
  /**
   * Set when the badge sits on top of cover art. A translucent tint is
   * unreadable over real key art — bright yellow box art swallowed the gold
   * "Hidden Gem" ribbon entirely — so overlaid badges get an opaque dark
   * backdrop instead of a tint of their own colour.
   */
  overlay = false,
  className = '',
}: {
  tier: Tier;
  rarity?: boolean;
  overlay?: boolean;
  className?: string;
}) {
  const color = TIER_COLORS[tier];
  return (
    <span
      className={`inline-flex items-center rounded-chip border px-2 py-0.5 font-display text-[10px] font-semibold uppercase tracking-[0.14em] ${
        overlay ? 'backdrop-blur-sm' : ''
      } ${className}`}
      style={{
        color,
        borderColor: `color-mix(in oklab, ${color} ${overlay ? 65 : 50}%, transparent)`,
        backgroundColor: overlay
          ? `color-mix(in oklab, ${color} 18%, rgb(7 6 15 / 0.82))`
          : `color-mix(in oklab, ${color} 14%, transparent)`,
        textShadow: overlay ? '0 1px 3px rgb(0 0 0 / 0.9)' : undefined,
      }}
    >
      {rarity ? TIER_RARITY[tier] : TIER_LABELS[tier]}
    </span>
  );
}
