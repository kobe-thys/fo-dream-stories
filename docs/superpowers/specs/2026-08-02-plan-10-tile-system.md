# Plan 10 Spec — 3D Tile Pipeline

**Status:** rev3 — normalizer BUILT and proven on 4 real tiles
**Date:** 2026-08-02
**Depends on:** Plan 9 (foundation fixes) landing first

## Goal

Let Kobe generate a tile the way he already does — one complete model, hex base
included — and have it land on the map at exactly the right size, position and
orientation, at a sane triangle count, with no Blender work and no eyeballing.

## Decisions (settled with Kobe, 2026-08-02)

- **Tiles are generated WITH their hexagonal base.** Kobe's bases carry story meaning
  (water under the waterfall and griffon's shell, lava in dragon mountain, ice under
  raindrop castle). The Kenney kit has no matching bases for those.
- **No composite (Kenney base + prop).** It was a hedge against wobbly generated
  hexes; measurement showed the hexes are fine. Dropped — no DB migration needed.
- **No billboards / 2D-on-tile.** Rejected: tried previously, looks bad.
- **Generation tool:** AI image-to-3D (Meshy / Tripo / Rodin) from the existing
  artwork in `art/source/`. Cleaner topology than the PNG→GLB converters used so far.

## Evidence this is the right shape

Measured 2026-08-02 (see `reference-tile-pipeline` memory for the full numbers):

- Kenney contract: pointy-top hex, R = 0.5774, footprint X 1.000 / Z 1.155, base at
  y = 0, corners at 30° mod 60. Textures are **external** (`Textures/colormap.png`).
- Kobe's two custom GLBs were **correct hexagons** — 30.8° and 31.2° orientation —
  merely 2.5–4% undersized and 1–3% off-centre. That is the whole seam problem.
- Normalization spike took both to **R = 0.5774 ± 0.00%**, centred, base at y=0.
- Optimization spike: `upside-down waterfall.glb` **196,808 → 8,111 tris,
  6.95 MB → 0.27 MB**.

Two failures the spike hit, both sequencing errors, both fixed by this spec:

- Measuring *after* simplification loses the hex corners, so rotation cannot be
  recovered (waterfall landed 5° out). → **Measure first, correct, then simplify.**
- Aggressive simplification destroys the base plate. → **Never simplify the base.**

---

## Task 1 — `scripts/tiles/normalize-tile.mjs` — ✅ BUILT

Proven on four of Kobe's real tiles (2026-08-02). Every one passed verification:

| tile | footprint before | rotation off by | triangles | size |
|---|---|---|---|---|
| sunken-elven-ship | R 0.3655 (37% small) | 2.7° | 20,910 → 8,000 | 2.3 MB → 434 KB |
| dragon-mountain | R 0.2499 (57% small) | **16.1°** | 10,871 → 7,999 | 2.1 MB → 466 KB |
| dragon-mountain-sea | R 0.2777 (52% small) | **-17.2°** | 9,544 → 8,000 | 2.0 MB → 374 KB |
| sun-cave | R 0.2838 (51% small) | 2.9° | 7,742 (under budget) | 2.0 MB → 423 KB |

All output at R = 0.5774 exactly, centred, base at y=0, surface at 0.094–0.103.

Lessons that cost real debugging time:
- **Generated hex orientation is effectively random** (16° and -17° here). Never skip
  the rotation correction.
- **Bake transforms on ALL nodes, not just mesh-bearing ones.** The correction wrappers
  have no mesh; leaving them live applies the fix twice. The verifier caught it.
- **Trimming the base changes which vertices the footprint measurement samples**, so the
  XZ footprint fix must run last, measured over the whole base plate rather than a thin
  bottom slice (these tiles have bevelled undersides, reading ~2% narrow).
- **Emit PNG textures, not WebP.** gltf-transform defaults to EXT_texture_webp; browsers
  and three.js read it, Blender does not — models open untextured.

Options in use: `--surface=0.1 --match-water --palette-lock`. Identical for all four
tiles, which is the evidence that this generalizes rather than needing per-tile fiddling.

Original design notes follow.

