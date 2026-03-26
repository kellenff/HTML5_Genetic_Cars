# CLAUDE.md

## Project Overview

HTML5 genetic algorithm car evolver using Box2D physics. Inspired by BoxCar2D, written from scratch. Static browser app with no build step.

## Architecture

Single-file app in `src/app.js` wrapped in an IIFE. UI shell is `index.html` + `styles.css`. See `AGENTS.md` for a detailed code map with section-by-section breakdown and line references.

Key sections in `src/app.js` (look for banner comments):

- `machine-learning/random.js` (~line 7): genome generation, mutation
- `machine-learning/create-instance.js` (~line 112): generation-zero genomes, crossover, clones
- `car-schema/construct.js` (~line 202): constants, schema, `worldDef()`
- `car-schema/def-to-car.js` (~line 232): genome-to-Box2D conversion
- `car-schema/run.js` (~line 355): per-car physics state, health, scoring
- `generation-config/*` (~line 437): parent selection, generation settings
- `machine-learning/genetic-algorithm/manage-round.js` (~line 541): GA generation management
- `ghost/*` (~line 709): best-run capture and replay
- `draw/*` (~line 938): canvas rendering
- `cw_Car` (~line 1227): UI wrapper per live car
- `world/setup-scene.js` (~line 1287): terrain generation
- `world/run.js` (~line 1392): Box2D world stepping
- `index.js (main entry)` (~line 1453): app state, DOM wiring, animation loop

## Running

Open `index.html` in a browser. No npm, no bundler.

If the browser blocks local file access:

```
python3 -m http.server 8000
```

## Dependencies

- `lib/box2d.js` and `lib/seedrandom.js` are vendored (committed to repo)
- External CDNs: d3 v3, vis 4.20.0 (loaded in index.html)

## Testing

No automated test suite. Verify manually: page loads, cars spawn, generations advance, graphs render, UI controls respond, save/restore works.

## Key Couplings

- DOM ids in `index.html` are referenced directly in `src/app.js` -- renaming requires matching changes in both
- Assumes 2 wheels via `carConstantsData.wheelCount` -- changes ripple into schema, rendering, construction
- `Math.seedrandom()` is called globally -- seed flow changes affect terrain determinism
- Persistence uses localStorage keys prefixed `cw_` -- changes to generation data structures must preserve or migrate these

## Preferred Workflow

1. Use banner comments in `src/app.js` to navigate instead of scanning the whole file
2. Keep HTML id changes synchronized with JS
3. For simulation changes, verify both init paths (`cw_generationZero`, `worldRun`) and reset paths (`cw_resetWorld`, new population, restore progress)
4. Do not split `src/app.js` into multiple files without updating `AGENTS.md`
