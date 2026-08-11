/**
 * Generate a rainbow arc as a standalone GLB, ready to compose onto a tile.
 *
 *   node scripts/tiles/make-rainbow.mjs <out.glb> [--y=0.52] [--radius=1.1]
 *        [--sweep=20] [--width=0.15] [--depth=0.07] [--azimuth=0] [--segments=14]
 *
 * The arc leaves the start point travelling straight UP and curves over `sweep`
 * degrees, so a small sweep reads as a rainbow just beginning rather than a bent
 * stick. Bands are concentric arcs about a common centre, which is why they fan out
 * side by side at the foot the way a real rainbow's do.
 *
 *   centre C = P0 + R·d                       (d = horizontal lean direction)
 *   P(θ, r) = C − r·cosθ·d + r·sinθ·Y         (P(0, R) = P0, tangent = +Y)
 *
 * Geometry is NON-INDEXED with per-face normals: the Kenney kit is flat-shaded, and
 * smooth normals across a chunky 7-band arc would look wrong beside it.
 *
 * Colours are flat baseColorFactor materials, not texture lookups — the Kenney
 * colormap atlas has no rainbow in it.
 */
import { Document, NodeIO } from '@gltf-transform/core'
import fs from 'fs'

const args = process.argv.slice(2)
const OUT = args.find(a => !a.startsWith('--'))
const flag = (n, d) => { const h = args.find(a => a.startsWith(`--${n}=`)); return h ? Number(h.split('=')[1]) : d }
if (!OUT) { console.error('usage: make-rainbow.mjs <out.glb> [--y=] [--radius=] [--sweep=] ...'); process.exit(1) }

const Y0      = flag('y', 0.52)          // where the arc leaves the tower
const R       = flag('radius', 1.1)      // radius of the band's centre line
const SWEEP   = flag('sweep', 20) * Math.PI / 180
const WIDTH   = flag('width', 0.15)      // total across all bands
const DEPTH   = flag('depth', 0.07)      // thickness, so it is not invisible edge-on
const AZIMUTH = flag('azimuth', 0) * Math.PI / 180
const SEGS    = Math.max(4, Math.round(flag('segments', 14)))

// ROYGBIV, pulled toward the kit's slightly muted tones.
const BANDS = [
  ['red',    '#e05c4f'],
  ['orange', '#ef9d3f'],
  ['yellow', '#f3d34a'],
  ['green',  '#57c286'],
  ['blue',   '#4aa3e0'],
  ['indigo', '#5a63c6'],
  ['violet', '#9a5fbf'],
]

const srgbToLinear = c => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))
const hexLinear = hex => {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => srgbToLinear(v / 255))
}

// Arc plane: spanned by the horizontal lean direction d and world up. n is the
// horizontal normal of that plane, giving the band its thickness.
const d = [Math.cos(AZIMUTH), 0, Math.sin(AZIMUTH)]
const nrm = [-Math.sin(AZIMUTH), 0, Math.cos(AZIMUTH)]
const C = [d[0] * R, Y0, d[2] * R]

const P = (theta, r, lat) => {
  const ct = Math.cos(theta), st = Math.sin(theta)
  return [
    C[0] - r * ct * d[0] + lat * nrm[0],
    C[1] + r * st,
    C[2] - r * ct * d[2] + lat * nrm[2],
  ]
}

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const norm = v => { const L = Math.hypot(...v) || 1; return [v[0] / L, v[1] / L, v[2] / L] }

const doc = new Document()
const buffer = doc.createBuffer()
const scene = doc.createScene()
const mesh = doc.createMesh('rainbow')

let tris = 0
BANDS.forEach(([name, hex], i) => {
  // Bands run outer→inner so red ends up on the outside, as in the sky.
  const half = WIDTH / 2
  const r1 = R + half - (i * WIDTH) / BANDS.length
  const r0 = R + half - ((i + 1) * WIDTH) / BANDS.length
  const pos = [], nor = []

  const quad = (a, b, c, e) => {
    const nv = norm(cross(sub(b, a), sub(c, a)))
    for (const v of [a, b, c, a, c, e]) { pos.push(...v); nor.push(...nv) }
    tris += 2
  }

  for (let s = 0; s < SEGS; s++) {
    const t0 = (s / SEGS) * SWEEP, t1 = ((s + 1) / SEGS) * SWEEP
    const h = DEPTH / 2
    // ring corners: [radius, lateral]
    const A0 = P(t0, r0, +h), B0 = P(t0, r1, +h), C0 = P(t0, r1, -h), D0 = P(t0, r0, -h)
    const A1 = P(t1, r0, +h), B1 = P(t1, r1, +h), C1 = P(t1, r1, -h), D1 = P(t1, r0, -h)
    quad(B0, B1, C1, C0)   // outer
    quad(A0, D0, D1, A1)   // inner
    quad(A0, A1, B1, B0)   // +lateral
    quad(D0, C0, C1, D1)   // -lateral
  }
  // Cap the far end so the arc does not read as hollow; the foot is buried in the tower.
  const tE = SWEEP, h = DEPTH / 2
  quad(P(tE, r0, +h), P(tE, r1, +h), P(tE, r1, -h), P(tE, r0, -h))

  const prim = doc.createPrimitive()
    .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(new Float32Array(pos)).setBuffer(buffer))
    .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(new Float32Array(nor)).setBuffer(buffer))
    .setMaterial(
      doc.createMaterial(`rainbow-${name}`)
        .setBaseColorFactor([...hexLinear(hex), 1])
        .setMetallicFactor(0)
        .setRoughnessFactor(1)
    )
  mesh.addPrimitive(prim)
})

scene.addChild(doc.createNode('rainbow').setMesh(mesh))
doc.getRoot().setDefaultScene(scene)
await new NodeIO().write(OUT, doc)

const rise = R * Math.sin(SWEEP), drift = R * (1 - Math.cos(SWEEP))
console.log(`  ${OUT.split('/').pop()} — ${BANDS.length} bands, ${tris} tris, ${(fs.statSync(OUT).size / 1024).toFixed(0)}KB`)
console.log(`  from y=${Y0}, sweep ${(SWEEP * 180 / Math.PI).toFixed(0)}deg, radius ${R}`)
console.log(`  rises ${rise.toFixed(3)} to y=${(Y0 + rise).toFixed(3)}, leans ${drift.toFixed(3)}`)
