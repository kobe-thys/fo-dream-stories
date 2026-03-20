'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Tile } from '@/lib/types'
import TileForm from '@/components/admin/TileForm'
import AlexImageSection from '@/components/admin/AlexImageSection'

export default function EditTilePage() {
  const { id } = useParams<{ id: string }>()
  const [tile, setTile] = useState<Tile | null>(null)

  useEffect(() => {
    fetch(`/api/admin/tiles/${id}`).then(r => r.json()).then(setTile)
  }, [id])

  if (!tile) return <p className="text-gray-500">Loading tile...</p>

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-bold">Edit: {tile.name}</h1>
      <TileForm tile={tile} />
      {(tile.type === 'story' || tile.type === 'mother_tree') && (
        <div className="border-t border-gray-800 pt-8">
          <h2 className="text-lg font-semibold mb-4">Alex&apos;s dream image</h2>
          <AlexImageSection tile={tile} onUpdated={setTile} />
        </div>
      )}
    </div>
  )
}
