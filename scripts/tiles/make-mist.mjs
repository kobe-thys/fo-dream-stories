/**
 * Mist as suspended droplets — many tiny opaque spheres, not solid lobes.
 *
 *   node scripts/tiles/make-mist.mjs <out.glb> [--count=140] [--radius=0.011]
 *        [--spread=0.40] [--low=0.205] [--top=0.55] [--bias=2.2]
 *        [--color=#e8f1f6] [--seed=11] [--sides=6] [--rings=3]
 *
 * WHY DROPLETS
 * Real fog is water suspended in air, and that turns out to be the trick here too.
 * Alpha does not survive into this app -- both tile renderers overwrite it
 * (DreamerHexTile forces transparent=false, opacity=1; AdminHexTile drives opacity
 * from tile state) -- so translucent mist renders solid.
 *
 * An earlier version used solid lobes and failed twice over: flat on the ground it
 * read as spilled paint, and lifted to drift among the mushrooms it simply HID
 * them. Opaque volume occludes whatever it overlaps, and no amount of tuning fixes
 * that.
 *
 * Many small separated spheres give POROSITY instead. Each droplet is opaque, but
 * you see between them, so the subject stays visible through the mist. Density
 * falls off with height (--bias), the way mist actually settles.
 *
 * Each droplet is a very low-poly UV sphere: at this size it only has to read as a
 * dot, so ~24 triangles each is plenty.
 */
import { Document, NodeIO } from '@gltf-transform/core'
import fs from 'fs'

const args = process.argv.slice(2)
const OUT = args.find(a => !a.startsWith('--'))
const flag = (n, d) => { const h = args.find(a => a.startsWith(`--${n}=`)); return h ? h.split('=')[1] : d }
const num = (n, d) => Number(flag(n, d))
if (!OUT) { console.error('usage: make-mist.mjs <out.glb> [--count=] [--radius=] ...'); process.exit(1) }

const COUNT = Math.max(1, Math.round(num('count', 140)))
const RADIUS = num('radius', 0.011)
const SPREAD = num('spread', 0.40)
const LOW = num('low', 0.205)
const TOP = num('top', 0.55)
const BIAS = num('bias', 2.2)          // >1 crowds droplets toward the ground
const COLOR = flag('color', '#e8f1f6')
const SIDES = Math.max(4, Math.round(num('sides', 6)))
const RINGS = Math.max(2, Math.round(num('rings', 3)))
const seed = Math.round(num('seed', 11))

// mulberry32. The previous LCG correlated consecutive draws badly enough that all
// eight mushrooms landed in the same half of the tile — with several values pulled
// per item, a weak generator shows up as visible clustering.
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0
    let t = Math.imul(a ^ a >>> 15, 1 | a)
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}
const rnd = mulberry32(seed)
const between = (a, b) => a + (b - a) * rnd()

const srgbToLinear = c => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))
const hexLinear = hex => {
  const n = parseInt(hex.replace('#', ''), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => srgbToLinear(v / 255))
}

const R = 0.5774, EDGE = R * Math.cos(Math.PI / 6), K = Math.PI / 3
const hexR = (x, z) => {
  const a = Math.atan2(z, x)
  const aa = ((a + Math.PI / 6) % K + K) % K - K / 2
  return Math.hypot(x, z) * Math.cos(aa) / EDGE
}

// INDEXED with SMOOTH normals. Flat shading suits the kit for big forms, but a
// droplet only has to read as a round dot -- smooth is both rounder and far
// cheaper, since vertices are shared instead of tripled per face. Non-indexed flat
// droplets cost 845 KB for 500; this is a fraction of that.
const pos = [], nor = [], idx = []

function droplet(cx, cy, cz, r) {
  const base = pos.length / 3
  for (let ring = 0; ring <= RINGS; ring++) {
    const t = (ring / RINGS) * Math.PI
    for (let j = 0; j < SIDES; j++) {
      const a = (j / SIDES) * Math.PI * 2
      const nx = Math.sin(t) * Math.cos(a), ny = -Math.cos(t), nz = Math.sin(t) * Math.sin(a)
      pos.push(cx + nx * r, cy + ny * r, cz + nz * r)
      nor.push(nx, ny, nz)                               // unit sphere normal
    }
  }
  for (let ring = 0; ring < RINGS; ring++) {
    for (let j = 0; j < SIDES; j++) {
      const a = base + ring * SIDES + j
      const b = base + ring * SIDES + (j + 1) % SIDES
      const c = base + (ring + 1) * SIDES + (j + 1) % SIDES
      const d = base + (ring + 1) * SIDES + j
      idx.push(a, c, d, a, b, c)
    }
  }
}

let placed = 0, aloft = 0
for (let i = 0; i < COUNT * 4 && placed < COUNT; i++) {
  const ang = between(0, Math.PI * 2)
  const rad = SPREAD * Math.sqrt(between(0, 1))
  const x = Math.cos(ang) * rad, z = Math.sin(ang) * rad
  if (hexR(x, z) > 0.93) continue                        // keep droplets on the tile
  // Biased low: mist settles, with only a few wisps up at cap height.
  const y = LOW + (TOP - LOW) * Math.pow(between(0, 1), BIAS)
  // Slightly bigger droplets low down, where mist looks densest.
  const r = RADIUS * between(0.6, 1.35) * (1 - 0.3 * ((y - LOW) / (TOP - LOW)))
  droplet(x, y, z, r)
  placed++
  if (y > 0.40) aloft++
}

const doc = new Document()
const buffer = doc.createBuffer()
const scene = doc.createScene()
const prim = doc.createPrimitive()
  .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(new Float32Array(pos)).setBuffer(buffer))
  .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(new Float32Array(nor)).setBuffer(buffer))
  .setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(idx)).setBuffer(buffer))
  .setMaterial(doc.createMaterial('mist').setBaseColorFactor([...hexLinear(COLOR), 1])
    .setMetallicFactor(0).setRoughnessFactor(1))
scene.addChild(doc.createNode('mist').setMesh(doc.createMesh('mist').addPrimitive(prim)))
doc.getRoot().setDefaultScene(scene)
await new NodeIO().write(OUT, doc)

console.log(`  ${OUT.split('/').pop()} — ${placed} droplets, ${idx.length / 3} tris, ${(fs.statSync(OUT).size / 1024).toFixed(0)}KB`)
console.log(`  y ${LOW}..${TOP}, ${aloft} above 0.40 (cap height), radius ~${RADIUS}, colour ${COLOR}`)
