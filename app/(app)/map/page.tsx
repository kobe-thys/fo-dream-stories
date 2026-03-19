'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Tile, ChildTileState, MappedTile, TileState } from '@/lib/types'
import { hexDistance } from '@/lib/hex'
import HexGrid from '@/components/map/HexGrid'
import FOMascot from '@/components/fo/FOMascot'

function getInitialState(tile: Tile, allTiles: Tile[]): TileState {
  if (tile.type === 'mother_tree') return 'unlocked'
  const motherTree = allTiles.find(t => t.type === 'mother_tree')
  if (motherTree) {
    const dist = hexDistance(
      tile.position_q, tile.position_r,
      motherTree.position_q, motherTree.position_r
    )
    if (dist === 1) return 'unlocked'
  }
  return 'locked'
}

export default function MapPage() {
  const router = useRouter()
  const [profileName, setProfileName] = useState('Dreamer')
  const [tiles, setTiles] = useState<MappedTile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const name = sessionStorage.getItem('activeProfileName') ?? 'Dreamer'
    const childId = sessionStorage.getItem('activeProfileId')
    setProfileName(name)

    if (!childId) {
      router.push('/select-profile')
      return
    }

    async function loadMap() {
      const supabase = createClient()

      // Fetch all tiles
      const { data: tileRows, error: tilesError } = await supabase
        .from('tiles')
        .select('*')
        .order('created_at', { ascending: true })

      if (tilesError || !tileRows) {
        setError('Could not load the map. Please try again.')
        setLoading(false)
        return
      }

      const allTiles = tileRows as Tile[]

      // Fetch this child's tile states
      const { data: stateRows } = await supabase
        .from('child_tile_states')
        .select('*')
        .eq('child_profile_id', childId)

      let stateMap: Record<string, TileState> = {}

      if (!stateRows || stateRows.length === 0) {
        // First visit — initialise states for all tiles
        const initialStates = allTiles.map(tile => ({
          child_profile_id: childId,
          tile_id: tile.id,
          state: getInitialState(tile, allTiles),
        }))
        await supabase.from('child_tile_states').upsert(initialStates, {
          onConflict: 'child_profile_id,tile_id',
        })
        initialStates.forEach(s => { stateMap[s.tile_id] = s.state })
      } else {
        ;(stateRows as ChildTileState[]).forEach(s => { stateMap[s.tile_id] = s.state })
      }

      const mappedTiles: MappedTile[] = allTiles.map(tile => ({
        ...tile,
        childState: stateMap[tile.id] ?? 'locked',
      }))

      setTiles(mappedTiles)
      setLoading(false)
    }

    loadMap()
  }, [router])

  function handleTileClick(tile: MappedTile) {
    // Terrain tiles: sensory moment experience — deferred to Plan 3
    if (tile.type === 'terrain') return
    // Story tiles: full story experience — deferred to Plan 3
    console.log('Story tile tapped:', tile.name)
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading your dream world...</p>
      </main>
    )
  }

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background px-4">
        <p className="text-red-400 text-center">{error}</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen flex flex-col items-center bg-background pt-8 px-4">
      <h1 className="text-xl font-bold text-foreground mb-1">
        {profileName}&apos;s Dream World
      </h1>
      <p className="text-muted-foreground text-sm mb-6">Tap a tile to begin an adventure</p>
      <div className="w-full flex justify-center overflow-auto">
        <HexGrid tiles={tiles} onTileClick={handleTileClick} />
      </div>
      <FOMascot message={`Welcome, ${profileName}! Where shall we go?`} />
    </main>
  )
}
