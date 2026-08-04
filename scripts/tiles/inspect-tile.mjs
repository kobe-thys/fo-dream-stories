/**
 * Report a source tile's vertical structure, so --base-top can be chosen by
 * looking rather than guessing.
 *
 *   node scripts/tiles/inspect-tile.mjs <source.glb>
 *
 * The base plate is the part whose cross-section fills the hex. Above it the
 * artwork narrows. Printing width per height band makes the boundary visible, and
 * the suggested value is the last band still at full hex width.
 *
 * Heights are reported in FINAL TILE UNITS -- the source is scaled by
 * 0.5774 / R_source first -- so the number can be typed straight into the
 * normalizer without converting anything.
 */
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'

const SRC = process.argv[2]
if (!SRC) { console.error('usage: inspect-tile.mjs <source.glb>'); process.exit(1) }

const KENNEY_R = 0.5774
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
const doc = await io.read(SRC)

const pts = []
for (const scene of doc.getRoot().listScenes()) {
  scene.traverse(node => {
    const mesh = node.getMesh(); if (!mesh) return
    const m = node.getWorldMatrix(); const v = [0, 0, 0]
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION'); if (!pos) continue
      for (let i = 0; i < pos.getCount(); i++) {
        pos.getElement(i, v)
        pts.push([
          m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12],
          m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13],
          m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14],
        ])
      }
    }
  })
}
if (!pts.length) { console.error('no geometry'); process.exit(1) }

// Loops, not Math.min(...arr): spreading hundreds of thousands of vertices
// overflows the call stack.
let ymin = Infinity, ymax = -Infinity
for (const p of pts) { if (p[1] < ymin) ymin = p[1]; if (p[1] > ymax) ymax = p[1] }

// Circumradius of the base ring, to convert into final-tile units.
const ring = pts.filter(p => p[1] <= ymin + (ymax - ymin) * 0.02)
const cx = ring.reduce((s, p) => s + p[0], 0) / ring.length
const cz = ring.reduce((s, p) => s + p[2], 0) / ring.length
let R = 0
for (const p of ring) R = Math.max(R, Math.hypot(p[0] - cx, p[2] - cz))
const k = KENNEY_R / R

const IDEAL_W = Math.sqrt(3) * KENNEY_R
const BANDS = 24
const step = (ymax - ymin) / BANDS

console.log(`source R=${R.toFixed(4)} -> scale x${k.toFixed(3)}; height ${((ymax - ymin) * k).toFixed(3)} in tile units`)
console.log(`hex width at full size = ${IDEAL_W.toFixed(3)}\n`)
console.log('  height   width   fill   verts')

let suggested = null
for (let i = 0; i < BANDS; i++) {
  const y0 = ymin + i * step, y1 = y0 + step
  const band = pts.filter(p => p[1] >= y0 && p[1] < y1)
  if (band.length < 5) continue
  let bx0 = Infinity, bx1 = -Infinity
  for (const p of band) { if (p[0] < bx0) bx0 = p[0]; if (p[0] > bx1) bx1 = p[0] }
  const w = (bx1 - bx0) * k
  const fill = w / IDEAL_W
  const h = (y0 - ymin) * k
  const bar = '█'.repeat(Math.max(0, Math.round(fill * 20)))
  console.log(`  ${h.toFixed(3)}  ${w.toFixed(3)}  ${(fill * 100).toFixed(0).padStart(3)}%  ${String(band.length).padStart(7)}  ${bar}`)
  // Still filling the hex (within 3%) => still the plate.
  if (fill >= 0.97) suggested = (y1 - ymin) * k
}

console.log(`\nsuggested --base-top=${suggested === null ? 'n/a' : suggested.toFixed(3)}`)
console.log('(last height whose cross-section still fills the hex; above this the artwork narrows)')
