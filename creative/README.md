# creative/

Brand assets and the design source of truth for Ludex.

| Path | What it is |
|---|---|
| `STYLE_GUIDE.md` | The spec: palette, type scale, elevation/glow rules, motion timings, component anatomy. Read this before designing any new surface. |
| `tokens.css` | **Live file** — imported by `src/index.css`. Every color, radius, shadow, and motion duration used by the app is declared here as a CSS custom property. |
| `brand/` | Logo, wordmark, and favicon as hand-authored SVG. |
| `icons/` | Platform icons (`platform-windows`, `platform-ps5`, `platform-switch`, `platform-switch2`) and vibe-axis icons. |

## Rules

- **`tokens.css` is the single source of truth for color.** Components must not hardcode hex
  values. If you need a new color, add a token here first.
- Tokens declared inside the `@theme` block automatically become Tailwind utilities:
  `--color-neon-magenta` → `bg-neon-magenta`, `text-neon-magenta`, `border-neon-magenta`.
- Icons are inline SVG with `currentColor` fills so they inherit text color and glow treatments.
- One accent color per game record (`art.accent`) is layered *on top of* the brand palette —
  the brand neons frame the UI, the game accent tints its own card.
