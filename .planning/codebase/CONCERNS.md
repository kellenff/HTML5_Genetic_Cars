# Codebase Concerns

**Analysis Date:** 2026-03-26

## Tech Debt

**Single-file monolith (2208 lines):**

- Issue: All application logic lives in `src/app.js` as an IIFE. Navigation depends on banner comments, and any merge conflict touches the entire file.
- Files: `src/app.js`
- Impact: Every change risks unintended side effects in distant sections. Two developers cannot work on separate features without merge pain.
- Fix approach: This is an intentional design choice documented in `CLAUDE.md`. If splitting is ever pursued, follow the existing banner-comment sections as natural module boundaries and update `AGENTS.md` accordingly.

**Dead code: `carConstruct.worldDef()` function:**

- Issue: The `worldDef()` factory (line ~209) is exported from `carConstruct` but never called anywhere. The actual `world_def` object is constructed inline at line ~1530. The two definitions are inconsistent -- the factory uses `{ width, height }` for tileDimensions while the real one uses `new b2Vec2(x, y)`, and the factory sets `gravity: { y: 0 }` instead of a real `b2Vec2`.
- Files: `src/app.js` lines 209-217
- Impact: Confusing for future developers who may try to use or refactor the factory. Zero runtime impact.
- Fix approach: Remove `worldDef()` from `carConstruct` or update it to match the actual construction and use it as the single source of truth.

**Swapped min/range in `chassis_density` schema:**

- Issue: In `generateSchema()` at line ~223, `chassis_density` is defined as `{ min: values.chassisDensityRange, range: values.chassisMinDensity }`, which maps to `{ min: 300, range: 30 }`. This means chassis density ranges from 300 to 330. By contrast, wheel density uses `{ min: 40, range: 100 }` (40 to 140). The variable names strongly suggest the mapping is backwards and should be `{ min: 30, range: 300 }` (30 to 330).
- Files: `src/app.js` line 223, constants at lines 190-200
- Impact: Chassis density has a much narrower effective range than intended, reducing genetic diversity for this trait. Cars are all quite heavy-bodied.
- Fix approach: Swap to `min: values.chassisMinDensity, range: values.chassisDensityRange`. Verify behavior visually -- existing evolved populations may shift in character.

**Stray empty template literal:**

- Issue: Line 578 contains a bare ` ` `` (empty template literal) that does nothing. Appears to be an editing artifact.
- Files: `src/app.js` line 578
- Impact: No runtime effect, but signals sloppy editing.
- Fix approach: Delete the line.

**`new Array()` usage:**

- Issue: Four instances of `new Array()` instead of idiomatic `[]` literal syntax at lines 288, 320, 575, and 1366.
- Files: `src/app.js` lines 288, 320, 575, 1366
- Impact: No functional difference, but inconsistent with the `[]` style used everywhere else in the codebase.
- Fix approach: Replace with `[]`.

**`nAttributes` magic number:**

- Issue: `var nAttributes = 15` at line 460 is a hardcoded constant used in `pickParent()` for crossover swap-point selection. It represents the total number of genome attributes but is not derived from the schema, so adding genome attributes (e.g., more wheels) would silently break crossover.
- Files: `src/app.js` line 460
- Impact: Crossover swap points would be biased or miss new attributes if the schema changes.
- Fix approach: Derive `nAttributes` from the schema at runtime, e.g., summing the lengths of all schema properties.

**Undeclared variable `cw_runningInterval`:**

- Issue: `cw_runningInterval` is assigned in `toggleDisplay()` at line 1714 and cleared at line 1722, but is never declared with `var`/`let`/`const`. Inside the IIFE this creates an implicit global.
- Files: `src/app.js` lines 1714, 1722
- Impact: Pollutes global scope. Could conflict with other scripts.
- Fix approach: Add `var cw_runningInterval;` near the other state declarations around line 1477.

## Known Bugs

**`restoreProgress()` does not parse `genCounter` as integer:**

- Symptoms: `generationState.counter` becomes a string after restore because `localStorage.cw_genCounter` is always stored/retrieved as a string (line 1997).
- Files: `src/app.js` line 1997
- Trigger: Save progress, then restore. The generation counter display works because `innerHTML` coerces to string, but any numeric comparison on `.counter` would fail.
- Workaround: The counter is mostly used for display and as an incrementing value, so `"5" + 1 = "51"` would be the actual breakage point -- which happens in `nextGeneration()` at line 602: `counter: previousState.counter + 1` produces string concatenation.
- Fix: Change line 1997 to `parseInt(localStorage.cw_genCounter, 10)`.

