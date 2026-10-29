# Development, testing, and deployment

[Back to README](../README.md)

## Local setup and source map

Clone the repository and open `index.html`, or serve the root:

```sh
git clone https://github.com/mitchell-d00/Pendulums.git
cd Pendulums
python3 -m http.server 8000
```

Open <http://localhost:8000>. There is no bundler, package manifest, dependency installation, or backend for the application.

| Path | Responsibility |
|---|---|
| `index.html` | Controls, accessible labels, explanatory copy, and runtime load order. |
| `style.css` | Responsive base layout and top-down interface. |
| `studio3d.css` | XYZ studio and individual-editor styling. |
| `physics.js` | Independent spherical-pendulum engine; browser global and CommonJS export. |
| `app.js` | Simulation loop, sampling, map, inspector, exports/import, individual overrides. |
| `studio3d.js` | Canvas 2D orthographic XYZ renderer, camera/gestures, layers, palettes, solo editor. |
| `tests/` | Four Node suites and six Python browser suites. |
| `preview-desktop.png`, `preview-mobile.png` | Screenshots of an earlier interface. |
| `README.md`, `docs/`, `CONTRIBUTING.md` | User and contributor documentation. |
| `LICENSE` | MIT license. |

Load scripts in this order: **physics.js → app.js → studio3d.js**. Include both stylesheets. Studio rendering reads the existing engine; do not add a second physics solver for visual effects.

## Testing

Run all commands from the repository root. Node.js 18 or later is sufficient for the built-in test runner; no npm install is needed:

```sh
node --test tests/physics.test.cjs tests/patterns.test.cjs tests/studio3d.test.cjs tests/physics_damping_regression.cjs
```

List the damping regression explicitly: it does not follow the other suites' `*.test.cjs` naming pattern. The current four files define 18 tests.

| Node suite | Coverage |
|---|---|
| `physics.test.cjs` | Counts/colors, constraints, rest, planar motion, conservation, drag, orbit, invalid inputs. |
| `patterns.test.cjs` | Presets, 360 headings, rotation, spiral damping, rosettes, radial starburst. |
| `studio3d.test.cjs` | Engine-level spinburst and color invariance; not a browser renderer test. |
| `physics_damping_regression.cjs` | Different drag rates on independent bobs using the same solver. |

Browser tests require **Python Playwright** and a runnable **Chromium executable at `/usr/bin/chromium`**. A virtual environment can isolate Python dependencies:

```sh
python3 -m venv .venv
. .venv/bin/activate
python -m pip install playwright
```

Install Chromium through your operating system as appropriate. These harnesses hard-code `/usr/bin/chromium`; Playwright's separately downloaded managed browser is not selected automatically. If your executable is elsewhere, adjust the `executable_path` in the local harnesses to your installed browser before running.

```sh
python tests/browser_smoke.py
python tests/patterns_browser.py
python tests/studio3d_browser.py
python tests/solo_browser.py
python tests/mirrored_actions_browser.py
python tests/individual_overrides_browser.py
```

| Browser suite | Coverage |
|---|---|
| `browser_smoke.py` | Base map, readouts, individual inspector, controls, exports and session restoration. |
| `patterns_browser.py` | Compass/touch entry, presets, spiral auto-damping, older sessions. |
| `studio3d_browser.py` | XYZ camera/gestures, artwork layers, palettes, art download/import. |
| `solo_browser.py` | Per-bob recipes, validation, damping, preservation of unrelated bobs. |
| `mirrored_actions_browser.py` | Matching top/bottom actions, layout, isolated bob updates. |
| `individual_overrides_browser.py` | Override precedence, decimals/headings, both Apply controls, explicit reset, session round trip. |

The harnesses inject local HTML/CSS/JavaScript into isolated Chromium pages at phone and desktop sizes. The older base/pattern suites inject only the base app assets; studio-specific suites load both stylesheets and all three scripts. They do not verify GitHub Pages, HTTP asset loading, or an actual deployment. Run scripts sequentially because some use temporary download files under `tests/`.

Report results for your checkout and distinguish tests actually run from historical pass counts. Browser prerequisites are test-only; end users need none of them.

## Browser interfaces

`window.PendulumPhysics` exposes `MAX_PENDULUMS`, `FIXED_DT`, `makePendulum`, `step`, `measures`, `preset`, `colorFor`, and `projected`. CommonJS tests use the same engine with `require('./physics.js')`.

`window.Pendulums` provides `status`, `getSnapshot()`, bounded `getVisualFrame(limit)`, color changes, individual damping/recipe/override helpers, play/pause, clear, and fit. Snapshot/session indices are zero-based. The studio consumes measured frame data without changing integration; the explicit action helpers intentionally mutate state.

`window.PendulumsStudio` exposes camera state/actions, copied artwork, layer helpers, palettes, recorded frames, and solo actions. These are local integration/test interfaces; consult implementations before depending on details. File-format versions are documented in [FILE_FORMATS.md](FILE_FORMATS.md).

## Deployment

Any static host can serve the root. On GitHub Pages:

1. Open repository **Settings → Pages**.
2. Choose **Deploy from a branch**, **main**, and **/ (root)**, then save.
3. Wait for the Pages deployment to succeed. The current live site is <https://mitchell-d00.github.io/Pendulums/>; use the URL GitHub reports if hosting configuration changes.
4. Verify `index.html`, `style.css`, `studio3d.css`, `physics.js`, `app.js`, and `studio3d.js` all load without errors.
5. Check desktop/phone layouts, both views, individual override followed by ensemble Apply, downloads, and both JSON import types.

Relative asset paths support serving under `/Pendulums/`. No secrets, server environment variables, CDN, database, or runtime network calls are required. Keep hosting checks separate from injected-source test results. Documentation changes do not establish that a deployment is live.
