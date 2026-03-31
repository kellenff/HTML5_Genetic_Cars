import { seedrandom } from "./lib/seedrandom.js";
import { b2Vec2 } from "./lib/box2d.js";
import { carConstruct } from "./physics/construct.js";
import { manageRound } from "./genetics/manage-round.js";
import { generationConfig } from "./generation-config.js";
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
import {
  saveProgress as doSaveProgress,
  restoreProgress as doRestoreProgress,
} from "./ui/persistence.js";
import { createGameLoop, createFastLoop } from "./ui/game-loop.js";
import { createGhostReplay } from "./ui/ghost-replay.js";

/* -------------------------------------------------------------------------
 * index.js (main entry)
 * ------------------------------------------------------------------------- */
// Global Vars

var ghostState;
var carMap = new Map();

var doDraw = true;

var box2dfps = 60;
var screenfps = 60;

var canvas = document.getElementById("mainbox");
var ctx = canvas.getContext("2d");

var camera = createCamera();

var minimapcamera = document.getElementById("minimapcamera").style;
var minimapholder = document.querySelector("#minimapholder");

var minimapcanvas = document.getElementById("minimap");
var minimapctx = minimapcanvas.getContext("2d");
var minimapscale = 3;
var minimapfogdistance = 0;
var lastFloorSeed = null;
var fogdistance = document.getElementById("minimapfog").style;

var carConstants = carConstruct.carConstants();

var max_car_health = box2dfps * 10;

var distanceMeter = document.getElementById("distancemeter");
var heightMeter = document.getElementById("heightmeter");

var leaderPosition = {
  x: 0,
  y: 0,
};

minimapcamera.width = 12 * minimapscale + "px";
minimapcamera.height = 6 * minimapscale + "px";

// ======= WORLD STATE ======

var world_def = {
  gravity: new b2Vec2(0.0, -9.81),
  doSleep: true,
  floorseed: btoa(seedrandom()),
  tileDimensions: new b2Vec2(1.5, 0.15),
  maxFloorTiles: 200,
  mutable_floor: false,
  box2dfps: box2dfps,
  motorSpeed: 20,
  max_car_health: max_car_health,
  schema: generationConfig.constants.schema,
};

var cw_deadCars;
var graphState = {
  cw_topScores: [],
  cw_graphAverage: [],
  cw_graphElite: [],
  cw_graphTop: [],
};

function resetGraphState() {
  graphState = {
    cw_topScores: [],
    cw_graphAverage: [],
    cw_graphElite: [],
    cw_graphTop: [],
  };
}

// ==========================

var generationState;

// ======== Activity State ====
var currentRunner;

function showDistance(distance, height) {
  distanceMeter.innerHTML = distance + " meters<br />";
  heightMeter.innerHTML = height + " meters";
  if (distance > minimapfogdistance) {
    fogdistance.width = 800 - Math.round(distance + 15) * minimapscale + "px";
    minimapfogdistance = distance;
  }
}

/* ========================================================================= */
/* ==== Generation ========================================================= */

function cw_generationZero() {
  generationState = manageRound.generationZero(generationConfig());
}

/* ==== END Generation ===================================================== */
/* ========================================================================= */

/* ========================================================================= */
/* ==== Drawing ============================================================ */

function cw_drawScreen() {
  var floorTiles = currentRunner.scene.floorTiles;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  cw_setCameraPosition();
  var camera_x = camera.pos.x;
  var camera_y = camera.pos.y;
  var zoom = camera.zoom;
  ctx.translate(200 - camera_x * zoom, 200 + camera_y * zoom);
  ctx.scale(zoom, -zoom);
  drawFloor(ctx, camera, floorTiles);
  ghostModule.drawFrame(ctx, ghostState, camera);
  cw_drawCars();
  ctx.restore();
}

function cw_setCameraTarget(k) {
  setCameraTarget(camera, k, currentRunner, carMap);
}

function cw_setCameraPosition() {
  setCameraPosition(camera, carMap, leaderPosition);
  updateMinimapCamera(camera, minimapcamera, minimapscale);
}

