/**
 * Turn an approved concept drawing into a GLB, via Meshy image-to-3D.
 *
 *   node scripts/tiles/meshy.mjs <concept.png> <out.glb> [options]
 *
 *   --polycount=N   target triangles from Meshy (default 12000)
 *   --model=NAME    ai_model: meshy-6 | meshy-7 | latest   (default meshy-6)
 *   --standard      use model_type=standard instead of lowpoly
 *   --keep-lighting do NOT ask Meshy to remove baked lighting
 *   --dry-run       print the request and the credit cost, send nothing
 *
 * Stage two of the tile forge. Stage one is `concept.mjs`; everything after this
 * is the existing chain -- normalize-tile -> kenney-flatten -> install.
 *
 * WHY THESE DEFAULTS
 *
 * They are chosen against the two things measured to be wrong with the current
 * story tiles, not from Meshy's defaults:
 *
 * - `model_type: 'lowpoly'` and a 12k polycount. Meshy's default is 30,000, and
 *   enid-kingdom's problem is that it shipped at 59,350 triangles against a budget
 *   of 8,000. Asking the generator for a low count gives far better topology than
 *   decimating a dense mesh afterwards -- decimation is what made those canopies
 *   lumpy. 12k leaves the normalizer some headroom to reach 8k cleanly.
 *
 * - `remove_lighting: true`. Image-to-3D bakes the concept's shading into the
 *   texture. On enid-kingdom that left 20% of faces on near-black #38383d, which
 *   read as soot in the canopy and had to be remapped away by hand. Kenney assets
 *   carry no baked shadow; the scene lights them.
 *
 * - `enable_pbr: false`. PBR maps are useless to us and actively harmful: the
 *   metallic map is the source of the absent-metallicFactor bug that made all 12
 *   story tiles render as mirrors.
 *
 * The image is sent as a base64 data URI, so nothing has to be publicly hosted.
 */
import fs from 'fs'
import path from 'path'

const API = 'https://api.meshy.ai/openapi/v1/image-to-3d'
const POLL_MS = 5000
const TIMEOUT_MS = 20 * 60_000

const args = process.argv.slice(2)
const [SRC, DST] = args.filter(a => !a.startsWith('--'))
const flag = (n, d) => { const h = args.find(a => a.startsWith(`--${n}=`)); return h ? h.split('=')[1] : d }
const has = n => args.includes(`--${n}`)

if (!SRC || (!DST && !has('dry-run'))) {
  console.error('usage: meshy.mjs <concept.png> <out.glb> [--polycount=N] [--model=meshy-6] [--dry-run]')
  process.exit(1)
}

const KEY = process.env.MESHY_API_KEY
if (!KEY) {
  console.error('MESHY_API_KEY is not set -- run: set -a && . /root/.secrets/tokens.env && set +a')
  process.exit(1)
}

const ext = path.extname(SRC).toLowerCase() === '.jpg' ? 'jpeg' : 'png'
const body = {
  image_url: `data:image/${ext};base64,${fs.readFileSync(SRC).toString('base64')}`,
  ai_model: flag('model', 'meshy-6'),
  model_type: has('standard') ? 'standard' : 'lowpoly',
  should_texture: true,
  enable_pbr: false,
  texture_resolution: '2k',
  should_remesh: true,
  topology: 'triangle',
  target_polycount: Number(flag('polycount', 12000)),
  remove_lighting: !has('keep-lighting'),
  target_formats: ['glb'],
}

if (has('dry-run')) {
  console.log(JSON.stringify({ ...body, image_url: `<${(fs.statSync(SRC).size / 1024).toFixed(0)}KB data uri>` }, null, 2))
  process.exit(0)
}

const headers = { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }

const balance = async () => {
  const r = await fetch('https://api.meshy.ai/openapi/v1/balance', { headers })
  return r.ok ? (await r.json()).balance : null
}

const before = await balance()
console.log(`balance before: ${before}`)

const create = await fetch(API, { method: 'POST', headers, body: JSON.stringify(body) })
const created = await create.json()
if (!create.ok) {
  console.error(`meshy ${create.status}: ${JSON.stringify(created).slice(0, 500)}`)
  process.exit(1)
}
const id = created.result ?? created.id
console.log(`task ${id}  (${body.model_type}, ${body.ai_model}, ${body.target_polycount} tris)`)

const t0 = Date.now()
let task
for (;;) {
  if (Date.now() - t0 > TIMEOUT_MS) { console.error('timed out'); process.exit(1) }
  await new Promise(r => setTimeout(r, POLL_MS))
  const res = await fetch(`${API}/${id}`, { headers })
  task = await res.json()
  if (!res.ok) { console.error(`poll ${res.status}: ${JSON.stringify(task).slice(0, 300)}`); process.exit(1) }
  process.stdout.write(`\r  ${task.status} ${task.progress ?? 0}%   ${((Date.now() - t0) / 1000).toFixed(0)}s   `)
  if (['SUCCEEDED', 'FAILED', 'CANCELED'].includes(task.status)) break
}
console.log()

if (task.status !== 'SUCCEEDED') {
  console.error(`task ${task.status}: ${task.task_error?.message ?? JSON.stringify(task).slice(0, 300)}`)
  process.exit(1)
}

const url = task.model_urls?.glb
if (!url) { console.error('no glb in model_urls'); process.exit(1) }
const glb = Buffer.from(await (await fetch(url)).arrayBuffer())
fs.writeFileSync(DST, glb)

const after = await balance()
console.log(`wrote ${DST}  ${(glb.length / 1024).toFixed(0)}KB`)
console.log(`credits: ${task.consumed_credits ?? (before - after)} consumed, ${after} left`)
if (task.thumbnail_url) console.log(`preview: ${task.thumbnail_url}`)
