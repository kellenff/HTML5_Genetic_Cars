# Architecture

**Analysis Date:** 2026-03-26

## Pattern Overview

**Overall:** Single-file monolith (IIFE) with logical module sections

**Key Characteristics:**

- All application logic lives in one file (`src/app.js`, 2208 lines) wrapped in an IIFE
- Logical sections delimited by banner comments emulate a multi-module structure
- No build step, no module bundler, no import/export -- everything is function-scoped within the IIFE
- Direct DOM manipulation throughout (no framework)
- A parallel Rust/WASM simulation engine exists in `crates/` and `dist/` but is not loaded by the primary `index.html`

## Layers

**Genome / Random Layer:**

- Purpose: Generate, mutate, and crossbreed car genome values (normalized floats)
- Location: `src/app.js:7-110` (section `machine-learning/random.js`)
- Contains: `random` object with `createNormals`, `createFloats`, `createIntegers`, `shuffleIntegers`, `mapToFloat`, `mapToInteger`, `mapToShuffle`, `mutateReplace`; standalone `createNormal()` helper
- Depends on: Nothing (leaf module)
- Used by: `createInstance`, `manageRound`, `manageRoundSA`

**Instance Creation Layer:**

- Purpose: Create genome instances (generation zero, crossbred children, mutated clones) and apply schema types
- Location: `src/app.js:112-184` (section `machine-learning/create-instance.js`)
- Contains: `createInstance` object with `createGenerationZero`, `createCrossBreed`, `createMutatedClone`, `applyTypes`
- Depends on: `random`
- Used by: `manageRound`, `manageRoundSA`

**Car Schema Layer:**

- Purpose: Define car constants, schema structure, and world physics defaults
- Location: `src/app.js:188-229` (sections `car-schema/car-constants.json` and `car-schema/construct.js`)
- Contains: `carConstantsData` (inlined JSON), `carConstruct` IIFE returning `worldDef()`, `carConstants()`, `generateSchema()`
- Depends on: `carConstantsData`
- Used by: `generationConfig`, `defToCar`, main entry

**Car Construction Layer:**

- Purpose: Convert a genome definition into Box2D physics bodies (chassis + wheels + joints)
- Location: `src/app.js:232-351` (section `car-schema/def-to-car.js`)
- Contains: `defToCar()`, `createChassis()`, `createChassisPart()`, `createWheel()`
- Depends on: `createInstance.applyTypes`, Box2D globals (`b2RevoluteJointDef`, `b2Vec2`, `b2BodyDef`, `b2Body`, `b2FixtureDef`, `b2PolygonShape`, `b2CircleShape`)
- Used by: `worldRun`

**Car State Layer:**

- Purpose: Track per-car physics state (health, position, score) each frame
- Location: `src/app.js:355-434` (section `car-schema/run.js`)
- Contains: `carRun` object with `getInitialState`, `updateState`, `getStatus`, `calculateScore`
- Depends on: Nothing (pure state logic)
- Used by: `worldRun`, `cw_Car.kill`

**Generation Config Layer:**

- Purpose: Configure parent selection, mutation defaults, and schema for the GA
- Location: `src/app.js:437-538` (sections `generation-config/*`)
- Contains: `flatRankSelect()`, `pickParent()`, `generateRandom()`, `generationConfig` IIFE
- Key constants: `generationSize: 20`, `championLength: 1`, `mutation_range: 1`, `gen_mutation: 0.05`
- Depends on: `carConstruct`
- Used by: `manageRound`, main entry (UI settings mutate `generationConfig.constants` directly)

**GA Round Management Layer:**

- Purpose: Orchestrate generation lifecycle (create gen zero, produce next generation via crossover + mutation)
- Location: `src/app.js:541-630` (section `machine-learning/genetic-algorithm/manage-round.js`)
- Contains: `manageRound` IIFE returning `generationZero()`, `nextGeneration()`
- Depends on: `createInstance`, `generationConfig` (passed as `config` parameter)
- Used by: Main entry (`cw_generationZero`, `cw_newRound`)

**Simulated Annealing Layer:**

- Purpose: Alternative search strategy (secondary, not default)
- Location: `src/app.js:633-706` (section `machine-learning/simulated-annealing/manage-round.js`)
- Contains: `manageRoundSA` IIFE returning `generationZero()`, `nextGeneration()`
- Depends on: `createInstance`
- Used by: Not actively wired into the default flow

**Ghost Replay Layer:**

