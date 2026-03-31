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
