import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function POST(request: NextRequest) {
  try {
    const { imageBase64, mimeType } = await request.json()
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              // @ts-ignore
              image_url: { url: `data:${mimeType};base64,${imageBase64}` },
            },
            {
              type: 'text',
              text: 'Describe what this child has drawn in 2-3 sentences, as if narrating their dream. Keep it warm, imaginative, and child-friendly.',
            },
          ],
        },
      ],
      max_tokens: 200,
    })
    const description = response.choices[0]?.message?.content ?? ''
    return NextResponse.json({ description })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Vision analysis failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
