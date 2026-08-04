/**
 * Normalize a hex tile GLB to the Kenney contract.
 *
 *   node scripts/tiles/normalize-tile.mjs <input.glb> <output.glb> [options]
 *
 *   --budget=N        triangle budget (default 8000)
 *   --texture=N       max texture edge in px (default 1024)
 *   --base-top=Y      where the base plate ends in the SOURCE model. Give this for
 *                     tall models (trees) -- the automatic guess picks canopy.
 *   --surface=Y       trim the base so the tile's main surface sits at height Y
 *                     (Kenney water/grass surfaces are at 0.100)
 *   --match-water     re-tint the artwork's water to Kenney's #8fdbff
 *   --palette-lock    remap the whole texture to Kenney's colormap palette
 *   --rebuild-base    discard the generated base and graft on an exact hex prism
 *                     (requires --surface; the only reliable fix for a deformed base)
 *   --dry-run         measure and report, write nothing
 *
 * WHY THE STAGE ORDER MATTERS
 * Simplification moves vertices, including the hex corners. Measuring rotation
 * after simplifying gives garbage (an early spike landed a tile 5 degrees out).
 * So: measure orientation at full resolution, correct it, simplify, then
 * re-measure scale and centre and apply a second corrective pass.
 *
 * TEXTURES ARE PNG, NOT WEBP, ON PURPOSE
 * gltf-transform defaults to EXT_texture_webp. Browsers and three.js handle it,
 * but Blender's glTF importer does not read it reliably -- the model opens
 * untextured, which makes the files useless for inspection. PNG costs a little
 * size and keeps the round-trip working.
 */
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { dedup, weld, simplify, textureCompress, prune } from '@gltf-transform/functions'
import { MeshoptSimplifier } from 'meshoptimizer'
import sharp from 'sharp'
import fs from 'fs'
import path from 'path'

const KENNEY_R = 0.5774                                  // measured from grass.glb
const KENNEY_WATER = { r: 0x8f, g: 0xdb, b: 0xff }
const COLORMAP = 'public/models/Textures/colormap.png'
const TOLERANCE = 0.001

const args = process.argv.slice(2)
const [SRC, DST] = args.filter(a => !a.startsWith('--'))
const flag = (n, d) => { const h = args.find(a => a.startsWith(`--${n}=`)); return h ? h.split('=')[1] : d }
const has = n => args.includes(`--${n}`)

if (!SRC) {
  console.error('usage: normalize-tile.mjs <in.glb> <out.glb> [--budget=8000] [--surface=0.1] [--match-water] [--palette-lock] [--dry-run]')
  process.exit(1)
}
const BUDGET = Number(flag('budget', 8000))
const TEXTURE_MAX = Number(flag('texture', 1024))
const SURFACE = flag('surface', null) === null ? null : Number(flag('surface', null))
// Where the base plate ENDS in the source model. Optional, but the dominant-band
// heuristic guesses badly on tall models -- on a big tree the densest band is
// canopy, which scaled the mother tree 6% small and made syrup-tree delete itself.
const BASE_TOP = flag('base-top', null) === null ? null : Number(flag('base-top', null))

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
const doc = await io.read(SRC)
const root = doc.getRoot()

// ── geometry helpers ───────────────────────────────────────────────────────

