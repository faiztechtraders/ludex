# Ludex Style Guide

**Visual identity: neon arcade / synthwave.**

The feeling to hit: standing in a dark arcade at 1am. Deep near-black, electric magenta and
cyan, things that glow rather than things that are merely colored. Game key art is the hero;
the chrome around it is dark and luminous so the art pops.

The live tokens are in [`tokens.css`](tokens.css). This document explains *why* and *how to use
them*. When the two disagree, `tokens.css` wins — but update this file too.

---

## 1. Color

### Canvas — the dark stack

| Token | Hex | Use |
|---|---|---|
| `--color-void` | `#07060f` | Page background. The deepest layer. |
| `--color-abyss` | `#0d0b1a` | Section backgrounds, headers. |
| `--color-surface` | `#141127` | Card and panel background. |
| `--color-surface-2` | `#1c1834` | Raised or hovered cards. |
| `--color-surface-3` | `#262040` | Popovers, active/pressed states. |
| `--color-hairline` | `#322a55` | 1px borders and dividers. |

The canvas is **near-black with a violet cast**, never neutral grey and never pure `#000`.
Pure black makes neon read as harsh and cheap; the violet bias makes magenta and cyan feel like
they're *lighting* the surface.

The `body` carries three fixed radial gradients — magenta top-left, cyan top-right, violet
bottom — at 10–16% opacity. That atmosphere layer is what keeps large empty areas from reading
as flat grey. Don't remove it and don't add a competing one per-page.

### Accents

| Token | Hex | Role |
|---|---|---|
| `--color-neon-magenta` | `#ff3ea5` | **Primary.** The one action per screen you most want taken. |
| `--color-neon-cyan` | `#22e4ff` | **Secondary.** Informational, selection, focus rings. |
| `--color-neon-violet` | `#a855f7` | Gradient midpoint. Rarely used alone. |
| `--color-neon-lime` | `#adff4a` | Success, high match scores. |
| `--color-neon-amber` | `#ffb020` | Streak flame, warnings. |

**Discipline rule: one neon dominant per screen.** Magenta and cyan competing at equal weight
looks like a broken TV. Pick the dominant accent for the surface, and let the other appear only
in small supporting roles (a focus ring, one badge).

The brand gradient — magenta → violet → cyan at 100° — is reserved for the wordmark, primary
CTAs, and progress fills. It is not a background.

### Tier / rarity

Mapped from the game `tier` field. This is intentionally gacha-flavored: the hidden gem being
the *legendary gold drop* is the emotional payoff of the whole spin mechanic.

| Tier | Token | Reads as |
|---|---|---|
| `mainstream` | `--color-tier-mainstream` `#38bdf8` | Common — familiar blue |
| `indie-darling` | `--color-tier-indie` `#a855f7` | Rare — violet |
| `hidden-gem` | `--color-tier-gem` `#ffc83d` | **Legendary — gold** |

Gold is scarce by design. If gold appears on half a results grid, the quota is misconfigured.

### Text & contrast

| Token | Contrast on `--color-void` | Use |
|---|---|---|
| `--color-text` `#f4f1ff` | 16.8:1 | Headings, body |
| `--color-text-secondary` `#b8b0d8` | 8.4:1 | Supporting copy, metadata |
| `--color-text-muted` `#8279a8` | 4.8:1 | Labels, timestamps — **the dimmest allowed for readable text** |

Never put body text directly in `--color-neon-magenta` or on a saturated neon fill. Neon is for
edges, glows, icons, and short labels. **Test every neon-on-dark text pairing** — the palette
makes it very easy to ship something that looks great and fails AA.

### Per-game accent

Every game record carries `art.accent` — a hex sampled from its key art. It tints that game's
card glow, detail-page hero wash, and generated fallback cover. The brand neons frame the UI;
the game accent owns the inside of its own card. They should never fight: keep game accent
usage to glow and wash, not to text or buttons.

---

## 2. Typography

| Role | Token | Family |
|---|---|---|
| Display | `--font-display` | **Chakra Petch** — angular, technical, arcade-adjacent |
| Body / UI | `--font-sans` | **Inter** |
| Numerals in code contexts | `--font-mono` | system mono stack |

**The display face is for headings, the wordmark, spin numerals, tier labels, and match
percentages only.** Chakra Petch at paragraph length is genuinely hard to read. Everything a
user reads as prose — blurbs, "why it fits" copy, help text — is Inter.

Scale (Tailwind classes): `text-xs` labels · `text-sm` metadata · `text-base` body ·
`text-lg`–`text-xl` card titles · `text-3xl`–`text-5xl` page headings · `text-6xl`+ hero and
spin results only.

Headings get `letter-spacing: -0.01em`. Small uppercase labels get `tracking-[0.18em]` — wide
letterspacing is what makes short uppercase text read as *arcade signage* rather than shouting.

---

## 3. Glow & elevation

Neon depth comes from **bloom, not drop shadow**. Every glow token is a layered box-shadow:
a tight 1px core line at ~50% alpha, a 12px mid halo, and a 40px diffuse bleed.