**`restoreProgress()` does not restore graph average/elite/top arrays:**

- Symptoms: After restoring saved progress, the graph only shows data from new generations. Historical average/elite/top-score lines are lost because only `cw_topScores` is saved/restored, not `cw_graphAverage`, `cw_graphElite`, or `cw_graphTop`.
- Files: `src/app.js` lines 1981-2010
- Trigger: Save after many generations, restore, observe incomplete graph.
- Workaround: None.
- Fix: Save and restore all four `graphState` fields, or rebuild them from `cw_topScores`.

**`for...in` on arrays in ghost drawing:**

- Symptoms: If `Array.prototype` is extended by any library, ghost rendering would iterate over non-numeric properties and likely crash or draw garbage.
- Files: `src/app.js` lines 893 (`for (var w in frame.wheels[i])`) and 903 (`for (var c in frame.chassis)`)
- Trigger: Any code that adds enumerable properties to `Array.prototype`.
- Workaround: Current vendored libraries do not extend `Array.prototype`, so this works in practice.
- Fix: Replace with `for` loops or `for...of`.

## Security Considerations

**`innerHTML` used with dynamic content:**

- Risk: `innerHTML` is used to render top scores at line 1156 (`ts.innerHTML += ...`). The score data comes from internal simulation state, not user input, so XSS risk is minimal. However, any future feature that displays user-provided text (e.g., seed names in the score list) could introduce XSS if piped through `innerHTML`.
- Files: `src/app.js` lines 1139, 1156
- Current mitigation: All data sources are numeric/internal.
- Recommendations: Use `textContent` for text-only updates. Continue using `innerHTML` only where HTML structure is needed and data is trusted.

**External CDN dependencies loaded over HTTPS without integrity hashes:**

- Risk: d3 v3 from `d3js.org` and vis 4.20.0 from `cdnjs.cloudflare.com` are loaded without `integrity` or `crossorigin` attributes. A CDN compromise could inject malicious code.
- Files: `index.html` lines 7, 307, 308
- Current mitigation: HTTPS transport protects against MITM.
- Recommendations: Add Subresource Integrity (SRI) hashes, or vendor these dependencies into `lib/` like Box2D and seedrandom already are.

**PayPal form with hardcoded `hosted_button_id`:**

- Risk: The donate button at `index.html` lines 55-61 posts to `paypal.com` with a hardcoded button ID (`X8VB9NDYWQDPE`). Not a vulnerability, but the form may be stale or point to an inactive account.
- Files: `index.html` lines 55-61
- Current mitigation: None needed from a security perspective.
- Recommendations: Verify the button ID is still valid or remove the form if donations are no longer accepted.

**Prototype pollution via `HTMLDivElement.prototype`:**

- Risk: Line 2122 adds `relMouseCoords` to `HTMLDivElement.prototype`, modifying a built-in prototype. This is a coupling risk rather than a direct security issue.
- Files: `src/app.js` line 2122
- Current mitigation: The app runs in isolation with no third-party runtime code.
- Recommendations: Move `relMouseCoords` to a standalone utility function and call it with `relMouseCoords.call(element, event)` or pass the element as a parameter.

**`localStorage` persistence has no validation:**

- Risk: `restoreProgress()` at lines 1996-2000 parses localStorage values with `JSON.parse()` without try/catch. Corrupted or manually edited localStorage data would crash the app.
- Files: `src/app.js` lines 1989-2010
- Current mitigation: None.
- Recommendations: Wrap restore in try/catch and fall back to a new population on parse failure.

## Performance Concerns

**Ghost replay memory growth:**

- Problem: Every frame of every car's run is captured in `ghost_add_replay_frame()` (line 862-871). Each frame stores full world-coordinate positions of chassis polygons and wheels. For 20 cars running 600 frames each, this is ~12,000 frame objects per generation, each containing nested arrays of vertex positions.
- Files: `src/app.js` lines 862-871, 1818
- Cause: Frame data is captured eagerly for all cars, but only the best car's replay is retained via `ghost_compare_to_replay()`. The per-car `replay` objects for non-best cars are garbage collected when `carMap` is cleared.
- Improvement path: This is acceptable for short sessions. For very long sessions (hundreds of generations), the retained ghost replay is small. The per-generation transient allocations are the main GC pressure source -- consider capturing only for the current leader.

**`fastForward()` blocks the main thread:**

