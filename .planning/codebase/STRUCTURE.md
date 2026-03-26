# Codebase Structure

**Analysis Date:** 2026-03-26

## Directory Layout

```
HTML5_Genetic_Cars/
├── index.html              # UI shell: canvases, controls, explanatory text
├── styles.css              # All presentation (fixed-width desktop layout)
├── src/
│   └── app.js              # Entire application (2208 lines, IIFE)
├── lib/
│   ├── box2d.js            # Vendored Box2D physics engine (11408 lines)
│   └── seedrandom.js       # Vendored seedrandom plugin (270 lines)
├── dist/                   # Alternate WASM-backed build output (not used by index.html)
│   ├── app.js              # Bundled JS for WASM version (2118 lines)
│   └── assets/
│       └── genetic_cars_sim_bg-Cli5_Qj6.wasm
├── crates/                 # Rust source for WASM simulation engine
│   └── genetic-cars-sim/
│       ├── crates/genetic-cars-sim/pkg/   # Nested WASM build output
│       └── pkg/                           # Primary WASM build output
│           ├── genetic_cars_sim.js
│           ├── genetic_cars_sim.d.ts
│           ├── genetic_cars_sim_bg.wasm
│           ├── genetic_cars_sim_bg.wasm.d.ts
│           └── package.json
├── .planning/              # GSD planning documents
│   └── codebase/           # Codebase analysis (this file)
├── .gsd/                   # GSD milestone/slice tracking
├── .claude/                # Claude agent outputs and traces
├── CLAUDE.md               # Project instructions for AI agents
├── AGENTS.md               # Detailed code map with section-by-section breakdown
├── README.md               # Project readme
└── LICENSE                 # License file
```

## Directory Purposes

**`src/`:**

- Purpose: Application source code
- Contains: Single file `app.js` (the entire app)
- Key files: `src/app.js`

**`lib/`:**

- Purpose: Vendored third-party libraries loaded directly by `index.html`
- Contains: `box2d.js` (physics engine), `seedrandom.js` (deterministic RNG)
- Key files: `lib/box2d.js`, `lib/seedrandom.js`

**`dist/`:**

- Purpose: Alternate build output for a WASM-backed version of the simulation
- Contains: Bundled JS (`app.js`) and WASM binary
- Note: Not referenced by the primary `index.html`. This is a separate build artifact.

**`crates/`:**

- Purpose: Rust source for a WASM port of the simulation engine (`SimEngine` class)
- Contains: Compiled WASM packages in `pkg/` directories
- Note: Exposes `SimEngine` with `step_all()`, `next_generation()`, `end_generation()`, etc. via wasm-bindgen. Not integrated into the primary app.

**`.gsd/`:**

- Purpose: GSD milestone and slice tracking
- Generated: Yes (by GSD tooling)
- Committed: No (in `.gitignore`)

**`.planning/`:**

- Purpose: Codebase analysis documents
- Generated: Yes (by GSD mapping)
- Committed: No (in `.gitignore`)

## Key File Locations

**Entry Points:**

- `index.html`: Browser entry point; loads all scripts, defines UI shell
- `src/app.js:2205`: `cw_init()` call -- application bootstrap

**Configuration:**

- `src/app.js:188-200`: `carConstantsData` -- car genome value ranges (wheel count, radius ranges, density ranges, chassis axis ranges)
- `src/app.js:209-217`: `carConstruct.worldDef()` -- physics world defaults (gravity, FPS, tile count, health, motor speed)
- `src/app.js:520-538`: `generationConfig` IIFE -- GA parameters (generation size, champion count, mutation rate)
- `src/app.js:1530-1541`: `world_def` -- runtime world state (gravity, floor seed, schema, mutable floor flag)

**Core Logic:**

