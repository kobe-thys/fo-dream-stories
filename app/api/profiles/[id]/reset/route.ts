import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { adminClient } from '@/lib/admin'

// POST /api/profiles/[id]/reset — clear all tile states and dream submissions for a child profile
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = adminClient()

  // Verify ownership: family_id on child_profiles equals the user's auth id
  const { data: profile } = await db.from('child_profiles').select('family_id').eq('id', id).single()
  if (!profile) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (profile.family_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await db.from('dream_submissions').delete().eq('child_profile_id', id)
  const { error } = await db.from('child_tile_states').delete().eq('child_profile_id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
