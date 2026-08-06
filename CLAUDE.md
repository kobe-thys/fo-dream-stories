@AGENTS.md

## Admin normalizer (Plan 11)

Tile normalization is enqueued from `/admin/normalizer` and executed by a worker on
Kobe's box — Vercel cannot do it (minutes of CPU, ~8 GB RAM, and `public/` is not
writable in production).

**The worker runs as a systemd service** — installed, enabled, and restarted on boot:

```bash
systemctl status fo-tile-worker      # is it up?
journalctl -u fo-tile-worker -f      # watch it work
systemctl restart fo-tile-worker     # after editing worker.mjs
```

Unit file is committed at `deploy/fo-tile-worker.service` (installed to
`/etc/systemd/system/`). It reads `/root/.secrets/tokens.env` via `EnvironmentFile`,
so a rotated key needs a `systemctl restart`.

To run it by hand instead (e.g. to debug), `set -a` is required — it exports the
sourced variables so the node process inherits them:

```bash
systemctl stop fo-tile-worker
set -a && . /root/.secrets/tokens.env && set +a
node scripts/tiles/worker.mjs
```

Flow: `queued → running → preview_ready →` (admin accepts) `→ accepted → installed`.
The worker normalizes, strips generator lights, forces matte materials, renders a
preview to the `tile-previews` bucket, and on accept installs into `public/models`,
regenerates the manifest, commits and pushes — Vercel deploys in ~60 s.

**Security:** `tile_jobs` rows are written from a public admin page and acted on by a
process on a personal machine. The worker builds argv from TYPED columns only and
uses `execFile`, never a shell. Never add a free-form flags/command column.

### Tile scripts (`scripts/tiles/`)

| script | does |
|---|---|
| `normalize-tile.mjs` | generated GLB → Kenney contract. `--surface` target height, `--base-top` where the plate ends in the source, `--rot-art` artwork rotation, `--rebuild-base`, `--palette-lock`, `--match-water` |
| `inspect-tile.mjs` | cross-section width per height band + a suggested `--base-top` |
| `strip-lights.mjs` | removes the generator's 4 embedded lights |
| `fix-materials.mjs` | metallic→0, prism side → Kenney dirt, `--base-top=#hex` |
| `adjust-tile.mjs` | moves the ARTWORK on a built tile: rotate, scale, `--center`, shift. Base never moves |
| `compose-tile.mjs` | lifts an overlay onto a base tile and merges them |
| `find-open-spot.mjs` | most open spot on a tile, for placing a prop clear of a path |
| `recolour-tile.py` | repaints texture regions selected by GEOMETRY (ground / trunk / skirt masks) |
| `remove-tile.mjs` | deletes an installed tile, refusing if it is still placed on the map |
| `worker.mjs` | the job runner (see above) |

**Measured constants — do not re-derive.** Surfaces: grass/sand/stone **0.200**,
water/dirt **0.100**, river channel **0.162**. Colours: grass **#48c1a3**, dirt
**#f1976c**. Hex: pointy-top, R=0.5774, footprint 1.000 × 1.155, base on y=0.

**Two traps in every AI-generated GLB:** `metallicFactor` is absent and glTF defaults
it to 1.0 (tiles render as mirrors), and each carries 4 `KHR_lights_punctual` lights
that accumulate across the map. The worker strips both; a tile built outside the
worker needs `strip-lights` + `fix-materials` run by hand.

**Never restart the worker while a job runs** — it used to strand the row on
`running` forever. It now requeues orphans at startup, but the job restarts from
scratch.
