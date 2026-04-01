'use client'
import { AdminTile } from './AdminHexTile'

interface Props {
  fromTile: AdminTile
  onDone: () => void
}

export default function LinkedTilesModeHeader({ fromTile, onDone }: Props) {
  const label = fromTile.name ?? fromTile.story?.title ?? `(${fromTile.position_q}, ${fromTile.position_r})`
  return (
    <div className="absolute top-0 left-0 right-0 z-20 flex items-center gap-4 px-5 py-3 bg-gray-950 border-b border-amber-800 shadow-lg">
      <span className="text-amber-400 text-sm font-semibold">
        Tiles unlocked when &quot;{label}&quot; is completed
      </span>
      <span className="text-gray-500 text-xs">Click non-undefined tiles to toggle</span>
      <button
        onClick={onDone}
        className="ml-auto px-4 py-1.5 bg-amber-700 text-amber-100 rounded-lg text-sm hover:bg-amber-600 transition-colors"
      >
        Done
      </button>
    </div>
  )
}
