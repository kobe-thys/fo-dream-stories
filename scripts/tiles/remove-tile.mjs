/**
 * Remove an installed tile safely.
 *
 *   node scripts/tiles/remove-tile.mjs <name.glb> [--yes] [--force]
 *
 * Deleting a model is not just deleting a file. Placed tiles reference a model by
 * FILENAME, so removing one that is still on the map leaves rows pointing at a
 * 404 -- and a missing GLB suspends the Canvas, which is the failure that used to
 * blank the whole dreamer map. So this refuses to delete a model that is still
 * placed unless --force, and tells you how many tiles use it.
 *
 * Without --yes it only reports what it would do.
 */
import { createClient } from '@supabase/supabase-js'
import { execFile } from 'child_process'
import { promisify } from 'util'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const run = promisify(execFile)
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const MODELS = path.join(REPO, 'public', 'models')

const args = process.argv.slice(2)
const NAME = args.find(a => !a.startsWith('--'))
const YES = args.includes('--yes')
const FORCE = args.includes('--force')

if (!NAME || !/^[\w .()-]+\.glb$/i.test(NAME)) {
  console.error('usage: remove-tile.mjs <name.glb> [--yes] [--force]')
  process.exit(1)
}

const glb = path.join(MODELS, path.basename(NAME))
const png = glb.replace(/\.glb$/i, '.png')
if (!fs.existsSync(glb)) { console.error(`not installed: ${NAME}`); process.exit(1) }

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://tdoqdiyalenignhitxgj.supabase.co'
const KEY = process.env.SUPABASE_SERVICE_ROLE
if (!KEY) { console.error('SUPABASE_SERVICE_ROLE not set'); process.exit(1) }
const db = createClient(URL_, KEY, { auth: { persistSession: false } })

const { count, error } = await db
  .from('tiles').select('*', { count: 'exact', head: true }).eq('model', NAME)
if (error) { console.error('could not check placements:', error.message); process.exit(1) }

console.log(`  ${NAME}`)
console.log(`  placed on the map: ${count ?? 0} tile(s)`)

if (count && !FORCE) {
  console.error(`\nREFUSING: still placed on ${count} tile(s). Remove them in the map builder`)
  console.error('first, or pass --force to delete anyway (those tiles will fail to load).')
  process.exit(1)
}

if (!YES) {
  console.log(`\nWould delete:\n  ${glb}`)
  if (fs.existsSync(png)) console.log(`  ${png}`)
  console.log('\nRe-run with --yes to do it.')
  process.exit(0)
}

fs.unlinkSync(glb)
if (fs.existsSync(png)) fs.unlinkSync(png)
await run('npm', ['run', 'models:manifest'], { cwd: REPO, timeout: 5 * 60_000 })
await run('git', ['add', '-A', 'public/models'], { cwd: REPO })
await run('git', ['commit', '-m', `chore(tile): remove ${NAME}`], { cwd: REPO })
await run('git', ['push', 'origin', 'main'], { cwd: REPO, timeout: 10 * 60_000 })
console.log('\n  deleted, manifest rebuilt, pushed — Vercel deploys in ~60s')
