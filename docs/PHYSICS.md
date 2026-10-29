# Physics and numerical model

[Back to README](../README.md)

## Model and coordinates

Each independent spherical pendulum has mass `m`, fixed length `L`, position `r = [x, y, z]`, and tangent velocity `v`. All share a stationary pivot at the origin; **positive z is downward**. The string is a rigid, massless length constraint, not a slack rope. There are no collisions, coupling, elasticity, moving pivots, Coriolis/Foucault forcing, or sand-contact forces.

[`physics.js`](../physics.js) uses full nonlinear Cartesian dynamics without a small-angle approximation:

```text
|r| = L                       r · v = 0
u = r / L
a = g(e_z − u_z u) − (|v|² / L)u − γv
```

`g` is gravity and `γ` is damping (s⁻¹). The terms represent tangent gravity, centripetal acceleration, and velocity-proportional drag.

## Initial conditions

For tilt `θ` from downward vertical, heading `φ` around the z axis (both converted to radians), tangential launch `s` (m/s), and radial angular rate `q` (rad/s):

```text
r = L [sin θ cos φ, sin θ sin φ, cos θ]
v = [Lq cos θ cos φ − s sin φ,
     Lq cos θ sin φ + s cos φ,
     −Lq sin θ]
```

In solver coordinates, heading zero is positive x and 90° is positive y. The UI dial draws zero at the top; it is a heading selector rather than geographic north on the map.

Presets supply initial conditions, not decorative curves. Orbit launches approximate conical motion; rosettes use lower tangential speeds; radial starburst has no tangential launch. The engine additionally supports `spinburst` for tests/API use. Neither visible preset menu exposes it, and session import does not accept it as an ensemble preset.

## Integration and sampling

Fourth-order Runge–Kutta advances at `FIXED_DT = 1/240` second. Acceleration evaluation projects trial states to spherical/tangent constraints; the final step projects position to radius `L` and removes radial velocity. This limits constraint drift but does not make RK4 symplectic or exactly energy-preserving.

`app.js` uses a real-time accumulator with playback scaling, a per-frame time clamp, and bounded catch-up. Rendering is independent of the physics step. Background tabs do not build an unlimited simulation backlog.

Every four physics steps the app records time, XYZ, speed, energy, and vertical angular momentum: **60 samples per simulated second**, plus initial samples after resets/edits. Each bob retains up to **18,000 samples**, about five minutes at full resolution. On exceeding the limit, alternate points from the oldest half are retained. Repeated thinning preserves historical coverage with progressively less detail. Clearing/replacing a track discards its retained history.

The XYZ viewer further subsamples for drawing. Frozen layers retain at most 801 XYZ points per bob. CSV/session JSON contain retained live samples, including hidden tracks, rather than frozen layers or unlimited history.

## Measurements and damping

```text
K  = ½m |v|²
U  = mg(L − z)                zero at hanging rest
E  = K + U
Jz = m(x vy − y vx)
```

With constant gravity and zero effective damping, energy and vertical angular momentum should be nearly conserved, subject to floating-point/integration error. Damping dissipates energy. Mass scales energy and angular momentum without changing isolated ideal trajectories. Changing gravity live changes forces and the potential-energy definition, so conservation comparisons across that edit do not describe a constant-gravity system.

Effective damping is `config.damping ?? ensembleDamping`: individual zero disables ensemble drag for that bob. UI/session damping is 0–0.5 s⁻¹ and gravity 0–20 m/s². Low-level `step` accepts damping up to 2 s⁻¹ and gravity up to 25 m/s²; those are not UI slider limits.

The engine accumulates approximate 3D travel distance by trapezoidal speed integration and ground distance by successive XY displacements. UI PATH LENGTH and TRACKED show **ground distance**. Sessions store both; CSV has no distance columns.

## Limits and references

This educational simulation has a rigid length constraint and bounded recording. High speeds and long runs can magnify numerical error. Check [deterministic tests](DEVELOPMENT.md#testing) and conservation for your scenario; the application is not an arbitrary-precision integrator or real sand-contact model.

Background references retained from the project:

- [Cambridge — Dynamics notes, §2.5.3 Spherical Pendulum](https://www.damtp.cam.ac.uk/user/dt281/dynamics/two.pdf).
- [Feedback Integrators for Mechanical Systems with Holonomic Constraints](https://pmc.ncbi.nlm.nih.gov/articles/PMC9460403/).
- [Computing global orbits of the forced spherical pendulum](https://www.sciencedirect.com/science/article/abs/pii/S0167278902003810).

These provide context for spherical pendulums and constrained integration. This implementation uses RK4 with projection, not RATTLE or a feedback integrator.
