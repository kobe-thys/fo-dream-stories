import { NextRequest, NextResponse } from 'next/server'
import { isAdmin, adminClient } from '@/lib/admin'

export async function GET() {
  if (!await isAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const db = adminClient()
  const { data, error } = await db
    .from('tiles')
    .select('id, type, name, position_q, position_r, terrain_type, model, rotation, story_id, published, scale_x, scale_y, scale_z, story:stories(id, title)')
    .order('created_at', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  if (!await isAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const db = adminClient()
  const { q, r, model } = await req.json()
  if (q === undefined || r === undefined) {
    return NextResponse.json({ error: 'q and r required' }, { status: 400 })
  }
  const { data, error } = await db
    .from('tiles')
    .insert({ type: 'undefined', position_q: q, position_r: r, model: model ?? null, rotation: 0, published: false, scale_x: 1.0, scale_y: 1.0, scale_z: 1.0 })
    .select('id, type, name, position_q, position_r, terrain_type, model, rotation, story_id, published, scale_x, scale_y, scale_z')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ...data, story: null }, { status: 201 })
}

export async function DELETE() {
  if (!await isAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const db = adminClient()
  // Delete child_tile_states first (FK to tiles)
  await db.from('child_tile_states').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  // Delete tile_unlocks (FK to tiles)
  await db.from('tile_unlocks').delete().neq('from_tile_id', '00000000-0000-0000-0000-000000000000')
  // Delete all tiles
  const { error } = await db.from('tiles').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
