/**
 * Flatten a tile's artwork onto Kenney's ACTUAL flat palette.
 *
 *   node scripts/tiles/kenney-flatten.mjs <input.glb> <output.glb> [options]
 *
 *   --report        print the swatch histogram (with height bands) and write nothing
 *   --keep-below=Y  exempt faces below height Y from --remap (protects a finished
 *                   base). They are still snapped -- an already-correct base lands
 *                   back on its own swatch, which is what unifies the material.
 *   --remap=FROM:TO[@minY[:maxY]]   after snapping, move one swatch to another,
 *                   optionally only within a height band. Repeatable.
 *                   e.g. --remap=#868ba1:#61cb8b@0.25  -> grey-blue above y=0.25
 *                   becomes Kenney green. This is how you fix artwork whose HUE is
 *                   wrong: snapping is nearest-neighbour, so it can only ever make
 *                   a blue tree a Kenney blue. Run --report first to see what
 *                   landed where.
 *
 * WHY THIS EXISTS -- AND WHY --palette-lock DOES NOT DO IT
 *
 * `normalize-tile.mjs --palette-lock` remaps every TEXEL to the nearest colour
 * found in colormap.png. Two things make that the wrong operation:
 *
 * 1. It reads 251 "palette" colours out of the colormap by collecting every unique
 *    TEXEL. But the colormap is 18 colour FAMILIES of 5 rungs each (see
 *    kenneyFamilies below), so that count is every rung of every ramp plus every
 *    interpolated pixel between them -- not a palette at all.
 *
 * 2. Because the blue ramps have the most steps, 45% of those 251 entries land in
 *    the blue/cyan bands while only one is a true green. Nearest-neighbour against
 *    that distribution is biased toward blue: anything desaturated or ambiguous
 *    gets pulled there. That is why enid-kingdom's tree canopies came out cyan and
 *    raindrop-castle came out uniformly pale blue.
 *
 * Worse, snapping per texel PRESERVES noise. Adjacent noisy texels land on
 * different swatches, so generator speckle becomes visible colour banding -- the
 * mottling on enid-kingdom's canopies is palette-lock quantising noise, not the
 * generator's own texture.
 *
 * So this script snaps per FACE, not per texel: average the texture over each
 * triangle, pick the nearest of the 90 rungs in OKLab (perceptual -- plain RGB
 * distance is what let hue drift in the first place), then repoint all three of
 * that triangle's UVs at that rung's cell centre and retarget the primitive to one
 * shared material on the genuine colormap.
 *
 * Snapping across RUNGS rather than the 18 flat bases is deliberate: collapsing a
 * family to its base colour would throw away the light-to-dark variation that makes
 * a silhouette readable, which on raindrop-castle turned the whole castle one
 * uniform blue. Every family has exactly 5 entries, so density is uniform and the
 * nearest-neighbour bias that broke --palette-lock cannot recur.
 *
 * The result samples exactly one texel per face. Noise cannot survive it, the
 * palette is guaranteed by construction, and the output references the same
 * colormap.png every genuine Kenney tile uses -- so a generated tile and a Kenney
 * tile are textured identically.
 */
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { prune, dedup, weld } from '@gltf-transform/functions'
import sharp from 'sharp'
import fs from 'fs'
import path from 'path'

const COLORMAP = 'public/models/Textures/colormap.png'
const GRID = 16          // colormap is a 16x16 grid of cells
const CELL = 32          // each cell is 32px in the 512px map

const args = process.argv.slice(2)
const [SRC, DST] = args.filter(a => !a.startsWith('--'))
const flag = (n, d) => { const h = args.find(a => a.startsWith(`--${n}=`)); return h ? h.split('=')[1] : d }
const has = n => args.includes(`--${n}`)

if (!SRC || (!DST && !has('report'))) {
  console.error('usage: kenney-flatten.mjs <in.glb> <out.glb> [--report] [--keep-below=Y]')
  process.exit(1)
}

const keepBelow = flag('keep-below') !== undefined ? Number(flag('keep-below')) : null

