import { NextRequest, NextResponse } from 'next/server'
import { isAdmin, adminClient } from '@/lib/admin'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!await isAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await params
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  const db = adminClient()
  const body = await req.json()
  const patch: Record<string, unknown> = {}
  if ('type' in body)         patch.type = body.type
  if ('story_id' in body)     patch.story_id = body.story_id
  if ('name' in body)         patch.name = body.name
  if ('terrain_type' in body) patch.terrain_type = body.terrain_type
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }
  const { error } = await db.from('tiles').update(patch).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
