/**
 * Bring generated tile materials in line with the Kenney kit.
 *
 *   node scripts/tiles/fix-materials.mjs <tile.glb> [--base-top=#48c1a3] [--base-side=#f1976c] [--keep-side] [--keep-metallic]
 *
 * WHY
 * glTF defaults metallicFactor to 1.0 when it is absent. Every image-to-3D export
 * omits it, so our story tiles rendered FULLY METALLIC -- mirroring the scene's
 * Environment map rather than showing their own albedo. Kenney's tiles set 0.0.
 * That mismatch is why a tile painted with Kenney's exact grass green still did not
 * look like the grass tile beside it.
 *
 * --base-top / --base-side recolour the flat, untextured prism materials that
 * --rebuild-base creates ("hexBaseTop", "hexBase"). Those are material colours, not
 * texels, so texture edits cannot reach them.
 *
 * baseColorFactor is LINEAR; hex input is sRGB, so it is converted here.
 */
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'

const args = process.argv.slice(2)
const SRC = args.find(a => !a.startsWith('--'))
const flag = (n) => { const h = args.find(a => a.startsWith(`--${n}=`)); return h ? h.split('=')[1] : null }
const has = (n) => args.includes(`--${n}`)

if (!SRC) {
  console.error('usage: fix-materials.mjs <tile.glb> [--base-top=#rrggbb] [--base-side=#rrggbb] [--keep-metallic]')
  process.exit(1)
}

// Kenney's dirt colour, measured off dirt.glb's top face and the skirt beneath
// grass.glb. Every stock tile shows this band under its surface, so a generated
// tile whose prism keeps a sampled colour reads as foreign next to them.
const KENNEY_DIRT = '#f1976c'

const srgbToLinear = (c) => c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
function hexToLinear(hex) {
  const n = parseInt(hex.replace('#', ''), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => srgbToLinear(v / 255))
}

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
const doc = await io.read(SRC)

const topHex = flag('base-top')
// Default the prism side to Kenney dirt; --keep-side leaves whatever was sampled.
const sideHex = has('keep-side') ? null : (flag('base-side') || KENNEY_DIRT)
let metal = 0, painted = 0

for (const mat of doc.getRoot().listMaterials()) {
  const name = mat.getName()
  const textured = !!mat.getBaseColorTexture()

  // Matte like Kenney. Only the textured artwork material -- the flat prism
  // materials are already explicitly 0.
  if (textured && !has('keep-metallic')) {
    mat.setMetallicFactor(0)
    mat.setRoughnessFactor(1)
    metal++
  }

  if (!textured && topHex && name === 'hexBaseTop') {
    const [r, g, b] = hexToLinear(topHex)
    mat.setBaseColorFactor([r, g, b, 1]); painted++
  }
  if (!textured && sideHex && name === 'hexBase') {
    const [r, g, b] = hexToLinear(sideHex)
    mat.setBaseColorFactor([r, g, b, 1]); painted++
  }
}

await io.write(SRC, doc)
console.log(`  ${SRC.split('/').pop()} — metallic->0 on ${metal} textured mat(s)` +
            (painted ? `, recoloured ${painted} prism material(s)` : ''))
