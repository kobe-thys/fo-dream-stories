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
