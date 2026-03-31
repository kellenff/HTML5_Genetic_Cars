## Index

- [Overview](#overview)
- [How the app boots](#how-the-app-boots)
- [File map for AI agents](#file-map-for-ai-agents)
  - [`index.html`](#indexhtml)
  - [`styles.css`](#stylescss)
  - [`src/lib/`](#srclibjs)
  - [`src/genetics/`](#srcgenetics)
  - [`src/generation-config.js`](#srcgeneration-configjs)
  - [`src/physics/`](#srcphysics)
  - [`src/rendering/`](#srcrendering)
  - [`src/ghost/`](#srcghost)
  - [`src/ui/`](#srcui)
  - [`src/main.js`](#srcmainjs)
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
- `src/` contains ~25 ES modules organized by concern (genetics, physics, rendering, ghost, ui) with `src/main.js` as the orchestrator.
- `public/lib/box2d.js` and `public/lib/seedrandom.js` are vendored runtime dependencies loaded as classic `<script>` tags (outside Vite's module graph), re-exported into the module graph via `src/lib/` shims.

## How the app boots

1. `index.html` loads `styles.css`, vendored libraries from `public/lib/` as classic scripts (seedrandom then box2d), and `src/main.js` as the module entry point.
2. `src/main.js` imports all required modules, resolves DOM nodes up front, and immediately initializes app state.
3. `main.js` calls `manageRound.generationZero(...)` to create the first genome population, then `worldRun(...)` to build the Box2D world and start the simulation.
4. The simulation advances through `requestAnimationFrame` via the game loop created by `createGameLoop(...)` from `src/ui/game-loop.js`.

## File map for AI agents

### `index.html`

Important regions:

- `#mainbox`: primary simulation canvas.
- `#graphcanvas`: line graph of generation metrics.
- `#topscores`: leaderboard / replay list.
- `#minimap`: terrain overview.
- Control buttons: `#save-progress`, `#restore-progress`, `#new-population`, `#fast-forward`, `#toggle-display`, `#toggle-ghost`.
- Tunable controls: world seed input, mutation rate, selection mode, gravity, motor speed, floor mutability, and camera follow options.

When changing UI behavior, update `index.html` and the related DOM lookup/event handling in `src/main.js` together.

### `styles.css`

Pure presentation. Assumes a fixed-width desktop layout (`body` has `min-width: 1200px`) and fixed canvas sizes. Avoid CSS changes when working only on simulation logic.

### `src/lib/`

Thin shims that bridge the vendored classic-script globals into the ES module graph.

- `src/lib/box2d.js`: re-exports `b2World`, `b2Vec2`, `b2BodyDef`, `b2Body`, `b2FixtureDef`, `b2PolygonShape`, `b2CircleShape`, `b2RevoluteJointDef`, and others from `window.*`.
- `src/lib/seedrandom.js`: exports a `seedrandom(seed)` wrapper around `Math.seedrandom(...)`.

No app logic lives here. These files only exist to satisfy ES module imports without changing the vendored scripts.

### `src/genetics/`

Pure functions — no DOM, no Box2D, no imports from other app modules.

- `src/genetics/random.js` — exports `random`: helpers for generating normalized, integer, float, and shuffled genome values, plus `random.mutateReplace(...)` for mutation.
- `src/genetics/create-instance.js` — exports `createInstance`: creates generation-zero genomes (`createInstance.generationZero`), cross-bred children (`createInstance.crossBreed`), mutated clones (`createInstance.clone`), and typed-schema genomes (`createInstance.applyTypes`).
- `src/genetics/manage-round.js` — exports `manageRound` with `{ generationZero, nextGeneration }`: orchestrates GA generation transitions, scores parents, selects survivors, and builds new populations.
- `src/genetics/manage-round-sa.js` — exports `manageRoundSA` with `{ generationZero, nextGeneration }`: simulated annealing alternative. Present but unused by default; the GA path is active.

### `src/generation-config.js`

Exports `generationConfig`: parent selection logic and default generation settings. `generationConfig.constants` sets generation size, champion preservation count, and mutation defaults. `generationConfig.schema` wires per-attribute mutation constraints to the physics schema from `src/physics/construct.js`.

Imports from `src/physics/construct.js` only.

### `src/physics/`

Converts genome definitions into Box2D simulation objects and steps the world.

- `src/physics/car-constants.js` — exports `carConstantsData`: wheel count, min/max chassis and wheel dimensions. The canonical source of `wheelCount`; changes here ripple into schema, rendering, and construction.
- `src/physics/construct.js` — exports `carConstruct`: schema generation (`carConstruct.generateSchema(...)`) and physics/world defaults (`carConstruct.worldDef()`). `worldDef()` is the best single place to inspect simulation-wide constants such as gravity, motor speed, and floor mutability.
- `src/physics/def-to-car.js` — exports `defToCar(normal_def, world, constants)`: converts a normalized genome definition into a Box2D chassis body plus wheel bodies with revolute joints.
- `src/physics/run.js` — exports `carRun`: updates a single car's physics-derived state (`carRun.update(...)`), evaluates health (`carRun.isAlive(...)`), and computes score.
- `src/physics/setup-scene.js` — exports `setupScene(world_def)`: procedural terrain generation and finish-line placement. Uses `Math.seedrandom(...)` for deterministic floor tile layout.
- `src/physics/world-run.js` — exports `worldRun(world_def, defs, listeners)`: creates the active Box2D world, calls `setupScene`, spawns all cars via `defToCar`, steps physics each tick, removes dead bodies, and ends a generation by calling the `onGenerationEnd` listener.

### `src/rendering/`

Canvas drawing helpers. No simulation logic, no DOM mutation beyond canvas context calls.

- `src/rendering/primitives.js` — exports `drawVirtualPoly(ctx, body, vtx, n_vtx)` and `drawCircle(ctx, body, center, radius, angle, color)`: low-level shape drawing in world-to-screen space.
- `src/rendering/draw-floor.js` — exports `drawFloor(ctx, camera, cw_floorTiles)`: draws terrain tiles with camera-offset culling.
- `src/rendering/draw-car.js` — exports `drawCar(car_constants, myCar, camera, ctx)`: draws a car's chassis polygon and wheel circles.
- `src/rendering/graphs.js` — exports `plotGraphs(...)` and `clearGraphics(...)`: renders the generation score line graph and updates the top-scores leaderboard DOM.

### `src/ghost/`

Captures and replays the best-run recording.

- `src/ghost/car-to-ghost.js` — exports `getFrame(car)`: extracts a single physics frame snapshot from a live Box2D car entry (chassis + wheels positions and angles).
- `src/ghost/ghost.js` — exports `createReplay()`, `createGhost()`, `resetGhost(ghost)`, `pause(ghost)`, `resume(ghost)`, `getPosition(ghost)`, `compareToReplay(replay, ghost, max)`, `moveFrame(ghost)`, `addReplayFrame(replay, car)`, `drawFrame(ctx, ghost, camera)`: full replay state machine. Ghost reuse is intentionally disabled when `world_def.mutable_floor` is true (terrain changes between runs).

### `src/ui/`

UI integration, DOM wiring, and app lifecycle. These modules are the only ones that touch the DOM (besides `main.js`).

- `src/ui/camera.js` — exports `createCamera()`, `setCameraTarget(camera, target, currentRunner, carMap)`, `setCameraPosition(camera, carMap, leaderPosition)`, `updateMinimapCamera(camera, minimapCameraStyle, minimapscale)`: camera state and leader-tracking logic.
- `src/ui/car-ui.js` — exports `cw_Car` (constructor), `setupCarUI(runner, carMap, ghostFns)`, `resetCarUI(generationState, generationConfig)`: per-car UI wrapper managing health bars, replay capture, and minimap markers. Expects health bar and minimap DOM nodes to exist before wrappers are created.
- `src/ui/persistence.js` — exports `saveProgress(generationState, ghostState, graphState, world_def)` and `restoreProgress()`: serializes/deserializes app state to browser `localStorage`.
- `src/ui/game-loop.js` — exports `createGameLoop({ stepFn, drawFn, box2dfps })` and `createFastLoop({ stepFn, screenfps })`: `requestAnimationFrame`-based normal and fast-forward animation loops.
- `src/ui/ghost-replay.js` — exports `createGhostReplay({ drawFn, fps })`: manages the `setInterval` that drives ghost replay rendering independently of the main loop.

### `src/main.js`

The orchestrator. Owns all mutable app state and wires everything together. Key responsibilities:

- Imports all modules and resolves all DOM node references up front.
- Holds `generationState` (current generation counter + genome array), `currentRunner` (active world instance), `carMap` (runner car → `cw_Car` wrapper), `ghostState`, and `graphState`.
- Wires all DOM event listeners (buttons, inputs, select boxes).
- Implements `cw_generationZero(...)` (init first generation), `cw_resetWorld(...)` (tear down and restart), save/restore handlers, and the generation-end callback that calls `manageRound.nextGeneration(...)`.
- Starts the animation loop via `createGameLoop(...)`.

## Main runtime concepts

### Generation state

`generationState` stores the current generation counter and the array of car genome definitions. New generations are derived from score-ranked results after all cars die, via `manageRound.nextGeneration(...)`.

### Runner state

`currentRunner` is the active world instance returned by `worldRun(world_def, defs, listeners)`. It owns:

- `scene.world`: Box2D world.
- `scene.floorTiles`: generated terrain bodies.
- `scene.finishLine`: finish distance.
- `cars`: live car entries with `def`, `car`, `state`, and eventually `score`.
- `step()`: advances physics and emits lifecycle callbacks.

### Car wrapper map

`carMap` maps live runner car entries to `cw_Car` instances (from `src/ui/car-ui.js`), which manage UI state such as health bars, replay capture, and minimap markers.

### Ghost replay

Ghost functionality (in `src/ghost/`) stores best-run frames and renders a replay over the live simulation. Replay rendering runs on its own interval via `src/ui/ghost-replay.js`. If `world_def.mutable_floor` is enabled, ghost reuse is intentionally disabled because the terrain changes between runs.

### Persistence

`saveProgress()` and `restoreProgress()` in `src/ui/persistence.js` use browser `localStorage` keys:

- `cw_savedGeneration`
- `cw_genCounter`
- `cw_ghost`
- `cw_topScores`
- `cw_floorSeed`

Any change to generation data structures should preserve or deliberately migrate these keys.

## Safe change guidance

### Good places to modify

- UI labels/layout: `index.html` and `styles.css`.
- Simulation defaults: `carConstruct.worldDef()` in `src/physics/construct.js` and `generationConfig.constants` in `src/generation-config.js`.
- Car genome shape: `carConstruct.generateSchema(...)` in `src/physics/construct.js`, plus any code that assumes wheel/chassis attribute counts.
- Selection/mutation behavior: `src/generation-config.js`, `src/genetics/manage-round.js`, and `random.mutateReplace(...)` in `src/genetics/random.js`.
- Scoring/survival behavior: `src/physics/run.js`.
- Terrain behavior: `setupScene(...)` in `src/physics/setup-scene.js`.

### Couplings to watch

- DOM ids in `index.html` are referenced directly from `src/main.js`. Renaming ids requires matching JavaScript updates.
- The app assumes two wheels by default via `carConstantsData.wheelCount` in `src/physics/car-constants.js`; changes ripple into `src/physics/construct.js` (schema), `src/rendering/draw-car.js` (rendering), and `src/physics/def-to-car.js` (construction).
- `cw_Car` expects health bar and minimap DOM nodes for each car to exist before wrappers are created.
- `worldRun(...)` destroys Box2D bodies when cars die; code holding stale references after death can break rendering or replay logic.
- Seed handling uses `Math.seedrandom(...)` via `src/lib/seedrandom.js`, so changes to seed flow can affect deterministic terrain generation.

### Preferred workflow for edits

1. Identify the relevant module from the file map above rather than searching across the whole codebase.
2. Keep related UI id changes synchronized between `index.html` and `src/main.js`.
3. For simulation changes, verify both initialization (`manageRound.generationZero`, `worldRun`) and reset paths (new population, restore progress) in `src/main.js`.
4. For persistence-related changes, test save + restore in the browser because there is no automated test suite.

## Running and verifying

- Dev: `yarn dev` — starts Vite at http://localhost:5173.
- Production: `yarn build && yarn preview` — builds to `dist/` and serves at http://localhost:4173.
- Uses Yarn Berry PnP (no `node_modules/`). After cloning, run `yarn install`.
- No automated test suite yet. Verification is manual: confirm the page loads, cars spawn, generations advance, graphs render, and UI controls still respond.

## Suggested documentation maintenance rules

- If you add or remove a module, update the file map in this file and the module tree in `CLAUDE.md`.
- If you add new controls or persistence keys, document them here under the relevant section.
- Prefer extending logic within the appropriate existing module rather than introducing new files; if you do add a file, keep it within the established dependency direction (no cycles).