- `src/app.js:7-97`: `random` -- genome value generation and mutation math
- `src/app.js:117-184`: `createInstance` -- genome creation (gen zero, crossbreed, clone, type application)
- `src/app.js:242-284`: `defToCar()` -- genome-to-Box2D body conversion
- `src/app.js:359-434`: `carRun` -- per-car state tracking and scoring
- `src/app.js:544-630`: `manageRound` -- GA generation management (generationZero, nextGeneration)
- `src/app.js:1395-1450`: `worldRun()` -- simulation runner (creates world, steps physics, manages car lifecycle)

**Drawing:**

- `src/app.js:938-954`: `cw_drawVirtualPoly()` -- polygon rendering helper
- `src/app.js:963-975`: `cw_drawCircle()` -- circle rendering helper
- `src/app.js:982-1014`: `cw_drawFloor()` -- terrain rendering with camera culling
- `src/app.js:1030-1158`: `graph_fns` + plotting helpers -- generation statistics graph
- `src/app.js:1167-1216`: `drawCar()` -- individual car rendering
- `src/app.js:1610-1624`: `cw_drawScreen()` -- main render pass (floor + ghost + cars)
- `src/app.js:1727-1749`: `cw_drawMiniMap()` -- minimap terrain rendering

**Ghost/Replay:**

- `src/app.js:713-766`: Frame capture functions (`ghost_get_frame`, `ghost_get_chassis`, `ghost_get_wheel`)
- `src/app.js:772-935`: `ghost_fns` IIFE -- replay lifecycle and drawing

**UI Integration:**

- `src/app.js:1228-1282`: `cw_Car` -- per-car DOM wrapper (health bar, minimap marker)
- `src/app.js:1753-1791`: `uiListeners` -- simulation event callbacks (preCarStep, carStep, carDeath, generationEnd)
- `src/app.js:1951-2175`: DOM event listeners for all control buttons and settings dropdowns

**Persistence:**

- `src/app.js:1981-2010`: `saveProgress()` and `restoreProgress()` -- localStorage serialization

**Styling:**

- `styles.css`: All CSS (197 lines). Fixed-width desktop layout (`min-width: 1200px`), fixed canvas sizes (800x400 main, 400x250 graph, 800x200 minimap).

## Naming Conventions

**Files:**

- Source uses flat naming: `app.js`, `index.html`, `styles.css`
- Vendored libs: lowercase with dots: `box2d.js`, `seedrandom.js`

**Sections within `src/app.js`:**

- Banner comments use path-like names matching the original multi-file structure: `machine-learning/random.js`, `car-schema/construct.js`, `draw/draw-car.js`, etc.
- Navigate by searching for `/* ---` banner patterns

**Functions:**

- Public/exported functions: `camelCase` -- `defToCar`, `setupScene`, `worldRun`, `drawCar`
- Internal helpers: `camelCase` with `cw_` prefix for DOM-interacting functions -- `cw_drawFloor`, `cw_drawScreen`, `cw_setCameraTarget`, `cw_createFloor`
- Ghost functions: `snake_case` with `ghost_` prefix -- `ghost_get_frame`, `ghost_draw_frame`, `ghost_create_replay`
- Settings functions: `cw_set` prefix -- `cw_setMutation`, `cw_setGravity`, `cw_setEliteSize`

**DOM IDs:**

- Lowercase concatenated: `mainbox`, `graphcanvas`, `topscores`, `minimap`, `minimapfog`, `minimapholder`
- Dynamically generated: `health{N}`, `bar{N}` (cloned per car in `cw_init`)

## Where to Add New Code

**New Simulation Feature (e.g., new scoring, new physics behavior):**

- Modify the relevant section in `src/app.js` (find the banner comment)
- Car state changes: edit `carRun` section (~line 355)
- Physics construction changes: edit `defToCar` section (~line 232)
- Terrain changes: edit `setupScene` section (~line 1287)

**New GA Feature (e.g., new selection method, crossover variant):**

- Add to `generation-config/*` section (~line 437) or `manageRound` section (~line 541)
- Wire new config into `generationConfig` IIFE

