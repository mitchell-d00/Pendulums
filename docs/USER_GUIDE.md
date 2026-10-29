# User guide

[Back to README](../README.md)

## Transport and ensemble

The app opens running with 12 pendulums in Chromatic ribbons. **Pause / Play** freezes or resumes integration. **Reset** restarts all bobs from stored initial configurations, clears live histories, resets elapsed time, and leaves the simulation paused. Individual overrides remain configured. **Clear sand** replaces live samples with a sample of each current position; motion, elapsed time, and accumulated distances continue. Sampled energy history is cleared too.

Set the count (1–30), arrangement, and release heading, then press **Apply arrangement** at either end of Ensemble. Apply restarts every bob, resets elapsed time and the top-down view, and retains the current play/pause state. Individual overrides are retained by bob index for bobs present in the new count. Reducing count discards removed bobs' configurations; increasing it later creates fresh ensemble bobs.

| Arrangement | Initial motion |
|---|---|
| Chromatic ribbons | Varied lengths, tilts, headings, and launch velocities. |
| Pendulum wave | Different lengths with aligned releases and no initial velocity. |
| Orbit garden | Approximately circular conical launches with varied lengths and tilts. |
| Inward spirals | Near-circular launches that contract when damping removes energy. |
| Rosette loops | Sub-circular tangential launches producing precessing loops. |
| Petal bloom | Radially arranged releases with alternating small tangential velocities. |
| 360° starburst | Evenly spaced radial releases without initial velocity. |
| Release fan | A spread of headings, tilts, and tangential launches. |
| At rest | Bobs start vertically below the pivot with zero velocity. |

The compass, slider, and exact entry select **one of 360 whole-degree ensemble offsets**, 0–359. Apply rotates ensemble-managed launch headings; overridden headings stay configured. It does not create 360 bobs. **Tilt** is angle away from downward vertical; **heading** is direction around the pivot. Presets may internally use fractional headings, displayed rounded in individual editors until applied.

Gravity (0–20 m/s²), ensemble damping (0–0.5 s⁻¹), and playback (0.25–3×) take effect live. Gravity affects all bobs; damping affects those without an individual value. Playback scales simulated time while keeping the fixed step. Slow/background tabs can run slower than the selected rate because catch-up is bounded.

Applying Inward spirals with ensemble damping zero sets **0.055 s⁻¹**. Switching away removes that automatically set damping. Manually editing the slider cancels automatic bookkeeping, so a manual value survives arrangement changes. Loading a session restores damping as an explicit value. Individual damping, including zero, takes priority.

## Edit one pendulum

1. Under **Make it yours → Individual pendulum**, select a bob.
2. Choose a **Motion recipe**, or enter custom values. Recipe selection prepares fields; Apply commits them. Recipes set length, tilt, and launch velocities while keeping the entered heading, mass, and color. Spiral supplies 0.055 s⁻¹ damping if the field is zero; other recipes retain the damping field.
3. Press **Apply to selected pendulum** at either end of Individual path mode. Only that bob restarts, at the current simulation time; other states and histories remain intact.
4. **Next pendulum** at either end selects the next bob, wrapping at the end.

Numeric edits after recipe selection change the label to **Custom physical release**. Successful Apply shows **individual override ACTIVE**. An override retains length, mass, tilt, heading, tangential launch, radial rate, damping if set, and color across ensemble Apply; ensemble Apply still restarts that bob. Session JSON preserves override metadata.

**Reset selected to ensemble** clears one bob's override and restarts only it using the currently applied ensemble, heading, and gravity, retaining color and path visibility. If already ensemble-managed, it does not restart. Changing the ensemble dropdown alone does not change the applied ensemble.

The **Pendulum inspector → Individual setup** also edits one bob. Either **Apply to #XX** restarts it and marks a custom override. It retains any existing individual damping, but has no damping editor; use Individual path mode for that.

| Parameter | Accepted UI range | Units |
|---|---|---|
| Heading | 0–359, whole degrees in Individual path mode | degrees |
| Length | 0.35–8 | m |
| Mass | 0.05–20 | kg |
| Tilt | 0–80 | degrees from downward vertical |
| Tangential launch | −12 to 12 | m/s |
| Radial rate | −6 to 6 | rad/s |
| Individual damping | 0–0.5 | s⁻¹ |
| Color | Six-digit `#RRGGBB` | — |

## Cameras, map, and readouts

The XYZ studio is an orthographic view of the same motion as the map; positive z points downward. Drag with one finger/left mouse button to orbit; two fingers pinch and pan. Shift-drag, right-drag, or **Pan mode** pans. The wheel zooms. Top, 3D, Side, and Under reset the camera to preset angles; arrow and zoom buttons provide additional controls.

The map has separate **+ / − / Fit view**, mouse-wheel zoom, and left-mouse drag pan. One grid unit is one meter. Surface, trail, bob, number, highlight, and line-weight controls affect the map. The studio has separate live-trail, string, and grid-box switches, with line widths independent of the map's slider.

Select a table row (or focus it and press Enter) to inspect a bob. Its eye button hides the live trail in both views and its bob/string in the studio; map bobs remain controlled by **Show moving bobs**. Hidden bobs continue simulating and recording. The inspector shows speed, energy, vertical angular momentum, and **top-view projected distance**, plus recent kinetic/potential history. TRACKED in the table also means projected distance.

Palettes and **Custom color** recolor live tracks without restarting. Frozen layers retain captured colors. Selecting Original 30 colors uses current track colors; it does not recover an earlier palette automatically.

## Preserve artwork

**Save current art layer** freezes measured XYZ paths without changing motion. Hide or remove individual layers; **Clear saved art** removes all layers without changing physics. Up to **eight layers** are kept; a ninth removes the oldest. Layers retain at most **801 XYZ points per bob**, with reduced detail compared with retained live history.

With **Keep previous artwork on new patterns** enabled (default), live paths are archived before ensemble Apply, Reset, and Clear sand. Layers appear only in the studio, not the map. Paths need at least two samples to produce a saved layer.

**Preserve this bob's previous trail** separately archives one bob before Individual path mode Apply or Reset selected to ensemble. Direct inspector Apply does not automatically archive; save an art layer first if needed.

Download **Layered art JSON** for frozen layers. Freeze live motion first if you want it included. Download **JSON session** separately to continue physics later. Neither file automatically backs up the whole interface, and closing/reloading the page loses unsaved work. See [saved-file formats](FILE_FORMATS.md).

## Troubleshooting

- Empty view/missing controls: extract the ZIP and keep all five runtime assets beside `index.html`; check the browser console for missing files.
- A bob ignores arrangement or damping changes: inspect its override; **Reset selected to ensemble** clears it.
- Spiral not tightening: check effective damping, especially an individual zero value.
- Imported physics paused: inspect the restored state, then press Play.
- Frozen art missing after reload: sessions do not contain art layers; export and load layered art separately.
