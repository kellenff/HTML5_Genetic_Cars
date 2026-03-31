import { random } from "./genetics/random.js";
import { createInstance } from "./genetics/create-instance.js";
import { carConstruct } from "./physics/construct.js";
import { defToCar } from "./physics/def-to-car.js";
import { carRun } from "./physics/run.js";
import { manageRound } from "./genetics/manage-round.js";
import { manageRoundSA } from "./genetics/manage-round-sa.js";
import { generationConfig } from "./generation-config.js";

/* -------------------------------------------------------------------------
 * ghost/car-to-ghost.js
 * ------------------------------------------------------------------------- */

function ghost_get_frame(car) {
  var out = {
    chassis: ghost_get_chassis(car.chassis),
    wheels: [],
    pos: { x: car.chassis.GetPosition().x, y: car.chassis.GetPosition().y },
  };

  for (var i = 0; i < car.wheels.length; i++) {
    out.wheels[i] = ghost_get_wheel(car.wheels[i]);
  }

  return out;
}

function ghost_get_chassis(c) {
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

function ghost_get_wheel(w) {
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

/* -------------------------------------------------------------------------
 * ghost/index.js
 * ------------------------------------------------------------------------- */
var ghost_fns = (function () {
  var enable_ghost = true;

  function ghost_create_replay() {
    if (!enable_ghost) return null;

    return {
      num_frames: 0,
      frames: [],
    };
  }

  function ghost_create_ghost() {
    if (!enable_ghost) return null;

    return {
      replay: null,
      frame: 0,
      dist: -100,
    };
  }

  function ghost_reset_ghost(ghost) {
    if (!enable_ghost) return;
    if (ghost == null) return;
    ghost.frame = 0;
  }

  function ghost_pause(ghost) {
    if (ghost != null) ghost.old_frame = ghost.frame;
    ghost_reset_ghost(ghost);
  }

  function ghost_resume(ghost) {
    if (ghost != null) ghost.frame = ghost.old_frame;
  }

  function ghost_get_position(ghost) {
    if (!enable_ghost) return;
    if (ghost == null) return;
    if (ghost.frame < 0) return;
    if (ghost.replay == null) return;
    var frame = ghost.replay.frames[ghost.frame];
    if (!frame) return;
    return frame.pos;
  }

  function ghost_compare_to_replay(replay, ghost, max) {
    if (!enable_ghost) return;
    if (ghost == null) return;
    if (replay == null) return;

    if (ghost.dist < max) {
      ghost.replay = replay;
      ghost.dist = max;
      ghost.frame = 0;
    }
  }

  function ghost_move_frame(ghost) {
    if (!enable_ghost) return;
    if (ghost == null) return;
    if (ghost.replay == null) return;
    ghost.frame++;
    if (ghost.frame >= ghost.replay.num_frames)
      ghost.frame = ghost.replay.num_frames - 1;
  }

  function ghost_add_replay_frame(replay, car) {
    if (!enable_ghost) return;
    if (replay == null) return;

    var frame = ghost_get_frame(car);
    replay.frames.push(frame);
    replay.num_frames++;
  }

  function ghost_draw_frame(ctx, ghost, camera) {
    var zoom = camera.zoom;
    if (!enable_ghost) return;
    if (ghost == null) return;
    if (ghost.frame < 0) return;
    if (ghost.replay == null) return;

    var frame = ghost.replay.frames[ghost.frame];
    if (!frame) return;

    // wheel style
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

    // chassis style
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

  return {
    ghost_create_replay: ghost_create_replay,
    ghost_create_ghost: ghost_create_ghost,
    ghost_pause: ghost_pause,
    ghost_resume: ghost_resume,
    ghost_get_position: ghost_get_position,
    ghost_compare_to_replay: ghost_compare_to_replay,
    ghost_move_frame: ghost_move_frame,
    ghost_add_replay_frame: ghost_add_replay_frame,
    ghost_draw_frame: ghost_draw_frame,
    ghost_reset_ghost: ghost_reset_ghost,
  };
})();

/* -------------------------------------------------------------------------
 * draw/draw-virtual-poly.js
 * ------------------------------------------------------------------------- */

function cw_drawVirtualPoly(ctx, body, vtx, n_vtx) {
  // set strokestyle and fillstyle before call
  // call beginPath before call

  var p0 = body.GetWorldPoint(vtx[0]);
  ctx.moveTo(p0.x, p0.y);
  for (var i = 1; i < n_vtx; i++) {
    var p = body.GetWorldPoint(vtx[i]);
    ctx.lineTo(p.x, p.y);
  }
  ctx.lineTo(p0.x, p0.y);
}

/* -------------------------------------------------------------------------
 * draw/draw-circle.js
 * ------------------------------------------------------------------------- */

function cw_drawCircle(ctx, body, center, radius, angle, color) {
  var p = body.GetWorldPoint(center);
  ctx.fillStyle = color;

  ctx.beginPath();
  ctx.arc(p.x, p.y, radius, 0, 2 * Math.PI, true);

  ctx.moveTo(p.x, p.y);
  ctx.lineTo(p.x + radius * Math.cos(angle), p.y + radius * Math.sin(angle));

  ctx.fill();
  ctx.stroke();
}

/* -------------------------------------------------------------------------
 * draw/draw-floor.js
 * ------------------------------------------------------------------------- */

function cw_drawFloor(ctx, camera, cw_floorTiles) {
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
        cw_drawVirtualPoly(ctx, b, s.m_vertices, s.m_vertexCount);
      }
      if (shapePosition > camera_x + 10) {
        break outer_loop;
      }
    }
  }
  ctx.fill();
  ctx.stroke();
}

/* -------------------------------------------------------------------------
 * draw/scatter-plot.js
 * ------------------------------------------------------------------------- */

