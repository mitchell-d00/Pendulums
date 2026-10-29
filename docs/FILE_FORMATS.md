# Exports and saved-file formats

[Back to README](../README.md)

## Choose a download

| Download | Contents | Reloadable? |
|---|---|---|
| PNG image | Visible top-down canvas: background, trails, bobs, labels, and highlight according to map switches. | Image only. |
| SVG paths | Visible retained XY paths, map background color, and pivot at the current map scale/pan; no bobs, labels, or textured grid. Path export follows per-track visibility, independently of the global Draw actual paths switch. | Editable vector image, not a session. |
| CSV samples | All retained live samples, including hidden bobs. No frozen artwork. | Not imported by the app. |
| JSON session | Physics settings, configurations/overrides, current states, distances, visibility, and retained measurements. | **Load JSON session** restores physics and pauses. |
| 3D PNG | Current XYZ canvas, including visible frozen layers and live motion. | Image only. |
| Layered art JSON | Frozen XYZ layers, plus exported camera and color-overlay metadata. Live tracks are not automatically frozen. | **Load art JSON** restores layers only. |

Files download through the browser; nothing is uploaded. The page does not automatically save work. Export before closing/reloading. JSON session and layered art are separate version-one formats; use the matching import button.

## Physics session JSON

Implemented by `session`, `parseSession`, and `loadJSON` in [`app.js`](../app.js).

| Field | Meaning |
|---|---|
| `format` | `pendulums-sand-session` |
| `version` | `1`, a file-format version, not an application release number. |
| `created` | ISO export timestamp. |
| `elapsed` | Simulated seconds. |
| `selected` | Zero-based selected bob index. |
| `preset` | One of `ribbons`, `wave`, `orbit`, `spiral`, `rosette`, `petals`, `starburst`, `fan`, `still`. |
| `releaseHeading` | Whole-degree ensemble offset, 0–359; defaults to zero when absent in older files. |
| `settings` | `gravity`, `damping`, `speed`, `theme` (`dark`, `sand`, `paper`), and `weight`. |
| `tracks` | 1–30 records, one per bob. |

Each track contains:

- `config`: `id`, hex `color`, `length`, `mass`, `theta` (tilt degrees), `phi` (heading degrees), `spin` (tangential m/s), and `push` (radial rad/s). Optional `damping`, `individualOverride`, and `soloRecipe` preserve individual settings. Import reassigns IDs by array index.
- `visible`: trail visibility boolean.
- `current`: three-component `r` and `v` arrays, cumulative 3D `distance`, and XY `groundDistance`.
- `samples`: at most 18,000 arrays, each ordered as below.

```text
[time_seconds, x_m, y_m, z_down_m, speed_m_s,
 kinetic_j, potential_j, total_j, vertical_angular_momentum_kg_m2_s]
```

Import accepts files up to **65,000,000 bytes**. It validates supported settings, counts, finite numbers, length/tangent constraints, sample shape/time ordering, and colors before rebuilding physics. Current states are projected onto their constraints. Successful load pauses, restores the selected bob, and resets the map view. Existing version-one files without individual metadata still load.

Sessions do **not** store studio layers, camera, palette selection, map camera, map display switches, or the running flag. Existing display controls remain in use. Ensemble spiral auto-damping bookkeeping is reset on load; the restored damping becomes an explicit value.

## CSV

The exact header is:

```csv
pendulum_id,color,sim_seconds,x_m,y_m,z_down_m,speed_m_s,kinetic_j,potential_j,total_j,vertical_angular_momentum_kg_m2_s
```

Unlike JSON indices, CSV bob IDs are **one-based**. Rows are grouped by bob, with retained samples in time order within each group; the entire file is not globally sorted by time. Older samples may be thinned, and individual restarts may give different starting times per bob. CSV does not include initial configurations, distances, or frozen art layers. See [physics and sampling](PHYSICS.md).

## Layered art JSON

Implemented in [`studio3d.js`](../studio3d.js).

| Field | Meaning |
|---|---|
| `format` | `pendulums-art-studio` |
| `version` | `1` |
| `created` | ISO export timestamp. |
| `camera` | Exported `yaw`, `pitch`, `zoom`, `panX`, `panY`, and `center`. |
| `overlayColors` | Exported color overrides keyed by bob index. |
| `layers` | At most eight frozen artwork layers. |

Layers have `id`, `label`, `visible`, and `tracks`. Each track contains `id`, hex `color`, `visible`, and `samples` as `[x, y, z]` arrays. Layers contain at most 30 tracks and each track at most 801 samples. They contain no velocities, time stamps, or energy records.

**Current import restores only `layers`.** Exported camera and `overlayColors` metadata are not reapplied. Import replaces the studio's saved-layer list without changing live physics or pausing. It accepts files up to **25,000,000 bytes**, validates labels/visibility/colors and finite XYZ values (absolute coordinate ≤100), and rejects oversized/incompatible layer data.

Use **Save current art layer** before downloading layered art if you want current live motion included. Save a physics session separately if you want to resume simulation.
