'use client'
import { useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { AdminTile } from '@/components/admin/map/AdminHexTile'
import TileSidePanel from '@/components/admin/map/TileSidePanel'
import LinkedTilesModeHeader from '@/components/admin/map/LinkedTilesModeHeader'

// react-three-fiber accesses the DOM on import — SSR off
const AdminHexGrid = dynamic(() => import('@/components/admin/map/AdminHexGrid'), { ssr: false })

interface StoryOption { id: string; title: string }

/**
 * In-memory undo. Deliberately not persisted — it is cleared by a reload, which
 * is the accepted trade for not adding an edits table. Tile edits hit the server
 * immediately, so undo replays the inverse call rather than rolling back a batch.
 */
type UndoAction =
  | { kind: 'create'; tile: AdminTile }
  | { kind: 'delete'; tile: AdminTile }
  | { kind: 'move'; id: string; from: { q: number; r: number } }
  | { kind: 'update'; id: string; before: Partial<AdminTile> }

const UNDO_LIMIT = 25

// Fields the side panel can change, and therefore the ones undo has to restore.
const MUTABLE: (keyof AdminTile)[] = [
  'type', 'story_id', 'name', 'terrain_type', 'model', 'rotation',
  'scale_x', 'scale_y', 'scale_z',
]

function patchTile(id: string, body: Record<string, unknown>) {
  return fetch(`/api/admin/map-tiles/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

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
  const [loadError, setLoadError] = useState<string | null>(null)
  const [undoStack, setUndoStack] = useState<UndoAction[]>([])
  const [undoing, setUndoing] = useState(false)

  const pushUndo = (a: UndoAction) =>
    setUndoStack(s => [...s, a].slice(-UNDO_LIMIT))

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
      } else {
        // Previously this failed silently and the picker just rendered empty.
        setLoadError('Could not load the tile model list (/api/admin/models).')
      }
      setLoading(false)
    })
    .catch(() => {
      setLoadError('Could not reach the admin API. Check you are signed in as an admin.')
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

    // Clicking the selected tile again clears the selection. Previously the only
    // way to deselect was to place a throwaway tile and delete it.
    setSelectedTile(prev => (prev?.id === tile.id ? null : tile))
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
      pushUndo({
        kind: 'move',
        id: selectedTile.id,
        from: { q: selectedTile.position_q, r: selectedTile.position_r },
      })
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
    pushUndo({ kind: 'create', tile: newTile })
    setTiles(prev => [...prev, newTile])
    setSelectedTile(newTile)
  }

  function handleTileUpdated(updated: AdminTile) {
    const before = tiles.find(t => t.id === updated.id)
    if (before) {
      const changed: Partial<AdminTile> = {}
      for (const k of MUTABLE) {
        if (before[k] !== updated[k]) (changed as Record<string, unknown>)[k] = before[k]
      }
      if (Object.keys(changed).length) pushUndo({ kind: 'update', id: updated.id, before: changed })
    }
    setTiles(prev => prev.map(t => t.id === updated.id ? updated : t))
    setSelectedTile(updated)
  }

  async function handleDelete() {
    if (!selectedTile) return
    const res = await fetch(`/api/admin/map-tiles/${selectedTile.id}`, { method: 'DELETE' })
    if (!res.ok) return
    pushUndo({ kind: 'delete', tile: selectedTile })
    setTiles(prev => prev.filter(t => t.id !== selectedTile.id))
    setSelectedTile(null)
    setIsMoving(false)
  }

  async function handleUndo() {
    const action = undoStack[undoStack.length - 1]
    if (!action || undoing) return
    setUndoing(true)
    try {
      if (action.kind === 'create') {
        const res = await fetch(`/api/admin/map-tiles/${action.tile.id}`, { method: 'DELETE' })
        if (!res.ok) return
        setTiles(prev => prev.filter(t => t.id !== action.tile.id))
        setSelectedTile(prev => prev?.id === action.tile.id ? null : prev)

      } else if (action.kind === 'move') {
        const res = await patchTile(action.id, { position_q: action.from.q, position_r: action.from.r })
        if (!res.ok) return
        setTiles(prev => prev.map(t => t.id === action.id
          ? { ...t, position_q: action.from.q, position_r: action.from.r } : t))
        setSelectedTile(prev => prev?.id === action.id
          ? { ...prev, position_q: action.from.q, position_r: action.from.r } : prev)

      } else if (action.kind === 'update') {
        const res = await patchTile(action.id, action.before as Record<string, unknown>)
        if (!res.ok) return
        setTiles(prev => prev.map(t => t.id === action.id ? { ...t, ...action.before } : t))
        setSelectedTile(prev => prev?.id === action.id ? { ...prev, ...action.before } : prev)

      } else {
        // Re-create. The row gets a NEW id, so unlock links that pointed at the
        // deleted tile are not restored -- re-link it if it was a story tile.
        const t = action.tile
        const res = await fetch('/api/admin/map-tiles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ q: t.position_q, r: t.position_r, model: t.model }),
        })
        if (!res.ok) return
        const created: AdminTile = await res.json()
        const rest: Record<string, unknown> = {}
        for (const k of MUTABLE) if (t[k] !== undefined && t[k] !== null) rest[k] = t[k]
        if (Object.keys(rest).length) await patchTile(created.id, rest)
        const restored = { ...created, ...rest } as AdminTile
        setTiles(prev => [...prev, restored])
        setSelectedTile(restored)
      }
      setUndoStack(s => s.slice(0, -1))
    } finally {
      setUndoing(false)
    }
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
        {loadError && (
          <div className="absolute top-3 left-3 z-20 px-3 py-2 bg-red-950 text-red-300 border border-red-800 rounded-lg text-xs max-w-sm">
            {loadError}
          </div>
        )}
        {linkedMode && selectedTile && (
          <LinkedTilesModeHeader fromTile={selectedTile} onDone={exitLinkedMode} />
        )}
        {!linkedMode && (
          <div className="absolute top-3 right-3 z-10 flex gap-2">
            <button
              onClick={handleUndo}
              disabled={undoStack.length === 0 || undoing}
              title={undoStack.length ? `Undo ${undoStack[undoStack.length - 1].kind} (${undoStack.length})` : 'Nothing to undo'}
              className="px-3 py-1.5 bg-gray-800 text-gray-200 border border-gray-700 rounded-lg text-xs hover:bg-gray-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ↶ Undo{undoStack.length ? ` (${undoStack.length})` : ''}
            </button>
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
