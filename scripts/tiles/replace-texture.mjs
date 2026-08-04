/**
 * Swap a tile's base-colour texture for a new PNG, leaving geometry untouched.
 *
 *   node scripts/tiles/replace-texture.mjs <tile.glb> <new.png> [textureIndex=0]
 *
 * Pairs with recolour-tile.py, which produces the replacement image.
 */
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import fs from 'fs'

const [SRC, PNG, IDX = '0'] = process.argv.slice(2)
if (!SRC || !PNG) {
  console.error('usage: replace-texture.mjs <tile.glb> <new.png> [textureIndex]')
  process.exit(1)
}

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
const doc = await io.read(SRC)
const textures = doc.getRoot().listTextures()
const i = Number(IDX)

if (!textures[i]) {
  console.error(`no texture at index ${i} (file has ${textures.length})`)
  process.exit(1)
}

const before = fs.statSync(SRC).size
textures[i].setImage(new Uint8Array(fs.readFileSync(PNG))).setMimeType('image/png')
await io.write(SRC, doc)

console.log(`  ${SRC.split('/').pop()} — texture ${i} replaced, ` +
            `${(before / 1024).toFixed(0)}KB -> ${(fs.statSync(SRC).size / 1024).toFixed(0)}KB`)
