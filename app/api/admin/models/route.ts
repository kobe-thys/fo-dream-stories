import { NextResponse } from 'next/server'
import { isAdmin } from '@/lib/admin'
// Static import so the list is bundled into the function. Reading public/ from
// disk at request time works locally but throws on Vercel, which does not trace
// public/ into the serverless bundle -- that produced an empty model picker in
// production while localhost looked fine. Regenerate via `npm run models:manifest`.
import manifest from '@/public/models/manifest.json'

export async function GET() {
  if (!await isAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  return NextResponse.json(manifest.models.map(m => m.file))
}
