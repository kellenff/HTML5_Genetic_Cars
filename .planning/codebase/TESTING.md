# Testing Patterns

**Analysis Date:** 2026-03-26

## Test Framework

**Runner:**

- None. No test framework is installed or configured.
- No `jest.config.*`, `vitest.config.*`, `mocha`, or any test runner present.

**Assertion Library:**

- None.

**Run Commands:**

```bash
# No automated test commands exist.
# Manual verification only: open index.html in a browser.
python3 -m http.server 8000   # Serve locally if browser blocks file:// access
```

## Current State

**Automated test coverage:** None. Zero test files exist in the repository. No `.test.*` or `.spec.*` files were found anywhere.

**Quality gates:** None. No linter, no type checker, no pre-commit hooks, no CI pipeline (no `.github/workflows/` directory).

**Package manager:** No `package.json` at root. The `node_modules/` directory contains vite, typescript, and related packages (likely from the `crates/genetic-cars-sim` Rust/WASM experiment), but these are not used by the main app.

## Manual Testing Checklist

Based on `CLAUDE.md` and `AGENTS.md`, the following must be verified manually after any change:

**Core simulation:**

- [ ] Page loads without console errors
- [ ] Cars spawn on the terrain at generation start
- [ ] Cars move forward and interact with terrain physics
- [ ] Cars die when health reaches zero (stuck or slow)
- [ ] Health bars update in real-time for each car
- [ ] Minimap markers track car positions
- [ ] Generation counter increments when all cars die
- [ ] New generation spawns after previous generation ends
- [ ] Leader camera tracking follows the frontmost car
- [ ] Clicking a health bar or minimap switches camera to that car
- [ ] "Watch Leader" button resets camera to auto-follow leader

**Genetic algorithm:**

- [ ] Elite cars (blue chassis) appear in subsequent generations
- [ ] Mutation rate dropdown changes offspring variation
- [ ] Mutation size dropdown changes offspring variation magnitude
- [ ] Elite clones dropdown changes number of preserved champions
- [ ] Cars generally improve (travel farther) over 5+ generations

**Graph and scores:**

- [ ] Graph canvas renders red (top), green (elite avg), blue (overall avg) lines
- [ ] Top scores list populates after each generation
- [ ] Score values are reasonable (positive, increasing trend)

**Ghost replay:**

- [ ] "View top replay" pauses simulation and plays back the best run
- [ ] Ghost car renders in gray/translucent style
- [ ] Clicking "Resume simulation" returns to live simulation
- [ ] Ghost overlay appears during live simulation showing best-ever run

**Controls:**

- [ ] "Save Population" stores to localStorage without error
- [ ] "Restore Saved Population" restores a previously saved state
- [ ] "Restore Saved Population" shows alert when no save exists
- [ ] "New Population" resets cars but keeps the same terrain
- [ ] "Surprise!" toggles rendering off (fast-forward mode) and back on
- [ ] "Fast Forward" completes the current generation instantly
- [ ] Seed input + "Go!" creates a new world with that seed (after confirm)
- [ ] Gravity dropdown changes physics immediately
- [ ] Floor "mutable" option regenerates terrain each generation

**Persistence edge cases:**

- [ ] Save, close browser, reopen, restore -- state is intact
- [ ] Save at generation 0, restore at generation 5 -- reverts correctly
- [ ] localStorage keys `cw_savedGeneration`, `cw_genCounter`, `cw_ghost`, `cw_topScores`, `cw_floorSeed` are populated after save

## Testability Assessment

### Easy to test (pure functions, no DOM dependency)

These sections in `src/app.js` contain pure logic that could be unit tested if extracted:

**`random` module (lines 7-109):**

- `createNormals()`, `mapToShuffle()`, `mapToInteger()`, `mapToFloat()`, `mutateReplace()`
- All accept a `generator` function parameter, making them deterministic when given a seeded RNG
- Test: provide a fixed-seed generator, assert output arrays match expected values

**`createInstance` module (lines 117-184):**

- `createGenerationZero()`, `createCrossBreed()`, `createMutatedClone()`, `applyTypes()`
- Pure data transformations on schema + genome objects
- Test: provide known schema + parent genomes, verify child genome structure and values

**`carRun` module (lines 359-434):**

