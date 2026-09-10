# CLAUDE.md — FO's Dream Stories

## Project Overview

A children's bedtime story web app. Parents read/play magical stories with their kids
on a hexagonal dream map. After each story, the child **sleeps**, and tells their dream
the next session — AI generates a dream image as a token. Alex's (the creator's son)
dream tip is revealed as a reward.

- **Everything lives in this repo** (Next.js 16, TypeScript, Tailwind v4, Supabase,
  Vercel). Code, all `.glb` tiles, migrations, and — since 2026-09-10 — the product
  brief, plans and specs under `docs/`.
- **Live app:** https://fo-dream-stories.vercel.app
- **Product brief:** `docs/product-brief.md` (and `.docx` revisions)
- **Plans and specs:** `docs/superpowers/plans/`, `docs/superpowers/specs/`
- **Not in git, by design:** secrets (`/root/.secrets/tokens.env`) and all Supabase
  data — 10 tables plus the `dream-images`, `dream-inputs`, `story-audio`,
  `tile-previews` and `tile-sources` buckets. The schema IS in
  `supabase/migrations/`; the contents are not.

## Start of session checklist

1. `source /root/.secrets/tokens.env` — loads all API tokens
2. Read the relevant doc under `docs/superpowers/` for task state
3. `git log --oneline -10` for recent changes

## Architecture

- Next.js 16 App Router, `app/` directory, `'use client'` components
- Supabase: PostgreSQL + RLS + Storage
- Auth via Supabase Auth (email/password), guarded by `proxy.ts` (not middleware.ts)
- OpenAI: Whisper (transcribe), GPT-4o Vision (describe drawing), DALL-E 3 (dream
  image), gpt-image-1 (tile concept drawings). ElevenLabs for story narration.
- Meshy for image-to-3D in the tile forge

## Key gotchas

- `proxy.ts` not `middleware.ts` — Next.js 16, export named `proxy`
- Dynamic route params: use `useParams()` in client components (async in Next 15+)
- OpenAI client: instantiate **inside** the handler, not at module level (breaks build)
- Supabase Storage uploads need a **service role JWT**, not a personal access token
- Supabase management SQL: `POST https://api.supabase.com/v1/projects/{ref}/database/query`
- New tables need `GRANT ALL ON public.{table} TO authenticated;` AND
  `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO service_role;`
- Hex tiles use `clipPath` — use CSS `filter: drop-shadow` for glow, not border
- **Never use `next/image` for Supabase Storage URLs** — plain `<img>` instead
- **CSS keyframes animating `filter`**: do NOT also set an inline `filter` on the same
  element — inline wins. Set `filter: undefined` in React while the animation runs.
- **MediaRecorder MIME type**: detect support first — iOS Safari has no `audio/webm`,
  which yields silent recordings and Whisper hallucination. Use
  `MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'`


## Supabase backup (daily)

`scripts/backup-supabase.mjs`, run by `fo-supabase-backup.timer` at 03:30 local.

```bash
systemctl list-timers fo-supabase-backup     # when does it next run?
journalctl -u fo-supabase-backup -n 30       # what happened last night?
systemctl start fo-supabase-backup.service   # run one now
node scripts/backup-supabase.mjs --dry-run   # see what it would do, write nothing
```

Backs up what git does not: all 10 tables as JSON, plus the `dream-images`,
`dream-inputs` and `story-audio` buckets. **Deliberately skips `tile-sources`
(162 MB of raw generator uploads) and `tile-previews`** — intermediate artefacts
whose finished output is already in git.

Layout under `/root/backups/fo-dream-stories/`: `latest/` is a storage mirror
(objects are immutable, so only missing ones are fetched — a run takes ~7s rather
than 50s), and `YYYY-MM-DD/` holds that day's table JSON plus a storage manifest.
14 days retained.

**This directory holds children's personal data.** It is 0700, the unit sets
`UMask=0077`, and it must never be moved somewhere served, synced anywhere public,
or committed.

**It is on the SAME DISK as the thing it protects.** That covers a bad migration or
an accidental delete, not the box dying. Copying `latest/` and the newest dated dir
off-site is still worth doing.

## Plans

Plans 1-11 are complete; see `docs/superpowers/`. Plan 12 (the tile forge) is built
and documented below.

---

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
