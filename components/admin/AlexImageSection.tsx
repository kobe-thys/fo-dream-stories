'use client'
import { useState } from 'react'
import { Tile } from '@/lib/types'

interface Props {
  tile: Tile
  onUpdated: (tile: Tile) => void
}

export default function AlexImageSection({ tile, onUpdated }: Props) {
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')

  async function handleRegenerate() {
    if (!tile.alex_tip) { setError("Add Alex's tip text first — it's used as the image prompt."); return }
    setGenerating(true)
    setError('')
    const res = await fetch('/api/admin/regenerate-alex-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tileId: tile.id, alexTip: tile.alex_tip }),
    })
    const json = await res.json()
    setGenerating(false)
    if (!res.ok) { setError(json.error); return }
    onUpdated({ ...tile, alex_dream_image_url: json.imageUrl })
  }

  return (
    <div className="flex flex-col gap-4">
      {tile.alex_dream_image_url ? (
        <div className="flex gap-6 items-start">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={tile.alex_dream_image_url}
            alt="Alex's dream"
            className="w-48 h-48 rounded-xl object-cover"
          />
          <div className="flex flex-col gap-3">
            <p className="text-sm text-gray-400">Current Alex dream image</p>
            <button
              onClick={handleRegenerate}
              disabled={generating}
              className="px-4 py-2 bg-amber-600/30 text-amber-400 rounded-lg text-sm hover:bg-amber-600/50 disabled:opacity-50 w-fit"
            >
              {generating ? 'Generating…' : 'Regenerate image'}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-gray-500">No Alex dream image yet. Add Alex&apos;s tip text above and generate one.</p>
          <button
            onClick={handleRegenerate}
            disabled={generating || !tile.alex_tip}
            className="px-4 py-2 bg-amber-600/30 text-amber-400 rounded-lg text-sm hover:bg-amber-600/50 disabled:opacity-50 w-fit"
          >
            {generating ? 'Generating…' : 'Generate Alex dream image'}
          </button>
        </div>
      )}
      {error && <p className="text-red-400 text-sm">{error}</p>}
    </div>
  )
}
