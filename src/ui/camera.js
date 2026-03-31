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
  minimapCameraStyle.left =
    Math.round((2 + camera.pos.x) * minimapscale) + "px";
  minimapCameraStyle.top =
    Math.round((31 - camera.pos.y) * minimapscale) + "px";
}
