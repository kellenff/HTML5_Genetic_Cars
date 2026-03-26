# Technology Stack

**Analysis Date:** 2026-03-26

## Languages

**Primary:**

- JavaScript (ES6+) - All application logic in `src/app.js`, vendored libs in `lib/`

**Secondary:**

- Rust (via wasm-bindgen) - WASM simulation engine in `crates/genetic-cars-sim/`; Rust source is not committed (only pre-built `pkg/` artifacts exist)
- HTML5 - UI shell in `index.html`
- CSS3 - Styling in `styles.css`

## Runtime

**Environment:**

- Browser only (Chrome recommended per page title)
- No server-side runtime; static files served directly
- Canvas 2D API for all rendering (no WebGL)
- WebAssembly for the alternate `dist/` build variant

**Package Manager:**

- None for the primary app (no `package.json` at project root)
- `node_modules/` contains dev-only tooling for the WASM build variant (Vite + plugins)

## Frameworks

**Core:**

- None. Vanilla JavaScript with direct DOM manipulation. The entire app is a single IIFE in `src/app.js` (2208 lines).

**Physics Engine:**

- Box2D.js (vendored) - `lib/box2d.js` (11,408 lines). JavaScript port of Box2D 2D physics.

**Testing:**

- No test framework. Manual verification only.

**Build/Dev (WASM variant only):**

- Vite 5.4.21 - Bundles the WASM-integrated `dist/app.js` build
- vite-plugin-wasm 3.6.0 - WASM loading support for Vite
- esbuild 0.21.5 - Used by Vite internally
- rollup 4.59.0 - Used by Vite internally
- TypeScript 5.9.3 - Type declarations for the WASM bindings

## Key Dependencies

**Critical (vendored in `lib/`):**

- Box2D.js (unknown version) - `lib/box2d.js` - 2D physics simulation engine; all car bodies, terrain, joints, and collision handled through this
- seedrandom.js (by David Bau, circa 2010) - `lib/seedrandom.js` (270 lines) - Deterministic PRNG via `Math.seedrandom()`; controls terrain generation reproducibility

**Critical (CDN-loaded):**

- d3 v3 - `https://d3js.org/d3.v3.min.js` - Loaded in `index.html` line 307; referenced in HTML but not directly called in `src/app.js` (likely used historically or available for future graphing)
- vis.js 4.20.0 - `https://cdnjs.cloudflare.com/ajax/libs/vis/4.20.0/vis.min.js` - Loaded in `index.html` line 308; CSS loaded at line 7; similarly available but not directly invoked in current `src/app.js`

**WASM Simulation (alternate build in `dist/`):**

- genetic-cars-sim 0.1.0 - `crates/genetic-cars-sim/pkg/` - Rust-compiled WASM module providing `SimEngine` class with physics stepping, genome management, and generation lifecycle. Built with wasm-bindgen.

## Configuration

**Environment:**

- No `.env` files; no environment variables
- All configuration is embedded in `src/app.js` as constants and DOM-wired UI controls
- World seed: user-provided or auto-generated via `Math.seedrandom()`
- Tunable via UI: mutation rate, mutation size, gravity, floor mutability, elite clones

**Build (WASM variant):**

- No `vite.config.*` file found at project root; Vite config may have been removed or uses defaults
- `dist/app.js` is a pre-built Vite output (2118 lines) that bundles the WASM glue code inline

## Platform Requirements

**Development:**

- Any modern browser (Chrome recommended)
- Optional: `python3 -m http.server 8000` to serve files if browser blocks local file access
- For WASM variant development: Node.js 18+ (for Vite), Rust toolchain with `wasm32-unknown-unknown` target, wasm-pack

**Production:**

- Static file hosting only (no server required)
- Browser must support: Canvas 2D, ES6, localStorage
- For WASM variant: browser must support WebAssembly

## Two Build Variants

**Primary (no build step):**

- Entry: `index.html` loads `lib/seedrandom.js`, `lib/box2d.js`, CDN scripts, then `src/app.js`
- Physics: JavaScript Box2D in `lib/box2d.js`
- This is the active, maintained version

**WASM variant (requires Vite build):**

- Entry: `dist/app.js` (pre-built Vite bundle)
- Physics: Rust-compiled WASM in `dist/assets/genetic_cars_sim_bg-Cli5_Qj6.wasm` (~499KB)
- Exposes `SimEngine` class with `step_all()`, `next_generation()`, `end_generation()`, etc.
- The WASM variant replaces Box2D.js physics with a Rust implementation but retains the same JS rendering layer

---

_Stack analysis: 2026-03-26_