function cw_drawGhostReplay() {
  var floorTiles = currentRunner.scene.floorTiles;
  var carPosition = ghostModule.getPosition(ghostState);
  if (!carPosition) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    cw_setCameraPosition();
    var zoom = camera.zoom;
    ctx.translate(200 - camera.pos.x * zoom, 200 + camera.pos.y * zoom);
    ctx.scale(zoom, -zoom);
    drawFloor(ctx, camera, floorTiles);
    ctx.restore();
    return;
  }
  camera.pos.x = carPosition.x;
  camera.pos.y = carPosition.y;
  updateMinimapCamera(camera, minimapcamera, minimapscale);
  showDistance(
    Math.round(carPosition.x * 100) / 100,
    Math.round(carPosition.y * 100) / 100,
  );
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(
    200 - carPosition.x * camera.zoom,
    200 + carPosition.y * camera.zoom,
  );
  ctx.scale(camera.zoom, -camera.zoom);
  ghostModule.drawFrame(ctx, ghostState, camera);
  ghostModule.moveFrame(ghostState);
  drawFloor(ctx, camera, floorTiles);
  ctx.restore();
}

function cw_drawCars() {
  var cw_carArray = Array.from(carMap.values());
  for (var k = cw_carArray.length - 1; k >= 0; k--) {
    var myCar = cw_carArray[k];
    drawCar(carConstants, myCar, camera, ctx);
  }
}

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

function cw_drawMiniMap() {
  var floorTiles = currentRunner.scene.floorTiles;
  var last_tile = null;
  var tile_position = new b2Vec2(-5, 0);
  var floorChanged = lastFloorSeed !== world_def.floorseed;
  lastFloorSeed = world_def.floorseed;
  if (floorChanged) {
    minimapfogdistance = 0;
    fogdistance.width = "800px";
  }
  minimapcanvas.width = minimapcanvas.width;
  minimapctx.strokeStyle = "#3F72AF";
  minimapctx.beginPath();
  minimapctx.moveTo(0, 35 * minimapscale);
  for (var k = 0; k < floorTiles.length; k++) {
    last_tile = floorTiles[k];
    var last_fixture = last_tile.GetFixtureList();
    var last_world_coords = last_tile.GetWorldPoint(
      last_fixture.GetShape().m_vertices[3],
    );
    tile_position = last_world_coords;
    minimapctx.lineTo(
      (tile_position.x + 5) * minimapscale,
      (-tile_position.y + 35) * minimapscale,
    );
  }
  minimapctx.stroke();
}

/* ==== END Drawing ======================================================== */
/* ========================================================================= */
var uiListeners = {
  preCarStep: function () {
    ghostModule.moveFrame(ghostState);
  },
  carStep(car) {
    updateCarUI(car);
  },
  carDeath(carInfo) {
    var k = carInfo.index;

    var car = carInfo.car,
      score = carInfo.score;
    var cwCar = carMap.get(carInfo);
    cwCar.kill(currentRunner, world_def);

    // refocus camera to leader on death
    if (camera.target == carInfo) {
      cw_setCameraTarget(-1);
    }

    ghostModule.compareToReplay(cwCar.replay, ghostState, score.v);
    carMap.delete(carInfo);

    score.i = generationState.counter;

    cw_deadCars++;
    var generationSize = generationConfig.constants.generationSize;
    document.getElementById("population").innerHTML = (
      generationSize - cw_deadCars
    ).toString();

    if (leaderPosition.leader == k) {
      // leader is dead, find new leader
      cw_findLeader();
    }
  },
  generationEnd(results) {
    cleanupRound(results);
    return cw_newRound(results);
  },
};

function simulationStep() {
  currentRunner.step();
  showDistance(
    Math.round(leaderPosition.x * 100) / 100,
    Math.round(leaderPosition.y * 100) / 100,
  );
}

var loop = createGameLoop({
  stepFn: simulationStep,
  drawFn: cw_drawScreen,
  box2dfps: box2dfps,
});

var ghostReplayCtrl = createGhostReplay({
  drawFn: cw_drawGhostReplay,
  fps: screenfps,
});

function updateCarUI(carInfo) {
  var k = carInfo.index;
  var car = carMap.get(carInfo);
  var position = car.getPosition();

  ghostModule.addReplayFrame(car.replay, car.car.car);
  car.minimapmarker.style.left =
    Math.round((position.x + 5) * minimapscale) + "px";
  car.healthBar.width =
    Math.round((car.car.state.health / max_car_health) * 100) + "%";
  if (position.x > leaderPosition.x) {
    leaderPosition = position;
    leaderPosition.leader = k;
  }
}

function cw_findLeader() {
  var lead = 0;
  carMap.forEach(function (cwCar, carInfo) {
    if (!cwCar.alive) {
      return;
    }
    var position = cwCar.getPosition();
    if (position.x > lead) {
      lead = position.x;
      leaderPosition = position;
      leaderPosition.leader = carInfo.index;
    }
  });
}

