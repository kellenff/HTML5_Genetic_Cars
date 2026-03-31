# Split IIFE Monolith into ES Modules

## Goals

- **Maintainability:** Each logical unit in its own file with clear boundaries.
- **Testability:** Domain modules importable in isolation without DOM or Box2D mocking.

## Decisions

- **Vendored globals:** Thin shim modules (`src/lib/box2d.js`, `src/lib/seedrandom.js`) re-export `window.*` globals. Modules import from shims rather than referencing globals directly.
- **Directory structure:** Regrouped by domain (`genetics/`, `physics/`, `rendering/`, `ghost/`, `ui/`) rather than following original banner-comment paths or flattening.
- **Main entry:** Split aggressively into camera, persistence, game-loop, car-ui, ghost-replay modules. Orchestrator (`main.js`) is pure glue.
- **generation-config.js:** Lives at `src/` top level (not inside `genetics/`) to preserve dependency linearity — it imports from both `physics/` (for schema) and is consumed by `genetics/` (via `main.js` passing it in).

## Dependency Direction

Strict, no cycles:

```
lib/               <- no app imports
genetics/          <- imports nothing from app (random, createInstance, manageRound)
physics/           <- imports lib/, genetics/create-instance (for applyTypes)
generation-config  <- imports physics/construct (for schema)
rendering/         <- imports lib/ (reads Box2D bodies)
ghost/             <- imports ghost/car-to-ghost only
ui/                <- imports physics/, rendering/, ghost/, genetics/
main.js            <- imports everything, owns mutable state
```

No module imports from a layer above it.

## File Map

### `src/lib/`

| File            | Exports                                                                                                                   | Imports                  | Notes                                                    |
| --------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------ | -------------------------------------------------------- |
| `box2d.js`      | `b2World`, `b2Vec2`, `b2BodyDef`, `b2Body`, `b2FixtureDef`, `b2PolygonShape`, `b2CircleShape`, `b2RevoluteJointDef`, etc. | `window.*`               | Re-exports all Box2D types actually used in the codebase |
| `seedrandom.js` | `seedrandom(seed)`                                                                                                        | `window.Math.seedrandom` | Wraps the global seedrandom call                         |

### `src/genetics/`

| File                 | Exports                                                                                                                               | Imports           | Source lines |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | ------------ |
| `random.js`          | `random` object (createNormals, createIntegers, createFloats, shuffleIntegers, mapToFloat, mapToInteger, mapToShuffle, mutateReplace) | nothing           | ~7-128       |
| `create-instance.js` | `createGenerationZero`, `createCrossBreed`, `createMutatedClone`, `applyTypes`                                                        | `random`          | ~130-222     |
| `manage-round.js`    | `generationZero`, `nextGeneration`                                                                                                    | `create-instance` | ~610-694     |
| `manage-round-sa.js` | `generationZero`, `nextGeneration`                                                                                                    | `create-instance` | ~696-768     |

### `src/generation-config.js`

| File                   | Exports                                                   | Imports             |
| ---------------------- | --------------------------------------------------------- | ------------------- |
| `generation-config.js` | `generationConfig` function, `generationConfig.constants` | `physics/construct` |

Contains `flatRankSelect`, `pickParent`, `generateRandom` as private functions (only used here).

### `src/physics/`

| File               | Exports                                                                    | Imports                                                                     | Source lines |
| ------------------ | -------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ------------ |
| `car-constants.js` | `carConstantsData` object                                                  | nothing                                                                     | ~224-237     |
| `construct.js`     | `generateSchema(constants)`, `carConstants()`, `worldDef()`                | `car-constants`, `lib/box2d`                                                | ~239-307     |
| `def-to-car.js`    | `defToCar(world, car_def, carConstants)`                                   | `lib/box2d`                                                                 | ~308-424     |
| `run.js`           | `carStep(state, world_def)`, `getScore(state)`, `getStatus(state, config)` | `lib/box2d`                                                                 | ~425-507     |
| `setup-scene.js`   | `setupScene(world_def)`                                                    | `lib/box2d`, `lib/seedrandom`                                               | ~1322-1440   |
| `world-run.js`     | `worldRun(world_def, generation, listeners)`                               | `def-to-car`, `run`, `setup-scene`, `genetics/create-instance` (applyTypes) | ~1441-1497   |

### `src/rendering/`

