# HTML5 Genetic Cars

## What This Is

A browser-based genetic algorithm car evolver using Box2D physics, inspired by BoxCar2D. Cars are evolved over procedurally generated terrain using a genome-to-chassis mapping, with generation management, ghost replay, and tunable simulation parameters. Pure client-side — no server required.

## Core Value

The simulation runs reliably in-browser with reproducible terrain and deterministic generation progression — everything else is scaffolding around that.

## Current Milestone: v1.0 Modern Tooling Refactor

**Goal:** Replace the no-build static setup with Vite + Vitest + Yarn PnP while keeping simulation behavior identical.

**Target features:**

- Vite dev server + SPA build pipeline (replaces `python3 -m http.server`)
- Vitest unit test framework (first automated coverage)
- Yarn PnP with zero-installs (committed `.yarn/cache`, no `node_modules`)
- No CDN dependencies — all deps bundled locally

## Requirements

### Validated

- ✓ Genetic algorithm car simulation runs in-browser — existing
- ✓ Box2D physics integration (chassis + wheel genome) — existing
- ✓ Canvas-based rendering (cars, terrain, graph, minimap) — existing
- ✓ Generation management (GA + simulated annealing paths) — existing
- ✓ Ghost best-run replay — existing
- ✓ LocalStorage persistence (save/restore progress) — existing
- ✓ Terrain generation (seeded, optional mutability) — existing
- ✓ UI controls (mutation rate, gravity, elite size, floor, camera) — existing

### Active

- [ ] Vite dev server with HMR replaces static file serving
- [ ] Vitest test suite covers core ML/GA logic
- [ ] Yarn PnP zero-installs: no `node_modules`, `.yarn/cache` committed
- [ ] All dependencies bundled — no CDN scripts in index.html
- [ ] box2d.js and seedrandom.js imported as modules (not `<script>` tags)
- [ ] d3 and vis CDN loads removed (confirmed unused in current codebase)

### Out of Scope

- Splitting src/app.js into multiple ES modules — separate refactor, not tooling
- Changing simulation logic or behavior — pure tooling milestone
- Adding new simulation features — future milestone
- TypeScript migration — future milestone (tooling foundation enables this)
- Server-side rendering — static SPA is the target
- CI/CD pipeline — future milestone

## Context

The codebase is a hand-bundled IIFE (~2200 lines). The current setup has no package.json, no build step. CDN loads for `d3 v3` and `vis 4.20.0` exist in `index.html` but are confirmed unused in `src/app.js` (zero references). `lib/box2d.js` is CommonJS-style (uses `exports.*`), `lib/seedrandom.js` mutates `Math.seedrandom` globally. A `node_modules/` directory with vite/typescript/rollup exists but has no `package.json` — stale from previous exploration. Only one global is exposed: `window.cw_setCameraTarget` (used in an inline `onclick` in `index.html`).

## Constraints

- **Behavior**: Simulation output must be identical before/after — terrain, physics, GA progression
- **Browser**: SPA bundle targets modern browsers (no IE/legacy support needed)
- **Architecture**: src/app.js stays as a single file IIFE for now — imported as side-effect
- **Compatibility**: Yarn PnP zero-installs requires `.yarn/cache` committed (~reasonable size)

## Key Decisions

| Decision                                | Rationale                                                           | Outcome   |
| --------------------------------------- | ------------------------------------------------------------------- | --------- |
| Drop d3 and vis CDN loads entirely      | Both confirmed unused in current code                               | — Pending |
| Keep src/app.js as single IIFE          | Splitting is a separate concern; tooling migration first            | — Pending |
| Yarn PnP over npm/pnpm                  | Zero-installs means contributors clone and run without install step | — Pending |
| box2d.js via Vite plugin or manual shim | CommonJS exports need compat layer                                  | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):

1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):

1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---

_Last updated: 2026-03-26 after milestone v1.0 initialization_
