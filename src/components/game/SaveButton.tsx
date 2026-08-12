import { useLudexStore } from '@/store/useLudexStore.ts';

/**
 * Save-to-collection toggle.
 *
 * Lives inside GameCard's link region, so it stops propagation — clicking the
 * bookmark must not also navigate to the detail page.
 */
export function SaveButton({
  slug,
  accent,
  size = 'sm',
}: {
  slug: string;
  accent?: string;
  size?: 'sm' | 'md';
}) {
  const saved = useLudexStore((s) => s.saved.includes(slug));
  const toggleSaved = useLudexStore((s) => s.toggleSaved);

  const dimension = size === 'sm' ? 'h-8 w-8' : 'h-10 w-10';
  const icon = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleSaved(slug);
      }}
      aria-pressed={saved}
      aria-label={saved ? 'Remove from collection' : 'Save to collection'}
      title={saved ? 'Remove from collection' : 'Save to collection'}
      className={`${dimension} flex items-center justify-center rounded-full border backdrop-blur transition-all duration-[--dur-fast] ease-[--ease-arrival] hover:scale-110 active:scale-95 ${
        saved
          ? 'border-transparent'
          : 'border-hairline bg-void/70 text-text-muted hover:border-text-muted hover:text-text'
      }`}
      style={
        saved
          ? {
              color: 'var(--color-text-inverse)',
              backgroundColor: accent ?? 'var(--color-neon-magenta)',
              boxShadow: `0 0 16px -4px ${accent ?? 'var(--color-neon-magenta)'}`,
            }
          : undefined
      }
    >
      <svg viewBox="0 0 24 24" className={icon} aria-hidden="true">
        <path
          d="M6 3.5h12a1 1 0 0 1 1 1v16l-7-4.2-7 4.2v-16a1 1 0 0 1 1-1Z"
          fill={saved ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
