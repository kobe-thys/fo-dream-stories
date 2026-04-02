'use client'
import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { AdminTile } from '@/components/admin/map/AdminHexTile'
import TileSidePanel from '@/components/admin/map/TileSidePanel'
import LinkedTilesModeHeader from '@/components/admin/map/LinkedTilesModeHeader'

// react-zoom-pan-pinch accesses the DOM on import — SSR off
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

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/map-tiles').then(r => r.json()),
      fetch('/api/admin/stories').then(r => r.json()),
      fetch('/api/admin/unlocks').then(r => r.json()),
    ]).then(([tileData, storyData, unlockData]) => {
      setTiles(tileData)
      setStories(storyData.map((s: { id: string; title: string }) => ({ id: s.id, title: s.title })))
      setAllUnlocks(unlockData)
      setLoading(false)
    })
  }, [])

  async function handleTileClick(q: number, r: number, tile: AdminTile | null) {
    if (linkedMode) {
      // Toggle linked tile (only non-undefined DB tiles are clickable in linked mode)
      if (!selectedTile || !tile) return
      const next = linkedIds.includes(tile.id)
        ? linkedIds.filter(id => id !== tile.id)
        : [...linkedIds, tile.id]
      setLinkedIds(next)
      setAllUnlocks(prev => {
        const filtered = prev.filter(u => u.from_tile_id !== selectedTile.id || u.to_tile_id !== tile.id)
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

    if (tile) {
      // Select existing tile
      setSelectedTile(tile)
    } else {
      // Create tile at empty position
      const res = await fetch('/api/admin/map-tiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q, r }),
      })
      if (!res.ok) return
      const newTile: AdminTile = await res.json()
      setTiles(prev => [...prev, newTile])
      setSelectedTile(newTile)
    }
  }

  function handleTileUpdated(updated: AdminTile) {
    setTiles(prev => prev.map(t => t.id === updated.id ? updated : t))
    setSelectedTile(updated)
  }

  function enterLinkedMode() {
    if (!selectedTile) return
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        Loading map...
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', height: '100%', position: 'relative' }} className="-m-8">

      {/* Map area */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {linkedMode && selectedTile && (
          <LinkedTilesModeHeader fromTile={selectedTile} onDone={exitLinkedMode} />
        )}
        <AdminHexGrid
          tiles={tiles}
          selectedTileId={selectedTile?.id ?? null}
          linkedTileIds={new Set(linkedIds)}
          linkedMode={linkedMode}
          onTileClick={handleTileClick}
        />
      </div>

      {/* Side panel */}
      <TileSidePanel
        tile={selectedTile}
        stories={stories}
        onTileUpdated={handleTileUpdated}
        onLinkedTilesClick={enterLinkedMode}
      />
    </div>
  )
}
