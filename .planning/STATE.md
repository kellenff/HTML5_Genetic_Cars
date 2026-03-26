# State

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-03-26 — Milestone v1.0 started

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-26)

**Core value:** The simulation runs reliably in-browser with reproducible terrain and deterministic generation progression.
**Current focus:** v1.0 Modern Tooling Refactor

## Accumulated Context

- Codebase map exists at `.planning/codebase/` (7 documents)
- `d3` and `vis` are loaded from CDN in `index.html` but have **zero usages** in `src/app.js` — confirmed dead, safe to drop
- `lib/box2d.js` is CommonJS-style (`exports.b2*`) — needs Vite compat handling
- `lib/seedrandom.js` mutates `Math.seedrandom` globally — import order matters
- `window.cw_setCameraTarget` is the only global exposed (inline `onclick` in `index.html`)
- `src/app.js` is a single IIFE — stays intact, imported as side-effect module
- Stale `node_modules/` present (vite/typescript/rollup, no package.json) — will be replaced by Yarn PnP
