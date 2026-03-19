'use client'
import { MappedTile } from '@/lib/types'
import { axialToPixel } from '@/lib/hex'
import HexTile from './HexTile'

interface HexGridProps {
  tiles: MappedTile[]
  onTileClick?: (tile: MappedTile) => void
}

// Container is 600×600px; Mother Tree (0,0) pixel coords map to the centre
const GRID_SIZE = 600
const CENTRE = GRID_SIZE / 2

export default function HexGrid({ tiles, onTileClick }: HexGridProps) {
  return (
    <div
      style={{
        position: 'relative',
        width: GRID_SIZE,
        height: GRID_SIZE,
        maxWidth: '100vw',
        overflow: 'hidden',
      }}
    >
      {tiles.map(tile => {
        const { x, y } = axialToPixel(tile.position_q, tile.position_r)
        return (
          <HexTile
            key={tile.id}
            tile={tile}
            x={CENTRE + x}
            y={CENTRE + y}
            onClick={onTileClick}
          />
        )
      })}
    </div>
  )
}
