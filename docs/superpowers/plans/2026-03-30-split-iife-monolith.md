# Split IIFE Monolith Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the 2300-line `src/app.js` IIFE into ~25 ES modules grouped by domain, preserving all existing behavior.

**Architecture:** Bottom-up extraction. Create shim modules for vendored globals, then extract leaf modules (genetics, physics constants) first, working up to the orchestrator. At each layer, create new files with the extracted code, update `src/app.js` to import from them, and verify the app still works. After all code is extracted, `src/app.js` becomes the final `src/main.js` orchestrator.

**Tech Stack:** Vite 6 (ES modules), Box2D.js (vendored global), seedrandom.js (vendored global)

**Spec:** `docs/superpowers/specs/2026-03-30-split-iife-monolith-design.md`

---

## Task 1: Remove IIFE Wrapper and Create Shim Modules

**Why first:** ES module `import` statements must be at the top level — they can't live inside an IIFE. Since `src/app.js` is already loaded as a module (via `src/main.js`), the IIFE wrapper is redundant. Removing it lets us add imports incrementally.

**Files:**

- Modify: `src/app.js` (remove IIFE wrapper)
- Create: `src/lib/box2d.js`
- Create: `src/lib/seedrandom.js`

- [ ] **Step 1: Remove the IIFE wrapper from `src/app.js`**

Delete line 1-4 (the opening comment block and `(function () {`) and line 2300 (`})();`). Dedent the entire file contents by 2 spaces.

The file should start directly with the first banner comment:

```js
/* -------------------------------------------------------------------------
 * machine-learning/random.js
 * ------------------------------------------------------------------------- */

const random = {
  // ... rest of file, no longer indented inside IIFE
```

And end with:

```js
cw_init();
```

No more `})();` at the end.

- [ ] **Step 2: Create `src/lib/box2d.js`**

```js
/* Re-export Box2D globals loaded by <script> tag in index.html */
export const b2World = window.b2World;
export const b2Vec2 = window.b2Vec2;
export const b2BodyDef = window.b2BodyDef;
export const b2Body = window.b2Body;
export const b2FixtureDef = window.b2FixtureDef;
export const b2PolygonShape = window.b2PolygonShape;
export const b2CircleShape = window.b2CircleShape;
export const b2RevoluteJointDef = window.b2RevoluteJointDef;
```

- [ ] **Step 3: Create `src/lib/seedrandom.js`**

```js
/* Re-export seedrandom loaded by <script> tag in index.html */
export function seedrandom(seed) {
  return Math.seedrandom(seed);
}
```

- [ ] **Step 4: Verify the app still works**

Run: `yarn dev`

Open http://localhost:5173. Confirm:

- Page loads without console errors
- Cars spawn and move
- Generations advance

The shim files are created but not yet imported — they'll be used starting in Task 2.

- [ ] **Step 5: Commit**

```bash
git add src/app.js src/lib/box2d.js src/lib/seedrandom.js
git commit -m "refactor: remove IIFE wrapper, add vendored lib shims"
```

---

## Task 2: Extract `src/genetics/random.js`

**Files:**

- Create: `src/genetics/random.js`
- Modify: `src/app.js` (add import, remove inline code)

- [ ] **Step 1: Create `src/genetics/random.js`**

Extract lines 10-128 from `src/app.js` (the `const random = { ... }` object and all its methods). Add an export:

```js
// src/genetics/random.js

const random = {
  shuffleIntegers(prop, generator) {
    // ... exact code from app.js lines 11-22
  },
  createIntegers(prop, generator) {
    // ... exact code from app.js lines 23-33
  },
  createFloats(prop, generator) {
    // ... exact code from app.js lines 34-45
  },
  createNormals(prop, generator) {
    // ... exact code from app.js lines 47-56
  },
  mapToShuffle(prop, values) {
    // ... exact code from app.js
  },
  mapToFloat(prop, values) {
    // ... exact code from app.js
  },
  mapToInteger(prop, values) {
    // ... exact code from app.js
  },
  mutateReplace(prop, generator, values, factor, chance) {
    // ... exact code from app.js
  },
};

export { random };
```

Copy the entire `random` object verbatim from `src/app.js`. The only change is adding `export { random };` at the end.

- [ ] **Step 2: Update `src/app.js`**

At the top of the file, add:

```js
import { random } from "./genetics/random.js";
```

Delete lines 6-128 (the `machine-learning/random.js` banner comment through the closing `};` of the random object).

- [ ] **Step 3: Verify**

Run: `yarn dev` — confirm cars spawn and generations advance (random is used for genome generation and mutation).

- [ ] **Step 4: Commit**

```bash
git add src/genetics/random.js src/app.js
git commit -m "refactor: extract genetics/random module"
```

---

## Task 3: Extract `src/genetics/create-instance.js`

**Files:**

- Create: `src/genetics/create-instance.js`
- Modify: `src/app.js`

- [ ] **Step 1: Create `src/genetics/create-instance.js`**

Extract lines 134-222 (the `var createInstance = { ... }` object). Import `random`:

```js
// src/genetics/create-instance.js
import { random } from "./random.js";

const createInstance = {
  createGenerationZero(schema, generator) {
    return Object.keys(schema).reduce(
      function (instance, key) {
        var schemaProp = schema[key];
        var values = random.createNormals(schemaProp, generator);
        instance[key] = values;
        return instance;
      },
      { id: Math.random().toString(32) },
    );
  },
  createCrossBreed(schema, parents, parentChooser) {
    var id = Math.random().toString(32);
    return Object.keys(schema).reduce(
      function (crossDef, key) {
        var schemaDef = schema[key];
        var values = [];
        for (var i = 0, l = schemaDef.length; i < l; i++) {
          var p = parentChooser(id, key, parents);
          values.push(parents[p][key][i]);
        }
        crossDef[key] = values;
        return crossDef;
      },
      {
        id: id,
        ancestry: parents.map(function (parent) {
          return {
            id: parent.id,
            ancestry: parent.ancestry,
          };
        }),
      },
    );
  },
  createMutatedClone(schema, generator, parent, factor, chanceToMutate) {
    var mutateFn = random.mutateReplace;
    return Object.keys(schema).reduce(
      function (clone, key) {
        var schemaProp = schema[key];
        var originalValues = parent[key];
        var values = mutateFn(
          schemaProp,
          generator,
          originalValues,
          factor,
          chanceToMutate,
        );
        clone[key] = values;
        return clone;
      },
      {
        id: parent.id,
        ancestry: parent.ancestry,
      },
    );
  },
  applyTypes(schema, parent) {
    return Object.keys(schema).reduce(
      function (clone, key) {
        var schemaProp = schema[key];
        var originalValues = parent[key];
        var values;
        switch (schemaProp.type) {
          case "shuffle":
            values = random.mapToShuffle(schemaProp, originalValues);
            break;
          case "float":
            values = random.mapToFloat(schemaProp, originalValues);
            break;
          case "integer":
            values = random.mapToInteger(schemaProp, originalValues);
            break;
          default:
            throw new Error(
              `Unknown type ${schemaProp.type} of schema for key ${key}`,
            );
        }
        clone[key] = values;
        return clone;
      },
      {
        id: parent.id,
        ancestry: parent.ancestry,
      },
    );
  },
};

export { createInstance };
```

- [ ] **Step 2: Update `src/app.js`**

Add import at top:

```js
import { createInstance } from "./genetics/create-instance.js";
```

Delete lines 130-222 (the `machine-learning/create-instance.js` banner through the end of the `createInstance` object).

- [ ] **Step 3: Verify**

Run: `yarn dev` — confirm cars spawn (createInstance is used in generation zero and crossbreeding).

- [ ] **Step 4: Commit**

```bash
git add src/genetics/create-instance.js src/app.js
git commit -m "refactor: extract genetics/create-instance module"
```

---

## Task 4: Extract `src/physics/car-constants.js` and `src/physics/construct.js`

**Files:**

- Create: `src/physics/car-constants.js`
- Create: `src/physics/construct.js`
- Modify: `src/app.js`

- [ ] **Step 1: Create `src/physics/car-constants.js`**

```js
// src/physics/car-constants.js
export const carConstantsData = {
  wheelCount: 2,
  wheelMinRadius: 0.2,
  wheelRadiusRange: 0.5,
  wheelMinDensity: 40,
  wheelDensityRange: 100,
  chassisDensityRange: 300,
  chassisMinDensity: 30,
  chassisMinAxis: 0.1,
  chassisAxisRange: 1.1,
};
```

- [ ] **Step 2: Create `src/physics/construct.js`**

