/**
 * Generate a floating cloud of music notes as a standalone GLB.
 *
 *   node scripts/tiles/make-notes.mjs <out.glb> [--x=0] [--y=0.8] [--z=0]
 *        [--count=7] [--spread=0.26] [--rise=0.34] [--size=0.075]
 *        [--color=#3a3f5c] [--seed=7] [--thick=0.34]
 *
 * Notes are built as real glyphs -- an extruded elliptical head tilted about 20
 * degrees, a vertical stem, and a flag or beam -- rather than billboards, so they
 * hold up as the map is orbited. Each is a slab with thickness for the same reason:
 * a flat glyph vanishes edge-on, and this map rotates freely.
 *
 * Every polygon extruded here is convex, so a triangle fan is a correct
 * triangulation; the flag is deliberately shaped to keep that true.
 *
 * The scatter is seeded, so re-running produces the identical cloud and a tile can
 * be rebuilt reproducibly.
 */
import { Document, NodeIO } from '@gltf-transform/core'
import fs from 'fs'

const args = process.argv.slice(2)
const OUT = args.find(a => !a.startsWith('--'))
const flag = (n, d) => { const h = args.find(a => a.startsWith(`--${n}=`)); return h ? h.split('=')[1] : d }
const num = (n, d) => Number(flag(n, d))
if (!OUT) { console.error('usage: make-notes.mjs <out.glb> [--x=] [--y=] [--count=] ...'); process.exit(1) }

const CX = num('x', 0), CY = num('y', 0.8), CZ = num('z', 0)
const COUNT = Math.max(1, Math.round(num('count', 7)))
const SPREAD = num('spread', 0.26)
const RISE = num('rise', 0.34)
const SIZE = num('size', 0.075)
const COLOR = flag('color', '#3a3f5c')
let seed = Math.round(num('seed', 7))

// Deterministic LCG — a fixed seed must always give the same cloud.
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 }
const between = (a, b) => a + (b - a) * rnd()

const srgbToLinear = c => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))
const hexLinear = hex => {
  const n = parseInt(hex.replace('#', ''), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => srgbToLinear(v / 255))
}

// ── glyph pieces, in note-local units (stem height ≈ 1.35) ──────────────────
const HEAD_RX = 0.52, HEAD_RZ = 0.34, TILT = -22 * Math.PI / 180
// Thickness matters more than it looks: the map orbits freely, and a thin glyph
// caught edge-on reads as a bare stick. A chunky slab still says "note" side-on,
// and suits the low-poly kit better than a wafer would.
const THICK = num('thick', 0.34), STEM_W = 0.12, STEM_H = 1.35

function ellipse(cx, cy, rx, ry, tilt, n = 12) {
  const pts = []
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    const x = Math.cos(a) * rx, y = Math.sin(a) * ry
    pts.push([cx + x * Math.cos(tilt) - y * Math.sin(tilt), cy + x * Math.sin(tilt) + y * Math.cos(tilt)])
  }
  return pts
}
const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]

/** A pennant off the stem top. Kept convex so the fan triangulation stays valid. */
const flagPoly = (sx, sy) => [
  [sx, sy], [sx + 0.46, sy - 0.30], [sx + 0.50, sy - 0.70], [sx + 0.16, sy - 0.42], [sx, sy - 0.30],
]

/** Extrude a convex polygon along local Z into flat-shaded triangles. */
function extrude(poly, t, out) {
  const h = t / 2
  const push = (a, b, c) => {
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
    const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]
    let nx = u[1] * v[2] - u[2] * v[1], ny = u[2] * v[0] - u[0] * v[2], nz = u[0] * v[1] - u[1] * v[0]
    const L = Math.hypot(nx, ny, nz) || 1
    nx /= L; ny /= L; nz /= L
    for (const p of [a, b, c]) { out.pos.push(...p); out.nor.push(nx, ny, nz) }
  }
  for (let i = 1; i < poly.length - 1; i++) {                    // front fan
    push([poly[0][0], poly[0][1], h], [poly[i][0], poly[i][1], h], [poly[i + 1][0], poly[i + 1][1], h])
  }
  for (let i = 1; i < poly.length - 1; i++) {                    // back fan
    push([poly[0][0], poly[0][1], -h], [poly[i + 1][0], poly[i + 1][1], -h], [poly[i][0], poly[i][1], -h])
  }
  for (let i = 0; i < poly.length; i++) {                        // side wall
    const a = poly[i], b = poly[(i + 1) % poly.length]
    push([a[0], a[1], h], [b[0], b[1], h], [b[0], b[1], -h])
    push([a[0], a[1], h], [b[0], b[1], -h], [a[0], a[1], -h])
  }
}