function worldPositions() {
  const pts = []
  for (const scene of root.listScenes()) scene.traverse(node => {
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
  return pts
}

function measure() {
  const P = worldPositions()
  let ymin = Infinity, ymax = -Infinity
  for (const p of P) { if (p[1] < ymin) ymin = p[1]; if (p[1] > ymax) ymax = p[1] }

  const band = P.filter(p => p[1] <= ymin + 0.02 * (ymax - ymin))
  const cx = band.reduce((s, p) => s + p[0], 0) / band.length
  const cz = band.reduce((s, p) => s + p[2], 0) / band.length
  let R = 0
  for (const p of band) R = Math.max(R, Math.hypot(p[0] - cx, p[2] - cz))

  // Circular mean over the hexagon's 6-fold symmetry. Averaging angles mod 60
  // wraps catastrophically: 59 and 1 average to 30 instead of 0.
  let sc = 0, ss = 0
  for (const p of band) {
    if (Math.hypot(p[0] - cx, p[2] - cz) < R * 0.98) continue
    const a = Math.atan2(p[2] - cz, p[0] - cx) * 6
    sc += Math.cos(a); ss += Math.sin(a)
  }
  const meanDeg = ((Math.atan2(ss, sc) / 6) * 180 / Math.PI + 360) % 60
  const rotOffset = ((meanDeg - 30 + 90) % 60) - 30

  // Dominant surface = the height band holding the most vertices. For these
  // tiles that is the flat water/ground plate.
  const BINS = 60
  const hist = new Array(BINS).fill(0)
  for (const p of P) hist[Math.min(BINS - 1, Math.floor((p[1] - ymin) / (ymax - ymin || 1) * BINS))]++
  const surface = ymin + (hist.indexOf(Math.max(...hist)) + 0.5) / BINS * (ymax - ymin)

  return { cx, cz, R, rotOffset, ymin, ymax, surface }
}

function applyCorrection({ scale, rotDeg, tx, ty, tz }) {
  const th = rotDeg * Math.PI / 180
  for (const scene of root.listScenes()) {
    const originals = scene.listChildren()
    const T = doc.createNode('recentre').setTranslation([tx, ty, tz])
    for (const o of originals) T.addChild(o)
    const W = doc.createNode('normalize')
      .setScale([scale, scale, scale])
      .setRotation([0, Math.sin(th / 2), 0, Math.cos(th / 2)])
    W.addChild(T)
    scene.addChild(W)
  }
}

/**
 * Bake node transforms into vertex data so later steps can edit positions
 * directly.
 *
 * Every world matrix must be read BEFORE anything is mutated, and then EVERY
 * node must be reset -- including the transform-only wrappers applyCorrection
 * creates. Resetting just the mesh-bearing nodes leaves those wrappers live, so
 * the correction gets applied twice and the tile lands nowhere near the grid.
 */
function bakeTransforms() {
  const jobs = []
  const allNodes = []
  for (const scene of root.listScenes()) scene.traverse(node => {
    allNodes.push(node)
    const mesh = node.getMesh()
    if (mesh) jobs.push([mesh, node.getWorldMatrix()])
  })

  const seen = new Set()
  for (const [mesh, m] of jobs) {
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION')
      if (!pos || seen.has(pos)) continue
      seen.add(pos)
      const arr = pos.getArray().slice()
      for (let i = 0; i < arr.length; i += 3) {
        const [x, y, z] = [arr[i], arr[i + 1], arr[i + 2]]
        arr[i]     = m[0] * x + m[4] * y + m[8] * z + m[12]
        arr[i + 1] = m[1] * x + m[5] * y + m[9] * z + m[13]
        arr[i + 2] = m[2] * x + m[6] * y + m[10] * z + m[14]
      }
      pos.setArray(arr)
      // Rotation also applies to normals; uniform scale does not change direction.
      const nrm = prim.getAttribute('NORMAL')
      if (nrm && !seen.has(nrm)) {
        seen.add(nrm)
        const na = nrm.getArray().slice()
        for (let i = 0; i < na.length; i += 3) {
          const [x, y, z] = [na[i], na[i + 1], na[i + 2]]
          let nx = m[0] * x + m[4] * y + m[8] * z
          let ny = m[1] * x + m[5] * y + m[9] * z
          let nz = m[2] * x + m[6] * y + m[10] * z
          const len = Math.hypot(nx, ny, nz) || 1
          na[i] = nx / len; na[i + 1] = ny / len; na[i + 2] = nz / len
        }
        nrm.setArray(na)
      }
    }
  }

  for (const node of allNodes) {
    node.setTranslation([0, 0, 0]).setRotation([0, 0, 0, 1]).setScale([1, 1, 1])
  }
}

/**
 * Compress the base band so the tile's surface lands at `target`, leaving
 * everything above the surface at its original proportions. Squashing the whole
 * tile in Y would flatten the artwork; this only thins the plinth.
 */
function trimBase(surface, target) {
  const k = target / surface
  const seen = new Set()
  for (const mesh of root.listMeshes()) for (const prim of mesh.listPrimitives()) {
    const pos = prim.getAttribute('POSITION')
    if (!pos || seen.has(pos)) continue
    seen.add(pos)
    const arr = pos.getArray().slice()
    for (let i = 1; i < arr.length; i += 3) {
      arr[i] = arr[i] <= surface ? arr[i] * k : arr[i] - surface + target
    }
    pos.setArray(arr)
  }
}

/** How close the base outline is to a regular hexagon. 0.866 is perfect. */
function hexRegularity(plateTop) {
  const pts = worldPositions().filter(p => p[1] <= plateTop)
  if (!pts.length) return { ratio: 1, min: 0, max: 0 }
  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length
  const cz = pts.reduce((s, p) => s + p[2], 0) / pts.length
  const bins = new Array(36).fill(0)
  for (const p of pts) {
    const a = Math.atan2(p[2] - cz, p[0] - cx)
    const k = Math.min(35, Math.floor(((a * 180 / Math.PI + 360) % 360) / 10))
    bins[k] = Math.max(bins[k], Math.hypot(p[0] - cx, p[2] - cz))
  }
  const seen = bins.filter(v => v > 0)
  return { ratio: Math.min(...seen) / Math.max(...seen), min: Math.min(...seen), max: Math.max(...seen) }
}

/**
 * Throw away the generated base and graft on an exact hex prism.
 *
 * Image-to-3D output does not produce regular hexagons -- measured outline
 * regularity has been as low as 0.713 against a perfect hexagon's 0.866, and
 * lopsided (0.40 on one side, 0.56 on the other). Scaling such a base so its
 * widest corner is right still leaves the narrow sides ~6% short, which reads as
 * gaps between tiles. No amount of scaling fixes a shape that is not a hexagon,
 * so the base is rebuilt from maths instead: pointy-top, R = 0.5774, corners at
 * 30 degrees, walls from y=0 to the surface height. The artwork above the
 * surface is untouched.
 *
 * Colours are sampled from the original base and snapped to Kenney's palette, so
 * the new prism keeps the tile's own look.
 */
async function rebuildBase(surface, palette) {
  // 1. Sample the colours of the base we are about to discard.
  //    Sample the OUTER wall, not everything below the surface: these models are
  //    hollow underneath, and averaging in that dark cavity turns a tan or grassy
  //    band into grey. Likewise take the top colour from the surface's outer ring,
  //    since the middle is occupied by the artwork itself.
  const rad = p => Math.hypot(p[0], p[2])
  const sideRGB = await sampleColour(
    p => p[1] > surface * 0.15 && p[1] < surface * 0.9 && rad(p) > KENNEY_R * 0.75, palette)
  const topRGB = await sampleColour(
    p => p[1] >= surface * 0.9 && p[1] <= surface * 1.2 && rad(p) > KENNEY_R * 0.5, palette)

  // 2. Drop every triangle that lies entirely below the surface.
  let removed = 0, kept = 0
  for (const mesh of root.listMeshes()) for (const prim of mesh.listPrimitives()) {
    const pos = prim.getAttribute('POSITION')
    const idx = prim.getIndices()
    if (!pos || !idx) continue
    const P = pos.getArray()
    const I = idx.getArray()
    const out = []
    for (let t = 0; t < I.length; t += 3) {
      const above = [0, 1, 2].some(k => P[I[t + k] * 3 + 1] > surface * 1.02)
      if (above) { out.push(I[t], I[t + 1], I[t + 2]); kept++ } else removed++
    }
    idx.setArray(new (I.constructor)(out))
  }

  // 3. Build the exact prism.
  const R = KENNEY_R
  const corner = i => {
    const a = (30 + i * 60) * Math.PI / 180
    return [R * Math.cos(a), R * Math.sin(a)]
  }
  // Two parts, because they are not the same colour: the walls read as the
  // tile's edge, the top cap has to read as a continuation of the artwork's own
  // surface. Painting the cap with the wall colour leaves a visible ring around
  // the artwork wherever the artwork does not reach the hex edge.
  const verts = [], indices = []
  const push = (x, y, z) => { verts.push(x, y, z); return verts.length / 3 - 1 }
  const capVerts = [], capIndices = []
  const pushCap = (x, y, z) => { capVerts.push(x, y, z); return capVerts.length / 3 - 1 }

  // walls
  for (let i = 0; i < 6; i++) {
    const [x0, z0] = corner(i), [x1, z1] = corner((i + 1) % 6)
    const a = push(x0, 0, z0), b = push(x1, 0, z1)
    const c = push(x1, surface, z1), d = push(x0, surface, z0)
    indices.push(a, b, c, a, c, d)
  }
  // bottom cap
  const botC = push(0, 0, 0)
  for (let i = 0; i < 6; i++) {
    const [x0, z0] = corner(i), [x1, z1] = corner((i + 1) % 6)
    indices.push(botC, push(x0, 0, z0), push(x1, 0, z1))
  }
  // top cap, tucked just under the artwork's own surface to avoid z-fighting
  const topC = pushCap(0, surface - 0.002, 0)
  for (let i = 0; i < 6; i++) {
    const [x0, z0] = corner(i), [x1, z1] = corner((i + 1) % 6)
    capIndices.push(topC, pushCap(x1, surface - 0.002, z1), pushCap(x0, surface - 0.002, z0))
  }

  const buf = root.listBuffers()[0] ?? doc.createBuffer()
  const mat = doc.createMaterial('hexBase')
    .setBaseColorFactor([sideRGB[0] / 255, sideRGB[1] / 255, sideRGB[2] / 255, 1])
    .setRoughnessFactor(1).setMetallicFactor(0)
  const prim = doc.createPrimitive()
    .setAttribute('POSITION', doc.createAccessor().setType('VEC3')
      .setArray(new Float32Array(verts)).setBuffer(buf))
    .setIndices(doc.createAccessor().setType('SCALAR')
      .setArray(new Uint32Array(indices)).setBuffer(buf))
    .setMaterial(mat)

  const capMat = doc.createMaterial('hexBaseTop')
    .setBaseColorFactor([topRGB[0] / 255, topRGB[1] / 255, topRGB[2] / 255, 1])
    .setRoughnessFactor(1).setMetallicFactor(0)
  const capPrim = doc.createPrimitive()
    .setAttribute('POSITION', doc.createAccessor().setType('VEC3')
      .setArray(new Float32Array(capVerts)).setBuffer(buf))
    .setIndices(doc.createAccessor().setType('SCALAR')
      .setArray(new Uint32Array(capIndices)).setBuffer(buf))
    .setMaterial(capMat)

  const mesh = doc.createMesh('hexBase').addPrimitive(prim).addPrimitive(capPrim)
  root.listScenes()[0].addChild(doc.createNode('hexBase').setMesh(mesh))

  const hex = c => `#${c.map(v => v.toString(16).padStart(2, '0')).join('')}`
  console.log(`  rebuild base: dropped ${removed.toLocaleString()} base triangles, kept ${kept.toLocaleString()}; prism side ${hex(sideRGB)} top ${hex(topRGB)}`)
}

/** Average texture colour of vertices matching a predicate, snapped to Kenney's palette. */
async function sampleColour(predicate, palette) {
  const tex = root.listTextures()[0]
  let acc = [0, 0, 0], n = 0
  if (tex?.getImage()) {
    const { data, info } = await sharp(Buffer.from(tex.getImage())).ensureAlpha().raw()
      .toBuffer({ resolveWithObject: true })
    for (const mesh of root.listMeshes()) for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION'), uv = prim.getAttribute('TEXCOORD_0')
      if (!pos || !uv) continue
      const p = [0, 0, 0], t = [0, 0]
      for (let i = 0; i < pos.getCount(); i++) {
        pos.getElement(i, p)
        if (!predicate(p)) continue
        uv.getElement(i, t)
        const x = Math.min(info.width - 1, Math.max(0, Math.round((t[0] % 1) * info.width)))
        const y = Math.min(info.height - 1, Math.max(0, Math.round((t[1] % 1) * info.height)))
        const o = (y * info.width + x) * 4
        acc[0] += data[o]; acc[1] += data[o + 1]; acc[2] += data[o + 2]; n++
      }
    }
  }
  if (!n) return [150, 150, 150]
  const avg = acc.map(v => Math.round(v / n))
  if (!palette) return avg
  let best = avg, bestD = Infinity
  for (const c of palette) {
    const d = (c[0] - avg[0]) ** 2 + (c[1] - avg[1]) ** 2 + (c[2] - avg[2]) ** 2
    if (d < bestD) { bestD = d; best = c }
  }
  return best
}