**Stage order is load-bearing — do not reorder:**

1. **Measure at full resolution.** Isolate the base ring (vertices within the bottom
   2% of model height), then compute:
   - centre `(cx, cz)` — mean of the ring
   - circumradius `R` — max radius from centre
   - rotation offset — **circular mean over the hexagon's 6-fold symmetry**
     (`atan2(Σsin6θ, Σcos6θ)/6`). A plain mean of angles mod 60 wraps catastrophically:
     59° and 1° average to 30° instead of 0°.
   - `ymin` — lowest vertex
2. **Apply the correction** as wrapper nodes: uniform scale `0.5774 / R`, rotate
   `-rotOffset` about Y, translate `(-cx, -ymin, -cz)`. Bake, don't defer.
3. **Segment base from decoration** at the base-plate top (the Y where the
   cross-section stops being the full hex).
4. **Simplify the decoration only**, to a budget. Base plate passes through untouched,
   so the hex silhouette is preserved exactly.
5. **Compress textures** — cap 1024², WebP where alpha allows.
6. **Verify and fail loudly.** Re-measure the output; abort if
   `|R - 0.5774| > 0.001`, centre off by > 0.001, or `ymin ≠ 0`. A tile that silently
   ships 4% small is the bug this whole plan exists to kill.
7. **Emit** normalized GLB + thumbnail + manifest entry (triangles, bytes, measured R).

**Budgets:** decoration ≤ 8,000 tris; total file ≤ 500 KB.

**Known risk:** the mother tree resisted decimation (47k → 40k) — its mesh is
fragmented into many open shells. If a model can't reach budget after base-protected
simplification, regenerate it rather than fight it. The verifier reports this rather
than shipping a 4 MB tile.

---

## Task 2 — Supporting scripts

| script | status | does |
|---|---|---|
| `render_glb.py` | **written & working** | CPU rasterizer (no GPU on this box) — thumbnails and preview sheets |
| `generate-manifest.ts` | new | `public/models/manifest.json`; extends Plan 9's |
| `make-cutouts.py` | **written, low value** | background removal. Base-separation output was rejected as poor quality and has been deleted; keep the script only for background-stripping source images before feeding a generator |

`npm run tiles:build` runs the chain over `art/` → `public/models/`.

**Gotcha to preserve:** Kenney GLBs reference a sibling `Textures/colormap.png` by
relative URI. Anything relocating a GLB must preserve that path or embed the texture.

---

## Task 3 — App changes

Deliberately small, because dropping composite removed the need for a migration.

- `lib/types.ts` / `Tile` — unchanged. `model` still names the GLB.
- `DreamerHexTile` / `AdminHexTile` — unchanged rendering path. They inherit Plan 9's
  null-model guard and error boundary.
- `TileSidePanel` — model grid now reads thumbnails and metadata from the manifest;
  show triangle count and file size per model so heavy tiles are visible at a glance.
- Per-tile `scale_x/y/z` stays as a manual override, but should no longer be *needed*
  — if a tile needs scaling to fit, the pipeline failed and should be re-run.

---

## Task 4 — Content

Generate and land the story tiles. Kobe's selections:

| artwork | tiles |
|---|---|
| elven-forest, elven-forest-2, elven-forest-3 | **all three used** |
| raindrop-castle | **one only** (pick v1 or v2) |
| dragon-mountain | **TBD — Kobe checking** |
| all others | one each |

Source artwork lives in `art/source/{stories,special-tiles}/`; original filenames
mapped in `art/source/ORIGINAL_FILENAMES.json`.

---

## Open questions

1. Meshy vs Tripo vs Rodin — which account will Kobe use? With an API key the
   generate → normalize → publish chain runs unattended for all 17.
2. Dragon mountain: one tile or both variants?
3. Raindrop castle: v1 or v2?

## Definition of done

- `npm run tiles:build` reproducibly regenerates every tile from `art/`
- Every shipped tile verified at R = 0.5774 ± 0.001, centred, base at y = 0
- No GLB in `public/models/` over 500 KB or 10k triangles
- All story artworks live as tiles on the admin map; `tsc` clean, tests green
