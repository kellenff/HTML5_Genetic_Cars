# Coding Conventions

**Analysis Date:** 2026-03-26

## Naming Patterns

**Files:**

- All lowercase with hyphens implied by section comments (e.g., `machine-learning/random.js`, `car-schema/def-to-car.js`), but there is only one actual source file: `src/app.js`
- HTML/CSS files: lowercase, no hyphens (`index.html`, `styles.css`)
- Vendored libs: lowercase (`lib/box2d.js`, `lib/seedrandom.js`)

**Functions:**

- Use camelCase for most functions: `defToCar()`, `setupScene()`, `flatRankSelect()`
- Legacy `cw_` prefix (short for "car world") on many functions: `cw_drawFloor()`, `cw_createFloor()`, `cw_drawCars()`, `cw_setCameraTarget()`, `cw_init()`
- The `cw_` prefix appears ~197 times across the file. New functions that interact with the global simulation state or DOM should use camelCase without the `cw_` prefix. Existing `cw_` functions should not be renamed without careful audit of `index.html` inline handlers.
- Private/internal helpers use plain camelCase: `createNormal()`, `createChassis()`, `createWheel()`

**Variables:**

- camelCase for local and module-scoped variables: `generationState`, `currentRunner`, `carMap`, `leaderPosition`
- `cw_` prefix on some legacy variables: `cw_deadCars`, `cw_paused`, `cw_animationFrameId`, `cw_ghostReplayInterval`
- snake_case appears in data-oriented objects: `world_def`, `car_def`, `normal_def`, `fix_def`, `body_def`, `joint_def`, `mutation_range`, `gen_mutation`, `max_car_health`
- Short single-letter variables in tight loops: `k`, `i`, `f`, `s`, `b`, `p`

**Constants/Config:**

- Object literals with camelCase keys: `carConstantsData` at `src/app.js:190`
- `generationConfig.constants` at `src/app.js:524` holds runtime-mutable "constants"
- No `UPPER_SNAKE_CASE` convention for constants; use camelCase in config objects

**Types:**

- No TypeScript. No JSDoc type annotations. Constructor functions use PascalCase: `cw_Car` at `src/app.js:1228`

## Code Style

**Formatting:**

- No formatter configured (no `.prettierrc`, `.editorconfig`, or ESLint config)
- Indentation: 2 spaces consistently throughout `src/app.js`
- Semicolons: inconsistent. Most statements have semicolons, but some object methods and closing braces omit them (e.g., lines 58, 67, 72, 184)
- Trailing commas: used in some object/array literals (e.g., line 17: `inclusive: true,`), absent in others
- Line length: no enforced maximum; most lines stay under 120 characters
- String quotes: double quotes for strings throughout (`"#eee"`, `"abc"`, `"shuffle"`)

**Linting:**

- No linter configured. No `.eslintrc`, `biome.json`, or equivalent
- No pre-commit hooks active (only `.sample` hook exists)

**Comment Style:**

- Banner comments delimit logical sections using ASCII box-drawing:
  ```
  /* -------------------------------------------------------------------------
   * section-name/file-name.js
   * ------------------------------------------------------------------------- */
  ```
- Major structural boundaries use double-line banners:
  ```
  /* ========================================================================= */
  /* === Car ================================================================= */
  ```
- Inline comments are sparse; used for clarifying non-obvious logic (e.g., `src/app.js:81-86` mutation bounds explanation, `src/app.js:1871-1874` seed reset rationale)
- One `/* globals ... */` comment at `src/app.js:236` for Box2D globals (not enforced by any linter)

## Module/Section Organization

**Pattern:** The entire app is a single IIFE wrapping ~2208 lines in `src/app.js`. Logical sections are marked with banner comments that reference the original pre-bundled file paths. Navigate by these banners, not by scrolling.

**Section order in `src/app.js`:**

1. Utility/pure functions (`random`, `createInstance`) -- lines 7-184
2. Data/config (`carConstantsData`, `carConstruct`) -- lines 190-229
3. Domain logic (`defToCar`, `carRun`) -- lines 232-434
4. GA strategy (`flatRankSelect`, `pickParent`, `generationConfig`, `manageRound`, `manageRoundSA`) -- lines 437-706
5. Ghost replay (`ghost_fns`) -- lines 709-935
6. Rendering (`cw_drawVirtualPoly`, `cw_drawCircle`, `cw_drawFloor`, `graph_fns`, `drawCar`) -- lines 938-1216
7. UI wrappers (`cw_Car`) -- lines 1227-1282
8. World setup (`setupScene`, `cw_createFloor`) -- lines 1287-1389
9. World runner (`worldRun`) -- lines 1392-1450
10. Main entry (state, DOM wiring, animation loop, persistence) -- lines 1453-2208

**Encapsulation patterns:**

- IIFEs returning public API objects: `carConstruct` (line 206), `generationConfig` (line 521), `manageRound` (line 544), `manageRoundSA` (line 636), `ghost_fns` (line 772)
- Plain object modules: `random` (line 12), `createInstance` (line 117), `carRun` (line 359), `graph_fns` (line 1030)
- Constructor function with prototype: `cw_Car` (line 1228)
- Standalone functions: `defToCar`, `setupScene`, `worldRun`, etc.

