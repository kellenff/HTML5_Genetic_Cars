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