/**
 * Final footprint correction, applied to X and Z only so it cannot undo the
 * height work done by trimBase.
 *
 * The footprint is taken as the widest extent anywhere in the base plate, not
 * from a thin slice at the very bottom -- these tiles have a bevelled underside,
 * so sampling only the lowest vertices reads ~2% narrow than the true hex.
 */
function fixFootprintXZ(plateTop) {
  const pts = worldPositions().filter(p => p[1] <= plateTop)
  if (!pts.length) return
  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length
  const cz = pts.reduce((s, p) => s + p[2], 0) / pts.length
  let R = 0
  for (const p of pts) R = Math.max(R, Math.hypot(p[0] - cx, p[2] - cz))
  const s = KENNEY_R / R

  const seen = new Set()
  for (const mesh of root.listMeshes()) for (const prim of mesh.listPrimitives()) {
    const pos = prim.getAttribute('POSITION')
    if (!pos || seen.has(pos)) continue
    seen.add(pos)
    const arr = pos.getArray().slice()
    for (let i = 0; i < arr.length; i += 3) {
      arr[i]     = (arr[i] - cx) * s
      arr[i + 2] = (arr[i + 2] - cz) * s
    }
    pos.setArray(arr)
  }
  console.log(`  footprint fix: R ${R.toFixed(4)} -> ${KENNEY_R} (x${s.toFixed(4)}), recentred`)
}