- Problem: `fastForward()` at line 1842-1847 runs a synchronous `while` loop until the entire generation completes. For 20 cars on complex terrain, this can freeze the browser for seconds.
- Files: `src/app.js` lines 1842-1847
- Cause: No yielding to the event loop during fast-forward.
- Improvement path: Use `setTimeout` chunking or a Web Worker to avoid blocking the UI thread. Alternatively, cap the number of steps per frame.

**`toggleDisplay()` tight loop:**

- Problem: When display is toggled off, `setInterval(..., 1)` at line 1714 runs simulation steps in a tight loop consuming 100% of one CPU core, limited only by `performance.now()` time checks.
- Files: `src/app.js` lines 1709-1725
- Cause: Intentional -- this is the "Surprise!" fast-simulation mode. But it makes the tab unresponsive to UI events.
- Improvement path: Use `requestIdleCallback` or limit iterations per interval tick.

**Canvas not using `willReadFrequently` or `desynchronized` hints:**

- Problem: The main canvas and minimap canvas are created with default context options. Modern browsers can optimize canvas rendering with hints.
- Files: `src/app.js` lines 1487, 1502
- Cause: Written before these APIs existed.
- Improvement path: Pass `{ desynchronized: true }` to `getContext('2d')` for the main simulation canvas.

**Graph scale does not adapt to scores:**

- Problem: The graph Y-axis is hardcoded to 250 pixels with fixed scale labels (0, 62, 125, 187, 250). If top scores exceed 250, the graph lines go off the visible area. Score values are plotted as raw pixel Y coordinates without any scaling transform.
- Files: `src/app.js` lines 1067-1101, `index.html` lines 23-28
- Cause: The graph was designed for a specific score range and never made adaptive.
- Improvement path: Compute max score per render and apply a Y-axis scale factor.

## Fragile Areas

**DOM ID coupling between `index.html` and `src/app.js`:**

- Files: `index.html`, `src/app.js` (30+ `getElementById`/`querySelector` calls)
- Why fragile: IDs like `mainbox`, `graphcanvas`, `topscores`, `minimap`, `minimapfog`, `minimapcamera`, `health`, `cars`, `generation`, `population`, `distancemeter`, `heightmeter`, `newseed` are hardcoded strings in both files. Renaming in one without the other silently breaks the app.
- Safe modification: Always search for the ID string in both files before renaming. Use the banner comments to find related JS code.
- Test coverage: None. Manual verification only.

**Dynamic DOM element creation in `cw_init()`:**

- Files: `src/app.js` lines 2070-2091
- Why fragile: Health bars and minimap markers are cloned from template elements (`[name="healthbar"]`, `[name="minimapmarker"]`), assigned generated IDs (`health0`, `bar0`, etc.), then the templates are removed from the DOM. `cw_Car` constructor (line 1240-1243) later looks up these IDs. If the generation size changes or `cw_init()` is called more than once, the IDs will be stale or duplicated.
- Safe modification: Only change `generationConfig.constants.generationSize` before `cw_init()` runs. Never call `cw_init()` twice.
- Test coverage: None.

**Global `Math.random` replacement via `Math.seedrandom()`:**

- Files: `lib/seedrandom.js`, `src/app.js` lines 1336, 1398, 1533, 1875, 1882, 1927, 1971, 2006, 2092
- Why fragile: `Math.seedrandom()` globally replaces `Math.random()`. The floor generation seeds it for deterministic terrain, then various call sites reseed for randomness. If the seeding sequence changes, terrain becomes non-reproducible. The comment at lines 1871-1874 explains a past bug where failing to reseed caused identical clones every generation.
- Safe modification: After any call to `Math.seedrandom(floorseed)`, always call `Math.seedrandom()` (no args) before using `Math.random()` for non-terrain purposes.
- Test coverage: None.

**`worldRun()` body destruction lifecycle:**

- Files: `src/app.js` lines 1434-1440
- Why fragile: When a car dies, its Box2D chassis and wheel bodies are immediately destroyed. Any code that still holds a reference to the car's `car.car.chassis` (e.g., via `cw_Car.getPosition()`) would crash with a destroyed body error if called after death.
- Safe modification: Always check `cwCar.alive` before accessing Box2D body methods.
- Test coverage: None.

## Scaling Limits

**Generation size fixed to 20, hardcoded UI:**

- Current capacity: 20 cars per generation.
- Limit: Changing `generationConfig.constants.generationSize` requires `cw_init()` to create the right number of health bar and minimap marker DOM elements. Increasing to 50+ would overflow the health bar panel and minimap visually.
- Scaling path: Make health bar and minimap marker creation dynamic per generation, not one-time at init.

**Floor tiles capped at 200:**