**New UI Control:**

1. Add HTML element in `index.html` (in the `#data` div, ~line 54-192)
2. Add CSS in `styles.css` if needed
3. Add event listener in main entry section of `src/app.js` (~line 1951+)
4. Add handler function near related settings functions (~line 2177+)

**New Drawing Feature:**

- Add to `draw/*` section (~line 938-1216)
- Wire into `cw_drawScreen()` at line 1610

**New Genome Property:**

1. Add to schema in `carConstruct.generateSchema()` at line 219
2. Update `carConstantsData` at line 190 if new ranges needed
3. Update `defToCar()` to use the new property
4. Update `nAttributes` constant at line 460 (used by crossover swap points)
5. Update `drawCar()` if visual representation changes

**New Persistence Key:**

- Add to `saveProgress()` at line 1981 and `restoreProgress()` at line 1989
- Use `cw_` prefix for localStorage key name

## Script Load Order

`index.html` loads scripts in this exact order (all synchronous `<script>` tags):

1. `lib/seedrandom.js` -- adds `Math.seedrandom()` globally
2. `lib/box2d.js` -- adds Box2D constructors globally (`b2World`, `b2Vec2`, `b2Body`, etc.)
3. `https://d3js.org/d3.v3.min.js` -- d3 library (CDN)
4. `https://cdnjs.cloudflare.com/ajax/libs/vis/4.20.0/vis.min.js` -- vis.js (CDN)
5. `src/app.js` -- application IIFE (executes immediately, calls `cw_init()`)

**Critical ordering:** `seedrandom.js` and `box2d.js` must load before `app.js` because `app.js` calls `Math.seedrandom()` and uses Box2D constructors during initialization.

## File Dependencies

```
index.html
├── styles.css (CSS)
├── vis.min.css (CDN CSS)
├── lib/seedrandom.js -> provides Math.seedrandom()
├── lib/box2d.js -> provides b2World, b2Vec2, b2Body, b2FixtureDef, etc.
├── d3.v3.min.js (CDN) -> provides d3 (loaded but not actively used in src/app.js)
├── vis.min.js (CDN) -> provides vis (loaded but not actively used in src/app.js)
└── src/app.js
    ├── reads Box2D globals from lib/box2d.js
    ├── reads Math.seedrandom from lib/seedrandom.js
    └── reads/writes DOM elements defined in index.html
```

**Internal dependency chain within `src/app.js`:**

```
random (leaf)
  └─> createInstance
       └─> manageRound, manageRoundSA

carConstantsData (leaf)
  └─> carConstruct
       └─> generationConfig
            └─> manageRound (via config param)

defToCar (uses createInstance.applyTypes, Box2D globals)
carRun (leaf)
setupScene (uses Box2D globals, Math.seedrandom)

worldRun (uses setupScene, defToCar, carRun)
  └─> main entry

ghost_fns (uses Box2D body API)
draw/* (uses Box2D body API, canvas context)
cw_Car (uses DOM, carRun)
graph_fns (uses canvas context)

main entry (uses everything above)
```

## Special Directories

**`node_modules/`:**

- Purpose: Contains dependencies (likely for the WASM build toolchain)
- Generated: Yes
- Committed: No (in `.gitignore`)
- Not used by the primary browser app

**`target/`:**

- Purpose: Rust/Cargo build output
- Generated: Yes
- Committed: No (in `.gitignore`)

**`dist/`:**

- Purpose: Built WASM-backed app variant
- Generated: Yes (by build toolchain)
- Committed: Yes (checked into repo)
- Not loaded by primary `index.html`

**`crates/genetic-cars-sim/pkg/`:**

- Purpose: wasm-pack output (compiled WASM + JS bindings)
- Generated: Yes (by `wasm-pack build`)
- Committed: Yes (checked into repo)

---

_Structure analysis: 2026-03-26_