// ── texture helpers ────────────────────────────────────────────────────────

async function kenneyPalette() {
  const { data, info } = await sharp(COLORMAP).removeAlpha().raw()
    .toBuffer({ resolveWithObject: true })
  const seen = new Set(); const pal = []
  for (let i = 0; i < data.length; i += info.channels) {
    const key = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2]
    if (seen.has(key)) continue
    seen.add(key); pal.push([data[i], data[i + 1], data[i + 2]])
  }
  return pal
}

function hueOf(r, g, b) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min
  if (d === 0) return { h: 0, sat: 0, max }
  let h = max === r ? 60 * (((g - b) / d) % 6)
        : max === g ? 60 * ((b - r) / d + 2)
        : 60 * ((r - g) / d + 4)
  return { h: h < 0 ? h + 360 : h, sat: d / max, max }
}

async function editTextures(fn, label) {
  for (const tex of root.listTextures()) {
    const img = tex.getImage(); if (!img) continue
    const { data, info } = await sharp(Buffer.from(img)).ensureAlpha().raw()
      .toBuffer({ resolveWithObject: true })
    const touched = fn(data, info)
    const out = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
      .png().toBuffer()
    tex.setImage(new Uint8Array(out)).setMimeType('image/png')
    console.log(`  ${label}: ${(100 * touched / (info.width * info.height)).toFixed(1)}% of ${info.width}x${info.height}`)
  }
}