```js
// src/physics/construct.js
import { carConstantsData } from "./car-constants.js";

var carConstants = carConstantsData;

function worldDef() {
  var box2dfps = 60;
  return {
    gravity: { y: 0 },
    doSleep: true,
    floorseed: "abc",
    maxFloorTiles: 200,
    mutable_floor: false,
    motorSpeed: 20,
    box2dfps: box2dfps,
    max_car_health: box2dfps * 10,
    tileDimensions: { width: 1.5, height: 0.15 },
  };
}

function getCarConstants() {
  return carConstants;
}

function generateSchema(values) {
  return {
    wheel_radius: {
      type: "float",
      length: values.wheelCount,
      min: values.wheelMinRadius,
      range: values.wheelRadiusRange,
      factor: 1,
    },
    wheel_density: {
      type: "float",
      length: values.wheelCount,
      min: values.wheelMinDensity,
      range: values.wheelDensityRange,
      factor: 1,
    },
    chassis_density: {
      type: "float",
      length: 1,
      min: values.chassisDensityRange,
      range: values.chassisMinDensity,
      factor: 1,
    },
    vertex_list: {
      type: "float",
      length: 12,
      min: values.chassisMinAxis,
      range: values.chassisAxisRange,
      factor: 1,
    },
    wheel_vertex: {
      type: "shuffle",
      length: 8,
      limit: values.wheelCount,
      factor: 1,
    },
  };
}

export const carConstruct = {
  worldDef: worldDef,
  carConstants: getCarConstants,
  generateSchema: generateSchema,
};
```

- [ ] **Step 3: Update `src/app.js`**

Add import at top:

```js
import { carConstruct } from "./physics/construct.js";
```

Delete lines 224-306 (the `car-constants.json` banner through the `carConstruct` IIFE closing `})();`). Also delete the `carConstantsData` object (lines 227-237).

- [ ] **Step 4: Verify**

Run: `yarn dev` — confirm cars spawn with correct shapes and physics.

- [ ] **Step 5: Commit**

```bash
git add src/physics/car-constants.js src/physics/construct.js src/app.js
git commit -m "refactor: extract physics/car-constants and physics/construct modules"
```

---

## Task 5: Extract `src/physics/def-to-car.js`

**Files:**

- Create: `src/physics/def-to-car.js`
- Modify: `src/app.js`

- [ ] **Step 1: Create `src/physics/def-to-car.js`**

Extract lines 315-423 (`defToCar`, `createChassis`, `createChassisPart`, `createWheel`). Import `createInstance` for `applyTypes` and Box2D shim types:

```js
// src/physics/def-to-car.js
import { createInstance } from "../genetics/create-instance.js";
import {
  b2RevoluteJointDef,
  b2Vec2,
  b2BodyDef,
  b2Body,
  b2FixtureDef,
  b2PolygonShape,
  b2CircleShape,
} from "../lib/box2d.js";

export function defToCar(normal_def, world, constants) {
  var car_def = createInstance.applyTypes(constants.schema, normal_def);
  var instance = {};
  instance.chassis = createChassis(
    world,
    car_def.vertex_list,
    car_def.chassis_density,
  );
  var i;

  var wheelCount = car_def.wheel_radius.length;

  instance.wheels = [];
  for (i = 0; i < wheelCount; i++) {
    instance.wheels[i] = createWheel(
      world,
      car_def.wheel_radius[i],
      car_def.wheel_density[i],
    );
  }

  var carmass = instance.chassis.GetMass();
  for (i = 0; i < wheelCount; i++) {
    carmass += instance.wheels[i].GetMass();
  }

  var joint_def = new b2RevoluteJointDef();

  for (i = 0; i < wheelCount; i++) {
    var torque = (carmass * -constants.gravity.y) / car_def.wheel_radius[i];

    var randvertex = instance.chassis.vertex_list[car_def.wheel_vertex[i]];
    joint_def.localAnchorA.Set(randvertex.x, randvertex.y);
    joint_def.localAnchorB.Set(0, 0);
    joint_def.maxMotorTorque = torque;
    joint_def.motorSpeed = -constants.motorSpeed;
    joint_def.enableMotor = true;
    joint_def.bodyA = instance.chassis;
    joint_def.bodyB = instance.wheels[i];
    world.CreateJoint(joint_def);
  }

  return instance;
}

function createChassis(world, vertexs, density) {
  var vertex_list = new Array();
  vertex_list.push(new b2Vec2(vertexs[0], 0));
  vertex_list.push(new b2Vec2(vertexs[1], vertexs[2]));
  vertex_list.push(new b2Vec2(0, vertexs[3]));
  vertex_list.push(new b2Vec2(-vertexs[4], vertexs[5]));
  vertex_list.push(new b2Vec2(-vertexs[6], 0));
  vertex_list.push(new b2Vec2(-vertexs[7], -vertexs[8]));
  vertex_list.push(new b2Vec2(0, -vertexs[9]));
  vertex_list.push(new b2Vec2(vertexs[10], -vertexs[11]));

  var body_def = new b2BodyDef();
  body_def.type = b2Body.b2_dynamicBody;
  body_def.position.Set(0.0, 4.0);

  var body = world.CreateBody(body_def);

  createChassisPart(body, vertex_list[0], vertex_list[1], density);
  createChassisPart(body, vertex_list[1], vertex_list[2], density);
  createChassisPart(body, vertex_list[2], vertex_list[3], density);
  createChassisPart(body, vertex_list[3], vertex_list[4], density);
  createChassisPart(body, vertex_list[4], vertex_list[5], density);
  createChassisPart(body, vertex_list[5], vertex_list[6], density);
  createChassisPart(body, vertex_list[6], vertex_list[7], density);
  createChassisPart(body, vertex_list[7], vertex_list[0], density);

  body.vertex_list = vertex_list;

  return body;
}

function createChassisPart(body, vertex1, vertex2, density) {
  var vertex_list = new Array();
  vertex_list.push(vertex1);
  vertex_list.push(vertex2);
  vertex_list.push(b2Vec2.Make(0, 0));
  var fix_def = new b2FixtureDef();
  fix_def.shape = new b2PolygonShape();
  fix_def.density = density;
  fix_def.friction = 10;
  fix_def.restitution = 0.2;
  fix_def.filter.groupIndex = -1;
  fix_def.shape.SetAsArray(vertex_list, 3);

  body.CreateFixture(fix_def);
}

function createWheel(world, radius, density) {
  var body_def = new b2BodyDef();
  body_def.type = b2Body.b2_dynamicBody;
  body_def.position.Set(0, 0);

  var body = world.CreateBody(body_def);

  var fix_def = new b2FixtureDef();
  fix_def.shape = new b2CircleShape(radius);
  fix_def.density = density;
  fix_def.friction = 1;
  fix_def.restitution = 0.2;
  fix_def.filter.groupIndex = -1;

  body.CreateFixture(fix_def);
  return body;
}
```

- [ ] **Step 2: Update `src/app.js`**

Add import at top:

```js
import { defToCar } from "./physics/def-to-car.js";
```

Delete lines 308-423 (the `car-schema/def-to-car.js` banner through `createWheel`).

- [ ] **Step 3: Verify**

Run: `yarn dev` — confirm cars have visible shapes (chassis + wheels).

- [ ] **Step 4: Commit**

```bash
git add src/physics/def-to-car.js src/app.js
git commit -m "refactor: extract physics/def-to-car module"
```

---

## Task 6: Extract `src/physics/run.js`

**Files:**

- Create: `src/physics/run.js`
- Modify: `src/app.js`

- [ ] **Step 1: Create `src/physics/run.js`**

Extract lines 429-507 (`carRun` object and its functions):

```js
// src/physics/run.js

function getInitialState(world_def) {
  return {
    frames: 0,
    health: world_def.max_car_health,
    maxPositiony: 0,
    minPositiony: 0,
    maxPositionx: 0,
  };
}

function updateState(constants, worldConstruct, state) {
  if (state.health <= 0) {
    throw new Error("Already Dead");
  }
  if (state.maxPositionx > constants.finishLine) {
    throw new Error("already Finished");
  }

  var position = worldConstruct.chassis.GetPosition();
  var nextState = {
    frames: state.frames + 1,
    maxPositionx:
      position.x > state.maxPositionx ? position.x : state.maxPositionx,
    maxPositiony:
      position.y > state.maxPositiony ? position.y : state.maxPositiony,
    minPositiony:
      position.y < state.minPositiony ? position.y : state.minPositiony,
  };

  if (position.x > constants.finishLine) {
    nextState.health = state.health;
    return nextState;
  }

  if (position.x > state.maxPositionx + 0.02) {
    nextState.health = constants.max_car_health;
    return nextState;
  }
  nextState.health = state.health - 1;
  if (Math.abs(worldConstruct.chassis.GetLinearVelocity().x) < 0.001) {
    nextState.health -= 5;
  }
  return nextState;
}

function getStatus(state, constants) {
  if (hasFailed(state, constants)) return -1;
  if (hasSuccess(state, constants)) return 1;
  return 0;
}

function hasFailed(state) {
  return state.health <= 0;
}

function hasSuccess(state, constants) {
  return state.maxPositionx > constants.finishLine;
}

function calculateScore(state, constants) {
  var avgspeed = (state.maxPositionx / state.frames) * constants.box2dfps;
  var position = state.maxPositionx;
  var score = position + avgspeed;
  return {
    v: score,
    s: avgspeed,
    x: position,
    y: state.maxPositiony,
    y2: state.minPositiony,
  };
}

export const carRun = {
  getInitialState: getInitialState,
  updateState: updateState,
  getStatus: getStatus,
  calculateScore: calculateScore,
};
```

- [ ] **Step 2: Update `src/app.js`**

