import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

export async function POST(request: NextRequest) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  try {
    const formData = await request.formData()
    const audio = formData.get('audio') as File | null
    if (!audio) return NextResponse.json({ error: 'No audio file' }, { status: 400 })

    if (audio.size < 1000) {
      return NextResponse.json({ error: 'Recording too short — please try again' }, { status: 400 })
    }

    const transcription = await openai.audio.transcriptions.create({
      model: 'whisper-1',
      file: audio,
      language: 'en',
    })
    return NextResponse.json({ text: transcription.text })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Transcription failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
