/* Pendulums — independent spherical pendulums viewed from above.
   Gravity is positive z (down). Each bob is constrained to |r| = length.
   Plain JavaScript; available as window.PendulumPhysics or CommonJS for tests.
*/
(function (root, factory) {
  const lib = factory();
  if (typeof module === 'object' && module.exports) module.exports = lib;
  if (root) root.PendulumPhysics = lib;
})(typeof globalThis !== 'undefined' ? globalThis : null, function () {
  'use strict';
  const MAX_PENDULUMS = 30;
  const FIXED_DT = 1 / 240;
  const rad = deg => deg * Math.PI / 180;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const norm = r => Math.hypot(r[0], r[1], r[2]);
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const colorFor = i => `hsl(${((i * 137.507764 + 192) % 360).toFixed(2)} 89% ${[67, 58, 75, 63, 71][i % 5]}%)`;

  function checkNumber(value, min, max, name) {
    if (!Number.isFinite(value) || value < min || value > max) {
      throw new RangeError(`${name} must be between ${min} and ${max}`);
    }
    return value;
  }

  function makePendulum(config) {
    const length = checkNumber(Number(config.length), .35, 8, 'Length');
    const mass = checkNumber(Number(config.mass), .05, 20, 'Mass');
    const theta = rad(checkNumber(Number(config.theta), 0, 80, 'Release angle'));
    const phi = rad(checkNumber(Number(config.phi), -360, 360, 'Heading'));
    const spin = checkNumber(Number(config.spin), -12, 12, 'Tangential launch speed');
    const push = checkNumber(Number(config.push), -6, 6, 'Radial angular speed');
    const s = Math.sin(theta), c = Math.cos(theta), cp = Math.cos(phi), sp = Math.sin(phi);
    const r = [length * s * cp, length * s * sp, length * c];
    // Local basis on the sphere: e_theta and e_phi are mutually orthogonal.
    const v = [
      length * push * c * cp - spin * sp,
      length * push * c * sp + spin * cp,
      -length * push * s
    ];
    return {
      id: config.id, color: config.color || colorFor(config.id || 0),
      length, mass, theta: config.theta, phi: config.phi, spin, push,
      r, v, distance: 0, groundDistance: 0
    };
  }

  function projected(r, v, length) {
    const radius = norm(r);
    if (!Number.isFinite(radius) || radius < 1e-12) throw new RangeError('Invalid pendulum state');
    const u = r.map(x => x / radius);
    const rv = dot(v, u);
    return { r: u.map(x => x * length), v: v.map((x, i) => x - rv * u[i]), u };
  }

  function rhs(r, v, length, g, damping) {
    const p = projected(r, v, length), u = p.u, w = p.v;
    const speedSquared = dot(w, w);
    // a = g*(e_z - (e_z·u)*u) - (|v|²/L)*u - damping*v.
    // First term is gravity tangent to the sphere; second is tension's
    // centripetal component. No small-angle approximation is used.
    const inward = g * u[2] + speedSquared / length;
    const a = u.map((ui, i) => (i === 2 ? g : 0) - inward * ui - damping * w[i]);
    return { dr: w, dv: a };
  }

  function step(p, dt, g = 9.81, damping = 0) {
    checkNumber(dt, 0.000001, 0.1, 'Time step');
    checkNumber(g, 0, 25, 'Gravity');
    checkNumber(damping, 0, 2, 'Damping');
    const {r, v, length} = p;
    const stage = (k, weight) => ({
      r: r.map((x, i) => x + weight * k.dr[i]),
      v: v.map((x, i) => x + weight * k.dv[i])
    });
    const k1 = rhs(r, v, length, g, damping);
    const s2 = stage(k1, dt / 2), k2 = rhs(s2.r, s2.v, length, g, damping);
    const s3 = stage(k2, dt / 2), k3 = rhs(s3.r, s3.v, length, g, damping);
    const s4 = stage(k3, dt), k4 = rhs(s4.r, s4.v, length, g, damping);
    const nextR = r.map((x, i) => x + dt / 6 * (k1.dr[i] + 2*k2.dr[i] + 2*k3.dr[i] + k4.dr[i]));
    const nextV = v.map((x, i) => x + dt / 6 * (k1.dv[i] + 2*k2.dv[i] + 2*k3.dv[i] + k4.dv[i]));
    const corrected = projected(nextR, nextV, length);
    const oldX = p.r[0], oldY = p.r[1];
    p.r = corrected.r;
    p.v = corrected.v;
    p.distance += dt * (norm(v) + norm(p.v)) / 2;
    p.groundDistance += Math.hypot(p.r[0] - oldX, p.r[1] - oldY);
    return p;
  }

  function measures(p, g = 9.81) {
    const speed = norm(p.v);
    const kinetic = .5 * p.mass * speed * speed;
    const potential = p.mass * g * (p.length - p.r[2]); // zero at hanging rest
    const angularMomentumZ = p.mass * (p.r[0] * p.v[1] - p.r[1] * p.v[0]);
    return {speed, kinetic, potential, total: kinetic + potential,
      angularMomentumZ, distance: p.distance, groundDistance: p.groundDistance,
      angle: Math.acos(clamp(p.r[2] / p.length, -1, 1)) * 180 / Math.PI};
  }

  function preset(count, name = 'wave', gravity = 9.81) {
    count = Math.round(checkNumber(Number(count), 1, MAX_PENDULUMS, 'Count'));
    if (!['wave', 'orbit', 'fan', 'ribbons', 'still'].includes(name)) throw new Error('Unknown preset');
    return Array.from({length: count}, (_, i) => {
      const t = count <= 1 ? .5 : i / (count - 1);
      const p = {id: i, length: 2.1 + .95 * t, mass: 1, theta: 32, phi: 0, spin: 0, push: 0, color: colorFor(i)};
      if (name === 'wave') { p.theta = 38; p.phi = 0; }
      if (name === 'orbit') {
        p.length = 2.15 + .8 * t; p.theta = 26 + 12*t; p.phi = (360 * t) % 360;
        const th = rad(p.theta);
        p.spin = Math.sin(th) * Math.sqrt(gravity * p.length / Math.cos(th));
      }
      if (name === 'fan') { p.theta = 24 + 36 * t; p.phi = -155 + 310 * t; p.spin = (t - .5) * 1.4; }
      if (name === 'ribbons') {
        p.theta = 20 + (i % 7) * 5; p.phi = (i * 137.507764) % 360;
        p.spin = 1.25 + (i % 5) * .24; p.push = (i % 4 - 1.5) * .06;
      }
      if (name === 'still') { p.theta = 0; p.phi = i * 12; p.spin = 0; }
      return p;
    });
  }

  return Object.freeze({MAX_PENDULUMS, FIXED_DT, makePendulum, step, measures, preset, colorFor, projected});
});
