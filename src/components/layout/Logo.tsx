/**
 * The Ludex mark — a cut-gem silhouette wrapped around a play glyph.
 * Mirrors creative/brand/ludex-mark.svg; inlined so it needs no fetch and can
 * inherit motion and filter treatments from its container.
 */
export function Logo({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-label="Ludex">
      <defs>
        <linearGradient id="ludex-brand" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--color-neon-magenta)" />
          <stop offset="52%" stopColor="var(--color-neon-violet)" />
          <stop offset="100%" stopColor="var(--color-neon-cyan)" />
        </linearGradient>
      </defs>
      <path
        d="M32 4 58 22.5 48 56 16 56 6 22.5Z"
        fill="none"
        stroke="url(#ludex-brand)"
        strokeWidth="3.5"
        strokeLinejoin="round"
      />
      <path d="M32 17 46.5 27.3 41 46 23 46 17.5 27.3Z" fill="url(#ludex-brand)" opacity="0.16" />
      <path d="M27 25.5 41.5 32.5 27 39.5Z" fill="url(#ludex-brand)" />
    </svg>
  );
}
