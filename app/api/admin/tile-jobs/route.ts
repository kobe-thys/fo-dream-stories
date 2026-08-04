import { NextRequest, NextResponse } from 'next/server'
import { isAdmin, adminClient } from '@/lib/admin'

/**
 * Tile normalization jobs.
 *
 * The admin page only ENQUEUES here — normalizing needs minutes and ~8 GB of RAM,
 * well past serverless limits, and public/ is not writable in production. A worker
 * on Kobe's machine polls this table and does the work.
 *
 * Everything a client can set is validated to a number, a boolean or a safe name.
 * The worker turns these into CLI flags, so anything free-form here would become a
 * command-injection path onto a personal machine.
 */

const NAME_RE = /^[a-z0-9][a-z0-9 _-]{0,60}\.glb$/i

export async function GET() {
  if (!await isAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const db = adminClient()
  const { data, error } = await db
    .from('tile_jobs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(30)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  if (!await isAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const body = await req.json()

  const sourcePath = String(body.source_path ?? '')
  const outputName = String(body.output_name ?? '')
  if (!sourcePath || sourcePath.includes('..')) {
    return NextResponse.json({ error: 'Bad source_path' }, { status: 400 })
  }
  if (!NAME_RE.test(outputName)) {
    return NextResponse.json({ error: 'output_name must be a simple .glb filename' }, { status: 400 })
  }

  const num = (v: unknown, lo: number, hi: number, dflt: number | null) => {
    if (v === undefined || v === null || v === '') return dflt
    const n = Number(v)
    return Number.isFinite(n) && n >= lo && n <= hi ? n : null
  }

  const surface = num(body.surface, 0.01, 2, null)
  if (surface === null) return NextResponse.json({ error: 'surface must be 0.01–2' }, { status: 400 })
  const baseTop = body.base_top === undefined || body.base_top === '' ? null : num(body.base_top, 0.001, 5, null)
  if (body.base_top !== undefined && body.base_top !== '' && baseTop === null) {
    return NextResponse.json({ error: 'base_top must be 0.001–5' }, { status: 400 })
  }
  const budget = num(body.budget, 500, 200000, 8000)
  if (budget === null) return NextResponse.json({ error: 'budget must be 500–200000' }, { status: 400 })

  const db = adminClient()
  const { data, error } = await db.from('tile_jobs').insert({
    source_path: sourcePath,
    output_name: outputName,
    surface,
    base_top: baseTop,
    budget: Math.round(budget),
    match_water: !!body.match_water,
    palette_lock: body.palette_lock !== false,
    rebuild_base: body.rebuild_base !== false,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest) {
  if (!await isAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id, status } = await req.json()
  // The admin may only accept a finished preview or discard a job — every other
  // transition belongs to the worker.
  if (!['accepted', 'failed'].includes(status)) {
    return NextResponse.json({ error: 'Only accepted/failed allowed here' }, { status: 400 })
  }
  const db = adminClient()
  const { error } = await db.from('tile_jobs').update({ status }).eq('id', id).eq('status', 'preview_ready')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
