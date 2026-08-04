import { NextRequest, NextResponse } from 'next/server'
import { isAdmin, adminClient } from '@/lib/admin'

/**
 * Signed upload URL for a source GLB.
 *
 * The browser uploads straight to Supabase Storage rather than through this route:
 * sources run to 33 MB and Vercel caps a serverless request body at 4.5 MB.
 */
export async function POST(req: NextRequest) {
  if (!await isAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { filename } = await req.json()
  const name = String(filename ?? '')
  if (!/^[\w .()-]{1,80}\.glb$/i.test(name)) {
    return NextResponse.json({ error: 'filename must be a .glb' }, { status: 400 })
  }

  // Prefix with a timestamp so re-uploading the same source does not collide.
  const key = `${Date.now()}-${name.replace(/\s+/g, '-')}`
  const db = adminClient()
  const { data, error } = await db.storage.from('tile-sources').createSignedUploadUrl(key)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ path: key, token: data.token, signedUrl: data.signedUrl })
}
