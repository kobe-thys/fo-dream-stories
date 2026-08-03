# Tile Contact Sheet

A standalone viewer that loads every GLB in `public/models/` onto a hex grid and
measures each one against the geometry contract. **No database, no auth, no Next.js** —
it does not touch Supabase, and it lives outside `public/` so it never ships to
production.

## Run

The vendored three.js is gitignored (it duplicates `node_modules`). Restore it once:

```bash
npm run viewer:vendor
```

Then, from the repo root:

```bash
python3 -m http.server 8777 --bind 127.0.0.1
```

Then open <http://127.0.0.1:8777/tools/tile-viewer/>

It must be served from the **repo root** (not from `tools/`), so that `/public/models/…`
resolves and each GLB can find its sibling `Textures/colormap.png`.

## What it checks

Kenney tiles are pointy-top hexes with circumradius **R = 0.5774**, so a conforming tile
has a **base footprint of 1.000 × 1.155** sitting on **y = 0**.

The important subtlety: it measures the **base** footprint — only the vertices within
0.02 of the model's lowest point — not the whole-model bounding box. Art on top may
legitimately overhang the hex (a tree canopy, a waterfall spilling over the rim), and
measuring the full bbox produces false alarms for exactly those tiles.

Models under 0.1 tall, or with a base far smaller than a hex, are classified as
**props/decals** (`path-*`, `unit-*`) and excluded from the pass/fail count — the hex
contract does not apply to them.

## Controls

| Control | What it does |
|---|---|
| All / Off-spec only | Filter the sheet down to failures |
| Tight packing | Removes the readability gap so you can see whether tiles actually tessellate |
| Ideal hex outline | Overlays a perfect R=0.5774 hexagon on every tile for eyeballing footprint error |
| Top / Angle / Fit | Camera presets |
| Hover | Base dims, full dims, height, base Y, and the verdict |
| Click a row | Focus the camera on that tile |

Green = on spec, red = off spec, grey = prop/decal, amber = failed to load.
