# Plan 9 Spec — Foundation Fixes & Workspace Cleanup

**Status:** DRAFT — awaiting Kobe's review
**Date:** 2026-08-02
**Prerequisite for:** Plan 10 (3D Tile System)

## Goal

Close the confirmed defects in the existing map code and clean up the workspace, so
Plan 10 is built on a correct base. No new features. Every item here is either a
verified bug, a security issue, or dead weight.

## Why now

Plan 10 rewrites tile rendering and adds a build pipeline. Three of the defects below
(hex picking, null-model crash, models manifest) sit directly under that work — fixing
them afterwards means touching the same files twice.

---

## Task 1 — Correct hex click-picking (cube rounding)

**Defect (confirmed by simulation).** `components/admin/map/AdminHexGrid.tsx:9`
`axialFromWorld()` rounds `q` and `r` independently:

```ts
const r = Math.round(z / HEX_Z_SPACING)
const q = Math.round(x / HEX_X_SPACING - r / 2)
```

Hex grids require cube rounding. Measured against nearest-centre ground truth over
200,000 random clicks: **7.5% land in the wrong hex** — the six corner triangles of
every tile. Symptom: placing or moving a tile sometimes jumps one cell.

**Fix.** Move the conversion into `lib/hex.ts` as the inverse of `axialToWorld`, using
fractional axial → cube → round → repair-largest-residual:

```ts
export function worldToAxial(x: number, z: number): { q: number; r: number } {
  const rf = z / HEX_Z_SPACING
  const qf = x / HEX_X_SPACING - rf / 2
  return cubeRound(qf, rf)
}

function cubeRound(qf: number, rf: number): { q: number; r: number } {
  const sf = -qf - rf
  let q = Math.round(qf), r = Math.round(rf), s = Math.round(sf)
  const dq = Math.abs(q - qf), dr = Math.abs(r - rf), ds = Math.abs(s - sf)
  if (dq > dr && dq > ds) q = -r - s
  else if (dr > ds)       r = -q - s
  return { q, r }
}
```

`AdminHexGrid` imports `worldToAxial` and deletes its local copy.

**Test** (`__tests__/lib/hex.test.ts`): assert `worldToAxial(axialToWorld(q,r)) === {q,r}`
for all `q,r ∈ [-6,6]`, and assert 20,000 random points agree with a nearest-centre
brute-force reference. The second test fails on the current implementation — that is
the point.

**Acceptance:** round-trip exact for the full range; 0 disagreements with brute force.

---

## Task 2 — Dreamer map must survive a tile with no model

**Defect.** `components/map/DreamerMapCanvas.tsx:53` filters only `type !== 'undefined'`,
then `components/map/DreamerHexTile.tsx:54` calls `useGLTF('/models/null')`. A story or
terrain tile with `model = null` produces a 404, the Suspense boundary never resolves,
and **the entire map goes blank** — not just that tile. The admin renderer already
guards this with `PlaceholderTile`; the consumer one does not.

**Fix.**
1. In `DreamerHexTile`, split as the admin component does: return a low-poly placeholder
   cylinder when `tile.model` is falsy, and only call `useGLTF` in the inner component.
   (Keeps hook order stable — `useGLTF` must not be called conditionally.)
2. Wrap each tile in an error boundary so a single corrupt or missing GLB degrades to
   the placeholder instead of killing the canvas. New
   `components/map/TileErrorBoundary.tsx` (class component; React has no hook form).
3. URL-encode the model path: `` `/models/${encodeURIComponent(tile.model)}` `` in both
   renderers. Current filenames contain spaces (`0 - mother tree2.glb`).

**Test:** render `DreamerHexTile` with `model: null` and assert no `useGLTF` call and no
throw; render with a model path that rejects and assert the boundary catches it.

**Acceptance:** a null-model tile and a broken-GLB tile both render as placeholders; the
rest of the map is unaffected.

---

## Task 3 — Model list must work on Vercel (manifest, not readdir)

**Defect.** `app/api/admin/models/route.ts` calls
`fs.readdirSync(path.join(process.cwd(), 'public', 'models'))`. Next.js does not trace
`public/` into the serverless function bundle, so this throws at runtime on Vercel.
The admin map page swallows it (`Array.isArray(modelData)` is false → `modelFiles`
stays `[]`), so the observable symptom is **an empty model picker in production that
works perfectly on localhost**.

**Fix.**
1. New `scripts/generate-model-manifest.ts` writes `public/models/manifest.json`:
   `{ generatedAt, models: [{ file, thumb, label }] }`.
