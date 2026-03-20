import { NextRequest, NextResponse } from 'next/server'
import { isAdmin, adminClient } from '@/lib/admin'

export async function POST(request: NextRequest) {
  if (!await isAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const formData = await request.formData()
  const file = formData.get('audio') as File | null
  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })

  const db = adminClient()
  const ext = file.name.split('.').pop() ?? 'mp3'
  const path = `${crypto.randomUUID()}.${ext}`

  const arrayBuffer = await file.arrayBuffer()
  const { error } = await db.storage
    .from('story-audio')
    .upload(path, new Blob([arrayBuffer], { type: file.type }), {
      contentType: file.type,
      upsert: false,
    })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data } = db.storage.from('story-audio').getPublicUrl(path)
  return NextResponse.json({ url: data.publicUrl })
}
