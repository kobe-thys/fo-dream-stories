import { NextRequest, NextResponse } from 'next/server'
import { isAdmin, adminClient } from '@/lib/admin'

export async function GET() {
  if (!await isAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const db = adminClient()
  const { data, error } = await db.from('tile_unlocks').select('from_tile_id, to_tile_id')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// Replaces all unlocks for a single from_tile_id
// Body: { from_tile_id: string; to_tile_ids: string[] }
export async function PUT(req: NextRequest) {
  if (!await isAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const db = adminClient()
  const body = await req.json()
  const { from_tile_id, to_tile_ids } = body
  if (!from_tile_id || typeof from_tile_id !== 'string') {
    return NextResponse.json({ error: 'from_tile_id required' }, { status: 400 })
  }
  if (!Array.isArray(to_tile_ids)) {
    return NextResponse.json({ error: 'to_tile_ids must be an array' }, { status: 400 })
  }
  const { error: deleteError } = await db.from('tile_unlocks').delete().eq('from_tile_id', from_tile_id)
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 })
  if (to_tile_ids.length > 0) {
    const rows = (to_tile_ids as string[]).map(to_tile_id => ({ from_tile_id, to_tile_id }))
    const { error } = await db.from('tile_unlocks').insert(rows)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
