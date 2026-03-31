// src/ui/car-ui.js
import { carRun } from '../physics/run.js';

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

export function setupCarUI(runner, carMap, ghostFns) {
  runner.cars.map(function (carInfo) {
    var car = new cw_Car(carInfo, carMap);
    carMap.set(carInfo, car);
    car.replay = ghostFns.createReplay();
    ghostFns.addReplayFrame(car.replay, car.car.car);
  });
}

export function resetCarUI(generationState, generationConfig) {
  document.getElementById("generation").innerHTML =
    generationState.counter.toString();
  document.getElementById("cars").innerHTML = "";
  document.getElementById("population").innerHTML =
    generationConfig.constants.generationSize.toString();
}