Add import at top:

```js
import { carRun } from "./physics/run.js";
```

Delete lines 425-507 (the `car-schema/run.js` banner through `calculateScore`).

- [ ] **Step 3: Verify**

Run: `yarn dev` — confirm cars die when stuck (health decay), generations end.

- [ ] **Step 4: Commit**

```bash
git add src/physics/run.js src/app.js
git commit -m "refactor: extract physics/run module"
```

---

## Task 7: Extract `src/genetics/manage-round.js` and `src/genetics/manage-round-sa.js`

**Files:**

- Create: `src/genetics/manage-round.js`
- Create: `src/genetics/manage-round-sa.js`
- Modify: `src/app.js`

- [ ] **Step 1: Create `src/genetics/manage-round.js`**

Extract lines 613-694 (the `manageRound` IIFE). Replace closure reference to `createInstance` with an import:

```js
// src/genetics/manage-round.js
import { createInstance } from "./create-instance.js";

var create = createInstance;

function generationZero(config) {
  var generationSize = config.generationSize,
    schema = config.schema;
  var cw_carGeneration = [];
  for (var k = 0; k < generationSize; k++) {
    var def = create.createGenerationZero(schema, function () {
      return Math.random();
    });
    def.index = k;
    cw_carGeneration.push(def);
  }
  return {
    counter: 0,
    generation: cw_carGeneration,
  };
}

function nextGeneration(previousState, scores, config) {
  var champion_length = config.championLength,
    generationSize = config.generationSize,
    selectFromAllParents = config.selectFromAllParents;

  var newGeneration = new Array();
  var newborn;
  for (var k = 0; k < champion_length; k++) {
    scores[k].def.is_elite = true;
    scores[k].def.index = k;
    newGeneration.push(scores[k].def);
  }
  var parentList = [];
  for (k = champion_length; k < generationSize; k++) {
    var parent1 = selectFromAllParents(scores, parentList);
    var parent2 = parent1;
    while (parent2 == parent1) {
      parent2 = selectFromAllParents(scores, parentList, parent1);
    }
    var pair = [parent1, parent2];
    parentList.push(pair);
    newborn = makeChild(
      config,
      pair.map(function (parent) {
        return scores[parent].def;
      }),
    );
    newborn = mutate(config, newborn);
    newborn.is_elite = false;
    newborn.index = k;
    newGeneration.push(newborn);
  }

  return {
    counter: previousState.counter + 1,
    generation: newGeneration,
  };
}

function makeChild(config, parents) {
  var schema = config.schema,
    pickParent = config.pickParent;
  return create.createCrossBreed(schema, parents, pickParent);
}

function mutate(config, parent) {
  var schema = config.schema,
    mutation_range = config.mutation_range,
    gen_mutation = config.gen_mutation,
    generateRandom = config.generateRandom;
  return create.createMutatedClone(
    schema,
    generateRandom,
    parent,
    Math.max(mutation_range),
    gen_mutation,
  );
}

export const manageRound = { generationZero, nextGeneration };
```

- [ ] **Step 2: Create `src/genetics/manage-round-sa.js`**

Extract lines 699-767 (the `manageRoundSA` IIFE):

```js
// src/genetics/manage-round-sa.js
import { createInstance } from "./create-instance.js";

var create = createInstance;

function generationZero(config) {
  var oldStructure = create.createGenerationZero(
    config.schema,
    config.generateRandom,
  );
  var newStructure = createStructure(config, 1, oldStructure);

  var k = 0;

  return {
    counter: 0,
    k: k,
    generation: [newStructure, oldStructure],
  };
}

function nextGeneration(previousState, scores, config) {
  var nextState = {
    k: (previousState.k + 1) % config.generationSize,
    counter:
      previousState.counter +
      (previousState.k === config.generationSize ? 1 : 0),
  };
  var oldDef = previousState.curDef || previousState.generation[1];
  var oldScore = previousState.score || scores[1].score.v;

  var newDef = previousState.generation[0];
  var newScore = scores[0].score.v;

  var temp = Math.pow(Math.E, -nextState.counter / config.generationSize);

  var scoreDiff = newScore - oldScore;
  if (scoreDiff > 0) {
    nextState.curDef = newDef;
    nextState.score = newScore;
  } else if (Math.random() > Math.exp(-scoreDiff / (nextState.k * temp))) {
    nextState.curDef = newDef;
    nextState.score = newScore;
  } else {
    nextState.curDef = oldDef;
    nextState.score = oldScore;
  }

  nextState.generation = [createStructure(config, temp, nextState.curDef)];

  return nextState;
}

function createStructure(config, mutation_range, parent) {
  var schema = config.schema,
    gen_mutation = 1,
    generateRandom = config.generateRandom;
  return create.createMutatedClone(
    schema,
    generateRandom,
    parent,
    mutation_range,
    gen_mutation,
  );
}

export const manageRoundSA = { generationZero, nextGeneration };
```

- [ ] **Step 3: Update `src/app.js`**

Add imports at top:

```js
import { manageRound } from "./genetics/manage-round.js";
import { manageRoundSA } from "./genetics/manage-round-sa.js";
```

Delete lines 610-767 (both `manage-round.js` and `manage-round-sa.js` banners and their IIFEs).

- [ ] **Step 4: Verify**

Run: `yarn dev` — confirm new generations are created after all cars die.

- [ ] **Step 5: Commit**

```bash
git add src/genetics/manage-round.js src/genetics/manage-round-sa.js src/app.js
git commit -m "refactor: extract genetics/manage-round and manage-round-sa modules"
```

---

## Task 8: Extract `src/generation-config.js`

**Files:**

- Create: `src/generation-config.js`
- Modify: `src/app.js`

- [ ] **Step 1: Create `src/generation-config.js`**

Extract lines 509-608 (`flatRankSelect`, `pickParent`, `generateRandom`, and the `generationConfig` IIFE):

```js
// src/generation-config.js
import { carConstruct } from "./physics/construct.js";

function flatRankSelect(parents) {
  var totalParents = parents.length;
  var parentIndex = -1;
  for (var k = 0; k < totalParents; k++) {
    if (Math.random() <= 0.2) {
      parentIndex = k;
      break;
    }
  }
  if (parentIndex === -1) {
    parentIndex = Math.floor(Math.random() * totalParents);
  }
  return parentIndex;
}

var nAttributes = 15;

function pickParent(currentChoices, chooseId, key) {
  if (!currentChoices.has(chooseId)) {
    currentChoices.set(chooseId, initializePick());
  }

  var state = currentChoices.get(chooseId);
  state.i++;
  if (["wheel_radius", "wheel_vertex", "wheel_density"].indexOf(key) > -1) {
    state.curparent = cw_chooseParent(state);
    return state.curparent;
  }
  state.curparent = cw_chooseParent(state);
  return state.curparent;

  function cw_chooseParent(state) {
    var curparent = state.curparent;
    var attributeIndex = state.i;
    var swapPoint1 = state.swapPoint1;
    var swapPoint2 = state.swapPoint2;
    if (swapPoint1 == attributeIndex || swapPoint2 == attributeIndex) {
      return curparent == 1 ? 0 : 1;
    }
    return curparent;
  }

  function initializePick() {
    var curparent = 0;

    var swapPoint1 = Math.floor(Math.random() * nAttributes);
    var swapPoint2 = swapPoint1;
    while (swapPoint2 == swapPoint1) {
      swapPoint2 = Math.floor(Math.random() * nAttributes);
    }
    var i = 0;
    return {
      curparent: curparent,
      i: i,
      swapPoint1: swapPoint1,
      swapPoint2: swapPoint2,
    };
  }
}

function generateRandom() {
  return Math.random();
}

var carConstants = carConstruct.carConstants();
var schema = carConstruct.generateSchema(carConstants);
var constants = {
  generationSize: 20,
  schema: schema,
  championLength: 1,
  mutation_range: 1,
  gen_mutation: 0.05,
};

var generationConfig = function () {
  var currentChoices = new Map();
  return Object.assign({}, constants, {
    selectFromAllParents: flatRankSelect,
    generateRandom: generateRandom,
    pickParent: pickParent.bind(void 0, currentChoices),
  });
};
generationConfig.constants = constants;

export { generationConfig };
```

- [ ] **Step 2: Update `src/app.js`**

Add import at top:

```js
import { generationConfig } from "./generation-config.js";
```

Delete lines 509-608 (from `generation-config/selectFromAllParents.js` banner through the `generationConfig` IIFE).

- [ ] **Step 3: Verify**

Run: `yarn dev` — confirm mutation rate, elite clones, and generation size work correctly.

- [ ] **Step 4: Commit**

```bash
git add src/generation-config.js src/app.js
git commit -m "refactor: extract generation-config module"
```

---

## Task 9: Extract `src/physics/setup-scene.js`

**Files:**

- Create: `src/physics/setup-scene.js`
- Modify: `src/app.js`

- [ ] **Step 1: Create `src/physics/setup-scene.js`**

Extract lines 1339-1439 (`setupScene`, `cw_createFloor`, `cw_createFloorTile`, `cw_rotateFloorTile`):

