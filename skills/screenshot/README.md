# skills/screenshot

Browser-driven verification. Three scripts, escalating in what they prove.

| Script | Command | Proves |
|---|---|---|
| `console-check.mjs` | `npm run check` | Every route renders without console errors, page errors, failed requests, or an empty `#root`. |
| `capture.mjs` | `npm run shot` | What each route looks like, desktop + mobile, into `screenshot/`. |
| `flows.mjs` | `npm run flows` | Interactions that only exist after a click actually work. |

All three need the dev server running and read `LUDEX_URL` (default
`http://localhost:3000`) — Vite auto-increments the port, so:

```bash
LUDEX_URL=http://localhost:3001 npm run check
```

## Run them in this order

```bash
npm run dev      # terminal 1
npm run check    # is anything throwing?
npm run shot     # what does it look like?
npm run flows    # does it actually work?
```

`check` first, always. A screenshot of a blank page tells you it's blank;
`check` tells you *why*, and it caught the bug that made every route blank
during development (a Zustand selector returning a fresh object each call,
which trips `useSyncExternalStore`).

## flows — why this exists

Static screenshots can only capture idle states. The gacha reveal, an answered
quiz step and a populated collection are all unreachable without clicking, so
they would ship unverified.

It also caught a genuine bug static capture never could: the reel mounted with
its final transform already applied, so no CSS transition ran, `transitionend`
never fired, and the spin hung forever on "Rolling…". The idle screenshot
looked perfect.

Current flows:

- **`spin-reveal`** — clicks SPIN, waits out the 3.4s reel, asserts the result
  card appears.
- **`spin-does-not-repeat`** — spins four times, **reloading between each**, and
  asserts no reroll repeats. The reload is the point: the repeat bug only
  existed because the seed counter was component state that reset on refresh.
- **`show-more-is-append-only`** — records the visible card titles, clicks
  "Show more", and fails if any already-visible row moved. Guards the engine's
  prefix-stable composition.
- **`quiz-to-results`** — selects *Switch 2 only*, walks the whole quiz, then
  asserts **every result card carries a Switch 2 badge**. This is the platform
  guarantee verified through the real UI, not just in engine unit tests.
- **`save-persists`** — saves a game, reloads, asserts it survived.
- **`mobile-fold-*`** — asserts zero horizontal overflow at 390px and captures
  viewport-only (not full-page) shots of what a phone actually sees first.

Failures write `screenshot/FAILED-<flow>.png` so you can see the state it
got stuck in.

## The part people skip

**Open the PNGs and look at them.** Screenshots that are generated and never
read provide no verification at all. Every visual problem found during
development — an all-gold front page, an invisible zero-value vibe bar, dead
space above the detail hero, the same match reason repeated on seven cards —
was found by looking, not by a passing test.