- Current capacity: 200 tiles at 1.5 units width = ~300 unit track length.
- Limit: Increasing `maxFloorTiles` linearly increases terrain generation time, minimap rendering, and floor-drawing iteration.
- Scaling path: Use spatial indexing for floor drawing (currently uses a simple start-index heuristic at line 991-995, which is reasonably efficient).

**`localStorage` size limits:**

- Current capacity: Ghost replay data for a long run can be several MB of JSON.
- Limit: Most browsers cap `localStorage` at 5-10 MB. A long ghost replay with many frames could exceed this.
- Scaling path: Compress ghost data, or use IndexedDB for persistence.

## Dependencies at Risk

**d3 v3 (loaded from CDN):**

- Risk: d3 v3 is ancient (2012-era) and long superseded by d3 v4-v7. The CDN URL `https://d3js.org/d3.v3.min.js` could be removed at any time. However, searching the codebase reveals d3 is loaded but not actually used in `src/app.js` -- all graphing is done with raw canvas. The vis library is also loaded but not used in the app code.
- Impact: If the CDN goes down, the page load would be delayed by the failed script fetch but the app would still work (since neither library is referenced in `src/app.js`).
- Migration plan: Remove the d3 and vis `<script>` and `<link>` tags from `index.html` entirely. Test that everything still works.

**vis 4.20.0 (loaded from CDN):**

- Risk: Same as d3 -- loaded but appears unused. The scatter plot section at line ~1020 has a comment header but no implementation.
- Impact: Unnecessary network request and bandwidth.
- Migration plan: Remove from `index.html`.

**box2d.js (vendored):**

- Risk: Vendored at `lib/box2d.js` (11,408 lines). No version info in the file. This is an older Box2D JS port. It works but receives no updates or security patches.
- Impact: Stable for this use case. No known issues.
- Migration plan: None needed unless porting to a modern physics engine.

## Missing Critical Features

**No automated tests:**

- Problem: Zero test files exist. All verification is manual as documented in `CLAUDE.md`.
- Blocks: Refactoring with confidence, CI/CD, regression detection.

**No error boundaries / recovery:**

- Problem: If any exception occurs during `gameLoop()` or `simulationStep()`, the entire simulation stops with no user feedback. The `requestAnimationFrame` loop just halts.
- Blocks: Graceful degradation for edge-case physics failures or corrupt save data.

**No mobile/responsive layout:**

- Problem: `styles.css` sets `body { min-width: 1200px }` and all canvas sizes are hardcoded (800x400, 800x200, 400x250). The app is desktop-only.
- Blocks: Mobile or tablet usage.

## Test Coverage Gaps

**All code is untested:**

- What's not tested: Every function in the codebase -- genetic algorithm logic, car construction, physics integration, DOM manipulation, persistence, ghost replay, rendering.
- Files: `src/app.js` (entire file)
- Risk: Any change could break scoring, mutation, crossover, rendering, or persistence without detection.
- Priority: High for the GA core (`random.*`, `createInstance.*`, `manageRound.*`, `carRun.*`). These are pure functions that could be tested without a browser. Medium for rendering and DOM logic.

## Recommendations

**Quick wins (low effort, high impact):**

1. Remove unused d3 and vis CDN dependencies from `index.html` -- eliminates external network dependency and speeds page load
2. Fix `restoreProgress()` to parse `genCounter` as integer -- prevents generation counter corruption after restore
3. Declare `var cw_runningInterval` -- eliminates implicit global
4. Delete the stray empty template literal at line 578
5. Wrap `restoreProgress()` JSON parsing in try/catch for resilience
6. Add SRI hashes to any remaining CDN resources, or vendor them

**Strategic improvements (high effort, high impact):**

1. Fix the `chassis_density` min/range swap -- expands genetic diversity for chassis weight (verify behavior carefully)
2. Extract pure GA functions (`random`, `createInstance`, `manageRound`, `carRun`) into testable modules with a minimal test harness
3. Make `fastForward()` non-blocking with chunked execution
4. Derive `nAttributes` from the schema instead of hardcoding 15
5. Save/restore all `graphState` fields for complete persistence

**Nice-to-haves:**

1. Replace `for...in` on arrays with `for` loops in ghost drawing code
2. Replace `new Array()` with `[]` for consistency
3. Remove `carConstruct.worldDef()` dead code or make it the canonical world definition source
4. Remove prototype extension of `HTMLDivElement` and use a standalone function
5. Add adaptive Y-axis scaling to the graph
6. Add `{ desynchronized: true }` canvas context hint for potential rendering speedup

---

_Concerns audit: 2026-03-26_