```js
// src/physics/setup-scene.js
import {
  b2World,
  b2Vec2,
  b2BodyDef,
  b2FixtureDef,
  b2PolygonShape,
} from "../lib/box2d.js";
import { seedrandom } from "../lib/seedrandom.js";

export function setupScene(world_def) {
  var world = new b2World(world_def.gravity, world_def.doSleep);
  var floorTiles = cw_createFloor(
    world,
    world_def.floorseed,
    world_def.tileDimensions,
    world_def.maxFloorTiles,
    world_def.mutable_floor,
  );

  var last_tile = floorTiles[floorTiles.length - 1];
  var last_fixture = last_tile.GetFixtureList();
  var tile_position = last_tile.GetWorldPoint(
    last_fixture.GetShape().m_vertices[3],
  );
  var finishLine = tile_position.x + 5;
  world.finishLine = finishLine;
  return {
    world: world,
    floorTiles: floorTiles,
    finishLine: finishLine,
  };
}

function cw_createFloor(
  world,
  floorseed,
  dimensions,
  maxFloorTiles,
  mutable_floor,
) {
  var last_tile = null;
  var tile_position = new b2Vec2(-5, 0);
  var cw_floorTiles = [];
  seedrandom(floorseed);
  for (var k = 0; k < maxFloorTiles; k++) {
    if (!mutable_floor) {
      last_tile = cw_createFloorTile(
        world,
        dimensions,
        tile_position,
        ((Math.random() * 3 - 1.5) * 1.5 * k) / maxFloorTiles,
      );
    } else {
      last_tile = cw_createFloorTile(
        world,
        dimensions,
        tile_position,
        ((Math.random() * 3 - 1.5) * 1.2 * k) / maxFloorTiles,
      );
    }
    cw_floorTiles.push(last_tile);
    var last_fixture = last_tile.GetFixtureList();
    tile_position = last_tile.GetWorldPoint(
      last_fixture.GetShape().m_vertices[3],
    );
  }
  return cw_floorTiles;
}

function cw_createFloorTile(world, dim, position, angle) {
  var body_def = new b2BodyDef();

  body_def.position.Set(position.x, position.y);
  var body = world.CreateBody(body_def);
  var fix_def = new b2FixtureDef();
  fix_def.shape = new b2PolygonShape();
  fix_def.friction = 0.5;

  var coords = new Array();
  coords.push(new b2Vec2(0, 0));
  coords.push(new b2Vec2(0, -dim.y));
  coords.push(new b2Vec2(dim.x, -dim.y));
  coords.push(new b2Vec2(dim.x, 0));

  var center = new b2Vec2(0, 0);

  var newcoords = cw_rotateFloorTile(coords, center, angle);

  fix_def.shape.SetAsArray(newcoords);

  body.CreateFixture(fix_def);
  return body;
}

function cw_rotateFloorTile(coords, center, angle) {
  return coords.map(function (coord) {
    return {
      x:
        Math.cos(angle) * (coord.x - center.x) -
        Math.sin(angle) * (coord.y - center.y) +
        center.x,
      y:
        Math.sin(angle) * (coord.x - center.x) +
        Math.cos(angle) * (coord.y - center.y) +
        center.y,
    };
  });
}
```

- [ ] **Step 2: Update `src/app.js`**

Add import at top:

```js
import { setupScene } from "./physics/setup-scene.js";
```

Delete lines 1322-1439 (the `world/setup-scene.js` banner through `cw_rotateFloorTile`).

- [ ] **Step 3: Verify**

Run: `yarn dev` — confirm terrain renders, minimap shows floor.

- [ ] **Step 4: Commit**

```bash
git add src/physics/setup-scene.js src/app.js
git commit -m "refactor: extract physics/setup-scene module"
```

---

## Task 10: Extract `src/physics/world-run.js`

**Files:**

- Create: `src/physics/world-run.js`
- Modify: `src/app.js`

- [ ] **Step 1: Create `src/physics/world-run.js`**

Extract lines 1444-1496 (the `worldRun` function). Import its dependencies:

```js
// src/physics/world-run.js
import { defToCar } from "./def-to-car.js";
import { carRun } from "./run.js";
import { setupScene } from "./setup-scene.js";
import { seedrandom } from "../lib/seedrandom.js";

export function worldRun(world_def, defs, listeners) {
  if (world_def.mutable_floor) {
    world_def.floorseed = btoa(seedrandom());
  }

  var scene = setupScene(world_def);
  world_def.finishLine = scene.finishLine;
  scene.world.Step(1 / world_def.box2dfps, 20, 20);
  var cars = defs.map((def, i) => {
    return {
      index: i,
      def: def,
      car: defToCar(def, scene.world, world_def),
      state: carRun.getInitialState(world_def),
    };
  });
  var alivecars = cars;
  return {
    scene: scene,
    cars: cars,
    step: function () {
      if (alivecars.length === 0) {
        throw new Error("no more cars");
      }
      scene.world.Step(1 / world_def.box2dfps, 20, 20);
      listeners.preCarStep();
      alivecars = alivecars.filter(function (car) {
        car.state = carRun.updateState(world_def, car.car, car.state);
        var status = carRun.getStatus(car.state, world_def);
        listeners.carStep(car);
        if (status === 0) {
          return true;
        }
        car.score = carRun.calculateScore(car.state, world_def);
        listeners.carDeath(car);

        var world = scene.world;
        var worldCar = car.car;
        world.DestroyBody(worldCar.chassis);

        for (var w = 0; w < worldCar.wheels.length; w++) {
          world.DestroyBody(worldCar.wheels[w]);
        }

        return false;
      });
      if (alivecars.length === 0) {
        listeners.generationEnd(cars);
      }
    },
  };
}
```

- [ ] **Step 2: Update `src/app.js`**

Add import at top:

```js
import { worldRun } from "./physics/world-run.js";
```

Delete lines 1441-1496 (the `world/run.js` banner through the `worldRun` function).

- [ ] **Step 3: Verify**

Run: `yarn dev` — confirm full simulation loop works (cars spawn, run, die, new generation starts).

- [ ] **Step 4: Commit**

```bash
git add src/physics/world-run.js src/app.js
git commit -m "refactor: extract physics/world-run module"
```

---

## Task 11: Extract `src/rendering/primitives.js`, `src/rendering/draw-floor.js`, `src/rendering/draw-car.js`

**Files:**

- Create: `src/rendering/primitives.js`
- Create: `src/rendering/draw-floor.js`
- Create: `src/rendering/draw-car.js`
- Modify: `src/app.js`

- [ ] **Step 1: Create `src/rendering/primitives.js`**

```js
// src/rendering/primitives.js

export function drawVirtualPoly(ctx, body, vtx, n_vtx) {
  var p0 = body.GetWorldPoint(vtx[0]);
  ctx.moveTo(p0.x, p0.y);
  for (var i = 1; i < n_vtx; i++) {
    var p = body.GetWorldPoint(vtx[i]);
    ctx.lineTo(p.x, p.y);
  }
  ctx.lineTo(p0.x, p0.y);
}

export function drawCircle(ctx, body, center, radius, angle, color) {
  var p = body.GetWorldPoint(center);
  ctx.fillStyle = color;

  ctx.beginPath();
  ctx.arc(p.x, p.y, radius, 0, 2 * Math.PI, true);

  ctx.moveTo(p.x, p.y);
  ctx.lineTo(p.x + radius * Math.cos(angle), p.y + radius * Math.sin(angle));

  ctx.fill();
  ctx.stroke();
}
```

- [ ] **Step 2: Create `src/rendering/draw-floor.js`**

```js
// src/rendering/draw-floor.js
import { drawVirtualPoly } from "./primitives.js";

export function drawFloor(ctx, camera, cw_floorTiles) {
  var camera_x = camera.pos.x;
  var zoom = camera.zoom;
  ctx.strokeStyle = "#000";
  ctx.fillStyle = "#777";
  ctx.lineWidth = 1 / zoom;
  ctx.beginPath();

  var k;
  if (camera.pos.x - 10 > 0) {
    k = Math.floor((camera.pos.x - 10) / 1.5);
  } else {
    k = 0;
  }

  outer_loop: for (k; k < cw_floorTiles.length; k++) {
    var b = cw_floorTiles[k];
    for (var f = b.GetFixtureList(); f; f = f.m_next) {
      var s = f.GetShape();
      var shapePosition = b.GetWorldPoint(s.m_vertices[0]).x;
      if (shapePosition > camera_x - 5 && shapePosition < camera_x + 10) {
        drawVirtualPoly(ctx, b, s.m_vertices, s.m_vertexCount);
      }
      if (shapePosition > camera_x + 10) {
        break outer_loop;
      }
    }
  }
  ctx.fill();
  ctx.stroke();
}
```

- [ ] **Step 3: Create `src/rendering/draw-car.js`**

