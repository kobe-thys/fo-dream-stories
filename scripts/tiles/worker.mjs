/**
 * Tile normalization worker — runs on Kobe's box, NOT on Vercel.
 *
 *   source /root/.secrets/tokens.env && node scripts/tiles/worker.mjs
 *
 * Polls public.tile_jobs, normalizes queued jobs with the machine's RAM, uploads a
 * preview, and waits for the admin to accept before installing and pushing.
 *
 *   queued  -> running -> preview_ready --(admin accepts)--> accepted -> installed
 *                     \-> failed
 *
 * SECURITY
 * This process acts on rows written by a public-internet admin page. It therefore
 * builds the CLI arguments itself from TYPED fields (numbers and booleans) and
 * never interpolates anything free-form. output_name is re-validated here rather
 * than trusted from the API: defence in depth, since a bad name would become a
 * path. Nothing from the database ever reaches a shell -- execFile with an argv
 * array, never `sh -c`.
 */
import { createClient } from '@supabase/supabase-js'
import { execFile } from 'child_process'
import { promisify } from 'util'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { fileURLToPath } from 'url'

const run = promisify(execFile)

// NOT named URL — that shadows the global URL constructor used just below.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://tdoqdiyalenignhitxgj.supabase.co'
const KEY = process.env.SUPABASE_SERVICE_ROLE
if (!KEY) { console.error('SUPABASE_SERVICE_ROLE not set — source /root/.secrets/tokens.env'); process.exit(1) }

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const MODELS = path.join(REPO, 'public', 'models')
const POLL_MS = Number(process.env.WORKER_POLL_MS || 5000)
const NAME_RE = /^[a-z0-9][a-z0-9 _-]{0,60}\.glb$/i

const db = createClient(SUPABASE_URL, KEY, { auth: { persistSession: false } })

const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a)

async function setStatus(id, patch) {
  const { error } = await db.from('tile_jobs').update(patch).eq('id', id)
  if (error) log('  ! status update failed:', error.message)
}

