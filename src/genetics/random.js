const random = {
  shuffleIntegers(prop, generator) {
    return random.mapToShuffle(
      prop,
      random.createNormals(
        {
          length: prop.length || 10,
          inclusive: true,
        },
        generator,
      ),
    );
  },
  createIntegers(prop, generator) {
    return random.mapToInteger(
      prop,
      random.createNormals(
        {
          length: prop.length,
          inclusive: true,
        },
        generator,
      ),
    );
  },
  createFloats(prop, generator) {
    return random.mapToFloat(
      prop,
      random.createNormals(
        {
          length: prop.length,
          inclusive: true,
        },
        generator,
      ),
    );
  },
  createNormals(prop, generator) {
    var l = prop.length;
    var values = [];
    for (var i = 0; i < l; i++) {
      values.push(createNormal(prop, generator));
    }
    return values;
  },
  mapToShuffle(prop, normals) {
    var offset = prop.offset || 0;
    var limit = prop.limit || prop.length;
    var sorted = normals.slice().sort(function (a, b) {
      return a - b;
    });
    return normals
      .map(function (val) {
        return sorted.indexOf(val);
      })
      .map(function (i) {
        return i + offset;
      })
      .slice(0, limit);
  },
  mapToInteger(prop, normals) {
    prop = {
      min: prop.min || 0,
      range: prop.range || 10,
      length: prop.length,
    };
    return random.mapToFloat(prop, normals).map(function (float) {
      return Math.round(float);
    });
  },
  mapToFloat(prop, normals) {
    prop = {
      min: prop.min || 0,
      range: prop.range || 1,
    };
    return normals.map(function (normal) {
      var min = prop.min;
      var range = prop.range;
      return min + normal * range;
    });
  },
  mutateReplace(
    prop,
    generator,
    originalValues,
    mutation_range,
    chanceToMutate,
  ) {
    var factor = (prop.factor || 1) * mutation_range;
    return originalValues.map(function (originalValue) {
      if (generator() > chanceToMutate) {
        return originalValue;
      }

      // Calculate bounds based on the factor, centered around the original value
      var minBound = Math.max(0, originalValue - factor / 2);
      var maxBound = Math.min(1, originalValue + factor / 2);

      // Pick a completely random flat value within those bounds
      // Fallback to 0-1 if factor is >= 1 (100% mutation size)
      if (factor >= 1) {
        minBound = 0;
        maxBound = 1;
      }

      var rangeValue = createNormal({ inclusive: true }, generator);
      // Map [0, 1] to [minBound, maxBound]
      return minBound + rangeValue * (maxBound - minBound);
    });
  },
};

function createNormal(prop, generator) {
  if (!prop.inclusive) {
    return generator();
  } else {
    return generator() < 0.5 ? generator() : 1 - generator();
  }
}

export { random };
