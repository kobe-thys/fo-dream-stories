import { NextResponse } from 'next/server'
import { isAdmin, adminClient } from '@/lib/admin'

export async function GET() {
  if (!await isAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const db = adminClient()

  const [
    { count: familyCount },
    { count: profileCount },
    { count: submissionCount },
    { count: sharedCount },
    { data: topTiles },
  ] = await Promise.all([
    db.from('families').select('*', { count: 'exact', head: true }),
    db.from('child_profiles').select('*', { count: 'exact', head: true }),
    db.from('dream_submissions').select('*', { count: 'exact', head: true }),
    db.from('dream_submissions').select('*', { count: 'exact', head: true }).eq('is_shared', true),
    db.from('dream_submissions')
      .select('tile_id, tiles(name)')
      .limit(100),
  ])

  // Count submissions per tile for top 5
  // TODO: replace with SQL group-by when submission count grows beyond 100
  const tileCounts: Record<string, { name: string; count: number }> = {}
  for (const row of topTiles ?? []) {
    const id = row.tile_id
    const tilesVal = row.tiles as unknown as { name: string } | { name: string }[] | null
    const tileObj = Array.isArray(tilesVal) ? tilesVal[0] : tilesVal
    const name = tileObj?.name ?? id
    tileCounts[id] = { name, count: (tileCounts[id]?.count ?? 0) + 1 }
  }
  const topStories = Object.values(tileCounts)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  return NextResponse.json({
    familyCount: familyCount ?? 0,
    profileCount: profileCount ?? 0,
    submissionCount: submissionCount ?? 0,
    sharedCount: sharedCount ?? 0,
    topStories,
  })
}
