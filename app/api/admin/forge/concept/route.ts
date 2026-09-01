import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { isAdmin, adminClient } from '@/lib/admin'
import { buildBrief } from '@/scripts/tiles/tile-brief.mjs'

/**
 * Draw a concept for a story tile, or revise the last one.
 *
 * This is the ONLY stage of the forge that runs on Vercel. Everything after an
 * approved drawing — Meshy, normalize, flatten, render — needs minutes and ~8 GB
 * and goes to the worker via tile_jobs. Drawing is a single API call of ~35s, and
 * putting it behind the queue would make the iterate loop feel dead, so it runs
 * here and returns the image directly.
 *
 * Concepts are written to the PUBLIC `tile-previews` bucket under `concepts/`
 * rather than a new bucket: the admin page has to display them, and that bucket is
 * already public and already read by this page. The worker downloads the approved
 * one from the same place.
 *
 * SECURITY: `idea` and `revise` are free-form text from an admin page. They are
 * used to build a PROMPT here and are never passed to the worker, which builds argv
 * from typed columns and an object key only. See migration 015.
 */

// Generation takes ~35s. The default serverless ceiling is well under that.
export const maxDuration = 60

const MAX_IDEA = 2000

export async function POST(req: NextRequest) {
  if (!await isAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const idea = String(body.idea ?? '').trim()
  const revise = String(body.revise ?? '').trim()
  const fromPath = String(body.from_path ?? '').trim()

  if (!idea) return NextResponse.json({ error: 'Describe the tile first' }, { status: 400 })
  if (idea.length > MAX_IDEA || revise.length > MAX_IDEA) {
    return NextResponse.json({ error: `Keep it under ${MAX_IDEA} characters` }, { status: 400 })
  }
  if (fromPath && !/^concepts\/[A-Za-z0-9._-]{1,120}\.png$/.test(fromPath)) {
    return NextResponse.json({ error: 'Bad from_path' }, { status: 400 })
  }

  // Instantiated inside the handler on purpose — at module level it breaks the build.
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const db = adminClient()

  try {
    const prompt = buildBrief(idea, revise || undefined)
    let b64: string | undefined

    if (revise && fromPath) {
      // gpt-image-1 has a true edit endpoint, so a revision references the previous
      // drawing rather than redrawing from the prompt alone. That is what keeps
      // "make the towers taller" from producing an unrelated castle.
      const prev = await db.storage.from('tile-previews').download(fromPath)
      if (prev.error) throw new Error(`Could not read the previous drawing: ${prev.error.message}`)
      const file = await OpenAI.toFile(
        Buffer.from(await prev.data.arrayBuffer()), 'previous.png', { type: 'image/png' })
      const edited = await openai.images.edit({
        model: 'gpt-image-1', image: file, prompt, size: '1024x1024',
      })
      b64 = edited.data?.[0]?.b64_json
    } else {
      const made = await openai.images.generate({
        model: 'gpt-image-1', prompt, size: '1024x1024', background: 'opaque',
      })
      b64 = made.data?.[0]?.b64_json
    }

    if (!b64) throw new Error('No image came back from the model')

    const path = `concepts/${crypto.randomUUID()}.png`
    const up = await db.storage.from('tile-previews')
      .upload(path, Buffer.from(b64, 'base64'), { contentType: 'image/png', upsert: true })
    if (up.error) throw new Error(`Could not save the drawing: ${up.error.message}`)

    const { data } = db.storage.from('tile-previews').getPublicUrl(path)
    return NextResponse.json({ path, url: `${data.publicUrl}?t=${Date.now()}` })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not draw the concept'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
