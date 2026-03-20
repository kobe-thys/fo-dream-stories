import { NextRequest, NextResponse } from 'next/server'
import { isAdmin, adminClient } from '@/lib/admin'

export async function GET() {
  if (!await isAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const db = adminClient()
  const { data, error } = await db.from('tile_unlocks').select('from_tile_id, to_tile_id')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// PUT replaces the entire unlock graph: { unlocks: [{from_tile_id, to_tile_id}] }
export async function PUT(request: NextRequest) {
  if (!await isAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { unlocks } = await request.json() as { unlocks: { from_tile_id: string; to_tile_id: string }[] }
  const db = adminClient()
  // Delete all existing rows. PostgREST requires at least one filter on DELETE;
  // filtering on a column that is always non-null satisfies this requirement cleanly.
  const { error: deleteError } = await db.from('tile_unlocks').delete().not('from_tile_id', 'is', null)
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 })
  if (unlocks.length > 0) {
    const { error: insertError } = await db.from('tile_unlocks').insert(unlocks)
    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
