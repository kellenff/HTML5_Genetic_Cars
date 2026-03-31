export function getFrame(car) {
  var out = {
    chassis: getChassis(car.chassis),
    wheels: [],
    pos: { x: car.chassis.GetPosition().x, y: car.chassis.GetPosition().y },
  };

  for (var i = 0; i < car.wheels.length; i++) {
    out.wheels[i] = getWheel(car.wheels[i]);
  }

  return out;
}

function getChassis(c) {
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

function getWheel(w) {
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
