'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Tile } from '@/lib/types'

export default function TileListPage() {
  const [tiles, setTiles] = useState<Tile[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/tiles').then(r => r.json()).then(data => {
      setTiles(data)
      setLoading(false)
    })
  }, [])

  if (loading) return <p className="text-gray-500">Loading tiles...</p>

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Tiles</h1>
        <Link
          href="/admin/tiles/new"
          className="px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700"
        >
          + New tile
        </Link>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-500 border-b border-gray-800">
            <th className="pb-2 pr-4">Name</th>
            <th className="pb-2 pr-4">Type</th>
            <th className="pb-2 pr-4">Position (q, r)</th>
            <th className="pb-2 pr-4">Story</th>
            <th className="pb-2 pr-4">Audio</th>
            <th className="pb-2">Alex image</th>
          </tr>
        </thead>
        <tbody>
          {tiles.map(tile => (
            <tr key={tile.id} className="border-b border-gray-800/50 hover:bg-gray-900/50">
              <td className="py-3 pr-4">
                <Link href={`/admin/tiles/${tile.id}`} className="text-violet-400 hover:underline">
                  {tile.name}
                </Link>
              </td>
              <td className="py-3 pr-4 text-gray-400">{tile.type}</td>
              <td className="py-3 pr-4 text-gray-400">{tile.position_q}, {tile.position_r}</td>
              <td className="py-3 pr-4">{tile.story_text ? '✓' : <span className="text-gray-600">—</span>}</td>
              <td className="py-3 pr-4">{tile.audio_url ? '✓' : <span className="text-gray-600">—</span>}</td>
              <td className="py-3">{tile.alex_dream_image_url ? '✓' : <span className="text-gray-600">—</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