| File            | Exports                                                                                         | Imports      | Source lines |
| --------------- | ----------------------------------------------------------------------------------------------- | ------------ | ------------ |
| `primitives.js` | `drawVirtualPoly(ctx, body, vtx, n_vtx)`, `drawCircle(ctx, body, center, radius, angle, color)` | nothing      | ~981-1014    |
| `draw-floor.js` | `drawFloor(ctx, camera, floorTiles)`                                                            | `primitives` | ~1016-1050   |
| `draw-car.js`   | `drawCar(carConstants, myCar, camera, ctx)`                                                     | `primitives` | ~1201-1256   |
| `graphs.js`     | `plotGraphs(...)`, `clearGraphics(...)`                                                         | nothing      | ~1058-1199   |

### `src/ghost/`

| File              | Exports                                                                                                                                      | Imports        | Source lines |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | ------------ |
| `car-to-ghost.js` | `getFrame(car)`                                                                                                                              | nothing        | ~769-826     |
| `ghost.js`        | `createReplay`, `createGhost`, `resetGhost`, `pause`, `resume`, `getPosition`, `compareToReplay`, `moveFrame`, `addReplayFrame`, `drawFrame` | `car-to-ghost` | ~828-979     |

Ghost drawing (`drawFrame`, `ghost_draw_poly`, `ghost_draw_circle`) stays in `ghost.js` — operates on pre-captured coordinate arrays, distinct from `rendering/primitives.js` which reads live Box2D bodies.

### `src/ui/`

| File              | Exports                                                                                                                                                                   | Imports                   |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| `camera.js`       | `createCamera()`, `setCameraTarget(camera, target)`, `setCameraPosition(camera, carMap, leaderPosition)`, `updateMinimapCamera(camera, minimapCameraStyle, minimapscale)` | nothing                   |
| `car-ui.js`       | `cw_Car` class, `setupCarUI(runner, carMap, ghostFns)`, `resetCarUI(generationState, generationConfig)`                                                                   | `physics/run` (getStatus) |
| `persistence.js`  | `saveProgress(generationState, ghost, graphState, world_def)`, `restoreProgress()`                                                                                        | nothing                   |
| `game-loop.js`    | `createGameLoop(config)` returning `{ start, stop, isRunning }`, `toggleDisplay(config)`                                                                                  | nothing                   |
| `ghost-replay.js` | `startGhostReplay(ghost, drawCallback, fps)`, `stopGhostReplay(state)`, `toggleGhostReplay(button, state)`                                                                | nothing                   |

### `src/main.js`

The orchestrator. Imports all modules. Owns mutable state:

- `world_def`, `generationState`, `currentRunner`, `ghost`, `carMap`, `graphState`, `camera`, `leaderPosition`
- `doDraw`, `cw_paused`, timing state

Responsibilities:

1. `cw_init()` — clone DOM templates, create first generation, start simulation
2. Wire all DOM event listeners (buttons, selects, minimap click)
3. Define `uiListeners` callback object passed to `worldRun`
4. Define composite functions (`cw_newRound`, `cw_resetWorld`, `cw_drawScreen`) that coordinate across modules
5. Expose `window.cw_setCameraTarget` for inline `onclick` handlers in HTML

Expected size: ~300-350 lines.

## What Stays Unchanged

- `index.html` — no DOM id changes, no structural changes
- `styles.css` — untouched
- `public/lib/` — vendored scripts stay as-is
- `vite.config.js` — Vite handles ES modules natively, no config changes

## What Gets Deleted

- `src/app.js` — replaced entirely by the new module tree

## Migration Strategy

Extract one layer at a time, bottom-up. Verify after each step.

1. Extract `src/lib/` shims — verify app loads
2. Extract `src/genetics/` (4 files) + `src/generation-config.js` — verify generations advance
3. Extract `src/physics/` (6 files) — verify cars spawn and physics runs
4. Extract `src/rendering/` (4 files) — verify canvas drawing works
5. Extract `src/ghost/` (2 files) — verify ghost replay works
6. Extract `src/ui/` (5 files) — verify all controls, save/restore, camera
7. Slim down `src/main.js` to orchestrator — final verification pass

### Verification (after each step)

Manual checklist (no automated test suite exists):

- Page loads without console errors
- Cars spawn and move
- Generations advance when all cars die
- Graphs render with red/green/blue lines
- UI controls respond (mutation rate, gravity, elite clones, floor mode)
- Save/restore population works
- Ghost replay starts and stops
- Camera follows leader, minimap updates
- Fast forward completes a generation
- "New Population" and "Create new world" reset correctly

### Documentation Updates

After migration completes:

- `CLAUDE.md` — rewrite architecture section with new module map
- `AGENTS.md` — rewrite file map to reflect new structure