const isWaterPixel = (r, g, b) => {
  const { h, sat, max } = hueOf(r, g, b)
  return sat > 0.35 && h >= 160 && h <= 230 && max > 40
}

/**
 * Re-tint the artwork's water to Kenney's #8fdbff, keeping the low-poly shading.
 *
 * Scaling Kenney's blue by each pixel's ABSOLUTE brightness reads too dark: a
 * mid-tone face lands well below #8fdbff and the tile stops matching its
 * neighbours. Instead anchor the tile's own dominant water tone -- the brightly
 * lit top surface, taken as the 80th percentile -- to exactly #8fdbff, and let
 * the shadowed sides fall below it proportionally. That mirrors how Kenney's own
 * water tiles look: a flat #8fdbff top with darker lit sides.
 */
const matchWater = () => editTextures(data => {
  const brights = []
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue
    if (isWaterPixel(data[i], data[i + 1], data[i + 2])) {
      brights.push(Math.max(data[i], data[i + 1], data[i + 2]))
    }
  }
  if (!brights.length) return 0
  brights.sort((a, b) => a - b)
  const anchor = brights[Math.floor(brights.length * 0.8)] || 255

  let n = 0
  for (let i = 0; i < data.length; i += 4) {
    if (!isWaterPixel(data[i], data[i + 1], data[i + 2])) continue
    const max = Math.max(data[i], data[i + 1], data[i + 2])
    const shade = Math.min(1, max / anchor)
    data[i]     = Math.min(255, Math.round(KENNEY_WATER.r * shade))
    data[i + 1] = Math.min(255, Math.round(KENNEY_WATER.g * shade))
    data[i + 2] = Math.min(255, Math.round(KENNEY_WATER.b * shade))
    n++
  }
  return n
}, 'water match')

