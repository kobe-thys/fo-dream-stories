import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'

const STYLE_SUFFIX = "Children's illustrated storybook style, dreamlike, warm colours, soft lighting, magical forest world, safe and wonder-filled"

export async function POST(request: NextRequest) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  try {
    const { prompt, childProfileId, tileId } = await request.json()
    const fullPrompt = `${prompt}. ${STYLE_SUFFIX}`

    const result = await openai.images.generate({
      model: 'dall-e-3',
      prompt: fullPrompt,
      size: '1024x1024',
      response_format: 'url',
    })

    const openAiUrl = result.data?.[0]?.url
    if (!openAiUrl) throw new Error('No image URL returned from DALL-E')

    // Fetch and store in Supabase (OpenAI URLs expire after ~1 hour)
    const imageResponse = await fetch(openAiUrl)
    const buffer = await imageResponse.arrayBuffer()
    const blob = new Blob([buffer], { type: 'image/png' })

    const uid = crypto.randomUUID()
    const path = `${childProfileId}/${tileId}/${uid}.png`
    const supabase = await createClient()
    const { error: uploadError } = await supabase.storage
      .from('dream-images')
      .upload(path, blob, { contentType: 'image/png', upsert: false })
    if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`)

    const { data } = supabase.storage.from('dream-images').getPublicUrl(path)
    return NextResponse.json({ imageUrl: data.publicUrl })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Image generation failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
