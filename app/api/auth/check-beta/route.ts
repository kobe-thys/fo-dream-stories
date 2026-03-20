import { NextResponse } from 'next/server'
import { adminClient } from '@/lib/admin'

export async function GET() {
  const db = adminClient()
  const { data, error } = await db
    .from('app_settings')
    .select('beta_open, beta_cap')
    .single()

  if (error || !data) return NextResponse.json({ allowed: true }) // fail open

  if (!data.beta_open) {
    return NextResponse.json({ allowed: false, reason: 'Signups are currently closed.' })
  }

  const { count } = await db
    .from('families')
    .select('*', { count: 'exact', head: true })

  if ((count ?? 0) >= data.beta_cap) {
    return NextResponse.json({ allowed: false, reason: `Beta is full (${data.beta_cap} families). Check back later.` })
  }

  return NextResponse.json({ allowed: true })
}
