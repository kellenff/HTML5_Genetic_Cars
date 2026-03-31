// src/ui/persistence.js

export function saveProgress(generationState, ghostState, graphState, world_def) {
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