```js
// src/rendering/draw-car.js
import { drawVirtualPoly, drawCircle } from "./primitives.js";

export function drawCar(car_constants, myCar, camera, ctx) {
  var camera_x = camera.pos.x;
  var zoom = camera.zoom;

  var wheelMinDensity = car_constants.wheelMinDensity;
  var wheelDensityRange = car_constants.wheelDensityRange;

  if (!myCar.alive) {
    return;
  }
  var myCarPos = myCar.getPosition();

  if (myCarPos.x < camera_x - 5) {
    return;
  }

  ctx.strokeStyle = "#444";
  ctx.lineWidth = 1 / zoom;

  var wheels = myCar.car.car.wheels;

  for (var i = 0; i < wheels.length; i++) {
    var b = wheels[i];
    for (var f = b.GetFixtureList(); f; f = f.m_next) {
      var s = f.GetShape();
      var color = Math.round(
        255 - (255 * (f.m_density - wheelMinDensity)) / wheelDensityRange,
      ).toString();
      var rgbcolor = "rgb(" + color + "," + color + "," + color + ")";
      drawCircle(ctx, b, s.m_p, s.m_radius, b.m_sweep.a, rgbcolor);
    }
  }

  if (myCar.is_elite) {
    ctx.strokeStyle = "#3F72AF";
    ctx.fillStyle = "#DBE2EF";
  } else {
    ctx.strokeStyle = "#F7C873";
    ctx.fillStyle = "#FAEBCD";
  }
  ctx.beginPath();

  var chassis = myCar.car.car.chassis;

  for (f = chassis.GetFixtureList(); f; f = f.m_next) {
    var cs = f.GetShape();
    drawVirtualPoly(ctx, chassis, cs.m_vertices, cs.m_vertexCount);
  }
  ctx.fill();
  ctx.stroke();
}
```

- [ ] **Step 4: Update `src/app.js`**

Add imports at top:

```js
import { drawFloor } from "./rendering/draw-floor.js";
import { drawCar } from "./rendering/draw-car.js";
```

Delete the primitives (lines ~981-1014), draw-floor (~1016-1050), and draw-car (~1201-1256) sections. Update references:

- `cw_drawFloor(ctx, camera, floorTiles)` becomes `drawFloor(ctx, camera, floorTiles)`

- [ ] **Step 5: Verify**

Run: `yarn dev` — confirm floor renders, cars render with correct colors (elite = blue, normal = yellow).

- [ ] **Step 6: Commit**

```bash
git add src/rendering/primitives.js src/rendering/draw-floor.js src/rendering/draw-car.js src/app.js
git commit -m "refactor: extract rendering/primitives, draw-floor, draw-car modules"
```

---

## Task 12: Extract `src/rendering/graphs.js`

**Files:**

- Create: `src/rendering/graphs.js`
- Modify: `src/app.js`

- [ ] **Step 1: Create `src/rendering/graphs.js`**

Extract lines ~1058-1199 (the graph functions). Export `plotGraphs` and `clearGraphics`:

```js
// src/rendering/graphs.js

function cw_storeGraphScores(lastState, cw_carScores, generationSize) {
  return {
    cw_topScores: (lastState.cw_topScores || []).concat([
      cw_carScores[0].score,
    ]),
    cw_graphAverage: (lastState.cw_graphAverage || []).concat([
      cw_average(cw_carScores, generationSize),
    ]),
    cw_graphElite: (lastState.cw_graphElite || []).concat([
      cw_eliteaverage(cw_carScores, generationSize),
    ]),
    cw_graphTop: (lastState.cw_graphTop || []).concat([
      cw_carScores[0].score.v,
    ]),
  };
}

function cw_plotTop(state, graphctx) {
  var cw_graphTop = state.cw_graphTop;
  var graphsize = cw_graphTop.length;
  graphctx.strokeStyle = "#C83B3B";
  graphctx.beginPath();
  graphctx.moveTo(0, 0);
  for (var k = 0; k < graphsize; k++) {
    graphctx.lineTo((400 * (k + 1)) / graphsize, cw_graphTop[k]);
  }
  graphctx.stroke();
}

function cw_plotElite(state, graphctx) {
  var cw_graphElite = state.cw_graphElite;
  var graphsize = cw_graphElite.length;
  graphctx.strokeStyle = "#7BC74D";
  graphctx.beginPath();
  graphctx.moveTo(0, 0);
  for (var k = 0; k < graphsize; k++) {
    graphctx.lineTo((400 * (k + 1)) / graphsize, cw_graphElite[k]);
  }
  graphctx.stroke();
}

function cw_plotAverage(state, graphctx) {
  var cw_graphAverage = state.cw_graphAverage;
  var graphsize = cw_graphAverage.length;
  graphctx.strokeStyle = "#3F72AF";
  graphctx.beginPath();
  graphctx.moveTo(0, 0);
  for (var k = 0; k < graphsize; k++) {
    graphctx.lineTo((400 * (k + 1)) / graphsize, cw_graphAverage[k]);
  }
  graphctx.stroke();
}

function cw_eliteaverage(scores, generationSize) {
  var sum = 0;
  for (var k = 0; k < Math.floor(generationSize / 2); k++) {
    sum += scores[k].score.v;
  }
  return sum / Math.floor(generationSize / 2);
}

function cw_average(scores, generationSize) {
  var sum = 0;
  for (var k = 0; k < generationSize; k++) {
    sum += scores[k].score.v;
  }
  return sum / generationSize;
}

export function clearGraphics(graphcanvas, graphctx, graphwidth, graphheight) {
  graphcanvas.width = graphcanvas.width;
  graphctx.translate(0, graphheight);
  graphctx.scale(1, -1);
  graphctx.lineWidth = 1;
  graphctx.strokeStyle = "#3F72AF";
  graphctx.beginPath();
  graphctx.moveTo(0, graphheight / 2);
  graphctx.lineTo(graphwidth, graphheight / 2);
  graphctx.moveTo(0, graphheight / 4);
  graphctx.lineTo(graphwidth, graphheight / 4);
  graphctx.moveTo(0, (graphheight * 3) / 4);
  graphctx.lineTo(graphwidth, (graphheight * 3) / 4);
  graphctx.stroke();
}

function cw_listTopScores(elem, state) {
  var cw_topScores = state.cw_topScores;
  var ts = elem;
  ts.textContent = "";
  var header = document.createElement("b");
  header.textContent = "Top Scores:";
  ts.appendChild(header);
  ts.appendChild(document.createElement("br"));
  cw_topScores.sort(function (a, b) {
    if (a.v > b.v) {
      return -1;
    } else {
      return 1;
    }
  });

  for (var k = 0; k < Math.min(10, cw_topScores.length); k++) {
    var topScore = cw_topScores[k];
    var n = "#" + (k + 1) + ":";
    var score = Math.round(topScore.v * 100) / 100;
    var distance = "d:" + Math.round(topScore.x * 100) / 100;
    var yrange =
      "h:" +
      Math.round(topScore.y2 * 100) / 100 +
      "/" +
      Math.round(topScore.y * 100) / 100 +
      "m";
    var gen = "(Gen " + cw_topScores[k].i + ")";

    var line = document.createTextNode(
      [n, score, distance, yrange, gen].join(" "),
    );
    ts.appendChild(line);
    ts.appendChild(document.createElement("br"));
  }
}

export function plotGraphs(
  graphElem,
  topScoresElem,
  scatterPlotElem,
  lastState,
  scores,
  config,
) {
  lastState = lastState || {};
  var generationSize = scores.length;
  var graphcanvas = graphElem;
  var graphctx = graphcanvas.getContext("2d");
  var graphwidth = 400;
  var graphheight = 250;
  var nextState = cw_storeGraphScores(lastState, scores, generationSize);
  clearGraphics(graphcanvas, graphctx, graphwidth, graphheight);
  cw_plotAverage(nextState, graphctx);
  cw_plotElite(nextState, graphctx);
  cw_plotTop(nextState, graphctx);
  cw_listTopScores(topScoresElem, nextState);
  return nextState;
}
```

- [ ] **Step 2: Update `src/app.js`**

Add imports at top:

```js
import { plotGraphs, clearGraphics } from "./rendering/graphs.js";
```

Delete the graph section (~1052-1199). Also delete the `var graph_fns` wrapper and `var plot_graphs = graph_fns.plotGraphs;` alias.

Replace remaining references:

- `plot_graphs(...)` becomes `plotGraphs(...)`
- `cw_clearGraphics(...)` becomes `clearGraphics(...)`

- [ ] **Step 3: Verify**

Run: `yarn dev` — confirm graph renders with red/green/blue lines after a generation completes, top scores list updates.

- [ ] **Step 4: Commit**

```bash
git add src/rendering/graphs.js src/app.js
git commit -m "refactor: extract rendering/graphs module"
```

---

## Task 13: Extract `src/ghost/car-to-ghost.js` and `src/ghost/ghost.js`

**Files:**

- Create: `src/ghost/car-to-ghost.js`
- Create: `src/ghost/ghost.js`
- Modify: `src/app.js`

- [ ] **Step 1: Create `src/ghost/car-to-ghost.js`**

Extract lines 773-826:

