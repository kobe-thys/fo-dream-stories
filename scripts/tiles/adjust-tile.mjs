/**
 * Nudge the ARTWORK on a built tile without touching its hex base.
 *
 *   node scripts/tiles/adjust-tile.mjs <tile.glb> [--rot=15] [--center] [--shift-x=0.02] [--shift-z=-0.01] [--scale=1.05]
 *
 * Order: rotate about Y, scale from the plate top, auto-centre if asked, then the
 * manual shift on top -- so "centre it, then nudge from there" behaves as written.
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
const ROT = clamp(flag('rot', 0), -180, 180) * Math.PI / 180
const CENTER = args.includes('--center')
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

// Accessors of the ARTWORK only; the base never moves. Several accessors are
// shared between primitives, so collect each once.
const accessors = []
for (const mesh of root.listMeshes()) {
  if (mesh.getName() === 'hexBase') continue
  for (const prim of mesh.listPrimitives()) {
    const pos = prim.getAttribute('POSITION')
    if (pos && !accessors.includes(pos)) accessors.push(pos)
  }
}
const moved = accessors.length

// Pass 1 — rotate about Y, then scale from the plate top.
const cosR = Math.cos(ROT), sinR = Math.sin(ROT)
for (const pos of accessors) {
  const arr = pos.getArray().slice()
  for (let i = 0; i < arr.length; i += 3) {
    const x = arr[i], z = arr[i + 2]
    arr[i]     = (x * cosR - z * sinR) * SCALE
    arr[i + 1] = (arr[i + 1] - plateTop) * SCALE + plateTop
    arr[i + 2] = (x * sinR + z * cosR) * SCALE
  }
  pos.setArray(arr)
}

// Auto-centre: bring the artwork's cross-section at the plate top onto the base's
// centre. Done HERE rather than during normalization, where it also fed the
// footprint fix and shrank the artwork -- the base is already a perfect prism at
// the origin, so moving the art onto it is the whole job.
let acx = 0, acz = 0
if (CENTER) {
  const band = []
  for (const pos of accessors) {
    const arr = pos.getArray()
    for (let i = 0; i < arr.length; i += 3) {
      if (Math.abs(arr[i + 1] - plateTop) <= 0.03) band.push([arr[i], arr[i + 2]])
    }
  }
  if (band.length > 8) {
    let mx = 0, mz = 0
    for (const [x, z] of band) { mx += x; mz += z }
    mx /= band.length; mz /= band.length
    let rmax = 0
    for (const [x, z] of band) rmax = Math.max(rmax, Math.hypot(x - mx, z - mz))
    // Outer points only: trunks standing mid-section drag a plain average off.
    const rim = band.filter(([x, z]) => Math.hypot(x - mx, z - mz) >= rmax * 0.85)
    if (rim.length >= 6) {
      let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity
      for (const [x, z] of rim) {
        if (x < x0) x0 = x; if (x > x1) x1 = x
        if (z < z0) z0 = z; if (z > z1) z1 = z
      }
      acx = -(x0 + x1) / 2
      acz = -(z0 + z1) / 2
    }
  }
}

// Pass 2 — translate: auto-centre first, manual shift on top.
for (const pos of accessors) {
  const arr = pos.getArray().slice()
  for (let i = 0; i < arr.length; i += 3) {
    arr[i]     += acx + SHIFT_X
    arr[i + 2] += acz + SHIFT_Z
  }
  pos.setArray(arr)
}

await io.write(SRC, doc)
console.log(`  adjusted ${moved} artwork accessor(s): rot ${(ROT * 180 / Math.PI).toFixed(1)}deg, ` +
            `scale ${SCALE}, shift (${SHIFT_X}, ${SHIFT_Z})` +
            (CENTER ? `, auto-centre (${acx.toFixed(4)}, ${acz.toFixed(4)})` : '') +
            `, anchored at plate top ${plateTop.toFixed(3)}`)
console.log(`  base untouched — still R=0.5774 on y=0`)
console.log(`  size ${(fs.statSync(SRC).size / 1024).toFixed(0)}KB`)
