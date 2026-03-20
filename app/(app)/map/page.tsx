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

const HEX_CLIP = 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)'

function tileColor(tile: MappedTile): string {
  if (tile.type === 'mother_tree') return '#7c3aed'
  if (tile.childState === 'completed') return '#1e40af'
  if (tile.childState === 'listened') return '#1e40af'
  return '#1e40af'
}

function FloatingTilePreview({ tile }: { tile: MappedTile }) {
  const size = 80
  return (
    <div style={{
      position: 'fixed', left: '50%', top: '62%',
      transform: 'translateX(-50%)',
      zIndex: 35,
      width: size * 1.155, height: size,
      filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.6)) drop-shadow(0 0 12px rgba(124,58,237,0.4))',
      animation: 'floatUp 0.3s ease-out forwards',
      pointerEvents: 'none',
    }}>
      <div style={{
        width: '100%', height: '100%',
        clipPath: HEX_CLIP,
        backgroundColor: tileColor(tile),
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ color: 'white', fontSize: 10, fontWeight: 700, textAlign: 'center', padding: '0 8px', lineHeight: 1.2 }}>
          {tile.name}
        </span>
      </div>
      <style>{`@keyframes floatUp { from { transform: translateX(-50%) translateY(12px); opacity: 0 } to { transform: translateX(-50%) translateY(0); opacity: 1 } }`}</style>
    </div>
  )
}

function getInitialState(tile: Tile, allTiles: Tile[]): TileState | null {
  if (tile.type === 'mother_tree') return 'unlocked'
  const motherTree = allTiles.find(t => t.type === 'mother_tree')
  if (motherTree) {
    const dist = hexDistance(tile.position_q, tile.position_r, motherTree.position_q, motherTree.position_r)
    if (dist === 1) return 'revealed' // ring-1 tiles start fogged — unlock after completing Mother Tree
  }
  return null // ring-2+ tiles are invisible until revealed by completing a ring-1 tile
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
  const [fogMessage, setFogMessage] = useState<string | null>(null)

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
      // Fogged tiles can't be entered yet — show a hint
      setFogMessage('Complete a nearby story to unlock this adventure!')
      setTimeout(() => setFogMessage(null), 3000)
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

      // Check current states of target tiles — revealed → unlock, null → reveal
      const { data: currentStates } = await supabase
        .from('child_tile_states').select('tile_id, state')
        .eq('child_profile_id', childId).in('tile_id', toIds)
      const currentStateMap: Record<string, TileState> = {}
      ;(currentStates ?? []).forEach((s: { tile_id: string; state: TileState }) => {
        currentStateMap[s.tile_id] = s.state
      })

      const upsertRows = toIds.map((id: string) => ({
        child_profile_id: childId,
        tile_id: id,
        state: currentStateMap[id] === 'revealed' ? 'unlocked' : 'revealed',
      }))

      await supabase.from('child_tile_states').upsert(upsertRows, { onConflict: 'child_profile_id,tile_id' })

      // Fetch tile data for affected tiles and update local state
      const { data: newTileRows } = await supabase.from('tiles').select('*').in('id', toIds)
      if (newTileRows) {
        const newMapped: MappedTile[] = (newTileRows as Tile[]).map(t => ({
          ...t,
          childState: (upsertRows.find(r => r.tile_id === t.id)?.state ?? 'revealed') as TileState,
          token_image_url: null,
        }))
        setTiles(prev => {
          const existingIds = new Set(prev.map(t => t.id))
          return [
            ...prev.map(t => { const u = newMapped.find(m => m.id === t.id); return u ?? t }),
            ...newMapped.filter(t => !existingIds.has(t.id)),
          ]
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
        <>
          {/* Floating tile preview — hovers below the popup */}
          <FloatingTilePreview tile={selectedTile} />
          <TilePopup
            tile={selectedTile}
            onClose={() => { setSelectedTile(null); setFlippedTileId(null) }}
            onListeningMode={() => { router.push(`/story/${selectedTile.id}?mode=listening`); setSelectedTile(null) }}
            onReadingMode={() => { router.push(`/story/${selectedTile.id}?mode=reading`); setSelectedTile(null) }}
            onSubmitDream={() => { setDrawerTile(selectedTile); setSelectedTile(null) }}
            onReadAgain={() => { router.push(`/story/${selectedTile.id}?mode=reading`); setSelectedTile(null) }}
          />
        </>
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

      {/* Fog hint toast */}
      {fogMessage && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-5 py-3 bg-slate-800 text-white text-sm rounded-2xl shadow-lg pointer-events-none">
          {fogMessage}
        </div>
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
