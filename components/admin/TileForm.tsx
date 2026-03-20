'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Tile } from '@/lib/types'
import AudioUpload from './AudioUpload'

type TileInput = Partial<Omit<Tile, 'id' | 'created_at' | 'alex_dream_image_url'>>

interface TileFormProps {
  tile?: Tile          // undefined = new tile
}

const TILE_TYPES = ['mother_tree', 'story', 'terrain'] as const
const TERRAIN_TYPES = ['forest', 'land', 'water', 'mountain'] as const

export default function TileForm({ tile }: TileFormProps) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState<TileInput>({
    type: tile?.type ?? 'story',
    name: tile?.name ?? '',
    position_q: tile?.position_q ?? 0,
    position_r: tile?.position_r ?? 0,
    terrain_type: tile?.terrain_type ?? null,
    story_text: tile?.story_text ?? '',
    audio_url: tile?.audio_url ?? null,
    alex_tip: tile?.alex_tip ?? '',
    sensory_moment_text: tile?.sensory_moment_text ?? '',
    default_token_image_url: tile?.default_token_image_url ?? null,
  })

  function set<K extends keyof TileInput>(key: K, value: TileInput[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const url = tile ? `/api/admin/tiles/${tile.id}` : '/api/admin/tiles'
    const method = tile ? 'PATCH' : 'POST'
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const json = await res.json()
    setSaving(false)
    if (!res.ok) { setError(json.error); return }
    router.push('/admin/tiles')
    router.refresh()
  }

  async function handleDelete() {
    if (!tile) return
    if (!confirm(`Delete "${tile.name}"? This cannot be undone.`)) return
    await fetch(`/api/admin/tiles/${tile.id}`, { method: 'DELETE' })
    router.push('/admin/tiles')
    router.refresh()
  }

  const isStory = form.type === 'story' || form.type === 'mother_tree'
  const isTerrain = form.type === 'terrain'

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6 max-w-2xl">
      {/* Type + Name + Position */}
      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-gray-400 uppercase tracking-wide">Type</span>
          <select
            value={form.type}
            onChange={e => set('type', e.target.value as Tile['type'])}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
          >
            {TILE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-gray-400 uppercase tracking-wide">Name</span>
          <input
            required
            value={form.name}
            onChange={e => set('name', e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-gray-400 uppercase tracking-wide">Position Q</span>
          <input
            type="number"
            value={form.position_q}
            onChange={e => set('position_q', parseInt(e.target.value))}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-gray-400 uppercase tracking-wide">Position R</span>
          <input
            type="number"
            value={form.position_r}
            onChange={e => set('position_r', parseInt(e.target.value))}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
          />
        </label>
      </div>

      {/* Terrain type (only for terrain tiles) */}
      {isTerrain && (
        <label className="flex flex-col gap-1">
          <span className="text-xs text-gray-400 uppercase tracking-wide">Terrain type</span>
          <select
            value={form.terrain_type ?? ''}
            onChange={e => set('terrain_type', e.target.value as Tile['terrain_type'])}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
          >
            <option value="">— select —</option>
            {TERRAIN_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
      )}

      {/* Story text (story/mother_tree only) */}
      {isStory && (
        <label className="flex flex-col gap-1">
          <span className="text-xs text-gray-400 uppercase tracking-wide">Story text</span>
          <textarea
            value={form.story_text ?? ''}
            onChange={e => set('story_text', e.target.value)}
            rows={8}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm leading-relaxed resize-y"
          />
        </label>
      )}

      {/* Audio upload */}
      {isStory && (
        <div className="flex flex-col gap-1">
          <span className="text-xs text-gray-400 uppercase tracking-wide">Audio</span>
          <AudioUpload
            currentUrl={form.audio_url ?? null}
            onUploaded={url => set('audio_url', url)}
          />
        </div>
      )}

      {/* Alex's tip (story/mother_tree only) */}
      {isStory && (
        <label className="flex flex-col gap-1">
          <span className="text-xs text-gray-400 uppercase tracking-wide">Alex&apos;s tip</span>
          <textarea
            value={form.alex_tip ?? ''}
            onChange={e => set('alex_tip', e.target.value)}
            rows={3}
            placeholder="What Alex found here..."
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm leading-relaxed"
          />
        </label>
      )}

      {/* Sensory moment (terrain only) */}
      {isTerrain && (
        <label className="flex flex-col gap-1">
          <span className="text-xs text-gray-400 uppercase tracking-wide">Sensory moment</span>
          <textarea
            value={form.sensory_moment_text ?? ''}
            onChange={e => set('sensory_moment_text', e.target.value)}
            rows={2}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
          />
        </label>
      )}

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving}
          className="px-6 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 disabled:opacity-50"
        >
          {saving ? 'Saving…' : tile ? 'Save changes' : 'Create tile'}
        </button>
        {tile && (
          <button
            type="button"
            onClick={handleDelete}
            className="px-6 py-2 bg-red-900/50 text-red-400 rounded-lg text-sm hover:bg-red-900"
          >
            Delete tile
          </button>
        )}
      </div>
    </form>
  )
}
