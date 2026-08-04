@AGENTS.md

## Admin normalizer (Plan 11)

Tile normalization is enqueued from `/admin/normalizer` and executed by a worker on
Kobe's box — Vercel cannot do it (minutes of CPU, ~8 GB RAM, and `public/` is not
writable in production).

```bash
set -a && . /root/.secrets/tokens.env && set +a
node scripts/tiles/worker.mjs        # leave running while using the tab
```

Flow: `queued → running → preview_ready →` (admin accepts) `→ accepted → installed`.
The worker normalizes, strips generator lights, forces matte materials, renders a
preview to the `tile-previews` bucket, and on accept installs into `public/models`,
regenerates the manifest, commits and pushes — Vercel deploys in ~60 s.

**Security:** `tile_jobs` rows are written from a public admin page and acted on by a
process on a personal machine. The worker builds argv from TYPED columns only and
uses `execFile`, never a shell. Never add a free-form flags/command column.
