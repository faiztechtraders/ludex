/**
 * Continuous answer input for axes where the middle is a real position rather
 * than a compromise (challenge, depth).
 *
 * A native range input under the styling, so keyboard control, screen readers
 * and touch all work without reimplementation.
 */
export function VibeSlider({
  poles,
  ticks,
  value,
  onChange,
  label,
}: {
  poles: [string, string];
  ticks?: string[];
  value: number | undefined;
  onChange: (value: number) => void;
  label: string;
}) {
  // Undefined means "not answered yet" — show the handle centred but keep the
  // track unfilled so it does not read as a deliberate mid-point answer.
  const answered = value !== undefined;
  const current = value ?? 0.5;
  const percent = current * 100;

  const activeTick =
    ticks && ticks.length > 0
      ? ticks[Math.min(ticks.length - 1, Math.floor(current * ticks.length))]
      : undefined;

  return (
    <div className="w-full">
      <div className="mb-3 flex items-baseline justify-between gap-4 text-sm">
        <span className="font-medium text-text-secondary">{poles[0]}</span>
        <span
          className={`font-display text-lg font-bold transition-colors ${
            answered ? 'brand-gradient-text' : 'text-text-muted'
          }`}
        >
          {answered ? (activeTick ?? `${Math.round(percent)}%`) : 'Not answered'}
        </span>
        <span className="font-medium text-text-secondary">{poles[1]}</span>
      </div>

      <div className="relative py-3">
        {/* Track */}
        <div className="pointer-events-none absolute inset-x-0 top-1/2 h-2.5 -translate-y-1/2 overflow-hidden rounded-chip border border-hairline bg-surface">
          {answered && (
            <div
              className="brand-gradient h-full rounded-chip transition-[width] duration-[--dur-fast]"
              style={{ width: `${percent}%` }}
            />
          )}
        </div>

        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={Math.round(percent)}
          aria-label={label}
          aria-valuetext={answered ? (activeTick ?? `${Math.round(percent)}%`) : 'Not answered'}
          onChange={(e) => onChange(Number(e.target.value) / 100)}
          className="relative z-10 w-full cursor-pointer appearance-none bg-transparent
            [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:w-6
            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-neon-magenta
            [&::-webkit-slider-thumb]:bg-void [&::-webkit-slider-thumb]:shadow-[--glow-magenta]
            [&::-webkit-slider-thumb]:transition-transform hover:[&::-webkit-slider-thumb]:scale-110
            [&::-moz-range-thumb]:h-6 [&::-moz-range-thumb]:w-6 [&::-moz-range-thumb]:rounded-full
            [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-neon-magenta
            [&::-moz-range-thumb]:bg-void"
        />
      </div>

      {ticks && (
        <div className="mt-1 flex justify-between text-[11px] text-text-muted">
          {ticks.map((tick) => (
            <span key={tick}>{tick}</span>
          ))}
        </div>
      )}
    </div>
  );
}
