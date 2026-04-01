'use client'
import { useEffect, useRef } from 'react'
import { TransformWrapper, TransformComponent, ReactZoomPanPinchRef } from 'react-zoom-pan-pinch'
import AdminHexTile, { AdminTile } from './AdminHexTile'

const GRID_RADIUS = 25
const CANVAS_W = 4400
const CANVAS_H = 3600
export const OFFSET_X = CANVAS_W / 2  // 2200
export const OFFSET_Y = CANVAS_H / 2  // 1800

// Generate all valid axial positions within radius R
function generatePositions(radius: number): { q: number; r: number }[] {
  const positions: { q: number; r: number }[] = []
  for (let q = -radius; q <= radius; q++) {
    for (let r = -radius; r <= radius; r++) {
      if (Math.abs(q + r) <= radius) {
        positions.push({ q, r })
      }
    }
  }
  return positions
}

const ALL_POSITIONS = generatePositions(GRID_RADIUS)

interface Props {
  tiles: AdminTile[]
  selectedTileId: string | null
  linkedTileIds: Set<string>
  linkedMode: boolean
  onTileClick: (q: number, r: number, tile: AdminTile | null) => void
}

export default function AdminHexGrid({ tiles, selectedTileId, linkedTileIds, linkedMode, onTileClick }: Props) {
  const transformRef = useRef<ReactZoomPanPinchRef | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  // Build lookup map: "q,r" → AdminTile
  const tileMap = new Map<string, AdminTile>()
  for (const tile of tiles) {
    tileMap.set(`${tile.position_q},${tile.position_r}`, tile)
  }

  useEffect(() => {
    if (!transformRef.current || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const x = rect.width / 2 - OFFSET_X
    const y = rect.height / 2 - OFFSET_Y
    transformRef.current.setTransform(x, y, 1, 0)
  }, [])

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', overflow: 'hidden', background: '#111827' }}
    >
      <TransformWrapper
        ref={transformRef}
        minScale={0.1}
        maxScale={4}
        limitToBounds={false}
        panning={{ velocityDisabled: true }}
      >
        <TransformComponent
          wrapperStyle={{ width: '100%', height: '100%' }}
          contentStyle={{ width: CANVAS_W, height: CANVAS_H, position: 'relative', willChange: 'transform' }}
        >
          {ALL_POSITIONS.map(({ q, r }) => {
            const tile = tileMap.get(`${q},${r}`) ?? null
            const key = `${q},${r}`
            return (
              <AdminHexTile
                key={key}
                tile={tile}
                q={q}
                r={r}
                offsetX={OFFSET_X}
                offsetY={OFFSET_Y}
                isSelected={tile !== null && tile.id === selectedTileId}
                isLinked={tile !== null && linkedTileIds.has(tile.id)}
                linkedMode={linkedMode}
                onClick={onTileClick}
              />
            )
          })}
        </TransformComponent>
      </TransformWrapper>
    </div>
  )
}
