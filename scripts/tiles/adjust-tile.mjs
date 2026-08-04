/**
 * Nudge the ARTWORK on a built tile without touching its hex base.
 *
 *   node scripts/tiles/adjust-tile.mjs <tile.glb> [--shift-x=0.02] [--shift-z=-0.01] [--scale=1.05]
 *
 * --rebuild-base leaves the prism as its own mesh named "hexBase", so the artwork
 * is simply everything else. That split is what makes this safe: the base stays
 * exactly on the Kenney contract (R=0.5774, centred, sitting on y=0) no matter how
 * far the artwork is shifted or grown over it.
 *
 * Scaling is anchored at the PLATE TOP, not the origin: the artwork grows outward
 * and upward while its underside stays glued to the plate. Scaling about the origin
 * would lift it off the base or sink it into it.
 *
 * Runs on the already-built GLB, so it takes seconds — the point is to be able to
 * iterate on placement without paying for a re-normalize.
 */
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import fs from 'fs'

const args = process.argv.slice(2)
const SRC = args.find(a => !a.startsWith('--'))
const flag = (n, d) => { const h = args.find(a => a.startsWith(`--${n}=`)); return h ? Number(h.split('=')[1]) : d }

if (!SRC) { console.error('usage: adjust-tile.mjs <tile.glb> [--shift-x=] [--shift-z=] [--scale=]'); process.exit(1) }

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
const SHIFT_X = clamp(flag('shift-x', 0), -0.5, 0.5)
const SHIFT_Z = clamp(flag('shift-z', 0), -0.5, 0.5)
const SCALE = clamp(flag('scale', 1), 0.5, 2)

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
const doc = await io.read(SRC)
const root = doc.getRoot()

// Plate top = highest vertex of the base mesh; the anchor for scaling.
let plateTop = 0
const base = root.listMeshes().find(m => m.getName() === 'hexBase')
if (base) {
  const pos = base.listPrimitives()[0].getAttribute('POSITION')
  const v = [0, 0, 0]
  for (let i = 0; i < pos.getCount(); i++) { pos.getElement(i, v); if (v[1] > plateTop) plateTop = v[1] }
} else {
  console.error('no hexBase mesh — this tile was not built with --rebuild-base, refusing to guess')
  process.exit(1)
}

// Mutate positions directly. Wrapping in a transform node would be cleaner, but
// several accessors are shared between primitives, so track what has been done.
const seen = new Set()
let moved = 0
for (const mesh of root.listMeshes()) {
  if (mesh.getName() === 'hexBase') continue          // the base never moves
  for (const prim of mesh.listPrimitives()) {
    const pos = prim.getAttribute('POSITION')
    if (!pos || seen.has(pos)) continue
    seen.add(pos)
    const arr = pos.getArray().slice()
    for (let i = 0; i < arr.length; i += 3) {
      arr[i]     = arr[i] * SCALE + SHIFT_X
      arr[i + 1] = (arr[i + 1] - plateTop) * SCALE + plateTop
      arr[i + 2] = arr[i + 2] * SCALE + SHIFT_Z
    }
    pos.setArray(arr)
    moved++
  }
}

await io.write(SRC, doc)
console.log(`  adjusted ${moved} artwork accessor(s): shift (${SHIFT_X}, ${SHIFT_Z}) scale ${SCALE}, anchored at plate top ${plateTop.toFixed(3)}`)
console.log(`  base untouched — still R=0.5774 on y=0`)
console.log(`  size ${(fs.statSync(SRC).size / 1024).toFixed(0)}KB`)
