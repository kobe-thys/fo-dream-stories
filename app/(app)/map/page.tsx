'use client'
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Tile, ChildTileState, MappedTile, TileState, DreamSubmission } from '@/lib/types'
import { hexDistance } from '@/lib/hex'
import HexGrid from '@/components/map/HexGrid'
import TilePopup from '@/components/map/TilePopup'
import DreamSubmissionDrawer from '@/components/dream/DreamSubmissionDrawer'
import FOMascot from '@/components/fo/FOMascot'

function getInitialState(tile: Tile, allTiles: Tile[]): TileState | null {
  if (tile.type === 'mother_tree') return 'unlocked'
  const motherTree = allTiles.find(t => t.type === 'mother_tree')
  if (motherTree) {
    const dist = hexDistance(tile.position_q, tile.position_r, motherTree.position_q, motherTree.position_r)
    if (dist === 1) return 'unlocked'
  }
  return null // ring-2+ tiles get no initial state row — they are invisible
}

export default function MapPage() {
  const router = useRouter()
  const [profileName, setProfileName] = useState('Dreamer')
  const [childId, setChildId] = useState<string | null>(null)
  const [tiles, setTiles] = useState<MappedTile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedTile, setSelectedTile] = useState<MappedTile | null>(null)
  const [drawerTile, setDrawerTile] = useState<MappedTile | null>(null)
  const [flippedTileId, setFlippedTileId] = useState<string | null>(null)
  const [sensoryTile, setSensoryTile] = useState<MappedTile | null>(null)

  const loadMap = useCallback(async (cId: string) => {
    const supabase = createClient()

    const { data: tileRows, error: tilesError } = await supabase
      .from('tiles').select('*').order('created_at', { ascending: true })
    if (tilesError || !tileRows) { setError('Could not load the map.'); setLoading(false); return }

    const allTiles = tileRows as Tile[]

    const { data: stateRows } = await supabase
      .from('child_tile_states').select('*').eq('child_profile_id', cId)

    let stateMap: Record<string, TileState> = {}

    if (!stateRows || stateRows.length === 0) {
      const initialStates = allTiles
        .map(tile => ({ tile, state: getInitialState(tile, allTiles) }))
        .filter(({ state }) => state !== null) as { tile: Tile; state: TileState }[]

      await supabase.from('child_tile_states').upsert(
        initialStates.map(({ tile, state }) => ({ child_profile_id: cId, tile_id: tile.id, state })),
        { onConflict: 'child_profile_id,tile_id' }
      )
      initialStates.forEach(({ tile, state }) => { stateMap[tile.id] = state })
    } else {
      ;(stateRows as ChildTileState[]).forEach(s => { stateMap[s.tile_id] = s.state })
    }

    // Fetch token images from latest dream_submissions per tile
    const { data: submissionRows } = await supabase
      .from('dream_submissions').select('tile_id, token_image_url, created_at').eq('child_profile_id', cId)
    const tokenMap: Record<string, string | null> = {}
    if (submissionRows) {
      ;(submissionRows as Pick<DreamSubmission, 'tile_id' | 'token_image_url' | 'created_at'>[])
        .sort((a, b) => a.created_at.localeCompare(b.created_at))
        .forEach(s => { tokenMap[s.tile_id] = s.token_image_url })
    }

    // Only include tiles that have a state (invisible tiles are excluded)
    const mappedTiles: MappedTile[] = allTiles
      .filter(tile => stateMap[tile.id] !== undefined)
      .map(tile => ({ ...tile, childState: stateMap[tile.id], token_image_url: tokenMap[tile.id] ?? null }))

    setTiles(mappedTiles)
    setLoading(false)
  }, [])

  useEffect(() => {
    const name = sessionStorage.getItem('activeProfileName') ?? 'Dreamer'
    const cId = sessionStorage.getItem('activeProfileId')
    setProfileName(name)
    setChildId(cId)
    if (!cId) { router.push('/select-profile'); return }
    loadMap(cId)
  }, [router, loadMap])

  async function handleTileClick(tile: MappedTile) {
    if (tile.childState === 'revealed') {
      // Reveal the tile: move to unlocked
      const supabase = createClient()
      await supabase.from('child_tile_states')
        .update({ state: 'unlocked' })
        .eq('child_profile_id', childId)
        .eq('tile_id', tile.id)
      setTiles(prev => prev.map(t => t.id === tile.id ? { ...t, childState: 'unlocked' } : t))
      return
    }
    if (tile.type === 'terrain') {
      // Show terrain sensory moment overlay (auto-dismisses after 4s)
      if (tile.sensory_moment_text) {
        setSensoryTile(tile)
        setTimeout(() => setSensoryTile(null), 4000)
      }
      return
    }
    // If tile already selected and has alex_dream_image_url → toggle flip
    if (selectedTile?.id === tile.id && tile.alex_dream_image_url) {
      setFlippedTileId(prev => prev === tile.id ? null : tile.id)
      return
    }
    setFlippedTileId(null)
    setSelectedTile(tile)
  }

  async function handleDreamComplete({ tokenImageUrl }: { tokenImageUrl: string }) {
    if (!drawerTile || !childId) return
    const tileId = drawerTile.id

    // Update local tile to completed
    setTiles(prev => prev.map(t =>
      t.id === tileId ? { ...t, childState: 'completed', token_image_url: tokenImageUrl } : t
    ))

    // Unlock propagation: find tiles this completion unlocks
    const supabase = createClient()
    const { data: unlockRows } = await supabase
      .from('tile_unlocks').select('to_tile_id').eq('from_tile_id', tileId)

    if (unlockRows && unlockRows.length > 0) {
      const toIds = unlockRows.map((r: { to_tile_id: string }) => r.to_tile_id)

      // Fetch the tile data for newly revealed tiles
      const { data: newTileRows } = await supabase
        .from('tiles').select('*').in('id', toIds)

      if (newTileRows) {
        // Upsert child_tile_states for newly revealed tiles
        await supabase.from('child_tile_states').upsert(
          toIds.map((id: string) => ({ child_profile_id: childId, tile_id: id, state: 'revealed' })),
          { onConflict: 'child_profile_id,tile_id' }
        )
        // Add new tiles to local state
        const newMapped: MappedTile[] = (newTileRows as Tile[]).map(t => ({
          ...t, childState: 'revealed', token_image_url: null,
        }))
        setTiles(prev => {
          const existingIds = new Set(prev.map(t => t.id))
          return [...prev, ...newMapped.filter(t => !existingIds.has(t.id))]
        })
      }
    }

    setDrawerTile(null)
    setSelectedTile(null)
    setFlippedTileId(null)
  }

  if (loading) return (
    <main className="min-h-screen flex items-center justify-center bg-background">
      <p className="text-muted-foreground">Loading your dream world...</p>
    </main>
  )

  if (error) return (
    <main className="min-h-screen flex items-center justify-center bg-background px-4">
      <p className="text-red-400 text-center">{error}</p>
    </main>
  )

  return (
    <main className="min-h-screen flex flex-col bg-background">
      <div className="flex items-center justify-between px-4 pt-6 pb-2">
        <h1 className="text-xl font-bold text-foreground">{profileName}&apos;s Dream World</h1>
        <button onClick={() => router.push('/select-profile')} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          Switch dreamer
        </button>
      </div>
      <p className="text-muted-foreground text-sm px-4 mb-4">Tap a tile to begin an adventure</p>

      <div className="flex-1 w-full">
        <HexGrid tiles={tiles} selectedTileId={selectedTile?.id} flippedTileId={flippedTileId} onTileClick={handleTileClick} />
      </div>

      {selectedTile && selectedTile.childState !== 'revealed' && (
        <TilePopup
          tile={selectedTile}
          onClose={() => { setSelectedTile(null); setFlippedTileId(null) }}
          onListeningMode={() => { router.push(`/story/${selectedTile.id}?mode=listening`); setSelectedTile(null) }}
          onReadingMode={() => { router.push(`/story/${selectedTile.id}?mode=reading`); setSelectedTile(null) }}
          onSubmitDream={() => { setDrawerTile(selectedTile); setSelectedTile(null) }}
          onReadAgain={() => { router.push(`/story/${selectedTile.id}?mode=reading`); setSelectedTile(null) }}
        />
      )}

      {/* Terrain sensory moment overlay */}
      {sensoryTile && sensoryTile.sensory_moment_text && (
        <>
          <div
            onClick={() => setSensoryTile(null)}
            className="fixed inset-0 z-30"
          />
          <div
            onClick={() => setSensoryTile(null)}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-40 w-72 bg-white rounded-2xl shadow-2xl p-6 text-center"
          >
            <p className="text-slate-700 text-base leading-relaxed">{sensoryTile.sensory_moment_text}</p>
            <p className="text-slate-400 text-xs mt-3">Tap to close</p>
          </div>
        </>
      )}

      {drawerTile && childId && (
        <DreamSubmissionDrawer
          tile={drawerTile}
          childProfileId={childId}
          onClose={() => setDrawerTile(null)}
          onComplete={handleDreamComplete}
        />
      )}

      <FOMascot message={`Welcome, ${profileName}! Where shall we go?`} />
    </main>
  )
}