```js
// src/ghost/car-to-ghost.js

export function getFrame(car) {
  var out = {
    chassis: getChassis(car.chassis),
    wheels: [],
    pos: { x: car.chassis.GetPosition().x, y: car.chassis.GetPosition().y },
  };

  for (var i = 0; i < car.wheels.length; i++) {
    out.wheels[i] = getWheel(car.wheels[i]);
  }

  return out;
}

function getChassis(c) {
  var gc = [];

  for (var f = c.GetFixtureList(); f; f = f.m_next) {
    var s = f.GetShape();

    var p = {
      vtx: [],
      num: 0,
    };

    p.num = s.m_vertexCount;

    for (var i = 0; i < s.m_vertexCount; i++) {
      p.vtx.push(c.GetWorldPoint(s.m_vertices[i]));
    }

    gc.push(p);
  }

  return gc;
}

function getWheel(w) {
  var gw = [];

  for (var f = w.GetFixtureList(); f; f = f.m_next) {
    var s = f.GetShape();

    var c = {
      pos: w.GetWorldPoint(s.m_p),
      rad: s.m_radius,
      ang: w.m_sweep.a,
    };

    gw.push(c);
  }

  return gw;
}
```

- [ ] **Step 2: Create `src/ghost/ghost.js`**

Extract lines 831-979 (the `ghost_fns` IIFE):

```js
// src/ghost/ghost.js
import { getFrame } from "./car-to-ghost.js";

var enable_ghost = true;

export function createReplay() {
  if (!enable_ghost) return null;
  return {
    num_frames: 0,
    frames: [],
  };
}

export function createGhost() {
  if (!enable_ghost) return null;
  return {
    replay: null,
    frame: 0,
    dist: -100,
  };
}

export function resetGhost(ghost) {
  if (!enable_ghost) return;
  if (ghost == null) return;
  ghost.frame = 0;
}

export function pause(ghost) {
  if (ghost != null) ghost.old_frame = ghost.frame;
  resetGhost(ghost);
}

export function resume(ghost) {
  if (ghost != null) ghost.frame = ghost.old_frame;
}

export function getPosition(ghost) {
  if (!enable_ghost) return;
  if (ghost == null) return;
  if (ghost.frame < 0) return;
  if (ghost.replay == null) return;
  var frame = ghost.replay.frames[ghost.frame];
  if (!frame) return;
  return frame.pos;
}

export function compareToReplay(replay, ghost, max) {
  if (!enable_ghost) return;
  if (ghost == null) return;
  if (replay == null) return;

  if (ghost.dist < max) {
    ghost.replay = replay;
    ghost.dist = max;
    ghost.frame = 0;
  }
}

export function moveFrame(ghost) {
  if (!enable_ghost) return;
  if (ghost == null) return;
  if (ghost.replay == null) return;
  ghost.frame++;
  if (ghost.frame >= ghost.replay.num_frames)
    ghost.frame = ghost.replay.num_frames - 1;
}

export function addReplayFrame(replay, car) {
  if (!enable_ghost) return;
  if (replay == null) return;

  var frame = getFrame(car);
  replay.frames.push(frame);
  replay.num_frames++;
}

export function drawFrame(ctx, ghost, camera) {
  var zoom = camera.zoom;
  if (!enable_ghost) return;
  if (ghost == null) return;
  if (ghost.frame < 0) return;
  if (ghost.replay == null) return;

  var frame = ghost.replay.frames[ghost.frame];
  if (!frame) return;

  ctx.fillStyle = "#eee";
  ctx.strokeStyle = "#aaa";
  ctx.lineWidth = 1 / zoom;

  for (var i = 0; i < frame.wheels.length; i++) {
    for (var w in frame.wheels[i]) {
      ghost_draw_circle(
        ctx,
        frame.wheels[i][w].pos,
        frame.wheels[i][w].rad,
        frame.wheels[i][w].ang,
      );
    }
  }

  ctx.strokeStyle = "#aaa";
  ctx.fillStyle = "#eee";
  ctx.lineWidth = 1 / zoom;
  ctx.beginPath();
  for (var c in frame.chassis)
    ghost_draw_poly(ctx, frame.chassis[c].vtx, frame.chassis[c].num);
  ctx.fill();
  ctx.stroke();
}

function ghost_draw_poly(ctx, vtx, n_vtx) {
  ctx.moveTo(vtx[0].x, vtx[0].y);
  for (var i = 1; i < n_vtx; i++) {
    ctx.lineTo(vtx[i].x, vtx[i].y);
  }
  ctx.lineTo(vtx[0].x, vtx[0].y);
}

function ghost_draw_circle(ctx, center, radius, angle) {
  ctx.beginPath();
  ctx.arc(center.x, center.y, radius, 0, 2 * Math.PI, true);

  ctx.moveTo(center.x, center.y);
  ctx.lineTo(
    center.x + radius * Math.cos(angle),
    center.y + radius * Math.sin(angle),
  );

  ctx.fill();
  ctx.stroke();
}
```

- [ ] **Step 3: Update `src/app.js`**

Add import at top:

```js
import * as ghostModule from "./ghost/ghost.js";
```

Delete lines 769-979 (the ghost banners and IIFE).

Delete the destructured aliases (`var ghost_draw_frame = ghost_fns.ghost_draw_frame;` etc.).

Rename the app-state variable `ghost` to `ghostState` to avoid conflict with the `ghostModule` namespace import. Replace all usages:

- `var ghost;` → `var ghostState;`
- `ghost_draw_frame(ctx, ghost, camera)` → `ghostModule.drawFrame(ctx, ghostState, camera)`
- `ghost_create_ghost()` → `ghostModule.createGhost()`
- `ghost_add_replay_frame(car.replay, car.car.car)` → `ghostModule.addReplayFrame(car.replay, car.car.car)`
- `ghost_compare_to_replay(cwCar.replay, ghost, score.v)` → `ghostModule.compareToReplay(cwCar.replay, ghostState, score.v)`
- `ghost_get_position(ghost)` → `ghostModule.getPosition(ghostState)`
- `ghost_move_frame(ghost)` → `ghostModule.moveFrame(ghostState)`
- `ghost_reset_ghost(ghost)` → `ghostModule.resetGhost(ghostState)`
- `ghost_pause(ghost)` → `ghostModule.pause(ghostState)`
- `ghost_resume(ghost)` → `ghostModule.resume(ghostState)`
- `ghost_create_replay()` → `ghostModule.createReplay()`
- `ghost = ghost_create_ghost()` → `ghostState = ghostModule.createGhost()`
- `ghost = null` → `ghostState = null`
- `JSON.stringify(ghost)` → `JSON.stringify(ghostState)`
- `ghost = JSON.parse(...)` → `ghostState = JSON.parse(...)`

- [ ] **Step 4: Verify**

Run: `yarn dev` — confirm ghost (translucent car) appears during simulation, "View top replay" button works.

- [ ] **Step 5: Commit**

```bash
git add src/ghost/car-to-ghost.js src/ghost/ghost.js src/app.js
git commit -m "refactor: extract ghost/car-to-ghost and ghost/ghost modules"
```

---

## Task 14: Extract `src/ui/camera.js`

**Files:**

- Create: `src/ui/camera.js`
- Modify: `src/app.js`

- [ ] **Step 1: Create `src/ui/camera.js`**

```js
// src/ui/camera.js

export function createCamera() {
  return {
    speed: 0.05,
    pos: { x: 0, y: 0 },
    target: -1,
    zoom: 70,
  };
}

export function setCameraTarget(camera, target, currentRunner, carMap) {
  if (target === -1) {
    camera.target = -1;
    return;
  }
  if (typeof target === "number" && currentRunner) {
    var carInfo = currentRunner.cars[target];
    if (carInfo && carMap.has(carInfo)) {
      camera.target = carInfo;
    } else {
      camera.target = -1;
    }
  } else {
    camera.target = target;
  }
}

export function setCameraPosition(camera, carMap, leaderPosition) {
  var cameraTargetPosition;
  if (camera.target !== -1 && carMap.has(camera.target)) {
    cameraTargetPosition = carMap.get(camera.target).getPosition();
  } else {
    camera.target = -1;
    cameraTargetPosition = leaderPosition;
  }
  var diff_y = camera.pos.y - cameraTargetPosition.y;
  var diff_x = camera.pos.x - cameraTargetPosition.x;
  camera.pos.y -= camera.speed * diff_y;
  camera.pos.x -= camera.speed * diff_x;
}

export function updateMinimapCamera(camera, minimapCameraStyle, minimapscale) {
  var camera_x = camera.pos.x;
  var camera_y = camera.pos.y;
  minimapCameraStyle.left = Math.round((2 + camera_x) * minimapscale) + "px";
  minimapCameraStyle.top = Math.round((31 - camera_y) * minimapscale) + "px";
}
```

- [ ] **Step 2: Update `src/app.js`**

Add import at top:

```js
import {
  createCamera,
  setCameraTarget,
  setCameraPosition,
  updateMinimapCamera,
} from "./ui/camera.js";
```

Replace the inline camera object with `var camera = createCamera();`.

Replace `cw_setCameraTarget(k)`:

```js
function cw_setCameraTarget(k) {
  setCameraTarget(camera, k, currentRunner, carMap);
}
```

Replace `cw_setCameraPosition()`:

```js
function cw_setCameraPosition() {
  setCameraPosition(camera, carMap, leaderPosition);
  updateMinimapCamera(camera, minimapcamera, minimapscale);
}
```

