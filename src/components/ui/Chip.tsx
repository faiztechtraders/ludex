import type { ReactNode } from 'react';

interface ChipProps {
  children: ReactNode;
  selected?: boolean;
  onClick?: () => void;
  /** Optional accent hex — used for per-game or per-platform tinting. */
  accent?: string;
  size?: 'sm' | 'md';
  className?: string;
  title?: string;
}

/**
 * Selectable filter chip.
 *
 * Selection is signalled by a check glyph as well as by color and glow.
 * Color alone is not an accessible selection indicator, and this component is
 * used for the platform picker, where getting the selection wrong is the
 * difference between usable and useless recommendations.
 */
export function Chip({
  children,
  selected = false,
  onClick,
  accent,
  size = 'md',
  className = '',
  title,
}: ChipProps) {
  const sizing = size === 'sm' ? 'px-2.5 py-1 text-[11px]' : 'px-3.5 py-1.5 text-sm';
  const interactive = onClick !== undefined;

  const style = selected && accent
    ? {
        borderColor: accent,
        backgroundColor: `color-mix(in oklab, ${accent} 16%, transparent)`,
        color: accent,
        boxShadow: `0 0 14px -4px ${accent}`,
      }
    : undefined;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!interactive}
      aria-pressed={interactive ? selected : undefined}
      title={title}
      className={[
        'inline-flex items-center gap-1.5 rounded-chip border font-medium',
        'transition-all duration-[--dur-fast] ease-[--ease-arrival]',
        sizing,
        interactive ? 'cursor-pointer' : 'cursor-default',
        selected && !accent
          ? 'border-neon-cyan bg-neon-cyan/12 text-neon-cyan shadow-[--glow-cyan]'
          : '',
        !selected
          ? `border-hairline text-text-secondary ${interactive ? 'hover:border-text-muted hover:text-text' : ''}`
          : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      style={style}
    >
      {selected && (
        <svg viewBox="0 0 16 16" className="h-3 w-3 shrink-0" aria-hidden="true">
          <path
            d="M3.5 8.5 6.5 11.5 12.5 4.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
      {children}
    </button>
  );
}