/** Normalize a queued job and publish a preview for review. */
async function normalize(job) {
  if (!NAME_RE.test(job.output_name)) {
    return setStatus(job.id, { status: 'failed', log: `unsafe output_name: ${job.output_name}` })
  }
  await setStatus(job.id, { status: 'running', log: null })
  log(`normalizing ${job.output_name} (surface=${job.surface})`)

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tilejob-'))
  const src = path.join(tmp, 'source.glb')
  const out = path.join(tmp, job.output_name)

  try {
    const { data, error } = await db.storage.from('tile-sources').download(job.source_path)
    if (error) throw new Error(`download failed: ${error.message}`)
    fs.writeFileSync(src, Buffer.from(await data.arrayBuffer()))

    // Built from typed columns only — never a string from the row.
    const args = [
      '--max-old-space-size=8192',
      path.join(REPO, 'scripts/tiles/normalize-tile.mjs'),
      src, out,
      `--surface=${Number(job.surface)}`,
      `--budget=${Math.round(Number(job.budget))}`,
    ]
    if (job.base_top != null) args.push(`--base-top=${Number(job.base_top)}`)
    if (job.match_water) args.push('--match-water')
    if (job.palette_lock) args.push('--palette-lock')
    if (job.rebuild_base) args.push('--rebuild-base')

    let stdout = ''
    try {
      const r = await run('node', args, { cwd: REPO, maxBuffer: 32 * 1024 * 1024, timeout: 40 * 60_000 })
      stdout = r.stdout + r.stderr
    } catch (e) {
      stdout = `${e.stdout || ''}${e.stderr || ''}` || String(e)
      throw new Error(stdout.trim().split('\n').slice(-6).join('\n'))
    }

    // Generated tiles carry the generator's studio lights; strip before preview so
    // what is reviewed is what ships.
    await run('node', [path.join(REPO, 'scripts/tiles/strip-lights.mjs'), out], { cwd: REPO })
    await run('node', [path.join(REPO, 'scripts/tiles/fix-materials.mjs'), out], { cwd: REPO })

    const png = out.replace(/\.glb$/i, '.png')
    await run('python3', [path.join(REPO, 'scripts/tiles/render_glb.py'), out, png],
              { cwd: REPO, timeout: 15 * 60_000 })

    const key = `${job.id}.png`
    const up = await db.storage.from('tile-previews')
      .upload(key, fs.readFileSync(png), { contentType: 'image/png', upsert: true })
    if (up.error) throw new Error(`preview upload failed: ${up.error.message}`)
    const { data: pub } = db.storage.from('tile-previews').getPublicUrl(key)

    // Keep the built tile for the accept step rather than rebuilding it.
    fs.copyFileSync(out, path.join(os.tmpdir(), `tilejob-${job.id}.glb`))
    fs.copyFileSync(png, path.join(os.tmpdir(), `tilejob-${job.id}.png`))

    // Take the LAST match: the log prints the input measurement first, and it is
    // the OUTPUT we want to record.
    const last = (re) => { const m = [...stdout.matchAll(re)]; return m.length ? m[m.length - 1][1] : undefined }
    const R = last(/R=([\d.]+)/g)
    const plate = last(/plateTop=([\d.]+)/g)
    const tris = /triangles=[\d,]+ -> ([\d,]+)/.exec(stdout)?.[1]?.replace(/,/g, '')

    await setStatus(job.id, {
      status: 'preview_ready',
      preview_url: `${pub.publicUrl}?t=${Date.now()}`,
      log: stdout.trim().split('\n').slice(-12).join('\n'),
      measured_r: R ? Number(R) : null,
      measured_plate_top: plate ? Number(plate) : null,
      triangles: tris ? Number(tris) : null,
      bytes: fs.statSync(out).size,
    })
    log(`  preview ready — R=${R} plateTop=${plate} tris=${tris}`)
  } catch (e) {
    log(`  FAILED: ${e.message}`)
    await setStatus(job.id, { status: 'failed', log: String(e.message).slice(0, 4000) })
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
}

/** Install an accepted tile into the repo and push, which triggers a Vercel deploy. */
async function install(job) {
  log(`installing ${job.output_name}`)
  try {
    const glb = path.join(os.tmpdir(), `tilejob-${job.id}.glb`)
    const png = path.join(os.tmpdir(), `tilejob-${job.id}.png`)
    if (!fs.existsSync(glb)) throw new Error('built tile missing — re-run the job')

    fs.copyFileSync(glb, path.join(MODELS, job.output_name))
    fs.copyFileSync(png, path.join(MODELS, job.output_name.replace(/\.glb$/i, '.png')))

    await run('npm', ['run', 'models:manifest'], { cwd: REPO, timeout: 5 * 60_000 })
    await run('git', ['add', 'public/models'], { cwd: REPO })
    await run('git', ['commit', '-m', `feat(tile): ${job.output_name} via admin normalizer`], { cwd: REPO })
    await run('git', ['push', 'origin', 'main'], { cwd: REPO, timeout: 10 * 60_000 })

    await setStatus(job.id, { status: 'installed' })
    log('  installed and pushed — Vercel will deploy in ~60s')
  } catch (e) {
    log(`  install FAILED: ${e.message}`)
    await setStatus(job.id, { status: 'failed', log: String(e.message).slice(0, 4000) })
  }
}

async function tick() {
  const { data, error } = await db.from('tile_jobs')
    .select('*').in('status', ['queued', 'accepted'])
    .order('created_at', { ascending: true }).limit(1)
  if (error) { log('poll error:', error.message); return }
  const job = data?.[0]
  if (!job) return
  if (job.status === 'queued') await normalize(job)
  else await install(job)
}

log(`worker up — repo ${REPO}, polling every ${POLL_MS}ms`)
for (;;) {
  await tick().catch(e => log('tick error:', e.message))
  await new Promise(r => setTimeout(r, POLL_MS))
}