Delete the original `cw_minimapCamera()` function.

- [ ] **Step 3: Verify**

Run: `yarn dev` — confirm camera follows leader, clicking cars changes target, minimap camera moves.

- [ ] **Step 4: Commit**

```bash
git add src/ui/camera.js src/app.js
git commit -m "refactor: extract ui/camera module"
```

---

## Task 15: Extract `src/ui/car-ui.js`

**Files:**

- Create: `src/ui/car-ui.js`
- Modify: `src/app.js`

- [ ] **Step 1: Create `src/ui/car-ui.js`**

Extract the `cw_Car` class and helper functions:

```js
// src/ui/car-ui.js
import { carRun } from "../physics/run.js";

export var cw_Car = function () {
  this.__constructor.apply(this, arguments);
};

cw_Car.prototype.__constructor = function (car) {
  this.car = car;
  this.car_def = car.def;
  var car_def = this.car_def;

  this.frames = 0;
  this.alive = true;
  this.is_elite = car.def.is_elite;
  this.healthBar = document.getElementById("health" + car_def.index).style;
  this.healthBarText = document.getElementById(
    "health" + car_def.index,
  ).nextSibling.nextSibling;
  this.healthBarText.textContent = car_def.index;
  this.minimapmarker = document.getElementById("bar" + car_def.index);

  if (this.is_elite) {
    this.healthBar.backgroundColor = "#3F72AF";
    this.minimapmarker.style.borderLeft = "1px solid #3F72AF";
    this.minimapmarker.textContent = car_def.index;
  } else {
    this.healthBar.backgroundColor = "#F7C873";
    this.minimapmarker.style.borderLeft = "1px solid #F7C873";
    this.minimapmarker.textContent = car_def.index;
  }
};

cw_Car.prototype.getPosition = function () {
  return this.car.car.chassis.GetPosition();
};

cw_Car.prototype.kill = function (currentRunner, constants) {
  this.minimapmarker.style.borderLeft = "1px solid #ccc";
  var finishLine = currentRunner.scene.finishLine;
  var max_car_health = constants.max_car_health;
  var status = carRun.getStatus(this.car.state, {
    finishLine: finishLine,
    max_car_health: max_car_health,
  });
  switch (status) {
    case 1: {
      this.healthBar.width = "0";
      break;
    }
    case -1: {
      this.healthBarText.textContent = "\u2020";
      this.healthBar.width = "0";
      break;
    }
  }
  this.alive = false;
};

export function setupCarUI(runner, carMap, ghostFns) {
  runner.cars.map(function (carInfo) {
    var car = new cw_Car(carInfo, carMap);
    carMap.set(carInfo, car);
    car.replay = ghostFns.createReplay();
    ghostFns.addReplayFrame(car.replay, car.car.car);
  });
}

export function resetCarUI(generationState, generationConfig) {
  document.getElementById("generation").textContent =
    generationState.counter.toString();
  document.getElementById("cars").textContent = "";
  document.getElementById("population").textContent =
    generationConfig.constants.generationSize.toString();
}
```

- [ ] **Step 2: Update `src/app.js`**

Add import at top:

```js
import { cw_Car, setupCarUI, resetCarUI } from "./ui/car-ui.js";
```

Delete the inline `cw_Car` class, its prototype methods, and the original `setupCarUI`/`resetCarUI` functions. Delete `var run = carRun;`.

Update call sites:

- `setupCarUI()` → `setupCarUI(currentRunner, carMap, ghostModule)`
- `resetCarUI()` → `resetCarUI(generationState, generationConfig)`

- [ ] **Step 3: Verify**

Run: `yarn dev` — confirm health bars render, clicking them changes camera, dead cars show dagger.

- [ ] **Step 4: Commit**

```bash
git add src/ui/car-ui.js src/app.js
git commit -m "refactor: extract ui/car-ui module"
```

---

## Task 16: Extract `src/ui/persistence.js`

**Files:**

- Create: `src/ui/persistence.js`
- Modify: `src/app.js`

- [ ] **Step 1: Create `src/ui/persistence.js`**

```js
// src/ui/persistence.js

export function saveProgress(
  generationState,
  ghostState,
  graphState,
  world_def,
) {
  localStorage.cw_savedGeneration = JSON.stringify(generationState.generation);
  localStorage.cw_genCounter = generationState.counter;
  localStorage.cw_ghost = JSON.stringify(ghostState);
  localStorage.cw_topScores = JSON.stringify(graphState.cw_topScores);
  localStorage.cw_floorSeed = world_def.floorseed;
}

export function restoreProgress() {
  if (
    typeof localStorage.cw_savedGeneration == "undefined" ||
    localStorage.cw_savedGeneration == null
  ) {
    alert("No saved progress found");
    return null;
  }
  return {
    generation: JSON.parse(localStorage.cw_savedGeneration),
    counter: localStorage.cw_genCounter,
    ghost: JSON.parse(localStorage.cw_ghost),
    topScores: JSON.parse(localStorage.cw_topScores),
    floorSeed: localStorage.cw_floorSeed,
  };
}
```

- [ ] **Step 2: Update `src/app.js`**

Add import at top:

```js
import { saveProgress, restoreProgress } from "./ui/persistence.js";
```

Delete the inline `saveProgress` and `restoreProgress` functions.

Update the save handler to pass state:

```js
document.querySelector("#save-progress").addEventListener("click", function () {
  saveProgress(generationState, ghostState, graphState, world_def);
});
```

Update the restore handler to use the returned object:

```js
document
  .querySelector("#restore-progress")
  .addEventListener("click", function () {
    var saved = restoreProgress();
    if (!saved) return;
    loop.stop();
    cw_clearPopulationWorld();
    generationState.generation = saved.generation;
    generationState.counter = saved.counter;
    ghostState = saved.ghost;
    graphState.cw_topScores = saved.topScores;
    world_def.floorseed = saved.floorSeed;
    document.getElementById("newseed").value = world_def.floorseed;

    currentRunner = worldRun(
      world_def,
      generationState.generation,
      uiListeners,
    );
    setupCarUI(currentRunner, carMap, ghostModule);
    cw_drawMiniMap();
    seedrandom();

    resetCarUI(generationState, generationConfig);
    loop.start();
  });
```

- [ ] **Step 3: Verify**

Run: `yarn dev` — save a population, refresh page, restore it. Confirm generation counter, floor seed, and ghost are restored.

- [ ] **Step 4: Commit**

```bash
git add src/ui/persistence.js src/app.js
git commit -m "refactor: extract ui/persistence module"
```

---

## Task 17: Extract `src/ui/game-loop.js`

**Files:**

- Create: `src/ui/game-loop.js`
- Modify: `src/app.js`

- [ ] **Step 1: Create `src/ui/game-loop.js`**

```js
// src/ui/game-loop.js

export function createGameLoop({ stepFn, drawFn, box2dfps, screenfps }) {
  var skipTicks = Math.round(1000 / box2dfps);
  var maxFrameSkip = skipTicks * 2;
  var paused = true;
  var animationFrameId = null;
  var nextGameTick = new Date().getTime();

  function gameLoop() {
    var loops = 0;
    while (
      !paused &&
      new Date().getTime() > nextGameTick &&
      loops < maxFrameSkip
    ) {
      nextGameTick += skipTicks;
      loops++;
    }
    stepFn();
    drawFn();

    if (!paused) animationFrameId = window.requestAnimationFrame(gameLoop);
  }

  return {
    start() {
      paused = false;
      nextGameTick = new Date().getTime();
      animationFrameId = window.requestAnimationFrame(gameLoop);
    },
    stop() {
      paused = true;
      if (animationFrameId) {
        window.cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
    },
    isRunning() {
      return !paused;
    },
  };
}

export function createFastLoop({ stepFn, screenfps }) {
  var intervalId = null;
  return {
    start() {
      intervalId = setInterval(function () {
        var time = performance.now() + 1000 / screenfps;
        while (time > performance.now()) {
          stepFn();
        }
      }, 1);
    },
    stop() {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    },
  };
}
```

- [ ] **Step 2: Update `src/app.js`**

Add import at top:

```js
import { createGameLoop, createFastLoop } from "./ui/game-loop.js";
```

After `uiListeners`, create the loop:

```js
var loop = createGameLoop({
  stepFn: simulationStep,
  drawFn: cw_drawScreen,
  box2dfps: box2dfps,
  screenfps: screenfps,
});
```

Replace `cw_startSimulation()` → `loop.start()`, `cw_stopSimulation()` → `loop.stop()`.

Replace `toggleDisplay()`:

```js
var fastLoop = null;
function toggleDisplay() {
  canvas.width = canvas.width;
  if (doDraw) {
    doDraw = false;
    loop.stop();
    fastLoop = createFastLoop({ stepFn: simulationStep, screenfps: screenfps });
    fastLoop.start();
  } else {
    doDraw = true;
    if (fastLoop) fastLoop.stop();
    fastLoop = null;
    loop.start();
  }
}
```

Delete inline `gameLoop`, `cw_startSimulation`, `cw_stopSimulation`, and related state variables.

- [ ] **Step 3: Verify**

