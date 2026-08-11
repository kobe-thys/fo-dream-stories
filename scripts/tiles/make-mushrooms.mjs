/**
 * A patch of mushrooms, as solids of revolution.
 *
 *   node scripts/tiles/make-mushrooms.mjs <out.glb> [--y=0.20] [--count=5]
 *        [--spread=0.30] [--size=0.28] [--seed=3] [--sides=10]
 *
 * A mushroom is a lathe: one 2D profile spun about Y. The profile deliberately
 * overhangs -- it flares OUT and slightly DOWN at the cap rim before doming over --
 * which is what gives the gills-side undercut that makes it read as a mushroom
 * rather than a lollipop.
 *
 * Stem and cap are separate primitives so they can carry different colours from one
 * shared profile, split at CAP_START.
 *
 * Flat-shaded to match the Kenney kit, and seeded so a tile rebuilds identically.
 */
import { Document, NodeIO } from '@gltf-transform/core'
import fs from 'fs'

const args = process.argv.slice(2)
const OUT = args.find(a => !a.startsWith('--'))
const flag = (n, d) => { const h = args.find(a => a.startsWith(`--${n}=`)); return h ? h.split('=')[1] : d }
const num = (n, d) => Number(flag(n, d))
if (!OUT) { console.error('usage: make-mushrooms.mjs <out.glb> [--y=] [--count=] ...'); process.exit(1) }

const Y = num('y', 0.20)
const COUNT = Math.max(1, Math.round(num('count', 5)))
const SPREAD = num('spread', 0.30)
const SIZE = num('size', 0.28)
const SIDES = Math.max(6, Math.round(num('sides', 10)))
let seed = Math.round(num('seed', 3))

const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 }
const between = (a, b) => a + (b - a) * rnd()
const pick = arr => arr[Math.floor(rnd() * arr.length) % arr.length]

const srgbToLinear = c => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))
const hexLinear = hex => {
  const n = parseInt(hex.replace('#', ''), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => srgbToLinear(v / 255))
}

// [radius, height]. Index >= CAP_START belongs to the cap.
const PROFILE = [
  [0.00, 0.00],
  [0.115, 0.00],
  [0.090, 0.16],
  [0.082, 0.34],
  [0.088, 0.50],   // slight swell where the cap sits
  [0.300, 0.545],  // <- CAP_START: flares out, still low = the undercut
  [0.345, 0.615],
  [0.330, 0.700],
  [0.235, 0.800],
  [0.110, 0.865],
  [0.00, 0.885],
]
const CAP_START = 5

const CAPS = ['#d1584f', '#e08a3c', '#b45fa8', '#d9b23f', '#c9584f']
const STEMS = ['#efe3cf', '#e6d8c0', '#f2e9da']

/** Revolve a profile slice into flat-shaded triangles. */
function lathe(profile, i0, i1, sides, out, place) {
  const push = (a, b, c) => {
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
    const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]
    let nx = u[1] * v[2] - u[2] * v[1], ny = u[2] * v[0] - u[0] * v[2], nz = u[0] * v[1] - u[1] * v[0]
    const L = Math.hypot(nx, ny, nz) || 1
    for (const p of [a, b, c]) {
      const q = place(p)
      out.pos.push(q[0], q[1], q[2])
      out.nor.push(nx / L, ny / L, nz / L)   // direction only; uniform scale keeps it valid
    }
  }
  for (let i = i0; i < i1; i++) {
    const [r0, y0] = profile[i], [r1, y1] = profile[i + 1]
    for (let j = 0; j < sides; j++) {
      const a0 = (j / sides) * Math.PI * 2, a1 = ((j + 1) / sides) * Math.PI * 2
      const P = (r, y, a) => [Math.cos(a) * r, y, Math.sin(a) * r]
      const A = P(r0, y0, a0), B = P(r0, y0, a1), C = P(r1, y1, a1), D = P(r1, y1, a0)
      if (r0 < 1e-6) push(A, C, D)             // degenerate at the axis
      else if (r1 < 1e-6) push(A, B, C)
      else { push(A, B, C); push(A, C, D) }
    }
  }
}

const stem = { pos: [], nor: [] }
// One primitive PER CAP COLOUR. A single cap primitive silently collapsed the whole
// patch to one colour -- the variety was generated and then thrown away.
const capsByColour = new Map()
const tops = []

for (let i = 0; i < COUNT; i++) {
  const s = SIZE * between(0.62, 1.15)
  const ang = between(0, Math.PI * 2)
  const rad = SPREAD * Math.sqrt(between(0.06, 1))
  const px = Math.cos(ang) * rad, pz = Math.sin(ang) * rad
  const lean = between(-0.16, 0.16)          // a straight row of mushrooms looks planted
  const leanDir = between(0, Math.PI * 2)
  const yaw = between(0, Math.PI * 2)
  const cl = Math.cos(lean), sl = Math.sin(lean)
  const cd = Math.cos(leanDir), sd = Math.sin(leanDir)

  const place = p => {
    let [x, y, z] = [p[0] * s, p[1] * s, p[2] * s]
    // tilt about the horizontal axis perpendicular to leanDir
    const dx = x * cd + z * sd, dz = -x * sd + z * cd
    const tx = dx * cl + y * sl, ty = -dx * sl + y * cl
    x = tx * cd - dz * sd; z = tx * sd + dz * cd
    const cy = Math.cos(yaw), sy = Math.sin(yaw)
    return [px + x * cy + z * sy, Y + ty, pz - x * sy + z * cy]
  }
  // Report where each cap ends up, so a note cloud can be placed on top of a
  // specific mushroom rather than floating vaguely over the patch.
  const capTop = place([0, PROFILE[PROFILE.length - 1][1], 0])
  tops.push(capTop.map(v => v.toFixed(3)).join(','))
  const hex = pick(CAPS)
  if (!capsByColour.has(hex)) capsByColour.set(hex, { pos: [], nor: [] })
  lathe(PROFILE, 0, CAP_START, SIDES, stem, place)
  lathe(PROFILE, CAP_START, PROFILE.length - 1, SIDES, capsByColour.get(hex), place)
}

const doc = new Document()
const buffer = doc.createBuffer()
const scene = doc.createScene()
const mesh = doc.createMesh('mushrooms')
const mk = (data, name, hex) => doc.createPrimitive()
  .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(new Float32Array(data.pos)).setBuffer(buffer))
  .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(new Float32Array(data.nor)).setBuffer(buffer))
  .setMaterial(doc.createMaterial(name).setBaseColorFactor([...hexLinear(hex), 1])
    .setMetallicFactor(0).setRoughnessFactor(1))

mesh.addPrimitive(mk(stem, 'mushroom-stem', STEMS[0]))
for (const [hex, data] of capsByColour) mesh.addPrimitive(mk(data, `mushroom-cap-${hex.slice(1)}`, hex))
scene.addChild(doc.createNode('mushrooms').setMesh(mesh))
doc.getRoot().setDefaultScene(scene)
await new NodeIO().write(OUT, doc)

const tris = ([...capsByColour.values()].reduce((n, d) => n + d.pos.length, stem.pos.length)) / 9
console.log(`  ${OUT.split('/').pop()} — ${COUNT} mushrooms, ${tris} tris, ${(fs.statSync(OUT).size / 1024).toFixed(0)}KB`)
console.log(`  cap tops: ${tops.join('  ')}`)
console.log(`  on y=${Y}, spread ${SPREAD}, cap colours ${[...capsByColour.keys()].join(' ')}`)
