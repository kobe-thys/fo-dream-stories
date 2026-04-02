import { NextResponse } from 'next/server'
import { isAdmin, adminClient } from '@/lib/admin'

export async function POST() {
  if (!await isAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const db = adminClient()
  const { error } = await db
    .from('tiles')
    .update({ published: true })
    .eq('published', false)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
