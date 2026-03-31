import { defToCar } from "./def-to-car.js";
import { carRun } from "./run.js";
import { setupScene } from "./setup-scene.js";
import { seedrandom } from "../lib/seedrandom.js";

export function worldRun(world_def, defs, listeners) {
  if (world_def.mutable_floor) {
    // GHOST DISABLED
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