function fastForward() {
  var gen = generationState.counter;
  while (gen === generationState.counter) {
    currentRunner.step();
  }
}

function cleanupRound(results) {
  results.sort(function (a, b) {
    if (a.score.v > b.score.v) {
      return -1;
    } else {
      return 1;
    }
  });
  graphState = plotGraphs(
    document.getElementById("graphcanvas"),
    document.getElementById("topscores"),
    null,
    graphState,
    results,
  );
}

function cw_newRound(results) {
  camera.pos.x = camera.pos.y = 0;
  cw_setCameraTarget(-1);

  // Reset the Math.random seed to true randomness before generating the next generation.
  // If we don't do this, the mutations will use the exact same deterministic pseudorandom
  // sequence that the physics engine used for the floor, resulting in exact identical clones
  // every generation if the parents happen to have the same scores.
  seedrandom();

  generationState = manageRound.nextGeneration(
    generationState,
    results,
    generationConfig(),
  );
  if (world_def.mutable_floor) {
    ghostState = null;
    world_def.floorseed = btoa(seedrandom());
  } else {
    ghostModule.resetGhost(ghostState);
  }
  currentRunner = worldRun(world_def, generationState.generation, uiListeners);
  setupCarUI(currentRunner, carMap, ghostModule);
  cw_drawMiniMap();
  cw_resetCarUI();
}

function cw_startSimulation() {
  loop.start();
}

function cw_stopSimulation() {
  loop.stop();
}

function cw_clearPopulationWorld() {
  carMap.forEach(function (car) {
    car.kill(currentRunner, world_def);
  });
}

function cw_resetPopulationUI() {
  document.getElementById("generation").innerHTML = "";
  document.getElementById("cars").innerHTML = "";
  document.getElementById("topscores").innerHTML = "";
  var _gc = document.getElementById("graphcanvas");
  clearGraphics(_gc, _gc.getContext("2d"), 400, 250);
  resetGraphState();
}

function cw_resetWorld() {
  doDraw = true;
  cw_stopSimulation();
  world_def.floorseed = document.getElementById("newseed").value;
  cw_clearPopulationWorld();
  cw_resetPopulationUI();

  seedrandom();
  cw_generationZero();
  currentRunner = worldRun(world_def, generationState.generation, uiListeners);

  ghostState = ghostModule.createGhost();
  cw_resetCarUI();
  setupCarUI(currentRunner, carMap, ghostModule);
  cw_drawMiniMap();

  cw_startSimulation();
}

function cw_resetCarUI() {
  cw_deadCars = 0;
  leaderPosition = {
    x: 0,
    y: 0,
  };
  resetCarUI(generationState, generationConfig);
}

document.querySelector("#fast-forward").addEventListener("click", function () {
  fastForward();
});

document.querySelector("#save-progress").addEventListener("click", function () {
  doSaveProgress(generationState, ghostState, graphState, world_def);
});

document
  .querySelector("#restore-progress")
  .addEventListener("click", function () {
    var saved = doRestoreProgress();
    if (!saved) return;
    cw_stopSimulation();
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
    cw_resetCarUI();
    cw_startSimulation();
  });

document
  .querySelector("#toggle-display")
  .addEventListener("click", function () {
    toggleDisplay();
  });

document
  .querySelector("#new-population")
  .addEventListener("click", function () {
    cw_stopSimulation();
    cw_clearPopulationWorld();
    cw_resetPopulationUI();
    seedrandom();
    cw_generationZero();
    ghostState = ghostModule.createGhost();
    currentRunner = worldRun(
      world_def,
      generationState.generation,
      uiListeners,
    );
    setupCarUI(currentRunner, carMap, ghostModule);
    cw_drawMiniMap();
    cw_resetCarUI();
    cw_startSimulation();
  });

document.querySelector("#confirm-reset").addEventListener("click", function () {
  cw_confirmResetWorld();
});

function cw_confirmResetWorld() {
  if (confirm("Really reset world?")) {
    cw_resetWorld();
  } else {
    return false;
  }
}

// ghost replay stuff

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

document.querySelector("#toggle-ghost").addEventListener("click", function (e) {
  cw_toggleGhostReplay(e.target);
});

function cw_toggleGhostReplay(button) {
  if (!ghostReplayCtrl.isRunning()) {
    cw_startGhostReplay();
    button.value = "Resume simulation";
  } else {
    cw_stopGhostReplay();
    button.value = "View top replay";
  }
}
// ghost replay stuff END

