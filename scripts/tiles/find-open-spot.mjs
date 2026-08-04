/**
 * Find the most open spot on a tile — the point furthest from existing geometry.
 *
 *   node scripts/tiles/find-open-spot.mjs <overlay.glb> [--clear=0.12] [--count=1]
 *
 * Prints "dx dz" per line, ready to feed to compose-tile.mjs.
 *
 * Used to drop a tree onto a path tile without landing it in the road. Candidates
 * are sampled across the hex interior, each scored by its distance to the nearest
 * existing vertex, and the best is chosen. With --count>1 later picks also keep
 * clear of earlier ones, so two trees do not end up on top of each other.
 */
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'

const args = process.argv.slice(2)
const SRC = args.find(a => !a.startsWith('--'))
const flag = (n, d) => { const h = args.find(a => a.startsWith(`--${n}=`)); return h ? Number(h.split('=')[1]) : d }
if (!SRC) { console.error('usage: find-open-spot.mjs <overlay.glb> [--clear=] [--count=]'); process.exit(1) }

const CLEAR = flag('clear', 0.12)    // gap to keep from existing geometry
const RADIUS = flag('radius', 0.10)  // half-width of the prop, for the rim margin
const COUNT = flag('count', 1)
const R = 0.5774
const K = Math.PI / 3
const EDGE = R * Math.cos(Math.PI / 6)

// Inside the hex, with a margin so a prop never overhangs the rim.
const hexR = (x, z) => {
  const a = Math.atan2(z, x)
  const aa = ((a + Math.PI / 6) % K + K) % K - K / 2
  return Math.hypot(x, z) * Math.cos(aa) / EDGE
}

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
const doc = await io.read(SRC)

// Collect TRIANGLES, not loose vertices. A path square is one big quad whose only
// vertices are its corners, so scoring by distance-to-vertex called the middle of
// it wide open and parked a tree in the road. Coverage has to be measured against
// the filled footprint.
const tris = []
for (const scene of doc.getRoot().listScenes()) {
  scene.traverse(node => {
    const mesh = node.getMesh(); if (!mesh) return
    const m = node.getWorldMatrix(); const v = [0, 0, 0]
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION'); if (!pos) continue
      const flat = []
      for (let i = 0; i < pos.getCount(); i++) {
        pos.getElement(i, v)
        flat.push([
          m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12],
          m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14],
        ])
      }
      const idx = prim.getIndices()
      if (idx) {
        for (let i = 0; i + 2 < idx.getCount(); i += 3) {
          tris.push([flat[idx.getScalar(i)], flat[idx.getScalar(i + 1)], flat[idx.getScalar(i + 2)]])
        }
      } else {
        for (let i = 0; i + 2 < flat.length; i += 3) tris.push([flat[i], flat[i + 1], flat[i + 2]])
      }
    }
  })
}

/** Distance from a point to a segment, in XZ. */
function distSeg(px, pz, a, b) {
  const dx = b[0] - a[0], dz = b[1] - a[1]
  const L = dx * dx + dz * dz
  let t = L ? ((px - a[0]) * dx + (pz - a[1]) * dz) / L : 0
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(px - (a[0] + t * dx), pz - (a[1] + t * dz))
}

/** 0 when the point is inside the footprint, else distance to its nearest edge. */
function distToFootprint(px, pz) {
  let best = Infinity
  for (const [a, b, c] of tris) {
    // Barycentric inside test in XZ.
    const d = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1])
    if (Math.abs(d) > 1e-12) {
      const w1 = ((b[1] - c[1]) * (px - c[0]) + (c[0] - b[0]) * (pz - c[1])) / d
      const w2 = ((c[1] - a[1]) * (px - c[0]) + (a[0] - c[0]) * (pz - c[1])) / d
      const w3 = 1 - w1 - w2
      if (w1 >= 0 && w2 >= 0 && w3 >= 0) return 0
    }
    best = Math.min(best, distSeg(px, pz, a, b), distSeg(px, pz, b, c), distSeg(px, pz, c, a))
  }
  return best
}

const chosen = []
for (let n = 0; n < COUNT; n++) {
  let best = null, bestScore = -Infinity
  const STEP = 0.02
  for (let x = -0.5; x <= 0.5; x += STEP) {
    for (let z = -0.55; z <= 0.55; z += STEP) {
      // Keep the whole prop inside the hex.
      if (hexR(x, z) > 1 - RADIUS / EDGE) continue
      let d = distToFootprint(x, z)
      if (d < CLEAR) continue                    // would overlap the path
      for (const [cx, cz] of chosen) d = Math.min(d, Math.hypot(x - cx, z - cz))
      // Prefer open ground, but nudge toward the rim so props frame the path
      // rather than sitting dead centre when the tile happens to be empty.
      const score = d + 0.15 * hexR(x, z)
      if (score > bestScore) { bestScore = score; best = [x, z] }
    }
  }
  if (!best) break
  chosen.push(best)
  console.log(`${best[0].toFixed(3)} ${best[1].toFixed(3)}`)
}