// --remap=#from:#to@minY:maxY  (band optional; maxY optional)
const REMAPS = args.filter(a => a.startsWith('--remap=')).map(a => {
  const m = a.slice(8).match(/^(#[0-9a-f]{6}):(#[0-9a-f]{6})(?:@([-\d.]+)(?::([-\d.]+))?)?$/i)
  if (!m) { console.error(`bad --remap: ${a}`); process.exit(1) }
  return {
    from: m[1].toLowerCase(),
    to: m[2].toLowerCase(),
    minY: m[3] !== undefined ? Number(m[3]) : -Infinity,
    maxY: m[4] !== undefined ? Number(m[4]) : Infinity,
  }
})

// ── OKLab ──────────────────────────────────────────────────────────────────
// Perceptual distance. sRGB euclidean distance treats a dark navy and a dark
// brown as close neighbours, which is exactly the confusion that let generated
// artwork drift across hue families.
const srgbToLinear = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 }

// glTF's baseColorFactor is LINEAR, while texture images are sRGB-encoded. Reading
// the factor as though it were sRGB reports a wrong colour -- it made this tile's
// base look like an off-palette red when it is in fact almost exactly Kenney dirt.
const linearToSrgb = c => 255 * (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055)

function oklab(r, g, b) {
  const R = srgbToLinear(r), G = srgbToLinear(g), B = srgbToLinear(b)
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B)
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B)
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B)
  return [
    0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
  ]
}

const dist = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2

// ── the real palette: 18 families, 5 rungs each ────────────────────────────
/**
 * The colormap is a 16x16 grid of 32px cells, organised in COLUMN PAIRS over
 * 4-row bands:
 *
 *   even column, one band  -> a single flat base colour (constant down the band)
 *   odd column,  same band -> that colour's 4-step darkening ramp
 *
 * So the palette is 18 colour FAMILIES of 5 rungs (base + 4 shades), not a flat
 * list. Inspecting real Kenney models settles how they are meant to be used:
 * building-castle.glb samples 15 distinct cells of which 14 are odd-column, and
 * it takes SEVERAL ROWS within one column (c11 r12,13,14,15). Kenney's depth
 * comes from picking different rungs of one family across a model's surfaces.
 *
 * That is why snapping to the flat bases alone is wrong: it would collapse every
 * face of a family to one colour and flatten the artwork's shape-reading. We snap
 * across all 90 rungs, which enforces the palette exactly while preserving the
 * light-to-dark variation that makes a silhouette legible.
 *
 * Density is uniform by construction here -- every family gets exactly 5 entries
 * -- which is what stops the nearest-neighbour bias that plagued --palette-lock.
 */
const BAND = 4

async function kenneyFamilies() {
  const { data, info } = await sharp(COLORMAP).removeAlpha().raw()
    .toBuffer({ resolveWithObject: true })
  const at = (r, c) => {
    const i = ((r * CELL + CELL / 2) * info.width + (c * CELL + CELL / 2)) * info.channels
    return [data[i], data[i + 1], data[i + 2]]
  }
  const hex = rgb => '#' + rgb.map(v => v.toString(16).padStart(2, '0')).join('')
  const isBlack = rgb => rgb[0] === 0 && rgb[1] === 0 && rgb[2] === 0
  const uv = (r, c) => ({
    u: (c * CELL + CELL / 2) / info.width,
    v: (r * CELL + CELL / 2) / info.height,
  })

  const families = []
  for (let c = 0; c < GRID; c += 2) {
    for (let b = 0; b < GRID; b += BAND) {
      const base = at(b, c)
      if (isBlack(base)) continue
      const name = hex(base)
      if (families.some(f => f.name === name)) continue
      // rung 0 is the flat base (even column); rungs 1..4 are the ramp (odd column)
      const rungs = [{ rgb: base, hex: name, lab: oklab(...base), ...uv(b, c) }]
      for (let r = b; r < b + BAND; r++) {
        const s = at(r, c + 1)
        if (isBlack(s)) continue
        rungs.push({ rgb: s, hex: hex(s), lab: oklab(...s), ...uv(r, c + 1) })
      }
      // light -> dark, so a remap can carry a rung index across families
      rungs.sort((x, y) => y.lab[0] - x.lab[0])
      rungs.forEach((s, i) => { s.family = name; s.rung = i })
      families.push({ name, rungs })
    }
  }
  return families
}