// Called when the Visualization API is loaded.

/* -------------------------------------------------------------------------
 * draw/plot-graphs.js
 * ------------------------------------------------------------------------- */

var graph_fns = {
  plotGraphs: function (
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
    cw_clearGraphics(graphcanvas, graphctx, graphwidth, graphheight);
    cw_plotAverage(nextState, graphctx);
    cw_plotElite(nextState, graphctx);
    cw_plotTop(nextState, graphctx);
    cw_listTopScores(topScoresElem, nextState);
    return nextState;
  },
};

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

function cw_clearGraphics(graphcanvas, graphctx, graphwidth, graphheight) {
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
  ts.innerHTML = "<b>Top Scores:</b><br />";
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

    ts.innerHTML += [n, score, distance, yrange, gen].join(" ") + "<br />";
  }
}

/* -------------------------------------------------------------------------
 * draw/draw-car.js
 * ------------------------------------------------------------------------- */

function drawCar(car_constants, myCar, camera, ctx) {
  var camera_x = camera.pos.x;
  var zoom = camera.zoom;

  var wheelMinDensity = car_constants.wheelMinDensity;
  var wheelDensityRange = car_constants.wheelDensityRange;

  if (!myCar.alive) {
    return;
  }
  var myCarPos = myCar.getPosition();

  if (myCarPos.x < camera_x - 5) {
    // too far behind, don't draw
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
      cw_drawCircle(ctx, b, s.m_p, s.m_radius, b.m_sweep.a, rgbcolor);
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
    cw_drawVirtualPoly(ctx, chassis, cs.m_vertices, cs.m_vertexCount);
  }
  ctx.fill();
  ctx.stroke();
}

/* -------------------------------------------------------------------------
 * draw/draw-car-stats.js
 * ------------------------------------------------------------------------- */

var run = carRun;

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
  var status = run.getStatus(this.car.state, {
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
 * world/setup-scene.js
 * ------------------------------------------------------------------------- */

/*

world_def = {
  gravity: {x, y},
  doSleep: boolean,
  floorseed: string,
  tileDimensions,
  maxFloorTiles,
  mutable_floor: boolean
}

*/

function setupScene(world_def) {
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
  Math.seedrandom(floorseed);
  for (var k = 0; k < maxFloorTiles; k++) {
    if (!mutable_floor) {
      // keep old impossible tracks if not using mutable floors
      last_tile = cw_createFloorTile(
        world,
        dimensions,
        tile_position,
        ((Math.random() * 3 - 1.5) * 1.5 * k) / maxFloorTiles,
      );
    } else {
      // if path is mutable over races, create smoother tracks
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

/* -------------------------------------------------------------------------
 * world/run.js
 * ------------------------------------------------------------------------- */
function worldRun(world_def, defs, listeners) {
  if (world_def.mutable_floor) {
    // GHOST DISABLED
    world_def.floorseed = btoa(Math.seedrandom());
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

/* -------------------------------------------------------------------------
 * index.js (main entry)
 * ------------------------------------------------------------------------- */
// Global Vars

var plot_graphs = graph_fns.plotGraphs;

var ghost_draw_frame = ghost_fns.ghost_draw_frame;
var ghost_create_ghost = ghost_fns.ghost_create_ghost;
var ghost_add_replay_frame = ghost_fns.ghost_add_replay_frame;
var ghost_compare_to_replay = ghost_fns.ghost_compare_to_replay;
var ghost_get_position = ghost_fns.ghost_get_position;
var ghost_move_frame = ghost_fns.ghost_move_frame;
var ghost_reset_ghost = ghost_fns.ghost_reset_ghost;
var ghost_pause = ghost_fns.ghost_pause;
var ghost_resume = ghost_fns.ghost_resume;
var ghost_create_replay = ghost_fns.ghost_create_replay;

var ghost;
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
  cw_drawFloor(ctx, camera, floorTiles);
  ghost_draw_frame(ctx, ghost, camera);
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
  var carPosition = ghost_get_position(ghost);
  if (!carPosition) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    cw_setCameraPosition();
    var zoom = camera.zoom;
    ctx.translate(200 - camera.pos.x * zoom, 200 + camera.pos.y * zoom);
    ctx.scale(zoom, -zoom);
    cw_drawFloor(ctx, camera, floorTiles);
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
  ghost_draw_frame(ctx, ghost, camera);
  ghost_move_frame(ghost);
  cw_drawFloor(ctx, camera, floorTiles);
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
    ghost_move_frame(ghost);
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

    ghost_compare_to_replay(cwCar.replay, ghost, score.v);
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

  ghost_add_replay_frame(car.replay, car.car.car);
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
  graphState = plot_graphs(
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
    ghost = null;
    world_def.floorseed = btoa(Math.seedrandom());
  } else {
    ghost_reset_ghost(ghost);
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
  cw_clearGraphics(_gc, _gc.getContext("2d"), 400, 250);
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

  ghost = ghost_create_ghost();
  resetCarUI();
  setupCarUI();
  cw_drawMiniMap();

  cw_startSimulation();
}

function setupCarUI() {
  currentRunner.cars.map(function (carInfo) {
    var car = new cw_Car(carInfo, carMap);
    carMap.set(carInfo, car);
    car.replay = ghost_create_replay();
    ghost_add_replay_frame(car.replay, car.car.car);
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
    ghost = ghost_create_ghost();
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
  localStorage.cw_ghost = JSON.stringify(ghost);
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
  ghost = JSON.parse(localStorage.cw_ghost);
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
  ghost_pause(ghost);
}

function cw_resumeSimulation() {
  ghost_resume(ghost);
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
  ghost = ghost_create_ghost();
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