2. Wire into `package.json`: `"prebuild": "tsx scripts/generate-model-manifest.ts"`,
   and commit the manifest so local `next dev` works without a build step.
3. `/api/admin/models` imports the manifest (static import — bundled, always present)
   and returns `models`. Drop `fs` entirely.
4. Admin map page: surface a visible error if the model list comes back empty, instead
   of silently rendering an empty picker.

**Note.** Plan 10 extends this manifest with per-model metadata (kind, footprint,
triangles). Establishing it here means Plan 10 only adds fields.

**Acceptance:** `/api/admin/models` returns the full list in a production build with the
`public/` directory absent from the function bundle.

---

## Task 4 — Stop rewriting every material on every frame

**Defect.** `components/map/DreamerHexTile.tsx:100` traverses every mesh of every tile
and reassigns colour, map, emissive and opacity **on every frame**, regardless of whether
anything changed. With the current 197k-triangle waterfall on the map this is
significant per-frame CPU on a tablet.

**Fix.** Split the two concerns:
- **State-driven appearance** (grey / revealed / completed base colours and texture
  swap) → apply in a `useEffect` keyed on `tile.childState`.
- **Animation** (the `completed` emissive pulse) → keep in `useFrame`, but write only
  `mat.emissiveIntensity`, and only for completed tiles.

Cache the material list once in the existing `useMemo` rather than re-traversing.

**Acceptance:** no measurable per-frame traversal for grey/revealed tiles; the completed
pulse still animates. Verify by counting traversals in a test double.

---

## Task 5 — Small correctness and consistency items

1. **`MODEL_SCALE` duplication.** `1.72` is a literal in `AdminHexTile.tsx:33` and
   `DreamerHexTile.tsx:121`. Move to `lib/hex.ts` as `MODEL_SCALE`, and derive the
   spacing constants from it rather than hard-coding `1.732` / `1.5`:
   ```ts
   export const KENNEY_HEX_R = 0.5774          // measured from grass.glb
   export const MODEL_SCALE  = 1.72
   const R = KENNEY_HEX_R * MODEL_SCALE
   export const HEX_X_SPACING = Math.sqrt(3) * R
   export const HEX_Z_SPACING = 1.5 * R
   ```
   This changes spacing by <1% and removes the magic numbers.
2. **Z-fighting.** `AdminHexGrid.tsx` places the click plane and `ContactShadows` both at
   `y = -0.01`. Move the click plane to `y = -0.05`.
3. **Consecutive tile placement.** `AdminHexGrid.tsx:43-47` — clicking empty ground while
   a tile is selected only deselects, so placing several tiles takes two clicks each.
   Place directly and keep the new tile selected.
4. **Stale docs.** `/root/FOs_dream_stories/CLAUDE.md` still lists Plan 5 as next; Plans
   5–8 have all shipped. Update the plan table and "Current state".

---

## Task 6 — Workspace cleanup

1. **Rotate the leaked GitHub token — do this first.**
   `/root/fo-dream-stories/.git/config` contains a personal access token in plaintext in
   the remote URL (`https://ghp_...@github.com/...`). Anyone with read access to the box
   or a backup of it has push rights to the repo.
   - Revoke the token at github.com/settings/tokens
   - Re-point the remote at SSH, or use a credential helper
   - Confirm the token never entered git history (it lives in `.git/config`, which is not
     itself committed — expected to be clean, but verify)
2. **Salvage, then delete `/root/fo-dream-stories-gemini`** (542 MB, dead parallel
   implementation, last commit "Initial commit", untouched since before April, and pushed
   to its own GitHub repo so nothing is lost).
   Copy across first: the `unit-*.glb` Kenney models absent from the main repo, and the
   `Image to 3D.glb` / `Image to 3D bottom pivot.glb` experiments (useful as pipeline
   test fixtures in Plan 10).
3. **Keep** `/root/FOs_dream_stories` (9 MB, docs and specs) and `/root/fo-dream-stories`
   (the app; 1.0 GB of its 1.1 GB is regenerable `node_modules` + `.next`).

---

## Out of scope

Anything touching tile *authoring* or the composite base/prop model — that is Plan 10.
No visual redesign. No DB migration in this plan.

## Definition of done

- `npx tsc --noEmit` clean; `npm test` green including the new hex and renderer tests
- Deployed to Vercel and verified: admin model picker populated, tile placement lands in
  the clicked hex, map survives a null-model tile
- Gemini folder removed, token rotated, `CLAUDE.md` current
