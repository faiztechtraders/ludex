# screenshot/

UI captures used for **visual verification** — the feedback loop that lets changes be checked
by looking at the rendered result, not just by reading code.

## How to capture

```bash
npm run dev     # in one terminal — note the port it prints
npm run shot    # in another
```

`skills/screenshot/capture.mjs` drives a headless browser across every route at two viewports
and writes PNGs here. It reads the dev server URL from `LUDEX_URL` (default
`http://localhost:3000`), so if Vite picked a different port:

```bash
LUDEX_URL=http://localhost:3001 npm run shot
```

## Naming convention

```
<route>-<viewport>.png

landing-desktop.png       vibe-check-desktop.png     results-desktop.png
landing-mobile.png        vibe-check-mobile.png      results-mobile.png
game-detail-desktop.png   daily-spin-desktop.png     browse-desktop.png
```

Viewports: `desktop` = 1440×900, `mobile` = 390×844.

Add a `-<label>` suffix for one-off comparisons (`results-desktop-before.png`).

## Why these are *not* committed

The PNGs are git-ignored, and deliberately so. Full-page captures of this app are enormous —
Browse renders ~95,000 px tall, and a single desktop capture runs to 9 MB — so the folder
reaches ~70 MB. Git stores every blob forever, so committing them would permanently weigh down
every clone in exchange for an artifact `npm run shot` regenerates in seconds.

They remain the visual-verification record; that record just lives in your working copy rather
than in history. If you need to share one, attach it to the PR or issue directly.

## Working with these

After any visual change: run the capture, then **open the PNGs and actually look at them.**
Screenshots that are generated and never read provide no verification at all.

Things worth checking each pass:
- Does the mobile capture show horizontal overflow?
- Is neon text still legible against the near-black canvas (AA contrast)?
- Do game cards without cached art fall back to a clean accent gradient?
- Do long game titles wrap rather than clip?
