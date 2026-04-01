'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { TileType, TerrainType } from '@/lib/types'
import { AdminTile } from './AdminHexTile'

interface StoryOption { id: string; title: string }

interface Props {
  tile: AdminTile | null
  stories: StoryOption[]
  onTileUpdated: (updated: AdminTile) => void
  onLinkedTilesClick: () => void
}

async function patchTile(id: string, patch: Record<string, unknown>): Promise<boolean> {
  const res = await fetch(`/api/admin/map-tiles/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })
  return res.ok
}

const TERRAIN_OPTIONS: { value: TerrainType; label: string }[] = [
  { value: 'forest',   label: 'Forest' },
  { value: 'water',    label: 'Water' },
  { value: 'mountain', label: 'Mountain' },
  { value: 'land',     label: 'Land' },
]

export default function TileSidePanel({ tile, stories, onTileUpdated, onLinkedTilesClick }: Props) {
  const [name, setName] = useState(tile?.name ?? '')
  const nameTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setName(tile?.name ?? '')
  }, [tile?.id, tile?.name])

  async function handleTypeChange(type: TileType) {
    if (!tile) return
    const ok = await patchTile(tile.id, { type })
    if (ok) onTileUpdated({ ...tile, type })
  }

  async function handleTerrainTypeChange(terrainType: TerrainType | null) {
    if (!tile) return
    const ok = await patchTile(tile.id, { terrain_type: terrainType })
    if (ok) onTileUpdated({ ...tile, terrain_type: terrainType })
  }

  function handleNameInput(value: string) {
    setName(value)
    if (nameTimerRef.current) clearTimeout(nameTimerRef.current)
    nameTimerRef.current = setTimeout(async () => {
      if (!tile) return
      const ok = await patchTile(tile.id, { name: value || null })
      if (ok) onTileUpdated({ ...tile, name: value || null })
    }, 300)
  }

  async function handleStoryChange(storyId: string | null) {
    if (!tile) return
    const story = storyId ? (stories.find(s => s.id === storyId) ?? null) : null
    const ok = await patchTile(tile.id, { story_id: storyId })
    if (ok) onTileUpdated({ ...tile, story_id: storyId, story })
  }

  const typeButtons: TileType[] = ['undefined', 'terrain', 'story', 'mother_tree']

  if (!tile) {
    return (
      <aside style={{ width: 320, minWidth: 320 }} className="bg-gray-900 border-l border-gray-800 p-5 flex flex-col gap-4">
        <p className="text-gray-500 text-sm">Click a tile to edit it, or click an empty hex to place a new tile.</p>
      </aside>
    )
  }

  return (
    <aside style={{ width: 320, minWidth: 320 }} className="bg-gray-900 border-l border-gray-800 p-5 flex flex-col gap-5 overflow-y-auto">

      {/* Coordinates */}
      <p className="text-xs text-gray-600 font-mono">
        ({tile.position_q}, {tile.position_r})
        {tile.name ? ` · ${tile.name}` : ''}
      </p>

      {/* Type selector */}
      <div>
        <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">Type</p>
        <div className="flex flex-wrap gap-2">
          {typeButtons.map(t => (
            <button
              key={t}
              onClick={() => handleTypeChange(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                tile.type === t
                  ? 'bg-violet-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Terrain type dropdown — terrain only */}
      {tile.type === 'terrain' && (
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">Terrain type</p>
          <select
            value={tile.terrain_type ?? ''}
            onChange={e => handleTerrainTypeChange((e.target.value as TerrainType) || null)}
            className="w-full bg-gray-800 text-gray-200 rounded-lg px-3 py-2 text-sm border border-gray-700"
          >
            <option value="">— None —</option>
            {TERRAIN_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      )}

      {/* Name — terrain and mother_tree only */}
      {(tile.type === 'terrain' || tile.type === 'mother_tree') && (
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">Name</p>
          <input
            type="text"
            value={name}
            onChange={e => handleNameInput(e.target.value)}
            placeholder="Tile name"
            className="w-full bg-gray-800 text-gray-200 rounded-lg px-3 py-2 text-sm border border-gray-700 placeholder-gray-600"
          />
        </div>
      )}

      {/* Story picker — story type only */}
      {tile.type === 'story' && (
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">Story</p>
          <select
            value={tile.story_id ?? ''}
            onChange={e => handleStoryChange(e.target.value || null)}
            className="w-full bg-gray-800 text-gray-200 rounded-lg px-3 py-2 text-sm border border-gray-700"
          >
            <option value="">— None —</option>
            {stories.map(s => (
              <option key={s.id} value={s.id}>{s.title}</option>
            ))}
          </select>
          {tile.story_id && (
            <Link
              href={`/admin/stories/${tile.story_id}`}
              className="text-xs text-violet-400 hover:text-violet-300 mt-1 block"
            >
              Edit story →
            </Link>
          )}
          <Link href="/admin/stories/new" className="text-xs text-gray-500 hover:text-gray-300 mt-1 block">
            + New story
          </Link>
        </div>
      )}

      {/* Linked tiles — all non-undefined tiles */}
      {tile.type !== 'undefined' && (
        <div className="pt-2 border-t border-gray-800">
          <button
            onClick={onLinkedTilesClick}
            className="w-full px-4 py-2 bg-gray-800 text-gray-300 rounded-lg text-sm hover:bg-gray-700 transition-colors text-left"
          >
            Linked tiles (unlocks when completed) →
          </button>
        </div>
      )}
    </aside>
  )
}
