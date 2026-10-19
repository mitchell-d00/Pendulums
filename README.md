# Pendulums

**A free, top-down 3D pendulum sandbox that draws the paths the pendulums *actually make*.**

Each of up to **30 independently simulated spherical pendulums** leaves its own colored line on a virtual sand map. Choose any of **360 distinct release bearings (0°–359°)** with the clickable compass, slider, or exact entry. Arrange up to 30 independently simulated bobs into **inward spirals, rosettes, petal blooms, starbursts**, or the original layouts. Change gravity, damping, string length, mass, release tilt and launch speeds, and watch those changes alter the measured trajectories. Every bob's speed, kinetic/potential/total energy, vertical angular momentum, and travel distance are available in the live readout.

![Pendulums desktop interface](preview-desktop.png)
![Pendulums mobile interface](preview-mobile.png)

## Run

1. Download/extract the ZIP, keeping the files together.
2. Open **`index.html`** in a browser. There is no build step, framework, internet requirement, API key, or external asset.
3. Press **Play** if paused. Watch the color trails grow across the top-down map.

For the existing [`mitchell-d00/Pendulums`](https://github.com/mitchell-d00/Pendulums) repository, enable **Settings → Pages → Deploy from a branch**, select **main** and **/ (root)**. GitHub Pages will serve `index.html`, `style.css`, `physics.js`, and `app.js`. The application is separate from Mitchell Tech.

## Controls

| Control | What it does |
|---|---|
| Play / Pause | Starts and freezes the actual physics calculation |
| Reset | Restarts every bob from its configured initial position and erases their paths |
| Clear sand | Erases only the trails; bobs keep their positions and continue from there |
| Count (1–30) + Apply | Creates that many independent pendulums |
| Motion arrangement | Nine presets including **inward spirals**, **rosette loops**, **petal bloom**, and **360° starburst**; original presets remain |
| 360 release-point compass | Select any **one of 360 directions**, 0–359° in 1° increments, using the clickable wheel, slider, or exact-number field; **Apply** rotates all selected initial launch positions; it does not create 360 pendulums |
| Individual release point | Inspect a bob, set its Release point to 0–359°, and press Apply to change **only that bob** |
| Gravity / damping | Changes the physics live; zero damping is the ideal conservative case |
| Playback | Changes simulated time per real second; the physics still uses a fixed step |
| Surface | Dark map, textured sand, or graph paper |
| Trail, bob, number, focus toggles | Change only the drawing; do not change the physics |
| Inspector + Apply to # | Reconfigures **one** pendulum, leaving the others running |
| Click a table row | Inspect one of all 30 individual paths and kinetic histories |
| Eye beside a path | Hide/show that path without stopping or deleting its data |
| Zoom + / − / Fit | Explore the projected paths at different scales |

On phones, the **map is shown first**, followed by the controls. On desktop, controls sit beside the live plot. The compass and keyboard-friendly angle entry work on touch screens, too.

**Spiral physics:** Selecting *Inward spirals* with zero damping initially applies 0.055 s⁻¹ drag, causing the launch orbit to wind inward. Switching away removes only this automatically applied damping; manually set damping values are respected. Changing the damping slider live lets you explore the difference. A free undamped pendulum cannot continuously widen or tighten its orbit without energy entering or leaving the system. The spiral is not a prewritten path.

**Release angle vs. number of pendulums:** The 360 marked release directions describe the initial **azimuth** around the shared pivot, **not 360 simultaneous pendulums**. The sandbox still allows 1–30 independently simulated masses and 30 distinct colors. Tilt controls how far each bob starts from the vertical axis; heading controls its compass direction.

## Export and reload

- **PNG**: an image of the current visible sand canvas, including trails and moving bobs.
- **SVG**: editable paths traced from the recorded points for every visible pendulum.
- **CSV**: one record per retained measured point, including bob number, color, simulated time, 3D coordinates, speed, kinetic energy, potential energy, total mechanical energy, and vertical angular momentum.
- **JSON session**: physics settings, original initial conditions, current 3D position and velocity, saved top-down path points and kinetic measurements. Load the JSON to continue inspecting or simulating a session. Import pauses the scene first. New sessions also preserve the ensemble release heading (0–359°); older version-one JSON without this field still loads as heading 0°.

Recording: up to 18,000 measured samples per bob are retained. At a full 60 samples per simulated second this initially captures five minutes at full resolution; older points are **progressively thinned** once full, retaining coverage of older paths but not unlimited detail. Trails are drawn from the actual numerical positions. No procedural or pre-drawn paths are substituted. CSV and JSON export the **retained** samples, not an unlimited history.

## What's physically modeled?

**Spherical pendulums**, not 30 independent animated Lissajous curves. Each mass hangs on a fixed, rigid, weightless rod/string with length \(L\), gravity \(g\), mass \(m\), 3D position \(\mathbf r\), and tangent velocity \(\mathbf v\). Downward is the positive z direction. The constraint and acceleration are

```text
|r| = L             r · v = 0
u = r / L
a = g (ez − uz u) − (|v|²/L) u − γ v
```

The solver advances the full nonlinear dynamics using **fourth-order Runge–Kutta** at **240 fixed simulation steps per second**, with a projection onto the spherical position and tangent velocity constraints after each step. Sand drawing samples the **actual horizontal x/y positions** every four physics steps, i.e. 60 recorded positions per simulated second. The virtual sand does not exert a force on the bobs.

At zero damping, energy and vertical angular momentum should be nearly conserved subject to floating-point and integrator error:

```text
K  = 1/2 m |v|²
U  = m g (L − z)
E  = K + U
Jz = m (x vy − y vx)
```

Mass changes energy values but does **not** change isolated ideal pendulum motion. Damping \(\gamma\) is modeled as acceleration proportional to negative velocity. No pendulum–pendulum collisions, string elasticity, pivot shaking, Foucault/Coriolis forcing, or actual sand resistance are included. Zooming/panning and hiding a trail do not change motion. RK4 with projection is **not** exactly energy-preserving; this is an educational physics simulator, not a certified integrator for arbitrary precision or very long runs.

### References used

- [University of Cambridge — Dynamics notes, §2.5.3 Spherical Pendulum](https://www.damtp.cam.ac.uk/user/dt281/dynamics/two.pdf) — spherical coordinate equations and conserved angular momentum.
- [Feedback Integrators for Mechanical Systems with Holonomic Constraints](https://pmc.ncbi.nlm.nih.gov/articles/PMC9460403/) — constraint manifolds and numerical spherical-pendulum integration.
- [Computing global orbits of the forced spherical pendulum](https://www.sciencedirect.com/science/article/abs/pii/S0167278902003810) — constrained numerical integration and preservation properties. This project uses RK4 plus projection instead of claiming the cited RATTLE method.

## Tests

With Node.js 18 or later:

```sh
node --test tests/physics.test.cjs tests/patterns.test.cjs
```

For desktop/mobile UI checks, install Python Playwright, ensure Chromium is at `/usr/bin/chromium`, and run:

```sh
python tests/browser_smoke.py
python tests/patterns_browser.py
```

The browser harnesses inject local HTML/CSS/JavaScript into isolated Chromium documents; they do not test the deployed GitHub Pages origin. The original suite covers 30 individual colors, independent traces, settings, pause, per-bob updates, CSV/PNG/SVG/JSON exports, import restoration, layout, and errors. The new suite covers the 360° compass and presets, old-JSON compatibility, physically damped spiral launch, auto-damping cleanup, keyboard entry and touch-wheel pointer selection.

**Local verification for this release:** 14/14 independent Node physics/pattern tests; 56/56 existing Chromium checks; 44/44 new browser checks at mobile and desktop sizes.

## Folder contents

```text
Pendulums/
  index.html              App shell and controls
  style.css               Responsive layout and visualization
  physics.js              Independent, testable spherical-pendulum engine
  app.js                  Sand drawing, inspector and export/import
  README.md               This guide
  LICENSE                 MIT
  tests/physics.test.cjs  Deterministic physics tests
  tests/patterns.test.cjs 360 release headings, spiral, symmetry and energy tests
  tests/browser_smoke.py  Original Chromium UI checks
  tests/patterns_browser.py  New presets, release compass, and JSON round-trip tests
```

Free to remix. Just plain HTML, CSS, and JavaScript.


## Interactive XYZ studio and individual paths

**3D motion box.** The new first panel draws measured bob positions and trails as real `(x, y, z)` coordinates. `z` increases downward, matching the gravitational coordinate convention used by `physics.js`. This is a rotating *orthographic* 3D visualization, not a second simulator or a physically solid sand box. Use **Top**, **3D**, **Side**, or **Under** for quick angles. On touchscreens, drag one finger to orbit around the paths, use two fingers to pinch-zoom and pan, or choose **Pan mode** for one-finger movement. Mouse drag rotates, Shift-drag pans, and the wheel zooms. Direction and zoom buttons are provided for accessibility.

**Preserve your artwork while changing arrangements.** Leave **Keep previous artwork on new patterns** checked, then make a rosette, switch to a fan, and apply a starburst. The existing sampled paths are frozen into separately hideable/removable 3D artwork layers before each new arrangement replaces the live initial conditions. **Save current art layer** lets you capture art without changing the pendulums. Up to **8 layers** are kept at once, with bounded, sampled paths (at most about 800 XYZ points per pendulum per saved layer). Download PNG or a separate layered-art JSON file; re-import a saved art JSON independently of a full physics session. Existing trajectory CSV and physics-session JSON exports remain available. The art layers store measured position samples, not computed decorative curves.

**Individual path mode.** In **Make it yours**, choose **Individual pendulum**, then expand the **Individual path mode** controls. Each of the up to **30 pendulums** can use its own physical release recipe, chosen from rosette, spiral, petal, starburst, fan, orbit, ribbons, wave, rest, or manual settings. Set each pendulum's **0–359° release heading**, string length, mass, release tilt, tangential launch speed, radial rate, damping, and hex trail color. Choose **Apply to selected pendulum** to reinitialize *only that bob* with validated initial conditions. Other bobs' XYZ states, velocities, existing tracks, and kinetic measurements are left untouched; they keep swinging. **Next pendulum** speeds up designing all 30. If **Preserve this bob's previous trail** is enabled, the old track is archived as a single-bob art layer.

**Science is preserved.** The same constrained spherical-pendulum RK4 integrator runs all bobs at a fixed 240 simulation steps per second. Gravity, length constraint, launch velocity, and drag determine the resulting paths. A solo pendulum's `config.damping` is an optional, validated drag coefficient (0–0.5 s⁻¹). With no override it inherits ensemble damping, so one bob can spiral inward with drag while another follows an undamped orbit. The 3D camera, art freezes, colors, and line weight have **no effect** on the equations of motion. Pendulums remain ideal, independent masses with massless rigid strings, no collisions, and no physical sand-contact forces.

### Reproducible checks

```sh
node --test tests/physics.test.cjs tests/patterns.test.cjs tests/studio3d.test.cjs tests/physics_damping_regression.cjs
python tests/browser_smoke.py
python tests/patterns_browser.py
python tests/studio3d_browser.py
python tests/solo_browser.py
```

The Node checks use only built-in modules. Browser checks require a local Python Playwright installation and Chromium at `/usr/bin/chromium`; the game itself uses only HTML, CSS, and plain JavaScript. In the 3D/per-bob development run the dedicated suites passed **12/12 Node checks**, **54/54 studio browser checks**, and **54/54 solo-path browser checks**, across desktop and phone viewports. These browser runs exercised locally injected source, **not a deployed GitHub Pages session**.

## Easy-reach Apply and Next buttons

Both ends of each applicable editor now have the same actions, making long settings panels easier to use on a phone:

- **Ensemble:** **Apply arrangement** at the top (under the panel title) and at the bottom. Sliders and the exact release-angle entry come **before** the 360-degree compass wheel, with the dial near the bottom of the settings.
- **Individual path mode:** **Apply to selected pendulum** and **Next pendulum** are paired at the top and bottom. Either pair runs the same function; changing one bob does not restart the other 29.
- **Pendulum inspector:** **Apply to #XX** is now at the top and bottom of the individual setup, and both labels update when selecting a different bob.

Buttons have touch-friendly minimum heights and visible keyboard focus indicators. This changes the layout and controls only; the same constrained spherical-pendulum solver and saved artwork remain unchanged.

**Regression:** The release was exercised in Chromium at 390px and 1280px with **84/84 local browser checks** (including matching action behavior and preserved unrelated bobs). The existing **8/8 baseline physics checks** also passed. Reproduce the mirrored-action tests with `python tests/mirrored_actions_browser.py` using Python Playwright and a local Chromium executable; GitHub Pages itself was not browser-tested during this update.


## Individual edits take priority over ensemble presets

**Individual Path Mode now keeps your edits.** When you apply a custom setup to a bob, it receives a **persistent individual override** for its physical parameters: length, mass, tilt, heading, tangential velocity, radial rate, and damping. Applying a different ensemble arrangement from either top or bottom Apply button recreates the ensemble bobs while **retaining overridden parameters** for any existing selected bobs. Those bobs still use the same spherical-pendulum solver, gravity, and physical constraints. Existing overrides are preserved in exported session JSON and restored on import.

Select a bob in **Make it yours**, choose a motion recipe or edit its values, and press **Apply to selected pendulum**. Its status explicitly shows **individual override ACTIVE**. Numeric fields display readable decimals instead of binary-floating-point tails, and legacy fractional preset bearings are displayed as the nearest whole-degree release step; the physics isn't changed until Apply is pressed. Editing a recipe parameter changes the displayed recipe to **Custom physical release**, so the label matches the entered values.

To give one bob back to the ensemble, select it and press **Reset selected to ensemble**. That action resets only that bob to the currently selected ensemble's initial conditions, without touching the other bobs. When **Preserve this bob's previous trail** is enabled, it archives the old measured trail as an art layer before resetting.

**What Apply Arrangement means:** it reinitializes the ensemble simulation, preserving your individual *configurations*, not the bobs' ongoing positions or unsaved live trails. Use **Keep previous artwork on new patterns** or save an art layer to preserve those drawings.

The dedicated regression file `tests/individual_overrides_browser.py` exercises inherited fractional angles, both individual and ensemble Apply controls, preset precedence, individual damping, saved-session restoration, and explicit reset. Run it with Python Playwright and Chromium. This is a source-level browser test, not verification of a completed GitHub Pages deployment.
