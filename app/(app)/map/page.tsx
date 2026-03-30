'use client'
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import { Tile, ChildTileState, MappedTile, Story, TileState, DreamSubmission } from '@/lib/types'
import { hexDistance } from '@/lib/hex'
import TilePopup from '@/components/map/TilePopup'
import DreamSubmissionDrawer from '@/components/dream/DreamSubmissionDrawer'
import FOMascot from '@/components/fo/FOMascot'

// Dynamic import with ssr:false — Three.js accesses window at module level
const DreamerMapCanvas = dynamic(() => import('@/components/map/DreamerMapCanvas'), { ssr: false })

function getInitialState(tile: Tile, allTiles: Tile[]): TileState | null {
  if (tile.type === 'undefined') return null  // undefined tiles never visible
  if (tile.type === 'mother_tree') return 'unlocked'
  const motherTree = allTiles.find(t => t.type === 'mother_tree')
  if (motherTree) {
    const dist = hexDistance(tile.position_q, tile.position_r, motherTree.position_q, motherTree.position_r)
    if (dist === 1) return 'revealed'
  }
  return null
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
  const [sensoryTile, setSensoryTile] = useState<MappedTile | null>(null)
  const [fogMessage, setFogMessage] = useState<string | null>(null)

  const loadMap = useCallback(async (cId: string) => {
    const supabase = createClient()

    const { data: tileRows, error: tilesError } = await supabase
      .from('tiles')
      .select('*, story:stories(*)')
      .order('created_at', { ascending: true })
    if (tilesError || !tileRows) { setError('Could not load the map.'); setLoading(false); return }

    const allTiles = tileRows as (Tile & { story: Story | null })[]

    const { data: stateRows } = await supabase
      .from('child_tile_states').select('*').eq('child_profile_id', cId)

    let stateMap: Record<string, TileState> = {}

    if (!stateRows || stateRows.length === 0) {
      const initialStates = allTiles
        .map(tile => ({ tile, state: getInitialState(tile, allTiles) }))
        .filter(({ state }) => state !== null) as { tile: typeof allTiles[0]; state: TileState }[]

      await supabase.from('child_tile_states').upsert(
        initialStates.map(({ tile, state }) => ({ child_profile_id: cId, tile_id: tile.id, state })),
        { onConflict: 'child_profile_id,tile_id' }
      )
      initialStates.forEach(({ tile, state }) => { stateMap[tile.id] = state })
    } else {
      ;(stateRows as ChildTileState[]).forEach(s => { stateMap[s.tile_id] = s.state })
    }

    const { data: submissionRows } = await supabase
      .from('dream_submissions').select('tile_id, token_image_url, created_at').eq('child_profile_id', cId)
    const tokenMap: Record<string, string | null> = {}
    if (submissionRows) {
      ;(submissionRows as Pick<DreamSubmission, 'tile_id' | 'token_image_url' | 'created_at'>[])
        .sort((a, b) => a.created_at.localeCompare(b.created_at))
        .forEach(s => { tokenMap[s.tile_id] = s.token_image_url })
    }

    const mappedTiles: MappedTile[] = allTiles
      .filter(tile => stateMap[tile.id] !== undefined)
      .map(tile => ({
        ...tile,
        childState: stateMap[tile.id],
        token_image_url: tokenMap[tile.id] ?? null,
        story: tile.story ?? null,
      }))

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

  async function handleTileClick(tile: MappedTile | null) {
    if (!tile) { setSelectedTile(null); return }

    if (tile.childState === 'revealed') {
      const motherTree = tiles.find(t => t.type === 'mother_tree')
      if (motherTree) {
        const dist = hexDistance(tile.position_q, tile.position_r, motherTree.position_q, motherTree.position_r)
        if (dist === 1 && motherTree.childState !== 'completed') {
          setFogMessage('Complete the Mother Tree story first!')
          setTimeout(() => setFogMessage(null), 3000)
          return
        }
      }
      if (childId) {
        const supabase = createClient()
        await supabase.from('child_tile_states').upsert(
          { child_profile_id: childId, tile_id: tile.id, state: 'unlocked' },
          { onConflict: 'child_profile_id,tile_id' }
        )
        const unlocked = { ...tile, childState: 'unlocked' as TileState }
        setTiles(prev => prev.map(t => t.id === tile.id ? unlocked : t))
        setSelectedTile(unlocked)
      }
      return
    }

    if (tile.type === 'terrain') {
      if (tile.sensory_moment_text) {
        setSensoryTile(tile)
        setTimeout(() => setSensoryTile(null), 4000)
      }
      return
    }

    setSelectedTile(tile)
  }

  async function handleDreamComplete({ tokenImageUrl }: { tokenImageUrl: string }) {
    if (!drawerTile || !childId) return
    const tileId = drawerTile.id

    setTiles(prev => prev.map(t =>
      t.id === tileId ? { ...t, childState: 'completed', token_image_url: tokenImageUrl } : t
    ))

    const supabase = createClient()
    const { data: unlockRows } = await supabase
      .from('tile_unlocks').select('to_tile_id').eq('from_tile_id', tileId)

    if (unlockRows && unlockRows.length > 0) {
      const toIds = unlockRows.map((r: { to_tile_id: string }) => r.to_tile_id)

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

      // Fetch newly-unlocked tiles including story join
      const { data: newTileRows } = await supabase
        .from('tiles')
        .select('*, story:stories(*)')
        .in('id', toIds)
      if (newTileRows) {
        const newMapped: MappedTile[] = (newTileRows as (Tile & { story: Story | null })[]).map(t => ({
          ...t,
          childState: (upsertRows.find(r => r.tile_id === t.id)?.state ?? 'revealed') as TileState,
          token_image_url: null,
          story: t.story ?? null,
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
    <main className="min-h-screen flex flex-col bg-background" style={{ position: 'relative' }}>
      <div className="flex items-center justify-between px-4 pt-6 pb-2" style={{ position: 'relative', zIndex: 10 }}>
        <h1 className="text-xl font-bold text-foreground">{profileName}&apos;s Dream World</h1>
        <button onClick={() => router.push('/select-profile')} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          Switch dreamer
        </button>
      </div>

      {/* 3D map — fills remaining space */}
      <div className="flex-1 w-full" style={{ position: 'relative', minHeight: 400 }}>
        <DreamerMapCanvas
          tiles={tiles}
          selectedTileId={selectedTile?.id ?? null}
          onTileClick={handleTileClick}
        />
      </div>

      {selectedTile && selectedTile.childState !== 'revealed' && (
        <TilePopup
          tile={selectedTile}
          onClose={() => setSelectedTile(null)}
          onListeningMode={() => { router.push(`/story/${selectedTile.id}?mode=listening`); setSelectedTile(null) }}
          onReadingMode={() => { router.push(`/story/${selectedTile.id}?mode=reading`); setSelectedTile(null) }}
          onSubmitDream={() => { setDrawerTile(selectedTile); setSelectedTile(null) }}
          onReadAgain={() => { router.push(`/story/${selectedTile.id}?mode=reading`); setSelectedTile(null) }}
        />
      )}

      {sensoryTile?.sensory_moment_text && (
        <>
          <div onClick={() => setSensoryTile(null)} className="fixed inset-0 z-30" />
          <div onClick={() => setSensoryTile(null)} className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-40 w-72 bg-white rounded-2xl shadow-2xl p-6 text-center">
            <p className="text-slate-700 text-base leading-relaxed">{sensoryTile.sensory_moment_text}</p>
            <p className="text-slate-400 text-xs mt-3">Tap to close</p>
          </div>
        </>
      )}

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

      <FOMascot
        message={`Welcome, ${profileName}! Tap the Mother Tree to begin.`}
        selectedTile={selectedTile}
      />
    </main>
  )
}
