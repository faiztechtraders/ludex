/**
 * Circular match-percentage indicator.
 *
 * Colour shifts with the score (lime -> cyan -> muted) but the number is always
 * present, so the meaning never depends on colour perception alone.
 */
export function MatchRing({
  score,
  size = 44,
  className = '',
}: {
  score: number;
  size?: number;
  className?: string;
}) {
  const stroke = size < 40 ? 3 : 3.5;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = (Math.min(Math.max(score, 0), 100) / 100) * circumference;

  const color =
    score >= 80
      ? 'var(--color-neon-lime)'
      : score >= 62
        ? 'var(--color-neon-cyan)'
        : 'var(--color-text-muted)';

  return (
    <div
      className={`relative shrink-0 ${className}`}
      style={{ width: size, height: size }}
      title={`${score}% match`}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="var(--color-void)"
          fillOpacity="0.7"
          stroke="var(--color-hairline)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          style={{ filter: `drop-shadow(0 0 5px ${color})` }}
        />
      </svg>
      <span
        className="absolute inset-0 flex items-center justify-center font-display font-bold"
        style={{ color, fontSize: size < 40 ? 11 : 13 }}
      >
        {score}
      </span>
      <span className="sr-only">{score} percent match</span>
    </div>
  );
}
