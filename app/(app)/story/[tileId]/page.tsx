'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Tile, MappedTile, Story, TileState } from '@/lib/types'
import ListeningMode from '@/components/story/ListeningMode'
import ReadingMode from '@/components/story/ReadingMode'

export default function StoryPage() {
  const router = useRouter()
  const { tileId } = useParams<{ tileId: string }>()
  const searchParams = useSearchParams()
  const mode = searchParams.get('mode') ?? 'reading'

  const [tile, setTile] = useState<MappedTile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!tileId) return
    async function load() {
      const childId = sessionStorage.getItem('activeProfileId')
      if (!childId) { router.push('/select-profile'); return }
      const supabase = createClient()
      const [{ data: tileData, error: tileErr }, { data: stateRow }] = await Promise.all([
        supabase.from('tiles').select('*, story:stories(*)').eq('id', tileId).single(),
        supabase.from('child_tile_states').select('state').eq('child_profile_id', childId).eq('tile_id', tileId).single(),
      ])

      if (tileErr || !tileData) {
        setError('Could not load this story.')
        setLoading(false)
        return
      }

      const td = tileData as Tile & { story: Story | null }
      setTile({
        ...td,
        childState: (stateRow?.state as TileState) ?? 'grey',
        token_image_url: null,
        story: td.story ?? null,
      })
      setLoading(false)
    }
    load()
  }, [tileId, router])

  async function handleComplete() {
    const childId = sessionStorage.getItem('activeProfileId') ?? ''
    if (childId && tile) {
      const supabase = createClient()
      await supabase.from('child_tile_states').upsert(
        { child_profile_id: childId, tile_id: tile.id, state: 'revealed', listened_at: new Date().toISOString() },
        { onConflict: 'child_profile_id,tile_id' }
      )
    }
    router.push('/map')
  }

  if (loading) {
    return (
      <div style={{ position: 'fixed', inset: 0, backgroundColor: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'rgba(255,255,255,0.6)' }}>Loading...</p>
      </div>
    )
  }

  if (error || !tile) {
    return (
      <div style={{ position: 'fixed', inset: 0, backgroundColor: '#000', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <p style={{ color: 'rgba(255,100,100,0.9)' }}>{error ?? 'Story not found.'}</p>
        <button onClick={() => router.push('/map')} style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>← Back to map</button>
      </div>
    )
  }

  if (mode === 'listening') {
    return (
      <ListeningMode
        tile={tile}
        onComplete={handleComplete}
        onFallback={() => router.replace(`/story/${tile.id}?mode=reading`)}
      />
    )
  }

  return <ReadingMode tile={tile} onComplete={handleComplete} />
}
