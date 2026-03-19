'use client'
import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Tile, MappedTile } from '@/lib/types'
import ListeningMode from '@/components/story/ListeningMode'
import ReadingMode from '@/components/story/ReadingMode'

export default function StoryPage({ params }: { params: { tileId: string } }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const mode = searchParams.get('mode') ?? 'reading'

  const [tile, setTile] = useState<MappedTile | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    const childId = sessionStorage.getItem('activeProfileId') ?? ''
    async function load() {
      const supabase = createClient()
      const { data } = await supabase
        .from('tiles')
        .select('*')
        .eq('id', params.tileId)
        .single()
      if (data) {
        const mappedTile: MappedTile = {
          ...(data as Tile),
          childState: 'unlocked',
          token_image_url: null,
        }
        setTile(mappedTile)
      }
      setLoading(false)
    }
    load()
  }, [params.tileId])

  async function handleComplete() {
    const childId = sessionStorage.getItem('activeProfileId') ?? ''
    if (childId && tile) {
      const supabase = createClient()
      await supabase
        .from('child_tile_states')
        .update({ state: 'listened', listened_at: new Date().toISOString() })
        .eq('child_profile_id', childId)
        .eq('tile_id', tile.id)
    }
    router.push('/map')
  }

  if (loading || !tile) {
    return (
      <div style={{ position: 'fixed', inset: 0, backgroundColor: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'rgba(255,255,255,0.6)' }}>Loading...</p>
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
