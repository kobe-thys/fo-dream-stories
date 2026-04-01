import { NextRequest, NextResponse } from 'next/server'
import { isAdmin, adminClient } from '@/lib/admin'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await isAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id: storyId } = await params

  const db = adminClient()
  const { data: story, error: storyErr } = await db
    .from('stories').select('title, story_text').eq('id', storyId).single()
  if (storyErr || !story) return NextResponse.json({ error: 'Story not found' }, { status: 404 })
  if (!story.story_text) return NextResponse.json({ error: 'Story has no text to synthesise' }, { status: 400 })

  const apiKey = process.env.ELEVENLABS_API_KEY
  const voiceId = process.env.ELEVENLABS_VOICE_ID
  if (!apiKey || !voiceId) return NextResponse.json({ error: 'ElevenLabs not configured' }, { status: 500 })

  // Call ElevenLabs TTS
  const ttsRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      'Accept': 'audio/mpeg',
    },
    body: JSON.stringify({
      text: story.story_text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: { stability: 0.5, similarity_boost: 0.75 },
    }),
  })

  if (!ttsRes.ok) {
    const msg = await ttsRes.text()
    return NextResponse.json({ error: `ElevenLabs error: ${msg}` }, { status: 502 })
  }

  const audioBuffer = await ttsRes.arrayBuffer()
  const path = `story-audio/${storyId}/${crypto.randomUUID()}.mp3`

  const { error: uploadErr } = await db.storage
    .from('dream-images')
    .upload(path, new Blob([audioBuffer], { type: 'audio/mpeg' }), { contentType: 'audio/mpeg', upsert: false })
  if (uploadErr) return NextResponse.json({ error: uploadErr.message }, { status: 500 })

  const { data: urlData } = db.storage.from('dream-images').getPublicUrl(path)

  const { error: updateErr } = await db
    .from('stories').update({ audio_url: urlData.publicUrl }).eq('id', storyId)
  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  return NextResponse.json({ url: urlData.publicUrl })
}
