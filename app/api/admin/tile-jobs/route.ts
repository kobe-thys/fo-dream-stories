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
const HEX_RE = /^#[0-9a-fA-F]{6}$/

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
    base_top_color: HEX_RE.test(body.base_top_color ?? '') ? body.base_top_color : null,
    base_side_color: HEX_RE.test(body.base_side_color ?? '') ? body.base_side_color : null,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest) {
  if (!await isAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const body = await req.json()
  const { id, status } = body

  // The admin may accept, discard, or ask for another adjust pass. Every other
  // transition belongs to the worker.
  if (!['accepted', 'failed', 'adjust'].includes(status)) {
    return NextResponse.json({ error: 'Only accepted/failed/adjust allowed here' }, { status: 400 })
  }

  const patch: Record<string, unknown> = { status }

  if (status === 'adjust') {
    const rng = (v: unknown, lo: number, hi: number, dflt: number) => {
      if (v === undefined || v === null || v === '') return dflt
      const n = Number(v)
      return Number.isFinite(n) && n >= lo && n <= hi ? n : null
    }
    const sx = rng(body.shift_x, -0.5, 0.5, 0)
    const sz = rng(body.shift_z, -0.5, 0.5, 0)
    const sc = rng(body.top_scale, 0.5, 2, 1)
    if (sx === null || sz === null || sc === null) {
      return NextResponse.json({ error: 'shift ±0.5, scale 0.5–2' }, { status: 400 })
    }
    patch.shift_x = sx
    patch.shift_z = sz
    patch.top_scale = sc
    if (body.base_top_color !== undefined) {
      patch.base_top_color = HEX_RE.test(body.base_top_color ?? '') ? body.base_top_color : null
    }
    if (body.base_side_color !== undefined) {
      patch.base_side_color = HEX_RE.test(body.base_side_color ?? '') ? body.base_side_color : null
    }
  }

  const db = adminClient()
  const { error } = await db.from('tile_jobs').update(patch).eq('id', id).eq('status', 'preview_ready')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
