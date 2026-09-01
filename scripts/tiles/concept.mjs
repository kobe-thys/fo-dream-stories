/**
 * Generate a CONCEPT DRAWING for a story tile, from an idea in plain words.
 *
 *   node scripts/tiles/concept.mjs "a dragon asleep on a volcano" out.png [options]
 *
 *   --provider=openai | gemini-3-pro-image | gemini-3.1-flash-image   (default openai)
 *   --revise=notes    change request applied to --from
 *   --from=prev.png   the image being revised (kept as reference so the revision
 *                     is an EDIT of the approved direction, not a fresh redraw)
 *
 * Stage one of the tile forge: idea -> drawing -> (revise)* -> approved drawing ->
 * Meshy image-to-3D -> normalize -> kenney-flatten -> installed.
 *
 * The brief itself lives in ./tile-brief.mjs, shared with the admin Forge tab so
 * the CLI and the UI cannot drift. Read that file for WHY it is shaped as it is --
 * in particular why it asks for soft shading and NOT isometric projection.
 *
 * NOTE: Gemini image models are not on the free tier (429, limit: 0) and need
 * billing enabled on the Google AI Studio project. OpenAI is the default.
 */
import fs from 'fs'
import { buildBrief } from './tile-brief.mjs'

const args = process.argv.slice(2)
const positional = args.filter(a => !a.startsWith('--'))
const [IDEA, OUT] = positional
const flag = (n, d) => { const h = args.find(a => a.startsWith(`--${n}=`)); return h ? h.slice(n.length + 3) : d }

if (!IDEA || !OUT) {
  console.error('usage: concept.mjs "<idea>" <out.png> [--provider=...] [--revise="..."] [--from=prev.png]')
  process.exit(1)
}

const provider = flag('provider', 'openai')
const revise = flag('revise')
const from = flag('from')

const brief = buildBrief(IDEA, revise)

async function gemini(model) {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new Error('GEMINI_API_KEY is not set -- run: set -a && . /root/.secrets/tokens.env && set +a')
  const parts = [{ text: brief }]
  if (from) {
    parts.unshift({ inlineData: { mimeType: 'image/png', data: fs.readFileSync(from).toString('base64') } })
  }
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts }] }),
    })
  const json = await res.json()
  if (!res.ok) throw new Error(`gemini ${res.status}: ${JSON.stringify(json).slice(0, 400)}`)
  const cand = json.candidates?.[0]?.content?.parts ?? []
  const img = cand.find(p => p.inlineData)
  if (!img) throw new Error(`no image returned: ${JSON.stringify(json).slice(0, 400)}`)
  return Buffer.from(img.inlineData.data, 'base64')
}

async function openai() {
  const key = process.env.OPENAI_API_KEY
  if (!key) throw new Error('OPENAI_API_KEY is not set')
  // gpt-image-1 has a true edit endpoint, so a revision references the previous
  // image rather than redrawing from the prompt alone.
  if (from) {
    const fd = new FormData()
    fd.append('model', 'gpt-image-1')
    fd.append('prompt', brief)
    fd.append('size', '1024x1024')
    fd.append('image', new Blob([fs.readFileSync(from)], { type: 'image/png' }), 'prev.png')
    const res = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: fd,
    })
    const json = await res.json()
    if (!res.ok) throw new Error(`openai ${res.status}: ${JSON.stringify(json).slice(0, 400)}`)
    return Buffer.from(json.data[0].b64_json, 'base64')
  }
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-image-1', prompt: brief, size: '1024x1024', background: 'opaque',
    }),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(`openai ${res.status}: ${JSON.stringify(json).slice(0, 400)}`)
  return Buffer.from(json.data[0].b64_json, 'base64')
}

const t0 = Date.now()
const png = provider === 'openai' ? await openai() : await gemini(provider)
fs.writeFileSync(OUT, png)
console.log(`${provider}  ${(png.length / 1024).toFixed(0)}KB  ${((Date.now() - t0) / 1000).toFixed(1)}s  -> ${OUT}`)