// ── sampling a triangle's average colour ───────────────────────────────────
// Barycentric samples rather than the centroid alone: a centroid can land on a
// UV seam or a stray dark texel and mis-colour the whole face.
const BARY = []
for (let i = 1; i <= 3; i++) {
  for (let j = 1; i + j <= 4; j++) {
    BARY.push([i / 5, j / 5, 1 - i / 5 - j / 5])
  }
}
BARY.push([1 / 3, 1 / 3, 1 / 3])

function sampleFace(img, w, h, uv0, uv1, uv2) {
  let r = 0, g = 0, b = 0, n = 0
  for (const [a, bb, c] of BARY) {
    const u = uv0[0] * a + uv1[0] * bb + uv2[0] * c
    const v = uv0[1] * a + uv1[1] * bb + uv2[1] * c
    const x = Math.min(w - 1, Math.max(0, Math.round(u * w - 0.5)))
    const y = Math.min(h - 1, Math.max(0, Math.round(v * h - 0.5)))
    const i = (y * w + x) * 4
    if (img[i + 3] < 128) continue          // transparent: not real artwork
    r += img[i]; g += img[i + 1]; b += img[i + 2]; n++
  }
  return n ? [r / n, g / n, b / n] : null
}

// ── main ───────────────────────────────────────────────────────────────────
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
const doc = await io.read(SRC)
const root = doc.getRoot()
const families = await kenneyFamilies()
const byFamily = new Map(families.map(f => [f.name, f]))
const entries = families.flatMap(f => f.rungs)
console.log(`palette: ${families.length} Kenney families, ${entries.length} rungs`)

for (const rm of REMAPS) {
  if (!byFamily.has(rm.from)) { console.error(`--remap source ${rm.from} is not a Kenney family base`); process.exit(1) }
  if (!byFamily.has(rm.to)) { console.error(`--remap target ${rm.to} is not a Kenney family base`); process.exit(1) }
}

// One shared material for the whole tile, textured with the genuine colormap.
const colormapTex = doc.createTexture('colormap')
  .setImage(new Uint8Array(fs.readFileSync(COLORMAP)))
  .setMimeType('image/png')
const kenneyMat = doc.createMaterial('kenney')
  .setBaseColorTexture(colormapTex)
  .setBaseColorFactor([1, 1, 1, 1])
  .setMetallicFactor(0)          // absent metallicFactor defaults to 1.0 -> mirrors
  .setRoughnessFactor(1)

// Cache decoded textures: several primitives usually share one image.
const decoded = new Map()
async function texelsFor(mat) {
  if (!mat) return null
  const tex = mat.getBaseColorTexture()
  if (!tex) return null
  if (decoded.has(tex)) return decoded.get(tex)
  const img = tex.getImage()
  if (!img) { decoded.set(tex, null); return null }
  const { data, info } = await sharp(Buffer.from(img)).ensureAlpha().raw()
    .toBuffer({ resolveWithObject: true })
  const out = { data, w: info.width, h: info.height }
  decoded.set(tex, out)
  return out
}

const histogram = new Map()
let faces = 0, skipped = 0, kept = 0

