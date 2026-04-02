import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { isAdmin, adminClient } from '@/lib/admin'

const ALEX_STYLE = "A child's dream illustration, watercolour and ink, soft magical light, storybook style, warm palette, child-safe, wonder-filled"

export async function POST(request: NextRequest) {
  if (!await isAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const { storyId, alexDream } = await request.json()
  if (!storyId || !alexDream) return NextResponse.json({ error: 'storyId and alexDream required' }, { status: 400 })

  const prompt = `${alexDream}. ${ALEX_STYLE}`
  const result = await openai.images.generate({
    model: 'dall-e-3',
    prompt,
    size: '1024x1024',
    response_format: 'url',
  })
  const openAiUrl = result.data?.[0]?.url
  if (!openAiUrl) return NextResponse.json({ error: 'No image returned' }, { status: 500 })

  const imageResponse = await fetch(openAiUrl)
  const buffer = await imageResponse.arrayBuffer()
  const db = adminClient()
  const path = `alex-dreams/stories/${storyId}/${crypto.randomUUID()}.png`
  const { error: uploadError } = await db.storage
    .from('dream-images')
    .upload(path, new Blob([buffer], { type: 'image/png' }), { contentType: 'image/png', upsert: false })
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

  const { data } = db.storage.from('dream-images').getPublicUrl(path)

  const { error: updateError } = await db
    .from('stories')
    .update({ alex_dream_image_url: data.publicUrl })
    .eq('id', storyId)
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  return NextResponse.json({ imageUrl: data.publicUrl })
}
