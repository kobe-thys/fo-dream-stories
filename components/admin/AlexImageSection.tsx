'use client'
import { Tile } from '@/lib/types'

interface Props {
  tile: Tile
  onUpdated: (tile: Tile) => void
}

export default function AlexImageSection({ tile }: Props) {
  return <p className="text-gray-500 text-sm">Alex image management coming soon (Task 6).</p>
}
