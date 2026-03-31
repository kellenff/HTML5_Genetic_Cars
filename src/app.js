import { random } from "./genetics/random.js";
import { createInstance } from "./genetics/create-instance.js";
import { carConstruct } from "./physics/construct.js";
import { defToCar } from "./physics/def-to-car.js";
import { carRun } from "./physics/run.js";
import { manageRound } from "./genetics/manage-round.js";
import { manageRoundSA } from "./genetics/manage-round-sa.js";
import { generationConfig } from "./generation-config.js";
import { setupScene } from "./physics/setup-scene.js";
import { worldRun } from "./physics/world-run.js";
import { drawFloor } from "./rendering/draw-floor.js";
import { drawCar } from "./rendering/draw-car.js";
import { plotGraphs, clearGraphics } from "./rendering/graphs.js";
import * as ghostModule from "./ghost/ghost.js";

/* ========================================================================= */
/* === Car ================================================================= */
var cw_Car = function () {
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
  this.healthBarText.innerHTML = car_def.index;
  this.minimapmarker = document.getElementById("bar" + car_def.index);

  if (this.is_elite) {
    this.healthBar.backgroundColor = "#3F72AF";
    this.minimapmarker.style.borderLeft = "1px solid #3F72AF";
    this.minimapmarker.innerHTML = car_def.index;
  } else {
    this.healthBar.backgroundColor = "#F7C873";
    this.minimapmarker.style.borderLeft = "1px solid #F7C873";
    this.minimapmarker.innerHTML = car_def.index;
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
      this.healthBarText.innerHTML = "&dagger;";
      this.healthBar.width = "0";
      break;
    }
  }
  this.alive = false;
};

/* -------------------------------------------------------------------------
 * index.js (main entry)
 * ------------------------------------------------------------------------- */
// Global Vars

var ghostState;
var carMap = new Map();

var doDraw = true;
var cw_paused = false;
var cw_animationFrameId = null;
var cw_runningInterval = null;

var box2dfps = 60;
var screenfps = 60;
var skipTicks = Math.round(1000 / box2dfps);
var maxFrameSkip = skipTicks * 2;

var canvas = document.getElementById("mainbox");
var ctx = canvas.getContext("2d");

var camera = {
  speed: 0.05,
  pos: {
    x: 0,
    y: 0,
  },
  target: -1,
  zoom: 70,
};

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

var cw_ghostReplayInterval = null;

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
  floorseed: btoa(Math.seedrandom()),
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
var loops = 0;
var nextGameTick = new Date().getTime();

function showDistance(distance, height) {
  distanceMeter.innerHTML = distance + " meters<br />";
  heightMeter.innerHTML = height + " meters";
  if (distance > minimapfogdistance) {
    fogdistance.width = 800 - Math.round(distance + 15) * minimapscale + "px";
    minimapfogdistance = distance;
  }
}

/* === END Car ============================================================= */
/* ========================================================================= */

/* ========================================================================= */
/* ==== Generation ========================================================= */

function cw_generationZero() {
  generationState = manageRound.generationZero(generationConfig());
}

function resetCarUI() {
  cw_deadCars = 0;
  leaderPosition = {
    x: 0,
    y: 0,
  };
  document.getElementById("generation").innerHTML =
    generationState.counter.toString();
  document.getElementById("cars").innerHTML = "";
  document.getElementById("population").innerHTML =
    generationConfig.constants.generationSize.toString();
}

/* ==== END Genration ====================================================== */
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

function cw_minimapCamera() {
  var camera_x = camera.pos.x;
  var camera_y = camera.pos.y;
  minimapcamera.left = Math.round((2 + camera_x) * minimapscale) + "px";
  minimapcamera.top = Math.round((31 - camera_y) * minimapscale) + "px";
}

function cw_setCameraTarget(k) {
  if (k === -1) {
    camera.target = -1;
    return;
  }
  // k can be a numeric index from the HTML onclick or a car info object
  if (typeof k === "number" && currentRunner) {
    var carInfo = currentRunner.cars[k];
    if (carInfo && carMap.has(carInfo)) {
      camera.target = carInfo;
    } else {
      camera.target = -1;
    }
  } else {
    camera.target = k;
  }
}

