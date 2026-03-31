import { carConstruct } from "./physics/construct.js";

function flatRankSelect(parents) {
  var totalParents = parents.length;
  var parentIndex = -1;
  for (var k = 0; k < totalParents; k++) {
    if (Math.random() <= 0.2) {
      parentIndex = k;
      break;
    }
  }
  if (parentIndex === -1) {
    parentIndex = Math.floor(Math.random() * totalParents);
  }
  return parentIndex;
}

var nAttributes = 15;

function pickParent(currentChoices, chooseId, key /* , parents */) {
  if (!currentChoices.has(chooseId)) {
    currentChoices.set(chooseId, initializePick());
  }

  var state = currentChoices.get(chooseId);
  state.i++;
  if (["wheel_radius", "wheel_vertex", "wheel_density"].indexOf(key) > -1) {
    state.curparent = cw_chooseParent(state);
    return state.curparent;
  }
  state.curparent = cw_chooseParent(state);
  return state.curparent;

  function cw_chooseParent(state) {
    var curparent = state.curparent;
    var attributeIndex = state.i;
    var swapPoint1 = state.swapPoint1;
    var swapPoint2 = state.swapPoint2;
    if (swapPoint1 == attributeIndex || swapPoint2 == attributeIndex) {
      return curparent == 1 ? 0 : 1;
    }
    return curparent;
  }

  function initializePick() {
    var curparent = 0;

    var swapPoint1 = Math.floor(Math.random() * nAttributes);
    var swapPoint2 = swapPoint1;
    while (swapPoint2 == swapPoint1) {
      swapPoint2 = Math.floor(Math.random() * nAttributes);
    }
    var i = 0;
    return {
      curparent: curparent,
      i: i,
      swapPoint1: swapPoint1,
      swapPoint2: swapPoint2,
    };
  }
}

function generateRandom() {
  return Math.random();
}

var carConstants = carConstruct.carConstants();
var schema = carConstruct.generateSchema(carConstants);
var constants = {
  generationSize: 20,
  schema: schema,
  championLength: 1,
  mutation_range: 1,
  gen_mutation: 0.05,
};
var generationConfig = (function () {
  var fn = function () {
    var currentChoices = new Map();
    return Object.assign({}, constants, {
      selectFromAllParents: flatRankSelect,
      generateRandom: generateRandom,
      pickParent: pickParent.bind(void 0, currentChoices),
    });
  };
  fn.constants = constants;
  return fn;
})();

export { generationConfig };
