'use client'
import { useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { AdminTile } from '@/components/admin/map/AdminHexTile'
import TileSidePanel from '@/components/admin/map/TileSidePanel'
import LinkedTilesModeHeader from '@/components/admin/map/LinkedTilesModeHeader'

// react-three-fiber accesses the DOM on import — SSR off
const AdminHexGrid = dynamic(() => import('@/components/admin/map/AdminHexGrid'), { ssr: false })

interface StoryOption { id: string; title: string }

export default function AdminMapPage() {
  const [tiles, setTiles]           = useState<AdminTile[]>([])
  const [stories, setStories]       = useState<StoryOption[]>([])
  const [allUnlocks, setAllUnlocks] = useState<{ from_tile_id: string; to_tile_id: string }[]>([])
  const [loading, setLoading]       = useState(true)
  const [selectedTile, setSelectedTile] = useState<AdminTile | null>(null)
  const [linkedMode, setLinkedMode] = useState(false)
  const [linkedIds, setLinkedIds]   = useState<string[]>([])
  const [isMoving, setIsMoving]     = useState(false)
  const [modelFiles, setModelFiles] = useState<string[]>([])
  const [selectedModel, setSelectedModel] = useState<string>('grass.glb')

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/map-tiles').then(r => r.json()),
      fetch('/api/admin/stories').then(r => r.json()),
      fetch('/api/admin/unlocks').then(r => r.json()),
      fetch('/api/admin/models').then(r => r.json()),
    ]).then(([tileData, storyData, unlockData, modelData]) => {
      setTiles(tileData)
      setStories(storyData.map((s: { id: string; title: string }) => ({ id: s.id, title: s.title })))
      setAllUnlocks(unlockData)
      if (Array.isArray(modelData) && modelData.length > 0) {
        setModelFiles(modelData)
        setSelectedModel(modelData[0])
      }
      setLoading(false)
    })
    .catch(() => {
      setLoading(false)
    })
  }, [])

  async function handleTileClick(id: string, shiftKey: boolean, ctrlKey: boolean) {
    const tile = tiles.find(t => t.id === id)
    if (!tile) return

    if (linkedMode) {
      // Linking: only non-undefined tiles, only when not blocked by another story
      if (!selectedTile || tile.type === 'undefined') return
      const linkedFrom = allUnlocks.find(u => u.to_tile_id === tile.id)?.from_tile_id
      if (linkedFrom && linkedFrom !== selectedTile.id) return // blocked
      const next = linkedIds.includes(tile.id)
        ? linkedIds.filter(id2 => id2 !== tile.id)
        : [...linkedIds, tile.id]
      setLinkedIds(next)
      setAllUnlocks(prev => {
        const filtered = prev.filter(u => !(u.from_tile_id === selectedTile.id && u.to_tile_id === tile.id))
        return next.includes(tile.id)
          ? [...filtered, { from_tile_id: selectedTile.id, to_tile_id: tile.id }]
          : filtered
      })
      await fetch('/api/admin/unlocks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from_tile_id: selectedTile.id, to_tile_ids: next }),
      })
      return
    }

    setSelectedTile(tile)
    setIsMoving(false)
  }

  async function handleEmptyClick(q: number, r: number) {
    if (linkedMode) return

    if (isMoving && selectedTile) {
      // Move tile to new position
      const res = await fetch(`/api/admin/map-tiles/${selectedTile.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ position_q: q, position_r: r }),
      })
      if (!res.ok) return
      const updated = { ...selectedTile, position_q: q, position_r: r }
      setTiles(prev => prev.map(t => t.id === selectedTile.id ? updated : t))
      setSelectedTile(updated)
      setIsMoving(false)
      return
    }

    // Create new tile
    const res = await fetch('/api/admin/map-tiles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q, r, model: selectedModel }),
    })
    if (!res.ok) return
    const newTile: AdminTile = await res.json()
    setTiles(prev => [...prev, newTile])
    setSelectedTile(newTile)
  }

  function handleTileUpdated(updated: AdminTile) {
    setTiles(prev => prev.map(t => t.id === updated.id ? updated : t))
    setSelectedTile(updated)
  }

  async function handleDelete() {
    if (!selectedTile) return
    const res = await fetch(`/api/admin/map-tiles/${selectedTile.id}`, { method: 'DELETE' })
    if (!res.ok) return
    setTiles(prev => prev.filter(t => t.id !== selectedTile.id))
    setSelectedTile(null)
    setIsMoving(false)
  }

  function enterLinkedMode() {
    if (!selectedTile || selectedTile.type !== 'story') return
    const current = allUnlocks
      .filter(u => u.from_tile_id === selectedTile.id)
      .map(u => u.to_tile_id)
    setLinkedIds(current)
    setLinkedMode(true)
  }

  function exitLinkedMode() {
    setLinkedMode(false)
    setLinkedIds([])
  }

  async function resetMap() {
    const input = window.prompt('Type RESET to delete all tiles and start over:')
    if (input !== 'RESET') return
    const res = await fetch('/api/admin/map-tiles', { method: 'DELETE' })
    if (!res.ok) { alert('Reset failed'); return }
    setTiles([])
    setSelectedTile(null)
    setAllUnlocks([])
    setLinkedMode(false)
    setIsMoving(false)
  }

  async function handlePublishAll() {
    const res = await fetch('/api/admin/map-tiles/publish', { method: 'POST' })
    if (!res.ok) { alert('Publish failed'); return }
    setTiles(prev => prev.map(t => ({ ...t, published: true })))
  }

  const linkedTileIdsSet = useMemo(() => new Set(linkedIds), [linkedIds])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        Loading map...
      </div>
    )
  }

  const unpublishedCount = tiles.filter(t => !t.published).length

  return (
    <div style={{ display: 'flex', height: '100%', position: 'relative' }} className="-m-8">

      {/* Map area */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {linkedMode && selectedTile && (
          <LinkedTilesModeHeader fromTile={selectedTile} onDone={exitLinkedMode} />
        )}
        {!linkedMode && (
          <div className="absolute top-3 right-3 z-10 flex gap-2">
            {unpublishedCount > 0 && (
              <button
                onClick={handlePublishAll}
                className="px-3 py-1.5 bg-amber-600 text-white border border-amber-500 rounded-lg text-xs hover:bg-amber-500 transition-colors"
              >
                Publish all ({unpublishedCount} draft{unpublishedCount !== 1 ? 's' : ''})
              </button>
            )}
            <button
              onClick={resetMap}
              className="px-3 py-1.5 bg-red-950 text-red-400 border border-red-900 rounded-lg text-xs hover:bg-red-900 transition-colors"
            >
              Reset all tiles
            </button>
          </div>
        )}
        <AdminHexGrid
          tiles={tiles}
          selectedTileId={selectedTile?.id ?? null}
          isMoving={isMoving}
          isLinkingMode={linkedMode}
          linkedTileIds={linkedTileIdsSet}
          allUnlocks={allUnlocks}
          onTileClick={handleTileClick}
          onEmptyClick={handleEmptyClick}
          onDeselect={() => { if (!isMoving && !linkedMode) { setSelectedTile(null) } }}
        />
      </div>

      {/* Side panel */}
      <TileSidePanel
        tile={selectedTile}
        stories={stories}
        modelFiles={modelFiles}
        selectedModel={selectedModel}
        onModelSelect={setSelectedModel}
        isMoving={isMoving}
        onTileUpdated={handleTileUpdated}
        onLinkedTilesClick={enterLinkedMode}
        onGrabToggle={() => setIsMoving(m => !m)}
        onDelete={handleDelete}
      />
    </div>
  )
}
