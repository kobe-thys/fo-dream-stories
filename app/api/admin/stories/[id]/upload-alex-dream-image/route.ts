import { NextRequest, NextResponse } from 'next/server'
import { isAdmin, adminClient } from '@/lib/admin'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await isAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id: storyId } = await params
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!UUID_RE.test(storyId)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  }
  const formData = await request.formData()
  const file = formData.get('image') as File | null
  if (!file) return NextResponse.json({ error: 'image file required' }, { status: 400 })

  const db = adminClient()
  const rawExt = file.name.split('.').pop()?.toLowerCase() ?? ''
  const ALLOWED_EXTS = ['png', 'jpg', 'jpeg', 'webp', 'gif']
  if (!ALLOWED_EXTS.includes(rawExt)) {
    return NextResponse.json({ error: 'Invalid file type' }, { status: 400 })
  }
  const ext = rawExt
  const path = `alex-dreams/stories/${storyId}/${crypto.randomUUID()}.${ext}`
  const buffer = await file.arrayBuffer()

  const { error: uploadError } = await db.storage
    .from('dream-images')
    .upload(path, new Blob([buffer], { type: file.type }), { contentType: file.type, upsert: false })
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

  const { data } = db.storage.from('dream-images').getPublicUrl(path)

  const { error: updateError } = await db
    .from('stories').update({ alex_dream_image_url: data.publicUrl }).eq('id', storyId)
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  return NextResponse.json({ url: data.publicUrl })
}
