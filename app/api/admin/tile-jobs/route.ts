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

const MODEL_RE = /^[A-Za-z0-9][A-Za-z0-9 _.-]{0,60}\.glb$/

export async function POST(req: NextRequest) {
  if (!await isAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const body = await req.json()

  // ── compose: pair two models already in public/models ──────────────────
  if (body.kind === 'compose') {
    const outputName = String(body.output_name ?? '')
    if (!NAME_RE.test(outputName)) {
      return NextResponse.json({ error: 'output_name must be a simple .glb filename' }, { status: 400 })
    }
    for (const k of ['base_model', 'overlay_model'] as const) {
      if (!MODEL_RE.test(String(body[k] ?? ''))) {
        return NextResponse.json({ error: `${k} must be a plain .glb name` }, { status: 400 })
      }
    }
    const inRange = (v: unknown, lo: number, hi: number) => {
      const n = Number(v ?? 0)
      return Number.isFinite(n) && n >= lo && n <= hi ? n : null
    }
    const dx = inRange(body.shift_x, -0.5, 0.5)
    const dz = inRange(body.shift_z, -0.5, 0.5)
    const rot = inRange(body.overlay_rot, 0, 5)
    if (dx === null || dz === null || rot === null) {
      return NextResponse.json({ error: 'shift ±0.5, rotation 0–5' }, { status: 400 })
    }

    const db = adminClient()
    const { data, error } = await db.from('tile_jobs').insert({
      kind: 'compose',
      output_name: outputName,
      base_model: body.base_model,
      overlay_model: body.overlay_model,
      shift_x: dx, shift_z: dz, overlay_rot: Math.round(rot),
      source_path: null, surface: null,
    }).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

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
  const artworkRot = num(body.artwork_rot, -180, 180, 0)
  if (artworkRot === null) return NextResponse.json({ error: 'artwork_rot must be -180..180' }, { status: 400 })
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
    artwork_rot: artworkRot,
    align_cut: !!body.align_cut,
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
  if (!['accepted', 'failed', 'adjust', 'queued'].includes(status)) {
    return NextResponse.json({ error: 'Only accepted/failed/adjust/queued allowed here' }, { status: 400 })
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

  // Re-run: for a normalize this re-does the whole build with new rotation or
  // alignment; for a compose it just moves the overlay.
  if (status === 'queued') {
    const rot180 = (v: unknown) => {
      if (v === undefined) return undefined
      const n = Number(v)
      return Number.isFinite(n) && n >= -180 && n <= 180 ? n : null
    }
    const ar = rot180(body.artwork_rot)
    if (ar === null) return NextResponse.json({ error: 'artwork_rot must be -180..180' }, { status: 400 })
    if (ar !== undefined) patch.artwork_rot = ar
    if (body.align_cut !== undefined) patch.align_cut = !!body.align_cut
  }
  if (status === 'queued') {
    const inRange = (v: unknown, lo: number, hi: number) => {
      const n = Number(v ?? 0)
      return Number.isFinite(n) && n >= lo && n <= hi ? n : null
    }
    const dx = inRange(body.shift_x, -0.5, 0.5)
    const dz = inRange(body.shift_z, -0.5, 0.5)
    const rot = inRange(body.overlay_rot, 0, 5)
    if (dx === null || dz === null || rot === null) {
      return NextResponse.json({ error: 'shift ±0.5, rotation 0–5' }, { status: 400 })
    }
    patch.shift_x = dx; patch.shift_z = dz; patch.overlay_rot = Math.round(rot)
  }

  const db = adminClient()
  const { error } = await db.from('tile_jobs').update(patch).eq('id', id).eq('status', 'preview_ready')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