for (const mesh of root.listMeshes()) {
  for (const prim of mesh.listPrimitives()) {
    const pos = prim.getAttribute('POSITION')
    const uvA = prim.getAttribute('TEXCOORD_0')
    const nrm = prim.getAttribute('NORMAL')
    if (!pos) continue

    const mat = prim.getMaterial()
    const tex = await texelsFor(mat)
    const factor = mat?.getBaseColorFactor() ?? [1, 1, 1, 1]

    const idx = prim.getIndices()
    const count = idx ? idx.getCount() : pos.getCount()
    const tri = i => (idx ? idx.getScalar(i) : i)

    // Unindex: a vertex shared by two faces of different colours cannot carry
    // two UVs, so every triangle gets its own three vertices.
    const P = [], N = [], UV = []

    for (let f = 0; f < count; f += 3) {
      const a = tri(f), b = tri(f + 1), c = tri(f + 2)
      const pa = [0, 0, 0], pb = [0, 0, 0], pc = [0, 0, 0]
      pos.getElement(a, pa); pos.getElement(b, pb); pos.getElement(c, pc)

      // Face colour: from the texture where there is one, else the base factor.
      let rgb = null
      if (tex && uvA) {
        const ua = [0, 0], ub = [0, 0], uc = [0, 0]
        uvA.getElement(a, ua); uvA.getElement(b, ub); uvA.getElement(c, uc)
        rgb = sampleFace(tex.data, tex.w, tex.h, ua, ub, uc)
      }
      if (!rgb) rgb = [linearToSrgb(factor[0]), linearToSrgb(factor[1]), linearToSrgb(factor[2])]

      const meanY = (pa[1] + pb[1] + pc[1]) / 3
      const protect = keepBelow !== null && meanY < keepBelow
      if (protect) kept++

      const lab = oklab(rgb[0], rgb[1], rgb[2])
      let best = entries[0], bestD = Infinity
      for (const s of entries) {
        const d = dist(lab, s.lab)
        if (d < bestD) { bestD = d; best = s }
      }

      // Hue steering. Snapping is nearest-neighbour, so it can correct noise and
      // off-palette shades but never a wrong HUE -- a blue tree only ever becomes
      // a Kenney blue tree. --remap moves a whole FAMILY to another, carrying the
      // rung index across, so a canopy is retinted without losing its shading.
      if (!protect) {
        for (const rm of REMAPS) {
          if (best.family === rm.from && meanY >= rm.minY && meanY <= rm.maxY) {
            const t = byFamily.get(rm.to).rungs
            best = t[Math.min(best.rung, t.length - 1)]
            break
          }
        }
      }

      const h = histogram.get(best.hex) ?? { n: 0, lo: Infinity, hi: -Infinity, family: best.family, rung: best.rung }
      h.n++; h.lo = Math.min(h.lo, meanY); h.hi = Math.max(h.hi, meanY)
      histogram.set(best.hex, h)
      faces++

      for (const p of [pa, pb, pc]) P.push(p[0], p[1], p[2])
      if (nrm) {
        const na = [0, 0, 0], nb = [0, 0, 0], nc = [0, 0, 0]
        nrm.getElement(a, na); nrm.getElement(b, nb); nrm.getElement(c, nc)
        N.push(...na, ...nb, ...nc)
      }
      for (let k = 0; k < 3; k++) UV.push(best.u, best.v)
    }

    if (has('report')) continue

    const buf = doc.getRoot().listBuffers()[0] ?? doc.createBuffer()
    prim.setIndices(null)
    prim.setAttribute('POSITION',
      doc.createAccessor().setType('VEC3').setArray(new Float32Array(P)).setBuffer(buf))
    prim.setAttribute('TEXCOORD_0',
      doc.createAccessor().setType('VEC2').setArray(new Float32Array(UV)).setBuffer(buf))
    if (nrm) {
      prim.setAttribute('NORMAL',
        doc.createAccessor().setType('VEC3').setArray(new Float32Array(N)).setBuffer(buf))
    }
    for (const name of ['TEXCOORD_1', 'COLOR_0', 'TANGENT']) {
      if (prim.getAttribute(name)) prim.setAttribute(name, null)
    }
    prim.setMaterial(kenneyMat)
  }
}

const top = [...histogram.entries()].sort((a, b) => b[1].n - a[1].n)
console.log(`faces: ${faces}${kept ? `  (${kept} exempt from --remap)` : ''}`)
console.log('  shade     family   rung   faces    share   height band')
for (const [hex, h] of top) {
  console.log(`  ${hex}  ${h.family}   ${h.rung}   ${String(h.n).padStart(6)}  `
    + `${(100 * h.n / faces).toFixed(1).padStart(5)}%   y ${h.lo.toFixed(3)} .. ${h.hi.toFixed(3)}`)
}
// --remap takes a FAMILY base, so summarise by family too.
const fam = new Map()
for (const [, h] of histogram) fam.set(h.family, (fam.get(h.family) ?? 0) + h.n)
console.log('  by family:')
for (const [f, n] of [...fam].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${f}  ${String(n).padStart(6)}  ${(100 * n / faces).toFixed(1).padStart(5)}%`)
}

if (has('report')) process.exit(0)

// Flattening leaves many vertices identical in position, normal AND uv (a face's
// three corners now share one colormap texel), so re-indexing recovers most of the
// size that unindexing cost. Faces of different colours have different uvs and so
// are never merged -- the flat look is preserved exactly.
await doc.transform(weld(), prune(), dedup())
await io.write(DST, doc)
console.log(`wrote ${DST}  ${(fs.statSync(DST).size / 1024).toFixed(0)}KB`)