async function paletteLock() {
  const pal = await kenneyPalette()
  // Nearest-neighbour over ~250 colours for every texel is slow, so resolve it
  // once per 5-bit RGB cell (32768 cells) and index that.
  const lut = new Uint8Array(32768 * 3)
  for (let ri = 0; ri < 32; ri++) for (let gi = 0; gi < 32; gi++) for (let bi = 0; bi < 32; bi++) {
    const r = ri * 8 + 4, g = gi * 8 + 4, b = bi * 8 + 4
    let best = 0, bestD = Infinity
    for (let p = 0; p < pal.length; p++) {
      const d = (pal[p][0] - r) ** 2 + (pal[p][1] - g) ** 2 + (pal[p][2] - b) ** 2
      if (d < bestD) { bestD = d; best = p }
    }
    const idx = ((ri << 10) | (gi << 5) | bi) * 3
    lut[idx] = pal[best][0]; lut[idx + 1] = pal[best][1]; lut[idx + 2] = pal[best][2]
  }
  console.log(`  palette: ${pal.length} Kenney colours`)
  await editTextures(data => {
    let n = 0
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] === 0) continue
      const idx = (((data[i] >> 3) << 10) | ((data[i + 1] >> 3) << 5) | (data[i + 2] >> 3)) * 3
      data[i] = lut[idx]; data[i + 1] = lut[idx + 1]; data[i + 2] = lut[idx + 2]
      n++
    }
    return n
  }, 'palette lock')
}

// ── run ────────────────────────────────────────────────────────────────────

