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

/**
 * Compose two models already in public/models into one tile, then preview.
 * Seconds rather than minutes — no simplification, no texture work, just a merge.
 */
async function compose(job) {
  if (!NAME_RE.test(job.output_name)) {
    return setStatus(job.id, { status: 'failed', log: `unsafe output_name: ${job.output_name}` })
  }
  await setStatus(job.id, { status: 'running', log: null })
  log(`composing ${job.base_model} + ${job.overlay_model} -> ${job.output_name}`)

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tilejob-'))
  const out = path.join(tmp, job.output_name)
  try {
    // Resolve by BASENAME inside public/models — never join a path from the row.
    const base = path.join(MODELS, path.basename(String(job.base_model)))
    const overlay = path.join(MODELS, path.basename(String(job.overlay_model)))
    if (!fs.existsSync(base)) throw new Error(`base not found: ${job.base_model}`)
    if (!fs.existsSync(overlay)) throw new Error(`overlay not found: ${job.overlay_model}`)

    const r = await run('node', [
      path.join(REPO, 'scripts/tiles/compose-tile.mjs'), base, overlay, out,
      `--dx=${Number(job.shift_x) || 0}`,
      `--dz=${Number(job.shift_z) || 0}`,
      `--rot=${Math.round(Number(job.overlay_rot) || 0)}`,
    ], { cwd: REPO, maxBuffer: 16 * 1024 * 1024, timeout: 10 * 60_000 })

    // A composed tile inherits whatever its base carries, so strip and normalise
    // materials here too rather than trusting the inputs.
    await run('node', [path.join(REPO, 'scripts/tiles/strip-lights.mjs'), out], { cwd: REPO })
    await run('node', [path.join(REPO, 'scripts/tiles/fix-materials.mjs'), out, '--keep-side'], { cwd: REPO })

    const png = out.replace(/\.glb$/i, '.png')
    await run('python3', [path.join(REPO, 'scripts/tiles/render_glb.py'), out, png],
              { cwd: REPO, timeout: 15 * 60_000 })

    const up = await db.storage.from('tile-previews')
      .upload(`${job.id}.png`, fs.readFileSync(png), { contentType: 'image/png', upsert: true })
    if (up.error) throw new Error(`preview upload failed: ${up.error.message}`)
    const { data: pub } = db.storage.from('tile-previews').getPublicUrl(`${job.id}.png`)

    fs.copyFileSync(out, path.join(os.tmpdir(), `tilejob-${job.id}.glb`))
    fs.copyFileSync(png, path.join(os.tmpdir(), `tilejob-${job.id}.png`))

    const tris = /([\d,]+) tris/.exec(r.stdout)?.[1]?.replace(/,/g, '')
    await setStatus(job.id, {
      status: 'preview_ready',
      preview_url: `${pub.publicUrl}?t=${Date.now()}`,
      log: (r.stdout + r.stderr).trim().split('\n').slice(-8).join('\n'),
      triangles: tris ? Number(tris) : null,
      bytes: fs.statSync(out).size,
    })
    log('  compose preview ready')
  } catch (e) {
    log(`  compose FAILED: ${e.message}`)
    await setStatus(job.id, { status: 'failed', log: String(e.message).slice(0, 4000) })
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
}

/**
 * Forge: an approved concept drawing becomes a tile.
 *
 *   concept.png -> Meshy image-to-3D -> normalize -> kenney-flatten -> preview
 *
 * The drawing was made on Vercel and stored in tile-previews/concepts/. Only its
 * OBJECT KEY reaches this process -- the idea text never does, so nothing here is
 * built from free-form input.
 *
 * `strip-lights` and `fix-materials` are deliberately NOT run. Meshy is asked for
 * enable_pbr=false, which already yields metallicFactor 0 and no embedded
 * KHR_lights_punctual, and kenney-flatten rewrites every material anyway. Running
 * the old fixers would only undo the colours it has just settled.
 */
async function forge(job) {
  if (!NAME_RE.test(job.output_name)) {
    return setStatus(job.id, { status: 'failed', log: `unsafe output_name: ${job.output_name}` })
  }
  if (!/^concepts\/[A-Za-z0-9._-]{1,120}\.png$/.test(String(job.concept_path || ''))) {
    return setStatus(job.id, { status: 'failed', log: `unsafe concept_path: ${job.concept_path}` })
  }
  if (!process.env.MESHY_API_KEY) {
    return setStatus(job.id, {
      status: 'failed',
      log: 'MESHY_API_KEY is not set in this worker. Add it to /root/.secrets/tokens.env, '
         + 'then: systemctl restart fo-tile-worker',
    })
  }

  await setStatus(job.id, { status: 'running', log: null })
  log(`forging ${job.output_name} (surface=${job.surface}, polycount=${job.polycount})`)

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tilejob-'))
  const concept = path.join(tmp, 'concept.png')
  const raw = path.join(tmp, 'raw.glb')
  const norm = path.join(tmp, 'norm.glb')
  const out = path.join(tmp, job.output_name)
  let stdout = ''

  try {
    const { data, error } = await db.storage.from('tile-previews').download(job.concept_path)
    if (error) throw new Error(`could not read the concept: ${error.message}`)
    fs.writeFileSync(concept, Buffer.from(await data.arrayBuffer()))

    // Meshy runs for minutes; give it room, but not forever.
    const m = await run('node', [
      path.join(REPO, 'scripts/tiles/meshy.mjs'), concept, raw,
      `--polycount=${Math.round(Number(job.polycount) || 10000)}`,
    ], { cwd: REPO, maxBuffer: 16 * 1024 * 1024, timeout: 30 * 60_000 })
    stdout += m.stdout + m.stderr

    const args = [
      '--max-old-space-size=8192',
      path.join(REPO, 'scripts/tiles/normalize-tile.mjs'), raw, norm,
      `--surface=${Number(job.surface)}`,
      `--budget=${Math.round(Number(job.budget) || 8000)}`,
    ]
    if (job.rebuild_base) args.push('--rebuild-base')
    const n = await run('node', args, { cwd: REPO, maxBuffer: 32 * 1024 * 1024, timeout: 40 * 60_000 })
    stdout += '\n' + n.stdout + n.stderr

    const flat = [path.join(REPO, 'scripts/tiles/kenney-flatten.mjs'), norm, out]
    if (job.skirt != null) flat.push(`--skirt=${Number(job.skirt)}`)
    const f = await run('node', flat, { cwd: REPO, maxBuffer: 32 * 1024 * 1024, timeout: 20 * 60_000 })
    stdout += '\n' + f.stdout + f.stderr

    const png = out.replace(/\.glb$/i, '.png')
    await run('python3', [path.join(REPO, 'scripts/tiles/render_glb.py'), out, png],
              { cwd: REPO, timeout: 20 * 60_000 })

    const key = `${job.id}.png`
    const up = await db.storage.from('tile-previews')
      .upload(key, fs.readFileSync(png), { contentType: 'image/png', upsert: true })
    if (up.error) throw new Error(`preview upload failed: ${up.error.message}`)
    const { data: pub } = db.storage.from('tile-previews').getPublicUrl(key)

    // Keep the built tile for the accept step rather than rebuilding it.
    fs.copyFileSync(out, path.join(os.tmpdir(), `tilejob-${job.id}.glb`))
    fs.copyFileSync(png, path.join(os.tmpdir(), `tilejob-${job.id}.png`))

    const last = (re) => { const hits = [...stdout.matchAll(re)]; return hits.length ? hits[hits.length - 1][1] : undefined }
    const R = last(/R=([\d.]+)/g)
    const plate = last(/plateTop=([\d.]+)/g)
    const tris = /triangles=[\d,]+ -> ([\d,]+)/.exec(stdout)?.[1]?.replace(/,/g, '')
    // Worth surfacing: below 0.82 the generated hex will not tile cleanly.
    const reg = /base regularity: ([\d.]+)/.exec(stdout)?.[1]

    await setStatus(job.id, {
      status: 'preview_ready',
      preview_url: `${pub.publicUrl}?t=${Date.now()}`,
      log: (reg ? `base regularity ${reg} (0.866 = perfect hexagon)\n──────────\n` : '')
         + stdout.trim().split('\n').slice(-14).join('\n'),
      measured_r: R ? Number(R) : null,
      measured_plate_top: plate ? Number(plate) : null,
      triangles: tris ? Number(tris) : null,
      bytes: fs.statSync(out).size,
    })
    log(`  forge preview ready — R=${R} plateTop=${plate} tris=${tris} regularity=${reg}`)
  } catch (e) {
    const detail = `${e.stdout || ''}${e.stderr || ''}`.trim() || e.message
    log(`  FAILED: ${e.message}`)
    await setStatus(job.id, {
      status: 'failed',
      log: `${stdout}\n──────────\n${detail}`.trim().split('\n').slice(-16).join('\n'),
    })
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
}

/** Normalize a queued job and publish a preview for review. */
async function normalize(job) {
  if (!NAME_RE.test(job.output_name)) {
    return setStatus(job.id, { status: 'failed', log: `unsafe output_name: ${job.output_name}` })
  }
  await setStatus(job.id, { status: 'running', log: null })
  log(`normalizing ${job.output_name} (surface=${job.surface})`)

  let profile = ''
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tilejob-'))
  const src = path.join(tmp, 'source.glb')
  const out = path.join(tmp, job.output_name)

  try {
    const { data, error } = await db.storage.from('tile-sources').download(job.source_path)
    if (error) throw new Error(`download failed: ${error.message}`)
    fs.writeFileSync(src, Buffer.from(await data.arrayBuffer()))

    // Profile the source BEFORE normalizing, and keep it whatever the outcome.
    // Choosing --base-top otherwise means guessing at a number you cannot see, and
    // a failed job is exactly when you most need the profile in front of you.
    try {
      const p = await run('node', ['--max-old-space-size=8192',
        path.join(REPO, 'scripts/tiles/inspect-tile.mjs'), src],
        { cwd: REPO, maxBuffer: 8 * 1024 * 1024, timeout: 10 * 60_000 })
      profile = p.stdout
    } catch (e) {
      profile = `(profile unavailable: ${e.message.split('\n')[0]})`
    }

    // Built from typed columns only — never a string from the row.
    const args = [
      '--max-old-space-size=8192',
      path.join(REPO, 'scripts/tiles/normalize-tile.mjs'),
      src, out,
      `--surface=${Number(job.surface)}`,
      `--budget=${Math.round(Number(job.budget))}`,
    ]
    if (job.base_top != null) args.push(`--base-top=${Number(job.base_top)}`)
    if (Number(job.artwork_rot)) args.push(`--rot-art=${Number(job.artwork_rot)}`)
    if (job.align_cut) args.push('--align-cut')
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
    const matArgs = [path.join(REPO, 'scripts/tiles/fix-materials.mjs'), out]
    if (/^#[0-9a-fA-F]{6}$/.test(job.base_top_color || '')) matArgs.push(`--base-top=${job.base_top_color}`)
    if (/^#[0-9a-fA-F]{6}$/.test(job.base_side_color || '')) matArgs.push(`--base-side=${job.base_side_color}`)
    await run('node', matArgs, { cwd: REPO })

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
      log: `${profile}\n──────────\n${stdout.trim().split('\n').slice(-12).join('\n')}`,
      measured_r: R ? Number(R) : null,
      measured_plate_top: plate ? Number(plate) : null,
      triangles: tris ? Number(tris) : null,
      bytes: fs.statSync(out).size,
    })
    log(`  preview ready — R=${R} plateTop=${plate} tris=${tris}`)
  } catch (e) {
    log(`  FAILED: ${e.message}`)
    await setStatus(job.id, {
      status: 'failed',
      log: `${profile}\n──────────\n${String(e.message)}`.slice(0, 8000),
    })
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
}

/**
 * Re-apply base colours and an artwork nudge to the ALREADY-BUILT tile, then
 * re-render. Seconds rather than the minutes a re-normalize would cost, which is
 * the whole point: placement is judged by eye, so it has to be cheap to retry.
 */
async function adjust(job) {
  log(`adjusting ${job.output_name}`)
  const cached = path.join(os.tmpdir(), `tilejob-${job.id}.glb`)
  const pristine = path.join(os.tmpdir(), `tilejob-${job.id}.orig.glb`)
  try {
    if (!fs.existsSync(cached)) throw new Error('built tile missing — re-run the job')
    // Keep an untouched copy: adjustments are absolute, not cumulative, so each
    // preview must start from the freshly built tile.
    if (!fs.existsSync(pristine)) fs.copyFileSync(cached, pristine)
    fs.copyFileSync(pristine, cached)

    // A forged tile has already been through kenney-flatten, which settled every
    // material onto the Kenney colormap. fix-materials would repaint over that and
    // undo the palette, so it only runs for the older kinds.
    if (job.kind !== 'forge') {
      const matArgs = [path.join(REPO, 'scripts/tiles/fix-materials.mjs'), cached]
      if (/^#[0-9a-fA-F]{6}$/.test(job.base_top_color || '')) matArgs.push(`--base-top=${job.base_top_color}`)
      if (/^#[0-9a-fA-F]{6}$/.test(job.base_side_color || '')) matArgs.push(`--base-side=${job.base_side_color}`)
      await run('node', matArgs, { cwd: REPO })
    }

    // Composed tiles have no hexBase mesh, so adjust-tile has nothing to anchor
    // against; re-compose instead by editing the job's shift and re-queueing.
    if (job.kind === 'compose') throw new Error('use Re-compose to move a composed overlay')
    const adjArgs = [
      path.join(REPO, 'scripts/tiles/adjust-tile.mjs'), cached,
      `--shift-x=${Number(job.shift_x) || 0}`,
      `--shift-z=${Number(job.shift_z) || 0}`,
      `--scale=${Number(job.top_scale) || 1}`,
      `--rot=${Number(job.artwork_rot) || 0}`,
    ]
    if (job.align_cut) adjArgs.push('--center')
    await run('node', adjArgs, { cwd: REPO })

    const png = path.join(os.tmpdir(), `tilejob-${job.id}.png`)
    await run('python3', [path.join(REPO, 'scripts/tiles/render_glb.py'), cached, png],
              { cwd: REPO, timeout: 15 * 60_000 })

    const up = await db.storage.from('tile-previews')
      .upload(`${job.id}.png`, fs.readFileSync(png), { contentType: 'image/png', upsert: true })
    if (up.error) throw new Error(`preview upload failed: ${up.error.message}`)
    const { data: pub } = db.storage.from('tile-previews').getPublicUrl(`${job.id}.png`)

    await setStatus(job.id, {
      status: 'preview_ready',
      preview_url: `${pub.publicUrl}?t=${Date.now()}`,
      bytes: fs.statSync(cached).size,
    })
    log('  adjusted preview ready')
  } catch (e) {
    log(`  adjust FAILED: ${e.message}`)
    await setStatus(job.id, { status: 'failed', log: String(e.message).slice(0, 4000) })
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

    // Re-installing a tile that came out byte-identical stages nothing, and
    // `git commit` exits non-zero on an empty index -- which used to fail the job
    // with a baffling error even though the tile was already live and correct.
    let staged = true
    try {
      await run('git', ['diff', '--cached', '--quiet'], { cwd: REPO })
      staged = false
    } catch { /* non-zero means there ARE staged changes */ }

    if (!staged) {
      await setStatus(job.id, { status: 'installed', log: 'Identical to the installed tile — nothing to deploy.' })
      log('  identical to what is already installed — nothing to push')
      return
    }

    await run('git', ['commit', '-m', `feat(tile): ${job.output_name} via admin ${job.kind === 'forge' ? 'forge' : 'normalizer'}`], { cwd: REPO })
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
    .select('*').in('status', ['queued', 'adjust', 'accepted'])
    .order('created_at', { ascending: true }).limit(1)
  if (error) { log('poll error:', error.message); return }
  const job = data?.[0]
  if (!job) return
  if (job.status === 'queued') {
    const build = { compose, forge }[job.kind] ?? normalize
    await build(job)
  }
  else if (job.status === 'adjust') await adjust(job)
  else await install(job)
}

/**
 * Reclaim jobs orphaned by a worker restart.
 *
 * A job is marked 'running' by the worker that owns it. If that process dies --
 * a systemd restart during a deploy, a crash, a reboot -- the row stays 'running'
 * forever and the UI shows a spinner for a job nobody is doing. There is exactly
 * one worker, so anything still 'running' at startup is by definition abandoned.
 *
 * 'adjust' and 'accepted' are left alone: both are cheap and idempotent, and the
 * poll below picks them up on its own.
 */
async function reclaimOrphans() {
  const { data, error } = await db.from('tile_jobs')
    .update({ status: 'queued', log: 'Requeued: the worker restarted while this job was running.' })
    .eq('status', 'running')
    .select('output_name')
  if (error) { log('orphan sweep failed:', error.message); return }
  if (data?.length) log(`requeued ${data.length} orphaned job(s): ${data.map(j => j.output_name).join(', ')}`)
}

await reclaimOrphans()

log(`worker up — repo ${REPO}, polling every ${POLL_MS}ms`)
for (;;) {
  await tick().catch(e => log('tick error:', e.message))
  await new Promise(r => setTimeout(r, POLL_MS))
}
