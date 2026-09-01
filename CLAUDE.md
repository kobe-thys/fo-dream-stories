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

### The forge — a tile from a written idea (Plan 12)

`/admin/normalizer` is now the **Tile workshop** with three routes:

| tab | input |
|---|---|
| **Forge** | an idea in words → concept drawing → (revise)* → approve |
| Normalize | a GLB generated elsewhere |
| Compose | two installed models stacked |

Forge flow: `idea → /api/admin/forge/concept (Vercel, ~35s) → approve → tile_jobs
kind='forge' → worker: Meshy → normalize → kenney-flatten → preview → accept →
install`.

**Drawing is the one thing that does NOT go through the queue.** It is a single
API call, and queueing it would make the revise loop feel dead. Drafts live in
component state, so abandoned ideas never reach `tile_jobs` — a row is written
only on approval. A revision uses gpt-image-1's **edit** endpoint against the
selected draft, so a change keeps the design instead of redrawing it.

**Security — the load-bearing line.** `idea` is free-form text from a public admin
page, and the worker builds argv from this table. It therefore **never reaches the
worker**: it is stored for display only, and what travels is the concept's object
key plus numbers. That is precisely why the drawing is generated on Vercel rather
than by passing a prompt through. Never add a column the worker interpolates.

**The brief lives in `scripts/tiles/tile-brief.mjs`**, imported by both the CLI and
the API route so they cannot drift. Read it before touching the prompt — it records
why it asks for soft shading and **not** isometric projection.

`MESHY_API_KEY` must be in `/root/.secrets/tokens.env`; after adding it,
`systemctl restart fo-tile-worker`. A forge job fails with a clear message if it
is missing. 30 Meshy credits per tile.

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
| `concept.mjs` | idea (+ revision) → concept drawing. Shares `tile-brief.mjs` with the admin Forge tab |
| `meshy.mjs` | approved drawing → GLB via Meshy. `lowpoly`, `enable_pbr=false`, `remove_lighting` |
| `kenney-flatten.mjs` | **the palette pass.** Snaps per FACE to the 18 Kenney families × 5 rungs in OKLab. `--skirt=Y`, `--remap=FROM:TO@minY` |
| `worker.mjs` | the job runner (see above) |

**Measured constants — do not re-derive.** Surfaces: grass/sand/stone **0.200**,
water/dirt **0.100**, river channel **0.162**. Colours: grass **#48c1a3**, dirt
**#f1976c**. Hex: pointy-top, R=0.5774, footprint 1.000 × 1.155, base on y=0.

**`normalize-tile --palette-lock` is BROKEN — never use it on artwork.** It reads
251 "colours" by collecting every texel of the colormap, of which 45% are blue and
one is green, so nearest-neighbour drags everything blue; and it snaps per texel, so
it quantises generator noise into visible banding. Use `kenney-flatten.mjs` instead.
The real palette is 18 families × 5 rungs (even column = flat base, odd column = its
4-step ramp).

**Two traps in every AI-generated GLB** (both absent from Meshy output built with
`enable_pbr=false`, but present in anything uploaded through Normalize)**:** `metallicFactor` is absent and glTF defaults
it to 1.0 (tiles render as mirrors), and each carries 4 `KHR_lights_punctual` lights
that accumulate across the map. The worker strips both; a tile built outside the
worker needs `strip-lights` + `fix-materials` run by hand.

**Never restart the worker while a job runs** — it used to strand the row on
`running` forever. It now requeues orphans at startup, but the job restarts from
scratch.
