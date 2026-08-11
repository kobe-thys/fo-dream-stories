/**
 * Low-lying mist banks — opaque, stylised, picture-book fog.
 *
 *   node scripts/tiles/make-mist.mjs <out.glb> [--y=0.21] [--count=6]
 *        [--spread=0.34] [--radius=0.22] [--height=0.055] [--color=#e3edf3] [--seed=11]
 *
 * WHY OPAQUE
 * Real fog wants alpha, and alpha does not survive into this app: both tile
 * renderers overwrite it (DreamerHexTile forces transparent=false, opacity=1;
 * AdminHexTile drives opacity from tile state). A translucent mist would render
 * solid anyway. So the mist is built the way a picture book draws it -- pale,
 * very flat, overlapping lobes that read as fog by SHAPE and VALUE rather than by
 * transparency.
 *
 * Each bank is a lathe with per-angle radius jitter, so the silhouette is lumpy
 * instead of a tidy disc. Squashed hard: wide and barely tall.
 */
import { Document, NodeIO } from '@gltf-transform/core'
import fs from 'fs'

const args = process.argv.slice(2)
const OUT = args.find(a => !a.startsWith('--'))
const flag = (n, d) => { const h = args.find(a => a.startsWith(`--${n}=`)); return h ? h.split('=')[1] : d }
const num = (n, d) => Number(flag(n, d))
if (!OUT) { console.error('usage: make-mist.mjs <out.glb> [--y=] [--count=] ...'); process.exit(1) }

const Y = num('y', 0.21)
const COUNT = Math.max(1, Math.round(num('count', 6)))
const SPREAD = num('spread', 0.34)
const RADIUS = num('radius', 0.22)
const HEIGHT = num('height', 0.055)
const COLOR = flag('color', '#e3edf3')
const SIDES = Math.max(8, Math.round(num('sides', 14)))
let seed = Math.round(num('seed', 11))

const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 }
const between = (a, b) => a + (b - a) * rnd()

const srgbToLinear = c => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))
const hexLinear = hex => {
  const n = parseInt(hex.replace('#', ''), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => srgbToLinear(v / 255))
}

// A flat dome: full width low down, tapering fast. Reads as a settled bank.
// Rounder than the first attempt, which was so flat it read as spilled paint
// rather than fog. Fog wants volume and a soft shoulder, not a sheet.
const PROFILE = [[0.00, 0.00], [0.55, 0.08], [0.86, 0.30], [1.00, 0.55], [0.88, 0.78], [0.52, 0.93], [0.00, 1.00]]

const pos = [], nor = []
const push = (a, b, c) => {
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
  const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]
  let nx = u[1] * v[2] - u[2] * v[1], ny = u[2] * v[0] - u[0] * v[2], nz = u[0] * v[1] - u[1] * v[0]
  const L = Math.hypot(nx, ny, nz) || 1
  for (const p of [a, b, c]) { pos.push(...p); nor.push(nx / L, ny / L, nz / L) }
}

for (let i = 0; i < COUNT; i++) {
  const ang = between(0, Math.PI * 2)
  const rad = SPREAD * Math.sqrt(between(0.02, 1))
  const cx = Math.cos(ang) * rad, cz = Math.sin(ang) * rad
  const R = RADIUS * between(0.65, 1.25)
  const H = HEIGHT * between(0.7, 1.3)
  // Only a whisper of lift. Opaque mist OCCLUDES whatever it overlaps -- lifting it
  // to drift among the mushrooms simply hid them. Without alpha the mist has to stay
  // low and fill the gaps BETWEEN things, letting them rise clear of it.
  const y0 = Y + between(-0.01, 0.025)

  // Per-angle wobble, fixed for this bank so the lobe is coherent rather than noisy.
  const wob = Array.from({ length: SIDES }, () => between(0.80, 1.20))
  const P = (pr, py, j) => {
    const a = (j % SIDES) / SIDES * Math.PI * 2
    const r = pr * R * wob[j % SIDES]
    return [cx + Math.cos(a) * r, y0 + py * H, cz + Math.sin(a) * r]
  }
  for (let k = 0; k < PROFILE.length - 1; k++) {
    const [r0, h0] = PROFILE[k], [r1, h1] = PROFILE[k + 1]
    for (let j = 0; j < SIDES; j++) {
      const A = P(r0, h0, j), B = P(r0, h0, j + 1), C = P(r1, h1, j + 1), D = P(r1, h1, j)
      if (r0 < 1e-6) push(A, C, D)
      else if (r1 < 1e-6) push(A, B, C)
      else { push(A, B, C); push(A, C, D) }
    }
  }
}

const doc = new Document()
const buffer = doc.createBuffer()
const scene = doc.createScene()
const prim = doc.createPrimitive()
  .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(new Float32Array(pos)).setBuffer(buffer))
  .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(new Float32Array(nor)).setBuffer(buffer))
  .setMaterial(doc.createMaterial('mist').setBaseColorFactor([...hexLinear(COLOR), 1])
    .setMetallicFactor(0).setRoughnessFactor(1))
scene.addChild(doc.createNode('mist').setMesh(doc.createMesh('mist').addPrimitive(prim)))
doc.getRoot().setDefaultScene(scene)
await new NodeIO().write(OUT, doc)

console.log(`  ${OUT.split('/').pop()} — ${COUNT} banks, ${pos.length / 9} tris, ${(fs.statSync(OUT).size / 1024).toFixed(0)}KB`)
console.log(`  hugging y=${Y}, radius ~${RADIUS}, height ~${HEIGHT}, colour ${COLOR}`)
