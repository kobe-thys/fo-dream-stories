/**
 * Remove embedded punctual lights from tile GLBs.
 *
 *   node scripts/tiles/strip-lights.mjs <file.glb> [more.glb ...]
 *
 * WHY THIS EXISTS
 * Image-to-3D generators (Trellis, Meshy) export their studio rig inside the GLB
 * as KHR_lights_punctual. Every one of our AI-generated story tiles carried FOUR
 * lights. three.js adds them to the scene on load, so each placed tile made the
 * whole map brighter -- 10 story tiles meant 40 extra lights, which is both a
 * visual bug (cumulative wash-out) and a real per-fragment shader cost.
 *
 * Kenney's tiles have none, which is why the effect only showed up once Kobe
 * started placing generated tiles.
 */
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import fs from 'fs'

const files = process.argv.slice(2)
if (!files.length) {
  console.error('usage: strip-lights.mjs <file.glb> [more.glb ...]')
  process.exit(1)
}

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)

export async function stripLights(doc) {
  let removed = 0
  for (const node of doc.getRoot().listNodes()) {
    if (node.getExtension('KHR_lights_punctual')) {
      node.setExtension('KHR_lights_punctual', null)
      removed++
    }
  }
  for (const ext of doc.getRoot().listExtensionsUsed()) {
    if (ext.extensionName === 'KHR_lights_punctual') {
      for (const prop of ext.listProperties()) { prop.dispose(); removed++ }
      ext.dispose()
    }
  }
  return removed
}

let missing = 0
for (const f of files) {
  // Skip, do not throw. Crashing on one bad path used to abandon every file after
  // it: a batch died on a rejected tile and left five tiles with their lights,
  // which then brightened the map again days later.
  if (!fs.existsSync(f)) { console.warn(`  ${f} — MISSING, skipped`); missing++; continue }
  const before = fs.statSync(f).size
  const doc = await io.read(f)
  const removed = await stripLights(doc)
  if (!removed) { console.log(`  ${f.split('/').pop()} — no lights, untouched`); continue }
  await io.write(f, doc)
  const after = fs.statSync(f).size
  console.log(`  ${f.split('/').pop()} — removed ${removed} light refs, ${(before/1024).toFixed(0)}KB -> ${(after/1024).toFixed(0)}KB`)
}
if (missing) {
  console.error(`\n${missing} file(s) missing — exiting non-zero so a batch does not look clean`)
  process.exit(1)
}
