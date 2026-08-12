import { useState } from 'react';
import type { Game } from '@/data/schema.ts';
import { heroUrl } from '@/data/art.ts';

/**
 * The wide banner behind a game's title on its detail page.
 *
 * Two things this has to get right:
 *
 *  - **No broken images.** Steam hero URLs are derived from the app id and not
 *    every app has one, so a 404 used to paint a broken-image icon across the
 *    top of the page. Falls back to the same accent wash the generated cover
 *    uses, which reads as deliberate rather than missing.
 *
 *  - **No hard edge.** Cropping a photo to a fixed band left a visible seam
 *    where the image simply stopped. The image is masked so it dissolves into
 *    the page background instead — the crop is still a crop, but it ends in a
 *    fade rather than a cut.
 */
export function GameHero({ game }: { game: Game }) {
  const [failed, setFailed] = useState(false);
  const src = heroUrl(game);
  const accent = game.art.accent;

  /**
   * Opaque through the upper half, then a long fade to nothing. Applied to both
   * the image and the fallback so the two are visually interchangeable.
   */
  const fade =
    'linear-gradient(to bottom, rgb(0 0 0) 0%, rgb(0 0 0) 45%, rgb(0 0 0 / 0.55) 72%, transparent 100%)';

  if (src && !failed) {
    return (
      <img
        src={src}
        alt=""
        onError={() => setFailed(true)}
        className="h-full w-full object-cover object-top"
        style={{ maskImage: fade, WebkitMaskImage: fade }}
      />
    );
  }

  return (
    <div
      className="h-full w-full"
      style={{
        maskImage: fade,
        WebkitMaskImage: fade,
        background: `
          radial-gradient(ellipse 55% 130% at 18% 0%, color-mix(in oklab, ${accent} 70%, transparent), transparent 68%),
          radial-gradient(ellipse 45% 110% at 78% 8%, color-mix(in oklab, ${accent} 38%, transparent), transparent 70%),
          linear-gradient(160deg, color-mix(in oklab, ${accent} 34%, var(--color-abyss)), var(--color-void))
        `,
      }}
    />
  );
}