// initial stuff, only called once (hopefully)
function cw_init() {
  // clone silver dot and health bar
  var mmm = document.getElementsByName("minimapmarker")[0];
  var hbar = document.getElementsByName("healthbar")[0];
  var generationSize = generationConfig.constants.generationSize;

  for (var k = 0; k < generationSize; k++) {
    // minimap markers
    var newbar = mmm.cloneNode(true);
    newbar.id = "bar" + k;
    newbar.style.paddingTop = k * 9 + "px";
    minimapholder.appendChild(newbar);

    // health bars
    var newhealth = hbar.cloneNode(true);
    newhealth.getElementsByTagName("DIV")[0].id = "health" + k;
    newhealth.car_index = k;
    document.getElementById("health").appendChild(newhealth);
  }
  mmm.parentNode.removeChild(mmm);
  hbar.parentNode.removeChild(hbar);
  world_def.floorseed = btoa(seedrandom());
  cw_generationZero();
  ghostState = ghostModule.createGhost();
  cw_resetCarUI();
  currentRunner = worldRun(world_def, generationState.generation, uiListeners);
  setupCarUI(currentRunner, carMap, ghostModule);
  cw_drawMiniMap();
  cw_startSimulation();
  document.querySelector('[value="Watch Leader"]').disabled = false;
}

function relMouseCoords(event) {
  var totalOffsetX = 0;
  var totalOffsetY = 0;
  var canvasX = 0;
  var canvasY = 0;
  var currentElement = this;

  do {
    totalOffsetX += currentElement.offsetLeft - currentElement.scrollLeft;
    totalOffsetY += currentElement.offsetTop - currentElement.scrollTop;
    currentElement = currentElement.offsetParent;
  } while (currentElement);

  canvasX = event.pageX - totalOffsetX;
  canvasY = event.pageY - totalOffsetY;

  return { x: canvasX, y: canvasY };
}
HTMLDivElement.prototype.relMouseCoords = relMouseCoords;
minimapholder.onclick = function (event) {
  var coords = minimapholder.relMouseCoords(event);
  var cw_carArray = Array.from(carMap.values());
  var closest = {
    value: cw_carArray[0].car,
    dist: Math.abs(
      (cw_carArray[0].getPosition().x + 6) * minimapscale - coords.x,
    ),
    x: cw_carArray[0].getPosition().x,
  };

  var maxX = 0;
  for (var i = 0; i < cw_carArray.length; i++) {
    var pos = cw_carArray[i].getPosition();
    var dist = Math.abs((pos.x + 6) * minimapscale - coords.x);
    if (dist < closest.dist) {
      closest.value = cw_carArray[i].car;
      closest.dist = dist;
      closest.x = pos.x;
    }
    maxX = Math.max(pos.x, maxX);
  }

  if (closest.x == maxX) {
    // focus on leader again
    cw_setCameraTarget(-1);
  } else {
    cw_setCameraTarget(closest.value);
  }
};

document
  .querySelector("#mutationrate")
  .addEventListener("change", function (e) {
    var elem = e.target;
    cw_setMutation(elem.options[elem.selectedIndex].value);
  });

document
  .querySelector("#mutationsize")
  .addEventListener("change", function (e) {
    var elem = e.target;
    cw_setMutationRange(elem.options[elem.selectedIndex].value);
  });

document.querySelector("#floor").addEventListener("change", function (e) {
  var elem = e.target;
  cw_setMutableFloor(elem.options[elem.selectedIndex].value);
});

document.querySelector("#gravity").addEventListener("change", function (e) {
  var elem = e.target;
  cw_setGravity(elem.options[elem.selectedIndex].value);
});

document.querySelector("#elitesize").addEventListener("change", function (e) {
  var elem = e.target;
  cw_setEliteSize(elem.options[elem.selectedIndex].value);
});

function cw_setMutation(mutation) {
  generationConfig.constants.gen_mutation = parseFloat(mutation);
}

function cw_setMutationRange(range) {
  generationConfig.constants.mutation_range = parseFloat(range);
}

function cw_setMutableFloor(choice) {
  world_def.mutable_floor = choice == 1;
}

function cw_setGravity(choice) {
  world_def.gravity = new b2Vec2(0.0, -parseFloat(choice));
  var world = currentRunner.scene.world;
  // CHECK GRAVITY CHANGES
  if (world.GetGravity().y != world_def.gravity.y) {
    world.SetGravity(world_def.gravity);
  }
}

function cw_setEliteSize(clones) {
  generationConfig.constants.championLength = parseInt(clones, 10);
}

// Expose to global scope for inline onclick handlers in index.html
window.cw_setCameraTarget = cw_setCameraTarget;

cw_init();