- `getInitialState()`, `updateState()`, `getStatus()`, `calculateScore()`
- Pure state machine logic. `updateState()` depends on a `worldConstruct.chassis.GetPosition()` interface but this is easily mockable
- Test: create mock chassis object with known position, step through state transitions

**`flatRankSelect()` (line 441):**

- Selection algorithm. Seeded `Math.random()` makes it testable

**`manageRound.generationZero()` and `manageRound.nextGeneration()` (lines 549-629):**

- GA lifecycle logic. Depends on `createInstance` and `random` but no DOM
- Test: generate population, simulate scores, verify next generation structure

**`cw_rotateFloorTile()` (line 1382):**

- Pure geometric rotation. Easy to test with known input/output pairs

### Hard to test (tightly coupled to DOM or Box2D)

**`defToCar()` (line 243):**

- Creates Box2D bodies directly. Requires a live `b2World` instance.
- Would need Box2D loaded in test environment (it is a 381KB vendored file)

**`cw_Car` constructor (line 1232):**

- Immediately queries DOM by dynamic IDs (`"health" + index`, `"bar" + index`)
- Cannot instantiate without full DOM setup including cloned template elements

**`worldRun()` (line 1395):**

- Creates Box2D world, steps physics, manages car lifecycle
- Deeply coupled to Box2D globals and DOM-connected listener callbacks

**`cw_drawScreen()`, `cw_drawFloor()`, `drawCar()` (lines 938-1216, 1610-1707):**

- Canvas 2D context rendering. Would require canvas mocking or visual regression testing.

**`cw_init()` (line 2070):**

- Clones DOM nodes, wires everything together. Integration-test level only.

**All event handlers (lines 1951-2175):**

- Directly read from DOM select elements and mutate global state

### Recommended testing approach if tests were added

**Phase 1 -- Unit tests for pure logic (highest value, lowest effort):**

1. Choose a test runner that works without bundling: Vitest with browser-compatible config, or plain Node.js with a lightweight runner
2. Extract the pure modules (`random`, `createInstance`, `carRun`, `manageRound`, `flatRankSelect`, `calculateScore`) into importable units. This could be done by:
   - Adding `export` statements guarded by `typeof module !== 'undefined'` checks
   - Or splitting `src/app.js` into ES modules (requires updating `AGENTS.md` per project rules)
3. Write deterministic tests using seeded RNG for all randomness-dependent functions
4. Key test scenarios:
   - Genome generation produces valid normalized values (0-1 range)
   - Crossover correctly interleaves parent genes at swap points
   - Mutation respects rate and range bounds
   - Score calculation matches expected formula: `position + (position / frames) * box2dfps`
   - State transitions: healthy -> degrading -> dead; healthy -> finish line
   - Elite preservation in `nextGeneration()` copies top N unchanged

**Phase 2 -- Integration tests with Box2D:**

1. Load `lib/box2d.js` and `lib/seedrandom.js` in the test environment
2. Test `defToCar()` creates valid Box2D bodies with expected mass/joint configuration
3. Test `setupScene()` generates deterministic terrain from a given seed
4. Test `worldRun()` lifecycle: cars spawn, step, die, generation ends

**Phase 3 -- E2E / visual tests (optional):**

1. Use Playwright or Puppeteer to load `index.html`
2. Verify canvas renders (screenshot comparison)
3. Click through UI controls and verify DOM state changes
4. Test save/restore round-trip via localStorage inspection

## Quality Gates

**Linting configuration:** None. No ESLint, JSHint, Biome, or any linter is configured.

**Type checking:** None. No TypeScript, no JSDoc with `@ts-check`, no Flow.

**Pre-commit hooks:** None active. `.git/hooks/pre-commit.sample` exists but is not enabled.

**CI/CD:** None. No `.github/workflows/`, no `.gitlab-ci.yml`, no CI configuration of any kind.

**Code formatting:** None enforced. No Prettier, no EditorConfig.

**Recommended minimum quality gates to add:**

1. ESLint with a minimal config (e.g., `eslint:recommended`) to catch undefined variables, unused variables, and common mistakes
2. A `Makefile` or `package.json` scripts entry for `lint` to run before commits
3. A simple smoke test that loads the page in a headless browser and checks for console errors

---

_Testing analysis: 2026-03-26_