- Purpose: Capture per-frame car state and replay the best run as an overlay
- Location: `src/app.js:709-935` (sections `ghost/car-to-ghost.js` and `ghost/index.js`)
- Contains: Frame capture (`ghost_get_frame`, `ghost_get_chassis`, `ghost_get_wheel`), replay management (`ghost_fns` IIFE with create/pause/resume/compare/draw functions)
- Depends on: Box2D body API, Canvas 2D context
- Used by: Main entry (capture during `carStep`, draw during `cw_drawScreen`, replay via `cw_toggleGhostReplay`)

**Drawing Layer:**

- Purpose: All canvas rendering (cars, floor, graphs, minimap)
- Location: `src/app.js:938-1225` (sections `draw/*`)
- Contains: `cw_drawVirtualPoly()`, `cw_drawCircle()`, `cw_drawFloor()`, `graph_fns.plotGraphs()`, score listing, `drawCar()`
- Depends on: Canvas 2D context, Box2D body API, `carRun` (for score display)
- Used by: Main entry (`cw_drawScreen`, `cw_drawMiniMap`, `cleanupRound`)

**Car UI Wrapper:**

- Purpose: Per-car DOM integration (health bar, minimap marker, alive/dead status)
- Location: `src/app.js:1227-1282` (section `cw_Car`)
- Contains: `cw_Car` constructor + prototype methods (`__constructor`, `getPosition`, `kill`)
- Depends on: DOM elements (`health{N}`, `bar{N}`), `carRun.getStatus`
- Used by: Main entry (`setupCarUI`, `updateCarUI`, `uiListeners.carDeath`)

**World Setup Layer:**

- Purpose: Create Box2D world, generate terrain, place finish line
- Location: `src/app.js:1287-1389` (section `world/setup-scene.js`)
- Contains: `setupScene()`, `cw_createFloor()`, `cw_createFloorTile()`, `cw_rotateFloorTile()`
- Depends on: Box2D globals, `Math.seedrandom()` for deterministic terrain
- Used by: `worldRun`

**World Run Layer:**

- Purpose: Create and step the active simulation (Box2D world + car lifecycle)
- Location: `src/app.js:1392-1450` (section `world/run.js`)
- Contains: `worldRun()` returns runner object with `scene`, `cars`, `step()`
- Depends on: `setupScene`, `defToCar`, `carRun`
- Used by: Main entry (creates `currentRunner`)

**Main Entry / App State:**

- Purpose: Global state, DOM wiring, persistence, animation loop, UI event handlers
- Location: `src/app.js:1453-2208` (section `index.js (main entry)`)
- Contains: All global state (`world_def`, `generationState`, `currentRunner`, `ghost`, `carMap`, `camera`), DOM event listeners, `cw_init()`, `gameLoop()`, `saveProgress()`, `restoreProgress()`, settings handlers
- Depends on: Every other layer
- Used by: Self-executing (IIFE runs `cw_init()` at line 2205)

## Data Flow

**Initialization Flow:**

1. IIFE executes, all module-sections define their functions/objects
2. `cw_init()` clones DOM templates for health bars and minimap markers
3. `cw_generationZero()` creates 20 random genome definitions via `manageRound.generationZero()`
4. `worldRun()` creates Box2D world, terrain, and physics bodies for all cars
5. `setupCarUI()` wraps each car in a `cw_Car` instance (stored in `carMap`)
6. `cw_startSimulation()` begins `requestAnimationFrame` loop

**Per-Frame Simulation Flow:**

1. `gameLoop()` calls `simulationStep()` then `cw_drawScreen()`
2. `simulationStep()` calls `currentRunner.step()`
3. `step()` advances Box2D physics one tick (`world.Step(1/60, 20, 20)`)
4. For each alive car: `carRun.updateState()` updates health/position
5. `uiListeners.carStep()` updates DOM health bars, minimap markers, ghost replay frames
6. Dead cars trigger `uiListeners.carDeath()`: score calculated, Box2D bodies destroyed, `cw_Car.kill()` updates UI
7. When all cars dead: `uiListeners.generationEnd()` triggers next generation

**Generation Transition Flow:**

1. `cleanupRound()` sorts results by score, updates graph
2. `cw_newRound()` resets camera, reseeds `Math.random`, calls `manageRound.nextGeneration()`
3. `nextGeneration()` preserves elite clones, creates crossbred+mutated children
4. New `worldRun()` creates fresh Box2D world with same (or new) terrain
5. `setupCarUI()` re-wraps cars, `resetCarUI()` updates DOM counters

**State Management:**

