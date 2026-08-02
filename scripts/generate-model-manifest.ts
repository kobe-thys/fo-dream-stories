/**
 * Writes public/models/manifest.json — the list of tile models available to the
 * admin model picker.
 *
 * Why a manifest rather than fs.readdirSync at request time: Next.js does not
 * trace public/ into the serverless function bundle, so reading the directory
 * works locally and throws on Vercel. The symptom was an empty model picker in
 * production that behaved perfectly on localhost.
 *
 * Runs as `prebuild`, and the output is committed so `next dev` works without a
 * build step. Re-run with `npm run models:manifest` after adding models.
 */
import fs from 'fs'
import path from 'path'

interface ModelEntry {
  file: string       // "grass.glb"
  label: string      // "grass"
  thumb: string|null // "/models/grass.png" when a sibling PNG exists
  bytes: number
}

const modelsDir = path.join(process.cwd(), 'public', 'models')
const manifestPath = path.join(modelsDir, 'manifest.json')

const files = fs.readdirSync(modelsDir).filter(f => f.toLowerCase().endsWith('.glb')).sort()

const models: ModelEntry[] = files.map(file => {
  const stem = file.replace(/\.glb$/i, '')
  const thumbFile = `${stem}.png`
  return {
    file,
    label: stem.replace(/-/g, ' ').trim(),
    thumb: fs.existsSync(path.join(modelsDir, thumbFile))
      ? `/models/${encodeURIComponent(thumbFile)}`
      : null,
    bytes: fs.statSync(path.join(modelsDir, file)).size,
  }
})

fs.writeFileSync(
  manifestPath,
  JSON.stringify({ generatedAt: new Date().toISOString(), models }, null, 2) + '\n'
)

const withThumb = models.filter(m => m.thumb).length
console.log(`manifest: ${models.length} models (${withThumb} with thumbnails) -> ${manifestPath}`)
