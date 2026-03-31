# CLAUDE.md

## Project Overview

HTML5 genetic algorithm car evolver using Box2D physics. Inspired by BoxCar2D, written from scratch. Vite-based SPA with Yarn Berry PnP.

## Architecture

The app is split into ~25 ES modules under `src/`. The UI shell is `index.html` + `styles.css`. See `AGENTS.md` for a detailed per-module code map with export names and responsibilities.

Module tree:

```
src/
  lib/
    box2d.js          # re-exports Box2D globals from vendored <script> tag
    seedrandom.js     # re-exports Math.seedrandom from vendored <script> tag
  genetics/
    random.js          # genome generation and mutation helpers
    create-instance.js # generation-zero, crossover, clone, applyTypes
    manage-round.js    # GA generation management
    manage-round-sa.js # simulated annealing (unused, preserved)
  generation-config.js # parent selection, generation constants, schema wiring
  physics/
    car-constants.js   # wheel/chassis dimension constants
    construct.js       # schema generation, worldDef()
    def-to-car.js      # genome → Box2D body conversion
    run.js             # per-car physics state, health, scoring
    setup-scene.js     # terrain generation, floor tiles
    world-run.js       # Box2D world stepping, car lifecycle
  rendering/
    primitives.js      # drawVirtualPoly, drawCircle
    draw-floor.js      # floor rendering with camera culling
    draw-car.js        # car chassis + wheel rendering
    graphs.js          # generation score graphs, top scores list
  ghost/
    car-to-ghost.js    # frame capture from Box2D bodies
    ghost.js           # replay state machine, ghost drawing
  ui/
    camera.js          # camera state, position tracking
    car-ui.js          # cw_Car class, health bars, minimap markers
    persistence.js     # save/restore to localStorage
    game-loop.js       # animation frame loop, fast-forward mode
    ghost-replay.js    # ghost replay interval management
  main.js              # orchestrator: mutable state, DOM wiring, init
```

Dependency direction (strict, no cycles):

```
lib/               ← no app imports
genetics/          ← imports nothing from app
physics/           ← imports lib/, genetics/create-instance
generation-config  ← imports physics/construct
rendering/         ← imports rendering/primitives only
ghost/             ← imports ghost/car-to-ghost only
ui/                ← imports physics/run
main.js            ← imports everything, owns mutable state
```

## Running

```
yarn dev
```

Opens at http://localhost:5173. For production build: `yarn build && yarn preview`.

## Dependencies

- `public/lib/box2d.js` and `public/lib/seedrandom.js` are vendored (served as classic scripts from `public/`, outside Vite's module graph)
- `src/lib/box2d.js` and `src/lib/seedrandom.js` are thin shims that re-export those globals into the ES module graph
- Vite 6 (dev dependency, managed by Yarn Berry PnP)

## Testing

No automated test suite. Verify manually: page loads, cars spawn, generations advance, graphs render, UI controls respond, save/restore works.

## Key Couplings

- DOM ids in `index.html` are referenced directly in `src/main.js` -- renaming requires matching changes in both
- Assumes 2 wheels via `carConstantsData.wheelCount` in `src/physics/car-constants.js` -- changes ripple into schema (`physics/construct.js`), rendering (`rendering/draw-car.js`), and construction (`physics/def-to-car.js`)
- `Math.seedrandom()` is called via `src/lib/seedrandom.js` -- seed flow changes affect terrain determinism
- Persistence uses localStorage keys prefixed `cw_` -- changes to generation data structures must preserve or migrate these

## Preferred Workflow

1. Use the module tree above to navigate to the right file instead of scanning everything
2. Keep HTML id changes synchronized between `index.html` and `src/main.js`
3. For simulation changes, verify both init paths (`manageRound.generationZero`, `worldRun`) and reset paths (new population, restore progress) in `src/main.js`
4. When adding a new module, update `AGENTS.md` with its exports and dependencies
