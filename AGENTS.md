## Index

- [Overview](#overview)
- [How the app boots](#how-the-app-boots)
- [File map for AI agents](#file-map-for-ai-agents)
  - [`index.html`](#indexhtml)
  - [`styles.css`](#stylescss)
  - [`src/app.js`](#srcappjs)
- [Main runtime concepts](#main-runtime-concepts)
  - [Generation state](#generation-state)
  - [Runner state](#runner-state)
  - [Car wrapper map](#car-wrapper-map)
  - [Ghost replay](#ghost-replay)
  - [Persistence](#persistence)
- [Safe change guidance](#safe-change-guidance)
  - [Good places to modify](#good-places-to-modify)
  - [Couplings to watch](#couplings-to-watch)
  - [Preferred workflow for edits](#preferred-workflow-for-edits)
- [Running and verifying](#running-and-verifying)
- [Suggested documentation maintenance rules](#suggested-documentation-maintenance-rules)

## Overview

`HTML5_Genetic_Cars` is a Vite-based SPA that evolves 2D cars over procedurally generated terrain. Run `yarn dev` to start the dev server at localhost:5173, or `yarn build && yarn preview` for a production build.

The runtime is intentionally minimal:

- `index.html` defines the entire UI shell: canvases, control buttons, form inputs, score panels, and explanatory text.
- `styles.css` contains all layout and widget styling.
- `src/app.js` is a hand-bundled single-file application containing the simulation, genetic algorithm logic, rendering, replay support, and DOM event wiring.
- `src/main.js` is the Vite entry point (one line: `import "./app.js"`).
- `public/lib/box2d.js` and `public/lib/seedrandom.js` are vendored runtime dependencies loaded as classic `<script>` tags (outside Vite's module graph).

## How the app boots

1. `index.html` loads local `styles.css`, vendored libraries from `public/lib/` as classic scripts (seedrandom then box2d), and `src/main.js` as a module entry point.
2. `src/main.js` imports `src/app.js`, which executes immediately inside an IIFE and resolves all required DOM nodes up front.
3. The main entry section starts around `src/app.js:1453` (`index.js (main entry)`). It initializes global state, creates the first generation, builds the world, wires UI event listeners, and starts the animation loop.
4. The simulation advances through `requestAnimationFrame`, while Box2D stepping is handled inside the current runner created by `worldRun(...)`.

## File map for AI agents

### `index.html`

Important regions:

- `#mainbox`: primary simulation canvas.
- `#graphcanvas`: line graph of generation metrics.
- `#topscores`: leaderboard / replay list.
- `#minimap`: terrain overview.
- Control buttons such as `#save-progress`, `#restore-progress`, `#new-population`, `#fast-forward`, `#toggle-display`, and `#toggle-ghost`.
- Tunable controls including world seed input, mutation rate, selection mode, gravity, motor speed, floor mutability, and camera follow options.

When changing UI behavior, update `index.html` and the related DOM lookup/event handling in `src/app.js` together.

### `styles.css`

Pure presentation. It assumes a fixed-width desktop layout (`body` has `min-width: 1200px`) and fixed canvas sizes. Avoid CSS changes when working only on simulation logic.

### `src/app.js`

This file is organized as an inlined bundle with preserved section comments. Treat those comment banners as the module map.

Key sections:

- `machine-learning/random.js` (`src/app.js:7`): helper functions for generating normalized, integer, float, and shuffled genome values, plus mutation logic.
- `machine-learning/create-instance.js` (`src/app.js:112`): creates generation-zero genomes, cross-bred children, mutated clones, and typed genomes.
- `car-schema/construct.js` (`src/app.js:202`): central constants and schema generation. `worldDef()` defines physics/world defaults and is the best place to inspect simulation-wide constants.
- `car-schema/def-to-car.js` (`src/app.js:232`): converts a genome definition into a Box2D chassis plus wheels.
- `car-schema/run.js` (`src/app.js:355`): updates a single car’s physics-derived state, health, and score.
- `generation-config/*` (`src/app.js:437` onward): parent selection and default generation settings. `generationConfig.constants` currently sets generation size, champion preservation, and mutation defaults.
- `machine-learning/genetic-algorithm/manage-round.js` (`src/app.js:541`): builds the initial generation and subsequent GA generations.
- `machine-learning/simulated-annealing/manage-round.js` (`src/app.js:633`): alternative search strategy. Present in the bundle but secondary to the default GA flow.
- `ghost/*` (`src/app.js:709` onward): capture and replay of best runs.
- `draw/*` (`src/app.js:938` onward): all canvas rendering helpers for cars, terrain, graphs, and overlays.
- `cw_Car` (`src/app.js:1227`): UI-oriented wrapper around a live car, including health bar and minimap integration.
- `world/setup-scene.js` (`src/app.js:1287`): terrain generation and finish-line placement.
- `world/run.js` (`src/app.js:1392`): creates the active Box2D world, steps cars, removes dead bodies, and ends a generation.
- `index.js (main entry)` (`src/app.js:1453` onward): global app state, DOM integration, persistence, generation resets, and the animation loop.

## Main runtime concepts

### Generation state

`generationState` stores the current generation counter and the array of car genome definitions. New generations are derived from score-ranked results after all cars die.

### Runner state

`currentRunner` is the active world instance returned by `worldRun(world_def, generationState.generation, uiListeners)`. It owns:

- `scene.world`: Box2D world.
- `scene.floorTiles`: generated terrain bodies.
- `scene.finishLine`: finish distance.
- `cars`: live car entries with `def`, `car`, `state`, and eventually `score`.
- `step()`: advances physics and emits lifecycle callbacks.

### Car wrapper map

`carMap` maps live runner car entries to `cw_Car` instances, which manage UI state such as health bars, replay capture, and minimap markers.

### Ghost replay

Ghost functionality stores best-run frames and can render a replay over the live simulation. If `world_def.mutable_floor` is enabled, ghost reuse is intentionally disabled because the terrain changes between runs.

### Persistence

`saveProgress()` and `restoreProgress()` use browser `localStorage` keys:

- `cw_savedGeneration`
- `cw_genCounter`
- `cw_ghost`
- `cw_topScores`
- `cw_floorSeed`

Any change to generation data structures should preserve or deliberately migrate these keys.

## Safe change guidance

### Good places to modify

- UI labels/layout: `index.html` and `styles.css`.
- Simulation defaults: `carConstruct.worldDef()` and `generationConfig.constants` in `src/app.js`.
- Car genome shape: `carConstruct.generateSchema(...)`, plus any code that assumes wheel/chassis attribute counts.
- Selection/mutation behavior: `generation-config/*`, `manageRound`, and `random.mutateReplace(...)`.
- Scoring/survival behavior: `car-schema/run.js`.
- Terrain behavior: `setupScene(...)` / `cw_createFloor(...)`.

### Couplings to watch

- DOM ids in `index.html` are referenced directly from `src/app.js`. Renaming ids requires matching JavaScript updates.
- The app assumes two wheels by default through `carConstantsData.wheelCount`; changes ripple into schema generation, rendering, and car construction.
- `cw_Car` expects health bar and minimap DOM nodes for each car to exist before wrappers are created.
- `worldRun(...)` destroys Box2D bodies when cars die; code holding stale references after death can break rendering or replay logic.
- Seed handling uses `Math.seedrandom(...)` globally, so changes to seed flow can affect deterministic terrain generation.

### Preferred workflow for edits

1. Find the nearest banner section in `src/app.js` instead of scanning the whole file blindly.
2. Keep related UI id changes synchronized between HTML and JavaScript.
3. For simulation changes, verify both initialization (`cw_generationZero`, `worldRun`) and reset paths (`cw_resetWorld`, new population, restore progress).
4. For persistence-related changes, test save + restore in the browser because there is no automated test suite in this repository.

## Running and verifying

- Dev: `yarn dev` — starts Vite at http://localhost:5173.
- Production: `yarn build && yarn preview` — builds to `dist/` and serves at http://localhost:4173.
- Uses Yarn Berry PnP (no `node_modules/`). After cloning, run `yarn install`.
- No automated test suite yet. Verification is manual: confirm the page loads, cars spawn, generations advance, graphs render, and UI controls still respond.

## Suggested documentation maintenance rules

- If you split `src/app.js` in the future, update this file first so agents know the new module boundaries.
- If you add new controls or persistence keys, document them here.
- Prefer extending existing section banners and nearby logic rather than introducing unrelated patterns; the codebase is intentionally old-school and tightly coupled to the DOM.
