# skills/

Modular utilities that are **independent of the React app**. Each subfolder is self-contained
and could be lifted out of Ludex without dragging the UI along.

| Skill | Language | Purpose |
|---|---|---|
| `recommendation/` | TypeScript (pure) | The matching engine — platform filtering, vibe scoring, tier quota, explanations. Plus its Vitest suite. |
| `data-pipeline/` | Node ESM (`.mjs`) | Dataset tooling: `validate-dataset.mjs`, `stats.mjs`, `enrich-art.mjs`. |
| `screenshot/` | Node ESM (`.mjs`) | `capture.mjs` — drives a headless browser to snapshot every route into `screenshot/`. |

## The hard rule

**No React, no DOM, no browser globals in `recommendation/`.** It must run under plain Node so
it can be unit-tested headlessly and reused in a CLI, a bot, or a serverless function later.
`src/engine/` is a one-line re-export that bridges it into the app.

The `data-pipeline/` and `screenshot/` scripts are Node-only by nature — they read and write
files and never ship to the browser.

## Why these live outside `src/`

Anything in `src/` is bundle-bound and implicitly allowed to reach for React. Putting the engine
here makes the layering boundary physical rather than a convention someone has to remember:
if a React import ever appears in `skills/recommendation/`, it's obviously wrong.

## Adding a skill

1. Create `skills/<name>/` with its own `README.md` stating inputs, outputs, and dependencies.
2. Pure-logic skills get a colocated `*.test.ts` — Vitest picks up `skills/**/*.test.ts`.
3. Node scripts get an `npm run` alias in `package.json`; don't expect anyone to remember a path.
