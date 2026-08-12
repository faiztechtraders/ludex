import { useState } from 'react';
import type { Game } from '@/data/schema.ts';
import { coverUrl } from '@/data/art.ts';
import { hashString } from '@/lib/rng.ts';

/**
 * A game's cover image, or a generated stand-in when none is cached.
 *
 * The fallback is not a grey box: it is a deterministic geometric composition
 * derived from the game's `art.accent` and slug, so a library with zero cached
 * images still reads as designed rather than broken. This is what lets Ludex
 * ship without any dependency on an image API.
 *
 * Also handles a cached URL that 404s later, falling back at runtime.
 */
export function GameCover({
  game,
  className = '',
  eager = false,
}: {
  game: Game;
  className?: string;
  eager?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const src = coverUrl(game);

  if (src && !failed) {
    return (
      <img
        src={src}
        alt=""
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        onError={() => setFailed(true)}
        className={`h-full w-full object-cover ${className}`}
      />
    );
  }

  return <GeneratedCover game={game} className={className} />;
}

/**
 * Deterministic procedural cover. Same game always produces the same art, so
 * the library looks stable across sessions rather than reshuffling on render.
 */
function GeneratedCover({ game, className = '' }: { game: Game; className?: string }) {
  const accent = game.art.accent;
  const seed = hashString(game.slug);

  // Two derived angles and a shape offset, so every game composes differently
  // while staying inside the same visual language.
  const angle = seed % 360;
  const offset = 18 + (seed % 42);
  const ringSize = 34 + ((seed >> 3) % 26);

  const initials = game.title
    .replace(/^(The|A|An)\s+/i, '')
    .split(/[\s:]+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase();

  return (
    <div
      className={`relative h-full w-full overflow-hidden ${className}`}
      style={{
        background: `
          radial-gradient(circle at ${offset}% ${100 - offset}%, color-mix(in oklab, ${accent} 55%, transparent), transparent 62%),
          linear-gradient(${angle}deg, color-mix(in oklab, ${accent} 32%, var(--color-abyss)), var(--color-void))
        `,
      }}
      aria-hidden="true"
    >
      {/* Concentric arcs — reads as an abstract emblem rather than a placeholder */}
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full opacity-45"
      >
        <circle
          cx="50"
          cy="52"
          r={ringSize}
          fill="none"
          stroke={accent}
          strokeWidth="0.6"
          opacity="0.7"
        />
        <circle
          cx="50"
          cy="52"
          r={ringSize * 0.66}
          fill="none"
          stroke={accent}
          strokeWidth="0.4"
          opacity="0.45"
        />
        <path
          d={`M0 ${72 + (seed % 12)} Q 50 ${52 + (seed % 20)} 100 ${78 - (seed % 14)}`}
          fill="none"
          stroke={accent}
          strokeWidth="0.5"
          opacity="0.55"
        />
      </svg>

      <div className="absolute inset-0 flex items-center justify-center">
        <span
          className="font-display text-5xl font-bold tracking-tight opacity-90"
          style={{ color: accent, textShadow: `0 0 30px ${accent}` }}
        >
          {initials}
        </span>
      </div>

      {/* Scanlines tie the fallback into the arcade identity. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'repeating-linear-gradient(to bottom, rgb(255 255 255 / 0.05) 0 1px, transparent 1px 3px)',
        }}
      />
    </div>
  );
}