| Token | Use |
|---|---|
| `--glow-magenta` | Primary buttons, active selections |
| `--glow-cyan` | Focus, informational highlights |
| `--glow-gold` | Legendary/hidden-gem drops **only** |
| `--glow-soft` | Plain neutral elevation for panels |

Utilities: `glow-magenta`, `glow-cyan`, `glow-gold`, `text-glow`, `panel`, `scanlines`,
`brand-gradient`, `brand-gradient-text`.

**Glow budget: at most two glowing elements visible at once.** Glow is an attention mechanism.
When everything glows, nothing does, and the page turns to mush.

Scanlines (`scanlines` + `scanlines-after`) go on hero surfaces and the spin reel. **Never
behind body text** — they cost real legibility for texture that nobody notices there.

---

## 4. Motion

Three durations, three curves. Anything slower belongs to the gacha reel, which owns its own
timing.

| Token | Value | Use |
|---|---|---|
| `--dur-fast` | 140ms | Hovers, chip toggles, tooltips |
| `--dur-base` | 240ms | Card entrances, panel opens, route fades |
| `--dur-slow` | 420ms | Quiz step transitions, drawer slides |

| Curve | Use |
|---|---|
| `--ease-arrival` | Entrances. The default for most UI. |
| `--ease-swap` | Two-way transitions that reverse. |
| `--ease-arcade` | Overshoot. **Rewards only** — spin results, XP gains, badge unlocks. |

`--ease-arcade` overshoots deliberately. It is a reward signal, so spending it on routine UI
devalues the moments that should feel like a win.

**Stagger** grids at 40ms per item, capped at ~8 items — beyond that the tail feels broken
rather than choreographed.

### Reduced motion — non-negotiable

`src/index.css` has a global `prefers-reduced-motion` backstop that collapses transitions. That
is not sufficient on its own: components that use motion to *convey information* must check
`useReducedMotion()` from `src/lib/` and take a different path.

Concretely, the Daily Spin must **cut straight to the result** under reduced motion, not play a
1ms reel. The app must be fully usable, spin included, with animation off.

---

## 5. Component anatomy

**Buttons** — `rounded-chip`, `px-5 py-2.5`, display font, `tracking-[0.06em]`.
*Primary:* brand gradient fill, `--color-text-inverse` text, `--glow-magenta` on hover.
*Secondary:* transparent fill, `--color-hairline` border, border brightens to cyan on hover.
*Ghost:* text only, background lifts to `--color-surface-2` on hover.
Hover lifts `translateY(-1px)`; press returns to 0. Never scale a button — it blurs the glow.

**Chips / filters** — `rounded-chip`, `px-3 py-1.5`, `text-sm`. Unselected: hairline border,
secondary text. Selected: accent border + 12% accent fill + accent text + glow. Selection must
be legible **without relying on color alone** — selected chips also carry a check glyph, for
color-blind users.

**Game cards** — `rounded-card`, `--color-surface` base, hairline border. 3:4 cover, title in
display font, platform badges row, tier ribbon top-right, match ring top-left when scored.
Hover: border → game accent, accent glow at ~35%, `translateY(-4px)`, cover scales to 1.04
inside `overflow-hidden`. **The card frame never scales** — only the image inside it.

**Panels** — use the `panel` utility. Frosted `--color-surface` at 82%, hairline border,
`--radius-panel`, 12px backdrop blur.

**Platform badges** — 20px icon plus optional label, tinted with that platform's brand hue
(`--color-platform-*`). Switch 2 badges additionally show `switch2Status`: a solid badge for
`native`, an outlined one for `backward-compatible`. That distinction is a product promise, not
decoration.

---

## 6. Iconography

`creative/icons/platforms.svg` holds the canonical platform glyphs; the same paths are mirrored
inline in `src/components/platform/PlatformIcon.tsx` to avoid a network fetch. **Keep the two in
sync.**

The glyphs are deliberately **generic hardware silhouettes, not manufacturer logos** — Ludex is
unaffiliated with Microsoft, Sony and Nintendo, and shipping their trademarks in the chrome
would be wrong. Each is recognizable by hardware shape alone.

All icons use `currentColor` so they inherit text color, hover states, and glow.
Default 20px in badges, 24px in the platform picker, 40px+ in the hero selector.

---

## 7. Layout

Content is capped at `--width-content` (1200px) with `px-5` gutters on mobile, `px-8` desktop.
The sticky header is `--header-height` (68px).

Grid rhythm for game cards: 2 columns mobile → 3 tablet → 4 desktop, `gap-4` / `gap-6`.

Vertical rhythm between major sections: `py-16` desktop, `py-10` mobile. Ludex is a dark,
dense app — generous vertical space is what keeps it from feeling cramped and cluttered.

---

## 8. Voice

Short, confident, a little playful. Never corporate.

- ✅ "Your next obsession, probably." · "Roll the dice." · "Nobody played this. Everybody should."
- ❌ "Discover personalized game recommendations tailored to your preferences."

Match explanations are specific and earned, not generic flattery: *"You wanted slow and
atmospheric — this is 20 hours of exactly that"* beats *"Great match for you!"*

Never claim certainty the data doesn't support. The app suggests; it doesn't pronounce.
