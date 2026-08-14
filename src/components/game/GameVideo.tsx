import { useState } from 'react';
import type { Game } from '@/data/schema.ts';
import { VIDEOS } from '@/data/videos.ts';

/**
 * A short trailer, so "what is this actually like" is answered in ten seconds
 * rather than three paragraphs.
 *
 * Steam hosts the video and both URLs derive from a single stored id — nothing
 * is embedded from a third party, so the page keeps shipping only its own
 * assets. Games with no Steam listing get a YouTube **search link** instead:
 * a link cannot pick the wrong video, whereas scraping for a "best guess"
 * trailer is exactly how Kirby's screenshots ended up on Super Mario Odyssey.
 *
 * Deliberately not autoplaying, and `preload="none"` — a 20MB trailer is not
 * something to download for a reader who came to look at the cover.
 */

const STEAM_VIDEO = 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps';

export function GameVideo({ game }: { game: Game }) {
  const movieId = VIDEOS[game.slug];

  /**
   * One `src` at a time, stepped on failure — not a list of `<source>` tags.
   *
   * With `<source>` children, React's synthetic `onError` on the `<video>` also
   * catches each child's error, so a single 404 tore the whole player down and
   * showed the YouTube link even when a later source would have played. About
   * half of Steam's trailers have no `movie_max.webm`, so that was most of them.
   *
   * mp4 first: it exists for nearly every trailer and is already full
   * resolution. 480p is the genuine fallback for older uploads.
   */
  const QUALITIES = ['movie_max.mp4', 'movie480.mp4'];
  const [step, setStep] = useState(0);
  const failed = step >= QUALITIES.length;

  if (movieId && !failed) {
    return (
      <section>
        <h2 className="mb-4 font-display text-sm font-semibold uppercase tracking-[0.16em] text-text-muted">
          Trailer
        </h2>
        <video
          controls
          preload="none"
          playsInline
          key={QUALITIES[step]}
          src={`${STEAM_VIDEO}/${movieId}/${QUALITIES[step]}`}
          poster={`${STEAM_VIDEO}/${movieId}/movie.293x165.jpg`}
          // Step down a quality rather than giving up. Only after every option
          // has failed does the YouTube link take over.
          onError={() => setStep((s) => s + 1)}
          className="aspect-video w-full rounded-card border border-hairline bg-abyss"
        />
      </section>
    );
  }

  // No Steam trailer — offer the search rather than guessing at a video id.
  const query = encodeURIComponent(`${game.title} ${game.year} gameplay`);
  return (
    <section>
      <h2 className="mb-3 font-display text-sm font-semibold uppercase tracking-[0.16em] text-text-muted">
        Gameplay
      </h2>
      <a
        href={`https://www.youtube.com/results?search_query=${query}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 rounded-chip border border-hairline px-3 py-1.5 text-sm text-text-secondary transition-colors hover:border-neon-cyan hover:text-neon-cyan"
      >
        Watch gameplay on YouTube
        <span aria-hidden="true">↗</span>
        <span className="sr-only">— opens a YouTube search in a new tab</span>
      </a>
    </section>
  );
}