- `generationState`: `{ counter: number, generation: GenomeDef[] }` -- the current generation number and array of genome definitions
- `currentRunner`: `{ scene, cars, step() }` -- the active Box2D world and car instances
- `carMap`: `Map<CarInfo, cw_Car>` -- maps runner car entries to UI wrappers
- `ghost`: `{ replay, frame, dist }` -- best-run replay data
- `graphState`: `{ cw_topScores, cw_graphAverage, cw_graphElite, cw_graphTop }` -- accumulated graph data across generations
- `world_def`: Mutable object holding physics/world configuration (gravity, floor seed, motor speed, etc.)
- `camera`: `{ speed, pos: {x, y}, target, zoom }` -- viewport tracking

**Event Handling Pattern:**

- DOM events: `addEventListener` on `document.querySelector()` results, bound in main entry section
- Simulation events: Callback-based via `uiListeners` object passed to `worldRun()` with `preCarStep`, `carStep`, `carDeath`, `generationEnd`
- One legacy inline handler: `onclick="cw_setCameraTarget(this.car_index)"` on health bars (requires `window.cw_setCameraTarget` at line 2203)

## Key Abstractions

**Genome Definition (def):**

- Purpose: Represents a car's genetic blueprint as normalized floats
- Shape: `{ id, index, is_elite, ancestry?, wheel_radius: float[], wheel_density: float[], chassis_density: float[], vertex_list: float[], wheel_vertex: int[] }`
- Created by: `createInstance.createGenerationZero()`, `createInstance.createCrossBreed()`, `createInstance.createMutatedClone()`
- Values stored as normalized [0,1] floats; `createInstance.applyTypes()` maps them to physical ranges via schema

**Schema:**

- Purpose: Defines the structure and value ranges for genome properties
- Shape: `{ wheel_radius: {type, length, min, range, factor}, ... }` for each genome property
- Created by: `carConstruct.generateSchema(carConstantsData)`
- Used to: Generate random genomes, apply type conversions, guide mutation

**Runner (currentRunner):**

- Purpose: Active simulation instance owning Box2D world and all live cars
- Shape: `{ scene: { world, floorTiles, finishLine }, cars: CarInfo[], step() }`
- Created by: `worldRun(world_def, defs, listeners)`
- `step()` is the core simulation tick; filters dead cars, emits callbacks

**CarInfo (car entry in runner):**

- Purpose: Links a genome def to its Box2D physics body and state
- Shape: `{ index, def, car: { chassis, wheels }, state: { frames, health, maxPositionx, maxPositiony, minPositiony }, score? }`
- Used as Map key in `carMap`

**cw_Car (UI wrapper):**

- Purpose: Bridges a CarInfo to DOM elements (health bar, minimap marker)
- Location: `src/app.js:1227-1282`
- Instance per live car, stored in `carMap` as values

## Entry Points

**Browser Entry:**

- Location: `index.html` line 309 loads `src/app.js`
- Triggers: Page load (script tag at bottom of body)
- Responsibilities: The IIFE executes immediately, `cw_init()` at line 2205 bootstraps everything

**Simulation Entry:**

- Location: `src/app.js:2070` (`cw_init()`)
- Triggers: Called once at IIFE end
- Responsibilities: Clone DOM templates, create generation zero, create Box2D world, start animation loop

**Animation Loop:**

- Location: `src/app.js:1801` (`gameLoop()`)
- Triggers: `requestAnimationFrame` chain started by `cw_startSimulation()`
- Responsibilities: Step physics, draw frame, schedule next frame

## Error Handling

**Strategy:** Minimal -- mostly exception-based guards in car state updates

**Patterns:**

- `carRun.updateState()` throws `Error("Already Dead")` or `Error("already Finished")` if called on an invalid car state (these are never caught; they indicate logic bugs)
- `worldRun.step()` throws `Error("no more cars")` when all cars are dead (caught implicitly by the generation end callback)
- `createInstance.applyTypes()` throws on unknown schema type
- No try/catch blocks in the codebase; errors propagate to browser console
- `restoreProgress()` uses `alert()` for missing save data

## Cross-Cutting Concerns

**Logging:** None. No `console.log` in production code. Debug div (`#debug`) exists in HTML but is unused.

**Validation:** None. Schema types are trusted; genome values are not bounds-checked after mutation.

**Authentication:** Not applicable (static client-side app).

**Determinism:** `Math.seedrandom()` from `lib/seedrandom.js` provides deterministic terrain generation. The seed is explicitly reset to true randomness before GA operations (`Math.seedrandom()` with no arg) to avoid correlated mutations.

**Persistence:** localStorage with `cw_` prefix keys. Stores generation genomes, counter, ghost data, top scores, floor seed. No versioning or migration.

---

_Architecture analysis: 2026-03-26_