## Common Patterns

**Adding a new feature:**

1. Place pure logic near the relevant banner section in `src/app.js`
2. Wire to UI through event listeners in the main entry section (lines 1951-2175)
3. If it needs DOM elements, add them in `index.html` and look them up by `document.getElementById()` or `document.querySelector()` in `src/app.js`

**Error handling:**

- Minimal. Errors are thrown as sentinels in `carRun.updateState()` (`src/app.js:378-382`) for "Already Dead" / "already Finished" states
- `worldRun.step()` throws `"no more cars"` when all cars are dead (`src/app.js:1418`)
- No try/catch blocks anywhere in the codebase
- User-facing errors: `alert()` for missing saved data (`src/app.js:1991`), `confirm()` for destructive resets (`src/app.js:2017`)

**State mutation:**

- State is mutated directly on module-scoped variables: `generationState`, `currentRunner`, `ghost`, `graphState`, `camera`, `world_def`
- `carRun.updateState()` returns a new state object (immutable-ish pattern at `src/app.js:387-407`)
- `carMap` (a `Map`) tracks live cars; entries are added in `setupCarUI()` and deleted in `uiListeners.carDeath()`
- DOM state is updated by direct property assignment on `.style` and `.value`

**Callback/listener pattern:**

- `worldRun()` accepts a `listeners` object with callbacks: `preCarStep()`, `carStep(car)`, `carDeath(carInfo)`, `generationEnd(results)` -- see `src/app.js:1753-1791`
- This is the primary extensibility mechanism for hooking into the simulation lifecycle

## DOM Interaction

**Lookups:**

- `document.getElementById()` for specific elements: `"mainbox"`, `"minimap"`, `"minimapfog"`, `"graphcanvas"`, `"topscores"`, `"generation"`, `"population"`, `"distancemeter"`, `"heightmeter"`, `"newseed"`, `"health"`, `"cars"`
- `document.querySelector()` for button/select event binding: `"#fast-forward"`, `"#save-progress"`, `"#restore-progress"`, `"#toggle-display"`, `"#new-population"`, `"#confirm-reset"`, `"#toggle-ghost"`, `"#mutationrate"`, `"#mutationsize"`, `"#floor"`, `"#gravity"`, `"#elitesize"`
- `document.getElementsByName()` for template elements: `"minimapmarker"`, `"healthbar"` (cloned in `cw_init()`)
- Dynamic IDs generated at init: `"bar0"` through `"bar19"` for minimap markers, `"health0"` through `"health19"` for health bars

**ID/class naming in HTML:**

- IDs: lowercase, no separators (`mainbox`, `graphcanvas`, `topscores`, `distancemeter`)
- IDs for controls: kebab-case (`save-progress`, `restore-progress`, `toggle-display`, `new-population`, `fast-forward`, `toggle-ghost`, `confirm-reset`)
- Classes: lowercase, no separators (`clearfix`, `healthbar`, `healthtext`, `minimapmarker`, `silverdot`)
- CSS uses `float-left` as a utility class

**Event binding:**

- Most events bound via `addEventListener("click", ...)` or `addEventListener("change", ...)` in the main entry section of `src/app.js` (lines 1951-2175)
- Two legacy inline `onclick` handlers remain in `index.html`:
  - `src/app.js:2203` exposes `cw_setCameraTarget` to `window` for the inline `onclick="cw_setCameraTarget(-1)"` on the "Watch Leader" button (`index.html:189`)
  - Health bars use `onclick="cw_setCameraTarget(this.car_index)"` (`index.html:300`), but the cloned health bars in `cw_init()` inherit this handler
- Minimap click handling: `minimapholder.onclick = function(event)` at `src/app.js:2123`

**DOM update pattern:**

- Direct property assignment on `.style` for position/size/color changes
- `canvas.width = canvas.width` trick to clear canvas (`src/app.js:1120`, `1710`, `1737`)

## Import Organization

**Not applicable.** No ES modules, no `import`/`require` statements. All dependencies are loaded via `<script>` tags in `index.html`:

1. `lib/seedrandom.js` -- vendored
2. `lib/box2d.js` -- vendored
3. `d3.v3.min.js` -- CDN
4. `vis.min.js` -- CDN
5. `src/app.js` -- the application

Within `src/app.js`, dependency order is managed by declaration order within the IIFE. Later sections reference earlier declarations via closure.

## Function Design

**Size:** Most functions are 5-30 lines. Largest functions are `cw_init()` (~35 lines), `cw_Car.prototype.__constructor` (~25 lines), and `nextGeneration()` (~40 lines).

**Parameters:** Functions accept plain objects for configuration (`world_def`, `config`, `prop`). Destructuring is not used; properties are accessed via dot notation or local variable reassignment:

```javascript
var champion_length = config.championLength,
  generationSize = config.generationSize,
  selectFromAllParents = config.selectFromAllParents;
```

**Return values:** Functions return plain objects. No classes for data structures. Score objects use terse keys: `{ v, s, x, y, y2 }` at `src/app.js:427-433`.

---

_Convention analysis: 2026-03-26_
