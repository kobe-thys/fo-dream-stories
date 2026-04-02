'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { TileType } from '@/lib/types'
import { AdminTile } from './AdminHexTile'

interface StoryOption { id: string; title: string }

interface Props {
  tile: AdminTile | null
  stories: StoryOption[]
  modelFiles: string[]
  selectedModel: string
  onModelSelect: (model: string) => void
  isMoving: boolean
  onTileUpdated: (updated: AdminTile) => void
  onLinkedTilesClick: () => void
  onGrabToggle: () => void
  onDelete: () => void
}

async function patchTile(id: string, patch: Record<string, unknown>): Promise<boolean> {
  const res = await fetch(`/api/admin/map-tiles/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })
  return res.ok
}

function ModelGrid({ models, selected, onSelect }: { models: string[]; selected: string; onSelect: (m: string) => void }) {
  return (
    <div className="grid grid-cols-3 gap-1 max-h-64 overflow-y-auto pr-1">
      {models.map(m => {
        const thumbSrc = `/models/${m.replace('.glb', '.png')}`
        const label = m.replace('.glb', '').replace(/-/g, ' ')
        return (
          <button
            key={m}
            onClick={() => onSelect(m)}
            title={label}
            className={`flex flex-col items-center gap-1 p-1.5 rounded-lg border transition-colors ${
              selected === m
                ? 'border-violet-500 bg-violet-900/30'
                : 'border-gray-700 bg-gray-800 hover:border-gray-600'
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={thumbSrc}
              alt={label}
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
              className="w-full aspect-square object-contain rounded"
            />
            <span className="text-[9px] text-gray-400 truncate w-full text-center leading-tight">{label}</span>
          </button>
        )
      })}
    </div>
  )
}

export default function TileSidePanel({
  tile, stories, modelFiles, selectedModel, onModelSelect,
  isMoving, onTileUpdated, onLinkedTilesClick, onGrabToggle, onDelete,
}: Props) {
  const [name, setName] = useState(tile?.name ?? '')
  const nameTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (nameTimerRef.current) clearTimeout(nameTimerRef.current)
    setName(tile?.name ?? '')
  }, [tile?.id, tile?.name])

  async function handleTypeChange(type: TileType) {
    if (!tile) return
    const patch: Record<string, unknown> = { type }
    // Auto-name terrain from model filename
    if (type === 'terrain' && tile.model) {
      patch.name = tile.model.replace('.glb', '').replace(/-/g, ' ')
    }
    // Clear story link when switching away from story
    if (type !== 'story') patch.story_id = null
    const ok = await patchTile(tile.id, patch)
    if (ok) onTileUpdated({ ...tile, type, ...(patch.name !== undefined ? { name: patch.name as string } : {}), ...(type !== 'story' ? { story_id: null, story: null } : {}) })
  }

  async function handleModelChange(model: string) {
    onModelSelect(model)
    if (!tile) return
    const patch: Record<string, unknown> = { model }
    // Auto-name terrain from model filename
    if (tile.type === 'terrain') {
      patch.name = model.replace('.glb', '').replace(/-/g, ' ')
    }
    const ok = await patchTile(tile.id, patch)
    if (ok) onTileUpdated({ ...tile, model, ...(patch.name !== undefined ? { name: patch.name as string } : {}) })
  }

  async function handleRotate() {
    if (!tile) return
    const rotation = (tile.rotation + 1) % 6
    const ok = await patchTile(tile.id, { rotation })
    if (ok) onTileUpdated({ ...tile, rotation })
  }

  async function handleStoryChange(storyId: string | null) {
    if (!tile) return
    const story = storyId ? (stories.find(s => s.id === storyId) ?? null) : null
    const ok = await patchTile(tile.id, { story_id: storyId })
    if (ok) onTileUpdated({ ...tile, story_id: storyId, story })
  }

  async function handleDelete() {
    if (!tile) return
    if (!confirm('Delete this tile? This cannot be undone.')) return
    onDelete()
  }

  if (!tile) {
    return (
      <aside style={{ width: 280, minWidth: 280 }} className="bg-gray-900 border-l border-gray-800 p-4 flex flex-col gap-4 overflow-y-auto">
        <p className="text-gray-500 text-xs">Click empty ground to place a tile.</p>
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">Model to place</p>
          <ModelGrid models={modelFiles} selected={selectedModel} onSelect={onModelSelect} />
        </div>
      </aside>
    )
  }

  const typeButtons: TileType[] = ['undefined', 'terrain', 'story']

  return (
    <aside style={{ width: 280, minWidth: 280 }} className="bg-gray-900 border-l border-gray-800 p-4 flex flex-col gap-4 overflow-y-auto">

      {/* Coordinates */}
      <p className="text-xs text-gray-600 font-mono">({tile.position_q}, {tile.position_r})</p>

      {/* Type */}
      <div>
        <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">Type</p>
        <div className="flex flex-wrap gap-1.5">
          {typeButtons.map(t => (
            <button key={t} onClick={() => handleTypeChange(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                tile.type === t ? 'bg-violet-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Model */}
      <div>
        <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">Model</p>
        <ModelGrid models={modelFiles} selected={tile.model ?? selectedModel} onSelect={handleModelChange} />
      </div>

      {/* Rotate */}
      <button onClick={handleRotate}
        className="w-full py-2 bg-gray-800 text-gray-300 rounded-lg text-xs hover:bg-gray-700 transition-colors">
        Rotate 60° ↻
      </button>

      {/* Story picker */}
      {tile.type === 'story' && (
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">Story</p>
          <select
            value={tile.story_id ?? ''}
            onChange={e => handleStoryChange(e.target.value || null)}
            className="w-full bg-gray-800 text-gray-200 rounded-lg px-3 py-2 text-sm border border-gray-700"
          >
            <option value="">— None —</option>
            {stories.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
          </select>
          {tile.story_id && (
            <Link href={`/admin/stories/${tile.story_id}`}
              className="text-xs text-violet-400 hover:text-violet-300 mt-1 block">
              Edit story →
            </Link>
          )}
        </div>
      )}

      {/* Linked tiles — story tiles with a story assigned only */}
      {tile.type === 'story' && tile.story_id && (
        <div className="border-t border-gray-800 pt-3">
          <button onClick={onLinkedTilesClick}
            className="w-full px-4 py-2 bg-gray-800 text-gray-300 rounded-lg text-sm hover:bg-gray-700 transition-colors text-left">
            Linked tiles (unlocks when completed) →
          </button>
        </div>
      )}

      {/* Grab / Drop */}
      <button onClick={onGrabToggle}
        className={`w-full py-2 rounded-lg text-xs font-medium transition-colors border ${
          isMoving
            ? 'bg-cyan-600 text-white border-cyan-500'
            : 'bg-gray-800 text-gray-300 border-gray-700 hover:bg-gray-700'
        }`}>
        {isMoving ? 'Drop tile (click new position)' : 'Grab & move'}
      </button>

      {/* Delete */}
      <button onClick={handleDelete}
        className="w-full py-2 text-red-400 text-xs hover:text-red-300 transition-colors">
        Delete tile
      </button>
    </aside>
  )
}
