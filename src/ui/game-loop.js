// src/ui/game-loop.js

export function createGameLoop({ stepFn, drawFn, box2dfps }) {
  var skipTicks = Math.round(1000 / box2dfps);
  var maxFrameSkip = skipTicks * 2;
  var paused = true;
  var animationFrameId = null;
  var nextGameTick = new Date().getTime();

  function gameLoop() {
    var loops = 0;
    while (!paused && new Date().getTime() > nextGameTick && loops < maxFrameSkip) {
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
