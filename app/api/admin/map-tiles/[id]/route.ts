import { NextRequest, NextResponse } from 'next/server'
import { isAdmin, adminClient } from '@/lib/admin'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!await isAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await params
  const db = adminClient()
  const body = await req.json()
  const patch: Record<string, unknown> = {}
  if ('type' in body)         patch.type = body.type
  if ('story_id' in body)     patch.story_id = body.story_id
  if ('name' in body)         patch.name = body.name
  if ('terrain_type' in body) patch.terrain_type = body.terrain_type
  const { error } = await db.from('tiles').update(patch).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
