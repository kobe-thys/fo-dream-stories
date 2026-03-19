'use client'
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch'
import { MappedTile } from '@/lib/types'
import { axialToPixel, HEX_WIDTH, HEX_HEIGHT } from '@/lib/hex'
import HexTile from './HexTile'

interface HexGridProps {
  tiles: MappedTile[]
  selectedTileId?: string | null
  flippedTileId?: string | null
  onTileClick?: (tile: MappedTile) => void
}

const PADDING = 100

export default function HexGrid({ tiles, selectedTileId, flippedTileId, onTileClick }: HexGridProps) {
  if (tiles.length === 0) return null

  // Compute bounding box from all tile pixel positions
  const positions = tiles.map(t => axialToPixel(t.position_q, t.position_r))
  const minX = Math.min(...positions.map(p => p.x)) - HEX_WIDTH / 2 - PADDING
  const maxX = Math.max(...positions.map(p => p.x)) + HEX_WIDTH / 2 + PADDING
  const minY = Math.min(...positions.map(p => p.y)) - HEX_HEIGHT / 2 - PADDING
  const maxY = Math.max(...positions.map(p => p.y)) + HEX_HEIGHT / 2 + PADDING
  const width = maxX - minX
  const height = maxY - minY
  const offsetX = -minX
  const offsetY = -minY

  return (
    <TransformWrapper minScale={0.5} maxScale={2} centerOnInit limitToBounds={false}>
      <TransformComponent wrapperStyle={{ width: '100%', maxWidth: '100vw' }}>
        <div style={{ position: 'relative', width, height }}>
          {tiles.map(tile => {
            const { x, y } = axialToPixel(tile.position_q, tile.position_r)
            return (
              <HexTile
                key={tile.id}
                tile={tile}
                x={offsetX + x}
                y={offsetY + y}
                isSelected={selectedTileId === tile.id}
                isFlipped={flippedTileId === tile.id}
                onClick={onTileClick}
              />
            )
          })}
        </div>
      </TransformComponent>
    </TransformWrapper>
  )
}