function cw_setCameraPosition() {
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
  cw_minimapCamera();
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
  cw_minimapCamera();
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

function toggleDisplay() {
  canvas.width = canvas.width;
  if (doDraw) {
    doDraw = false;
    cw_stopSimulation();
    cw_runningInterval = setInterval(function () {
      var time = performance.now() + 1000 / screenfps;
      while (time > performance.now()) {
        simulationStep();
      }
    }, 1);
  } else {
    doDraw = true;
    clearInterval(cw_runningInterval);
    cw_startSimulation();
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

function gameLoop() {
  loops = 0;
  while (
    !cw_paused &&
    new Date().getTime() > nextGameTick &&
    loops < maxFrameSkip
  ) {
    nextGameTick += skipTicks;
    loops++;
  }
  simulationStep();
  cw_drawScreen();

  if (!cw_paused) cw_animationFrameId = window.requestAnimationFrame(gameLoop);
}

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
  Math.seedrandom();

  generationState = manageRound.nextGeneration(
    generationState,
    results,
    generationConfig(),
  );
  if (world_def.mutable_floor) {
    ghostState = null;
    world_def.floorseed = btoa(Math.seedrandom());
  } else {
    ghostModule.resetGhost(ghostState);
  }
  currentRunner = worldRun(world_def, generationState.generation, uiListeners);
  setupCarUI();
  cw_drawMiniMap();
  resetCarUI();
}

function cw_startSimulation() {
  cw_paused = false;
  cw_animationFrameId = window.requestAnimationFrame(gameLoop);
}

function cw_stopSimulation() {
  cw_paused = true;
  if (cw_animationFrameId) {
    window.cancelAnimationFrame(cw_animationFrameId);
    cw_animationFrameId = null;
  }
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

  Math.seedrandom();
  cw_generationZero();
  currentRunner = worldRun(world_def, generationState.generation, uiListeners);

  ghostState = ghostModule.createGhost();
  resetCarUI();
  setupCarUI();
  cw_drawMiniMap();

  cw_startSimulation();
}

function setupCarUI() {
  currentRunner.cars.map(function (carInfo) {
    var car = new cw_Car(carInfo, carMap);
    carMap.set(carInfo, car);
    car.replay = ghostModule.createReplay();
    ghostModule.addReplayFrame(car.replay, car.car.car);
  });
}

document.querySelector("#fast-forward").addEventListener("click", function () {
  fastForward();
});

document.querySelector("#save-progress").addEventListener("click", function () {
  saveProgress();
});

document
  .querySelector("#restore-progress")
  .addEventListener("click", function () {
    restoreProgress();
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
    Math.seedrandom();
    cw_generationZero();
    ghostState = ghostModule.createGhost();
    currentRunner = worldRun(
      world_def,
      generationState.generation,
      uiListeners,
    );
    setupCarUI();
    cw_drawMiniMap();
    resetCarUI();
    cw_startSimulation();
  });

function saveProgress() {
  localStorage.cw_savedGeneration = JSON.stringify(generationState.generation);
  localStorage.cw_genCounter = generationState.counter;
  localStorage.cw_ghost = JSON.stringify(ghostState);
  localStorage.cw_topScores = JSON.stringify(graphState.cw_topScores);
  localStorage.cw_floorSeed = world_def.floorseed;
}

function restoreProgress() {
  if (
    typeof localStorage.cw_savedGeneration == "undefined" ||
    localStorage.cw_savedGeneration == null
  ) {
    alert("No saved progress found");
    return;
  }
  cw_stopSimulation();
  cw_clearPopulationWorld();
  generationState.generation = JSON.parse(localStorage.cw_savedGeneration);
  generationState.counter = localStorage.cw_genCounter;
  ghostState = JSON.parse(localStorage.cw_ghost);
  graphState.cw_topScores = JSON.parse(localStorage.cw_topScores);
  world_def.floorseed = localStorage.cw_floorSeed;
  document.getElementById("newseed").value = world_def.floorseed;

  currentRunner = worldRun(world_def, generationState.generation, uiListeners);
  setupCarUI();
  cw_drawMiniMap();
  Math.seedrandom();

  resetCarUI();
  cw_startSimulation();
}

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

function cw_pauseSimulation() {
  cw_stopSimulation();
  ghostModule.pause(ghostState);
}

function cw_resumeSimulation() {
  ghostModule.resume(ghostState);
  cw_startSimulation();
}

function cw_startGhostReplay() {
  if (!doDraw) {
    toggleDisplay();
  }
  cw_pauseSimulation();
  cw_ghostReplayInterval = setInterval(
    cw_drawGhostReplay,
    Math.round(1000 / screenfps),
  );
}

function cw_stopGhostReplay() {
  clearInterval(cw_ghostReplayInterval);
  cw_ghostReplayInterval = null;
  cw_findLeader();
  camera.pos.x = leaderPosition.x;
  camera.pos.y = leaderPosition.y;
  cw_resumeSimulation();
}

document.querySelector("#toggle-ghost").addEventListener("click", function (e) {
  cw_toggleGhostReplay(e.target);
});

function cw_toggleGhostReplay(button) {
  if (cw_ghostReplayInterval == null) {
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
  world_def.floorseed = btoa(Math.seedrandom());
  cw_generationZero();
  ghostState = ghostModule.createGhost();
  resetCarUI();
  currentRunner = worldRun(world_def, generationState.generation, uiListeners);
  setupCarUI();
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
