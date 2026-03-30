import { NextRequest, NextResponse } from 'next/server'
import { isAdmin, adminClient } from '@/lib/admin'

export async function GET() {
  if (!await isAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const db = adminClient()
  const { data, error } = await db
    .from('stories')
    .select('id, title, created_at, story_text, audio_url, alex_tip, fo_image_url')
    .order('created_at', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const result = (data ?? []).map((s: Record<string, unknown>) => ({
    id: s.id,
    title: s.title,
    created_at: s.created_at,
    has_story_text: Boolean(s.story_text),
    has_audio: Boolean(s.audio_url),
    has_alex_tip: Boolean(s.alex_tip),
    has_fo_image: Boolean(s.fo_image_url),
  }))
  return NextResponse.json(result)
}

export async function POST(request: NextRequest) {
  if (!await isAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const db = adminClient()
  const body = await request.json()
  if (!body.title) return NextResponse.json({ error: 'title required' }, { status: 400 })
  const { data, error } = await db.from('stories').insert({ title: body.title }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