const before = measure()
const countTris = () => root.listMeshes().flatMap(m => m.listPrimitives())
  .reduce((s, p) => s + (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3, 0)
const trisBefore = countTris()

console.log(`input  ${path.basename(SRC)}`)
console.log(`  R=${before.R.toFixed(4)} (want ${KENNEY_R}) centre=(${before.cx.toFixed(4)},${before.cz.toFixed(4)}) rot=${before.rotOffset.toFixed(2)}deg ymin=${before.ymin.toFixed(4)}`)
console.log(`  triangles=${trisBefore.toLocaleString()}  size=${(fs.statSync(SRC).size / 1024).toFixed(0)}KB`)

if (has('dry-run')) {
  console.log(`\nwould scale x${(KENNEY_R / before.R).toFixed(4)}, rotate ${(-before.rotOffset).toFixed(2)}deg, drop ${(-before.ymin).toFixed(4)}`)
  process.exit(0)
}

// Pass 1 — orientation from clean, full-resolution geometry.
applyCorrection({
  scale: KENNEY_R / before.R, rotDeg: -before.rotOffset,
  tx: -before.cx, ty: -before.ymin, tz: -before.cz,
})

if (trisBefore > BUDGET) {
  await doc.transform(
    dedup(), weld({ tolerance: 0.001 }),
    simplify({ simplifier: MeshoptSimplifier, ratio: BUDGET / trisBefore, error: 0.01, lockBorder: false }),
    prune(),
  )
}
const trisAfter = countTris()

// Pass 2 — repair scale and centring, which simplification nudges.
const mid = measure()
applyCorrection({ scale: KENNEY_R / mid.R, rotDeg: 0, tx: -mid.cx, ty: -mid.ymin, tz: -mid.cz })

bakeTransforms()

if (SURFACE !== null) {
  const s = measure()
  const from = BASE_TOP !== null ? BASE_TOP : s.surface
  const how = BASE_TOP !== null ? ' (--base-top)' : ' (auto)'
  console.log(`  trim base: surface ${from.toFixed(3)}${how} -> ${SURFACE}`)
  trimBase(from, SURFACE)
}

// Report how hexagonal the generated base actually is, before deciding to keep it.
{
  const plateTop = SURFACE !== null ? SURFACE * 1.05 : measure().surface
  const reg = hexRegularity(plateTop)
  const verdict = reg.ratio >= 0.82 ? 'usable' : 'DEFORMED — use --rebuild-base'
  console.log(`  base regularity: ${reg.ratio.toFixed(3)} (perfect hexagon = 0.866) — ${verdict}`)
}

if (has('rebuild-base')) {
  if (SURFACE === null) { console.error('--rebuild-base requires --surface'); process.exit(1) }
  await rebuildBase(SURFACE, await kenneyPalette())
}
// Always the last geometry step: the footprint is what the grid depends on.
// Skipped after --rebuild-base, whose prism is already exact by construction --
// re-fitting would only re-introduce error from the artwork's own silhouette.
if (!has('rebuild-base')) {
  fixFootprintXZ(SURFACE !== null ? SURFACE * 1.05 : measure().surface)
}

if (has('match-water')) await matchWater()
if (has('palette-lock')) await paletteLock()

// PNG, not WebP -- Blender cannot reliably import EXT_texture_webp.
// Encoded by hand rather than via textureCompress so the palette option applies.
for (const tex of root.listTextures()) {
  const img = tex.getImage(); if (!img) continue
  const out = await sharp(Buffer.from(img))
    .resize(TEXTURE_MAX, TEXTURE_MAX, { fit: 'inside', withoutEnlargement: true })
    .png({ palette: true, quality: 90, effort: 7 })
    .toBuffer()
  tex.setImage(new Uint8Array(out)).setMimeType('image/png')
}
await doc.transform(prune())
await io.write(DST, doc)

/**
 * Height of the topmost DENSE ring of vertices at the hex rim = top of the solid
 * base plate. The prism wall is a closed ring of many vertices at one height,
 * while decoration out at the rim is sparse -- so this ignores a wing or a wall
 * that a bounding box or a rim maximum would latch onto. Reproduces all five
 * Kenney references exactly (grass/sand/stone 0.200, water/dirt 0.100), which is
 * the evidence it measures the right thing.
 */
function ringPlateTop() {
  // With --rebuild-base the plate is its own mesh, so read it exactly rather than
  // inferring. Necessary for dense tiles: enid-kingdom has 6,622 rim vertices with
  // walls at every height, and the ring heuristic latched onto 0.740.
  if (has('rebuild-base')) {
    const m = root.listMeshes().find(x => x.getName() === 'hexBase')
    if (m) {
      const pos = m.listPrimitives()[0].getAttribute('POSITION')
      const v = [0, 0, 0]; let top = -Infinity
      for (let i = 0; i < pos.getCount(); i++) { pos.getElement(i, v); if (v[1] > top) top = v[1] }
      if (isFinite(top)) return top
    }
  }
  const EDGE = KENNEY_R * Math.cos(Math.PI / 6), K = Math.PI / 3
  const hexR = (x, z) => {
    const a = Math.atan2(z, x)
    const aa = ((a + Math.PI / 6) % K + K) % K - K / 2
    return Math.hypot(x, z) * Math.cos(aa) / EDGE
  }
  const rim = worldPositions().filter(p => {
    const h = hexR(p[0], p[2]); return h > 0.93 && h < 1.06
  })
  if (!rim.length) return null
  const bins = new Map()
  for (const p of rim) {
    const k = Math.round(p[1] / 0.005) * 0.005
    bins.set(k, (bins.get(k) || 0) + 1)
  }
  const peak = Math.max(...bins.values())
  let best = null
  for (const [y, c] of bins) {
    if (c >= Math.max(3, peak * 0.25) && y > 0.02 && (best === null || y > best)) best = y
  }
  return best
}

// ── verify, and fail loudly ────────────────────────────────────────────────
const after = measure()
// Verify the footprint over the whole base plate, matching fixFootprintXZ --
// measuring a thinner slice than the correction used would flag false failures.
const plateTop = SURFACE !== null ? SURFACE * 1.05 : after.surface
// With --rebuild-base the footprint IS the generated prism. Measuring every low
// vertex instead would fold in overhanging artwork (a griffon's wing, a hull)
// and report a false failure -- overhang is allowed, a wrong prism is not.
const plate = has('rebuild-base')
  ? (() => {
      const m = root.listMeshes().find(x => x.getName() === 'hexBase')
      const pos = m.listPrimitives()[0].getAttribute('POSITION')
      const out = []; const v = [0, 0, 0]
      for (let i = 0; i < pos.getCount(); i++) { pos.getElement(i, v); out.push([...v]) }
      return out
    })()
  : worldPositions().filter(p => p[1] <= plateTop)
const pcx = plate.reduce((s, p) => s + p[0], 0) / plate.length
const pcz = plate.reduce((s, p) => s + p[2], 0) / plate.length
let pR = 0
for (const p of plate) pR = Math.max(pR, Math.hypot(p[0] - pcx, p[2] - pcz))

const problems = []
if (Math.abs(pR - KENNEY_R) > TOLERANCE) problems.push(`footprint R=${pR.toFixed(4)}, want ${KENNEY_R}`)
if (Math.abs(pcx) > TOLERANCE || Math.abs(pcz) > TOLERANCE) problems.push(`off-centre (${pcx.toFixed(4)},${pcz.toFixed(4)})`)
if (Math.abs(after.ymin) > TOLERANCE) problems.push(`base not at y=0 (${after.ymin.toFixed(4)})`)
const ringTop = ringPlateTop()
if (SURFACE !== null) {
  // Check the rim ring, not the densest band: post-trim the densest band can be
  // canopy (syrup-tree measured 0.534 against a 0.2 target and was deleted).
  const got = ringTop ?? after.surface
  if (Math.abs(got - SURFACE) > 0.02) problems.push(`plate top at ${got.toFixed(3)}, want ${SURFACE}`)
}

console.log(`output ${path.basename(DST)}`)
console.log(`  R=${pR.toFixed(4)} centre=(${pcx.toFixed(4)},${pcz.toFixed(4)}) ymin=${after.ymin.toFixed(4)} plateTop=${ringTop === null ? 'n/a' : ringTop.toFixed(3)} top=${after.ymax.toFixed(3)}`)
console.log(`  triangles=${trisBefore.toLocaleString()} -> ${trisAfter.toLocaleString()}   size=${(fs.statSync(SRC).size / 1024).toFixed(0)}KB -> ${(fs.statSync(DST).size / 1024).toFixed(0)}KB`)

// A rejected tile must not be left on disk: the manifest would pick it up and it
// would ship anyway, which defeats the point of verifying.
function reject(msg) {
  try { fs.unlinkSync(DST) } catch {}
  console.error(`\n${msg}`)
  console.error(`Removed ${path.basename(DST)} — nothing written.`)
  process.exit(1)
}

if (problems.length) reject(`FAILED verification:\n  - ${problems.join('\n  - ')}`)
if (trisAfter > BUDGET * 1.25) {
  reject(`FAILED: ${trisAfter.toLocaleString()} triangles over budget ${BUDGET.toLocaleString()}.\n`
    + `  The simplifier plateaus when a mesh has many UV/normal seams — raising the error\n`
    + `  tolerance does not help. Regenerate the model at a lower output resolution.`)
}
console.log('\nOK — verified against the Kenney contract.')
