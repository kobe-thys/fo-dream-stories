import { NextRequest, NextResponse } from 'next/server'
import { isAdmin, adminClient } from '@/lib/admin'

export async function GET() {
  if (!await isAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const db = adminClient()
  const { data, error } = await db
    .from('dream_submissions')
    .select(`
      id, transcribed_text, token_image_url, generated_image_url,
      input_type, is_shared, created_at,
      child_profiles ( name, date_of_birth ),
      tiles ( name )
    `)
    .eq('is_shared', true)
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE a shared dream (sets is_shared = false)
export async function DELETE(request: NextRequest) {
  if (!await isAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await request.json()
  const db = adminClient()
  const { error } = await db
    .from('dream_submissions')
    .update({ is_shared: false })
    .eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