/** kind: 0 quarter, 1 eighth, 2 beamed pair */
function glyph(kind, out) {
  const stemX = HEAD_RX * 0.86
  extrude(ellipse(0, 0, HEAD_RX, HEAD_RZ, TILT), THICK, out)
  extrude(rect(stemX - STEM_W, 0, stemX, STEM_H), THICK, out)
  if (kind === 1) extrude(flagPoly(stemX, STEM_H), THICK, out)
  if (kind === 2) {
    const dx = 1.15
    extrude(ellipse(dx, -0.10, HEAD_RX, HEAD_RZ, TILT), THICK, out)
    extrude(rect(dx + stemX - STEM_W, -0.10, dx + stemX, STEM_H), THICK, out)
    extrude(rect(stemX - STEM_W, STEM_H - 0.22, dx + stemX, STEM_H), THICK, out)   // beam
  }
}

// ── scatter ────────────────────────────────────────────────────────────────
const pos = [], nor = []
for (let i = 0; i < COUNT; i++) {
  const local = { pos: [], nor: [] }
  const kind = i % 3 === 2 ? 2 : (i % 2)
  glyph(kind, local)

  // Rise with the index so the cloud drifts upward, jittered so it is not a ladder.
  const t = (i + between(0.1, 0.9)) / COUNT
  const ang = between(0, Math.PI * 2)
  const rad = SPREAD * Math.sqrt(between(0.05, 1))
  const px = CX + Math.cos(ang) * rad
  const pz = CZ + Math.sin(ang) * rad
  const py = CY + RISE * t

  // Higher notes are smaller: reads as drifting away.
  const s = SIZE * between(0.72, 1.08) * (1 - 0.25 * t)
  const yaw = between(0, Math.PI * 2)
  const roll = between(-0.35, 0.35)
  const cy_ = Math.cos(yaw), sy_ = Math.sin(yaw)
  const cr = Math.cos(roll), sr = Math.sin(roll)

  for (let k = 0; k < local.pos.length; k += 3) {
    // roll in the glyph plane, then yaw about world Y, then place
    let x = local.pos[k] * s, y = local.pos[k + 1] * s, z = local.pos[k + 2] * s
    const rx = x * cr - y * sr, ry = x * sr + y * cr
    pos.push(px + rx * cy_ + z * sy_, py + ry, pz - rx * sy_ + z * cy_)
    let nx = local.nor[k], ny = local.nor[k + 1], nz = local.nor[k + 2]
    const nrx = nx * cr - ny * sr, nry = nx * sr + ny * cr
    nor.push(nrx * cy_ + nz * sy_, nry, -nrx * sy_ + nz * cy_)
  }
}

const doc = new Document()
const buffer = doc.createBuffer()
const scene = doc.createScene()
const prim = doc.createPrimitive()
  .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(new Float32Array(pos)).setBuffer(buffer))
  .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(new Float32Array(nor)).setBuffer(buffer))
  .setMaterial(doc.createMaterial('music-notes')
    .setBaseColorFactor([...hexLinear(COLOR), 1]).setMetallicFactor(0).setRoughnessFactor(1))
scene.addChild(doc.createNode('notes').setMesh(doc.createMesh('notes').addPrimitive(prim)))
doc.getRoot().setDefaultScene(scene)
await new NodeIO().write(OUT, doc)

const ys = []
for (let k = 1; k < pos.length; k += 3) ys.push(pos[k])
console.log(`  ${OUT.split('/').pop()} — ${COUNT} notes, ${pos.length / 9} tris, ${(fs.statSync(OUT).size / 1024).toFixed(0)}KB`)
console.log(`  centred (${CX}, ${CZ}) above y=${CY}, rising to ${Math.max(...ys).toFixed(3)}, colour ${COLOR}`)
