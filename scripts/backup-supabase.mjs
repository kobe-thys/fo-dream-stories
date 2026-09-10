/**
 * Daily backup of everything Supabase holds that git does not.
 *
 *   set -a && . /root/.secrets/tokens.env && set +a
 *   node scripts/backup-supabase.mjs [--dry-run]
 *
 * WHY THIS EXISTS
 * The code and every built tile are on GitHub, and the DB SCHEMA is in
 * supabase/migrations. Nothing backs up the DATA: the map's 178 tiles and their
 * unlock graph, the stories, and — the part that cannot be regenerated at any
 * price — the dream images and recordings children have submitted. Losing the
 * Supabase project today would lose all of it.
 *
 * WHY NOT pg_dump
 * There is no Postgres client on this box and no DB password in tokens.env (only
 * the other project's). This takes a LOGICAL backup over the REST API with the
 * service role instead, which needs neither. The schema is already in git, so rows
 * are the missing half.
 *
 * WHAT IS DELIBERATELY NOT BACKED UP
 * `tile-sources` (162 MB of raw generator uploads) and `tile-previews` (job preview
 * renders) are intermediate artefacts — the finished tiles they produced are in git.
 * Copying them nightly would cost 165 MB a day to protect nothing. If that judgement
 * ever changes, add them to BUCKETS.
 *
 * LAYOUT
 *   <ROOT>/latest/<bucket>/<path>   a mirror; only missing objects are fetched
 *   <ROOT>/YYYY-MM-DD/*.json        that day's table rows + a storage manifest
 *
 * Storage is mirrored rather than copied per day because the objects are immutable
 * — a dream image never changes once written — so a dated copy would be the same
 * bytes again. The dated dirs stay small and the mirror stays current.
 *
 * THIS CONTAINS CHILDREN'S PERSONAL DATA. The directory is created 0700 and must
 * never be moved somewhere served, synced to a public place, or committed.
 */
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://tdoqdiyalenignhitxgj.supabase.co'
const KEY = process.env.SUPABASE_SERVICE_ROLE
const ROOT = process.env.BACKUP_ROOT || '/root/backups/fo-dream-stories'
const KEEP_DAYS = Number(process.env.BACKUP_KEEP || 14)
const DRY = process.argv.includes('--dry-run')

if (!KEY) {
  console.error('SUPABASE_SERVICE_ROLE not set — source /root/.secrets/tokens.env')
  process.exit(1)
}

// Every table in the public schema. Listed explicitly rather than discovered, so a
// table added later shows up as a loud failure here instead of being silently missed.
const TABLES = [
  'app_settings', 'child_profiles', 'child_tile_states', 'dream_submissions',
  'families', 'stories', 'tile_jobs', 'tile_unlocks', 'tiles', 'user_progress',
]

// Only the buckets holding something irreplaceable. See the header.
const BUCKETS = ['dream-images', 'dream-inputs', 'story-audio']

const db = createClient(URL, KEY, { auth: { persistSession: false } })
const log = (...a) => console.log(new Date().toISOString().slice(0, 19).replace('T', ' '), ...a)
const day = new Date().toISOString().slice(0, 10)
const dated = path.join(ROOT, day)
const mirror = path.join(ROOT, 'latest')

/** Page through a table so a large one cannot be silently truncated. */
async function dumpTable(name) {
  const rows = []
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db.from(name).select('*').range(from, from + PAGE - 1)
    if (error) throw new Error(`${name}: ${error.message}`)
    rows.push(...data)
    if (data.length < PAGE) break
  }
  if (!DRY) fs.writeFileSync(path.join(dated, `${name}.json`), JSON.stringify(rows, null, 2))
  return rows.length
}

/** Storage lists one prefix at a time, so walk into folders. */
async function walk(bucket, prefix = '') {
  const out = []
  const PAGE = 100
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await db.storage.from(bucket)
      .list(prefix, { limit: PAGE, offset, sortBy: { column: 'name', order: 'asc' } })
    if (error) throw new Error(`${bucket}/${prefix}: ${error.message}`)
    for (const item of data) {
      const full = prefix ? `${prefix}/${item.name}` : item.name
      // A row with no id is a folder placeholder, not an object.
      if (item.id === null) out.push(...await walk(bucket, full))
      else out.push({ path: full, size: item.metadata?.size ?? 0, updated: item.updated_at })
    }
    if (data.length < PAGE) break
  }
  return out
}

async function mirrorBucket(bucket) {
  const objects = await walk(bucket)
  let fetched = 0, bytes = 0, skipped = 0
  for (const o of objects) {
    const dest = path.join(mirror, bucket, o.path)
    // Objects here are immutable once written, so an existing file of the right
    // size is already correct and re-downloading it would be pure cost.
    if (fs.existsSync(dest) && fs.statSync(dest).size === o.size) { skipped++; continue }
    if (DRY) { fetched++; bytes += o.size; continue }
    const { data, error } = await db.storage.from(bucket).download(o.path)
    if (error) { log(`  ! ${bucket}/${o.path}: ${error.message}`); continue }
    fs.mkdirSync(path.dirname(dest), { recursive: true })
    fs.writeFileSync(dest, Buffer.from(await data.arrayBuffer()))
    fetched++; bytes += o.size
  }
  return { objects, fetched, bytes, skipped }
}

const started = Date.now()
if (!DRY) fs.mkdirSync(dated, { recursive: true, mode: 0o700 })
if (!DRY) fs.mkdirSync(mirror, { recursive: true, mode: 0o700 })

let tableRows = 0
const summary = { day, tables: {}, buckets: {} }

for (const t of TABLES) {
  const n = await dumpTable(t)
  summary.tables[t] = n
  tableRows += n
  log(`table ${t.padEnd(20)} ${String(n).padStart(6)} rows`)
}

for (const b of BUCKETS) {
  const r = await mirrorBucket(b)
  summary.buckets[b] = { objects: r.objects.length, newly_fetched: r.fetched, bytes: r.bytes }
  if (!DRY) {
    fs.writeFileSync(path.join(dated, `storage-${b}.manifest.json`),
      JSON.stringify(r.objects, null, 2))
  }
  log(`bucket ${b.padEnd(19)} ${String(r.objects.length).padStart(6)} objects  `
    + `${r.fetched} new (${(r.bytes / 1e6).toFixed(1)} MB), ${r.skipped} already held`)
}

// Retention. Only ever removes directories whose name is a plain date, so a typo in
// BACKUP_ROOT cannot make this delete something else.
let pruned = 0
if (!DRY && fs.existsSync(ROOT)) {
  const dirs = fs.readdirSync(ROOT).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort()
  for (const d of dirs.slice(0, Math.max(0, dirs.length - KEEP_DAYS))) {
    fs.rmSync(path.join(ROOT, d), { recursive: true, force: true })
    pruned++
  }
}

summary.seconds = Math.round((Date.now() - started) / 1000)
summary.pruned = pruned
if (!DRY) fs.writeFileSync(path.join(dated, 'summary.json'), JSON.stringify(summary, null, 2))

const du = d => { let n = 0; const walkfs = p => { for (const e of fs.readdirSync(p, { withFileTypes: true })) { const f = path.join(p, e.name); e.isDirectory() ? walkfs(f) : n += fs.statSync(f).size } }; if (fs.existsSync(d)) walkfs(d); return n }
log(`done in ${summary.seconds}s — ${tableRows} rows, mirror ${(du(mirror) / 1e6).toFixed(1)} MB`
  + `, ${pruned} old day(s) pruned`)
if (DRY) log('(dry run — nothing written)')