Run: `yarn dev` — confirm simulation runs, "Surprise!" toggles fast mode, resumes correctly.

- [ ] **Step 4: Commit**

```bash
git add src/ui/game-loop.js src/app.js
git commit -m "refactor: extract ui/game-loop module"
```

---

## Task 18: Extract `src/ui/ghost-replay.js`

**Files:**

- Create: `src/ui/ghost-replay.js`
- Modify: `src/app.js`

- [ ] **Step 1: Create `src/ui/ghost-replay.js`**

```js
// src/ui/ghost-replay.js

export function createGhostReplay({ drawFn, fps }) {
  var intervalId = null;

  return {
    start() {
      intervalId = setInterval(drawFn, Math.round(1000 / fps));
    },
    stop() {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    },
    isRunning() {
      return intervalId !== null;
    },
  };
}
```

- [ ] **Step 2: Update `src/app.js`**

Add import at top:

```js
import { createGhostReplay } from "./ui/ghost-replay.js";
```

Create the replay controller:

```js
var ghostReplayCtrl = createGhostReplay({
  drawFn: cw_drawGhostReplay,
  fps: screenfps,
});
```

Replace ghost replay functions:

```js
function cw_startGhostReplay() {
  if (!doDraw) toggleDisplay();
  loop.stop();
  ghostModule.pause(ghostState);
  ghostReplayCtrl.start();
}

function cw_stopGhostReplay() {
  ghostReplayCtrl.stop();
  cw_findLeader();
  camera.pos.x = leaderPosition.x;
  camera.pos.y = leaderPosition.y;
  ghostModule.resume(ghostState);
  loop.start();
}

function cw_toggleGhostReplay(button) {
  if (!ghostReplayCtrl.isRunning()) {
    cw_startGhostReplay();
    button.value = "Resume simulation";
  } else {
    cw_stopGhostReplay();
    button.value = "View top replay";
  }
}
```

Delete `var cw_ghostReplayInterval`, `cw_pauseSimulation`, `cw_resumeSimulation`, and the old replay functions.

- [ ] **Step 3: Verify**

Run: `yarn dev` — let a generation run, click "View top replay", confirm it replays, click again to resume.

- [ ] **Step 4: Commit**

```bash
git add src/ui/ghost-replay.js src/app.js
git commit -m "refactor: extract ui/ghost-replay module"
```

---

## Task 19: Finalize `src/main.js` Orchestrator

At this point, `src/app.js` should contain only orchestrator code (~300-350 lines).

**Files:**

- Delete: `src/main.js` (old one-line import)
- Rename: `src/app.js` → `src/main.js`
- Modify: `src/main.js` (final cleanup)

- [ ] **Step 1: Replace main.js with app.js**

```bash
rm src/main.js
git mv src/app.js src/main.js
```

- [ ] **Step 2: Clean up imports in `src/main.js`**

Ensure all needed imports are present. Add `seedrandom` and `b2Vec2` if not already imported:

```js
import { seedrandom } from "./lib/seedrandom.js";
import { b2Vec2 } from "./lib/box2d.js";
```

Remove any imports not used directly in the orchestrator (e.g., `random`, `createInstance` if they're only used transitively through other modules).

Remove remaining banner comments from the old structure.

The final import block should be:

```js
import { manageRound } from "./genetics/manage-round.js";
import { generationConfig } from "./generation-config.js";
import { carConstruct } from "./physics/construct.js";
import { worldRun } from "./physics/world-run.js";
import { drawFloor } from "./rendering/draw-floor.js";
import { drawCar } from "./rendering/draw-car.js";
import { plotGraphs, clearGraphics } from "./rendering/graphs.js";
import * as ghostModule from "./ghost/ghost.js";
import {
  createCamera,
  setCameraTarget,
  setCameraPosition,
  updateMinimapCamera,
} from "./ui/camera.js";
import { cw_Car, setupCarUI, resetCarUI } from "./ui/car-ui.js";
import { saveProgress, restoreProgress } from "./ui/persistence.js";
import { createGameLoop, createFastLoop } from "./ui/game-loop.js";
import { createGhostReplay } from "./ui/ghost-replay.js";
import { seedrandom } from "./lib/seedrandom.js";
import { b2Vec2 } from "./lib/box2d.js";
```

- [ ] **Step 3: Verify full application**

Run: `yarn dev`. Complete verification checklist:

- Page loads without console errors
- Cars spawn and move
- Generations advance when all cars die
- Graphs render with red/green/blue lines
- Mutation rate dropdown works
- Mutation size dropdown works
- Gravity dropdown changes physics mid-run
- Elite clones dropdown works
- Floor mode (fixed/mutable) works
- Save Population then Restore Saved Population works
- "Surprise!" toggles fast-forward mode
- "New Population" resets with same terrain
- "Create new world" with seed changes terrain
- Ghost (translucent car) appears during simulation
- "View top replay" shows replay, "Resume simulation" returns
- Camera follows leader by default
- Clicking health bar changes camera target
- "Watch Leader" resets camera to leader
- Clicking minimap selects nearest car
- Minimap camera indicator moves with camera
- Fast Forward skips to end of generation

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor: finalize main.js orchestrator, remove app.js"
```

---

## Task 20: Update Documentation

**Files:**

- Modify: `CLAUDE.md`
- Modify: `AGENTS.md`

- [ ] **Step 1: Update `CLAUDE.md` architecture section**

Replace the "Architecture" and "Key sections" content with:

```markdown
## Architecture

ES module tree rooted at `src/main.js`. UI shell is `index.html` + `styles.css`.

Module layers (strict dependency direction -- no upward imports):

- `src/lib/` -- shims for vendored globals (Box2D, seedrandom)
- `src/genetics/` -- genome generation, mutation, crossover, GA management
- `src/physics/` -- car constants, schema, Box2D construction, physics stepping, terrain, world runner
- `src/generation-config.js` -- bridges genetics and physics (schema + selection config)
- `src/rendering/` -- canvas drawing primitives, floor, car, graphs
- `src/ghost/` -- ghost frame capture and replay state machine
- `src/ui/` -- camera, car UI wrapper, persistence, game loop, ghost replay controls
- `src/main.js` -- orchestrator: owns mutable state, wires DOM events, coordinates modules
```

Also update the "Key Couplings" section to reflect modules instead of banner comments.

- [ ] **Step 2: Update `AGENTS.md` file map**

Rewrite the `src/app.js` section into per-module entries under `src/`. List each module with its exports and responsibilities, following the structure of the existing document.

- [ ] **Step 3: Verify documentation accuracy**

Skim each module file path mentioned in the docs and confirm it exists.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md AGENTS.md
git commit -m "docs: update CLAUDE.md and AGENTS.md for ES module structure"
```

---

## Summary

| Task | Description                                | Files Created                                                                 | Files Modified               |
| ---- | ------------------------------------------ | ----------------------------------------------------------------------------- | ---------------------------- |
| 1    | Remove IIFE, create shims                  | `lib/box2d.js`, `lib/seedrandom.js`                                           | `app.js`                     |
| 2    | Extract genetics/random                    | `genetics/random.js`                                                          | `app.js`                     |
| 3    | Extract genetics/create-instance           | `genetics/create-instance.js`                                                 | `app.js`                     |
| 4    | Extract physics/car-constants + construct  | `physics/car-constants.js`, `physics/construct.js`                            | `app.js`                     |
| 5    | Extract physics/def-to-car                 | `physics/def-to-car.js`                                                       | `app.js`                     |
| 6    | Extract physics/run                        | `physics/run.js`                                                              | `app.js`                     |
| 7    | Extract genetics/manage-round + SA         | `genetics/manage-round.js`, `genetics/manage-round-sa.js`                     | `app.js`                     |
| 8    | Extract generation-config                  | `generation-config.js`                                                        | `app.js`                     |
| 9    | Extract physics/setup-scene                | `physics/setup-scene.js`                                                      | `app.js`                     |
| 10   | Extract physics/world-run                  | `physics/world-run.js`                                                        | `app.js`                     |
| 11   | Extract rendering primitives + floor + car | `rendering/primitives.js`, `rendering/draw-floor.js`, `rendering/draw-car.js` | `app.js`                     |
| 12   | Extract rendering/graphs                   | `rendering/graphs.js`                                                         | `app.js`                     |
| 13   | Extract ghost layer                        | `ghost/car-to-ghost.js`, `ghost/ghost.js`                                     | `app.js`                     |
| 14   | Extract ui/camera                          | `ui/camera.js`                                                                | `app.js`                     |
| 15   | Extract ui/car-ui                          | `ui/car-ui.js`                                                                | `app.js`                     |
| 16   | Extract ui/persistence                     | `ui/persistence.js`                                                           | `app.js`                     |
| 17   | Extract ui/game-loop                       | `ui/game-loop.js`                                                             | `app.js`                     |
| 18   | Extract ui/ghost-replay                    | `ui/ghost-replay.js`                                                          | `app.js`                     |
| 19   | Finalize main.js orchestrator              | --                                                                            | rename `app.js` to `main.js` |
| 20   | Update documentation                       | --                                                                            | `CLAUDE.md`, `AGENTS.md`     |
