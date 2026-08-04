/**
 * Bake an overlay onto a terrain tile, producing one standalone tile.
 *
 *   node scripts/tiles/compose-tile.mjs <base.glb> <overlay.glb> <out.glb> [--lift=auto] [--rot=0] [--dx=0] [--dz=0]
 *
 * Kenney ships path and unit pieces separately from the tiles they belong on: the
 * decals sit at y=0..0.025 and the tiles top out at y=0.200, so a piece dropped in
 * as-is lies buried inside the ground. This lifts the overlay onto the base's plate
 * and merges the two into a single GLB the map can place like any other tile.
 *
 *   --lift  height to raise the overlay to. "auto" measures the base's plate top.
 *   --rot   overlay rotation in 60-degree steps, so a path can face any hex edge.
 *   --dx/dz nudge the overlay across the tile.
 *
 * Both inputs reference the same external Textures/colormap.png, so dedup() folds
 * the duplicate material away after merging.
 */
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { dedup, prune, mergeDocuments } from '@gltf-transform/functions'
import fs from 'fs'
import path from 'path'

const args = process.argv.slice(2)
const [BASE, OVERLAY, OUT] = args.filter(a => !a.startsWith('--'))
const flag = (n, d) => { const h = args.find(a => a.startsWith(`--${n}=`)); return h ? h.split('=')[1] : d }

if (!BASE || !OVERLAY || !OUT) {
  console.error('usage: compose-tile.mjs <base.glb> <overlay.glb> <out.glb> [--lift=auto] [--rot=0] [--dx=] [--dz=]')
  process.exit(1)
}

const ROT = Number(flag('rot', 0)) * Math.PI / 3     // hex steps
const DX = Number(flag('dx', 0))
const DZ = Number(flag('dz', 0))
const EPS = 0.001                                     // sink slightly to avoid z-fighting

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
const base = await io.read(BASE)
const overlay = await io.read(OVERLAY)

/** World-space vertex positions of a document. */
function positionsOf(doc) {
  const out = []
  for (const scene of doc.getRoot().listScenes()) {
    scene.traverse(node => {
      const mesh = node.getMesh(); if (!mesh) return
      const m = node.getWorldMatrix(); const v = [0, 0, 0]
      for (const prim of mesh.listPrimitives()) {
        const pos = prim.getAttribute('POSITION'); if (!pos) continue
        for (let i = 0; i < pos.getCount(); i++) {
          pos.getElement(i, v)
          out.push([
            m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12],
            m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13],
            m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14],
          ])
        }
      }
    })
  }
  return out
}

let lift = flag('lift', 'auto')
if (lift === 'auto') {
  let top = -Infinity
  for (const p of positionsOf(base)) if (p[1] > top) top = p[1]
  lift = top - EPS
} else {
  lift = Number(lift)
}

// Bake the transform into the overlay's vertices before merging: simpler than
// reconciling node hierarchies across two documents.
const seen = new Set()
for (const mesh of overlay.getRoot().listMeshes()) {
  for (const prim of mesh.listPrimitives()) {
    const pos = prim.getAttribute('POSITION')
    if (!pos || seen.has(pos)) continue
    seen.add(pos)
    const arr = pos.getArray().slice()
    const c = Math.cos(ROT), s = Math.sin(ROT)
    for (let i = 0; i < arr.length; i += 3) {
      const x = arr[i], z = arr[i + 2]
      arr[i]     = x * c - z * s + DX
      arr[i + 1] = arr[i + 1] + lift
      arr[i + 2] = x * s + z * c + DZ
    }
    pos.setArray(arr)
  }
}

// Merge, then fold the overlay's scene into the base scene so the result has one.
const baseScene = base.getRoot().getDefaultScene() || base.getRoot().listScenes()[0]
const before = new Set(base.getRoot().listScenes())
mergeDocuments(base, overlay)
for (const scene of base.getRoot().listScenes()) {
  if (before.has(scene)) continue
  for (const node of scene.listChildren()) baseScene.addChild(node)
  scene.dispose()
}
base.getRoot().setDefaultScene(baseScene)

// Merging brings the overlay's buffer along, and a GLB may hold only one. Point
// every accessor at the first buffer and drop the rest.
const buffers = base.getRoot().listBuffers()
for (const acc of base.getRoot().listAccessors()) acc.setBuffer(buffers[0])
for (const b of buffers.slice(1)) b.dispose()

await base.transform(dedup(), prune())
await io.write(OUT, base)

const tris = base.getRoot().listMeshes()
  .flatMap(m => m.listPrimitives())
  .reduce((n, p) => n + (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3, 0)

console.log(`  ${path.basename(BASE)} + ${path.basename(OVERLAY)} -> ${path.basename(OUT)}`)
console.log(`  lift ${Number(lift).toFixed(3)}${ROT ? `, rot ${flag('rot', 0)}×60°` : ''}` +
            `  ${Math.round(tris).toLocaleString()} tris, ${(fs.statSync(OUT).size / 1024).toFixed(0)}KB`)
