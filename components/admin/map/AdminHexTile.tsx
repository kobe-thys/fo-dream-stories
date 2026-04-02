'use client'
import { axialToPixel, HEX_SIZE } from '@/lib/hex'
import { TileType, TerrainType } from '@/lib/types'

export const HEX_W = Math.sqrt(3) * HEX_SIZE   // ~76.2px
export const HEX_H = 2 * HEX_SIZE               // 88px
const HEX_CLIP = 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)'

export function tileColor(type: TileType, terrainType: TerrainType | null): string {
  if (type === 'story') return '#7c3aed'
  if (type === 'terrain') {
    if (terrainType === 'forest')   return '#166534'
    if (terrainType === 'water')    return '#1e40af'
    if (terrainType === 'mountain') return '#78716c'
    return '#374151'  // land or null
  }
  return '#6b7280'  // undefined
}

export interface AdminTile {
  id: string
  type: TileType
  name: string | null
  position_q: number
  position_r: number
  terrain_type: TerrainType | null
  story_id: string | null
  story: { id: string; title: string } | null
}

interface Props {
  tile: AdminTile | null    // null = empty slot (no DB row yet)
  q: number
  r: number
  offsetX: number
  offsetY: number
  isSelected: boolean
  isLinked: boolean
  linkedMode: boolean
  onClick: (q: number, r: number, tile: AdminTile | null) => void
}

export default function AdminHexTile({ tile, q, r, offsetX, offsetY, isSelected, isLinked, linkedMode, onClick }: Props) {
  const { x, y } = axialToPixel(q, r)
  const left = offsetX + x - HEX_W / 2
  const top  = offsetY + y - HEX_H / 2

  // In linked mode, empty slots and undefined tiles are non-clickable
  const isClickable = !linkedMode || (tile !== null && tile.type !== 'undefined')
  const opacity = linkedMode && (!tile || tile.type === 'undefined') ? 0.2 : 1

  let filter: string | undefined
  if (isSelected) filter = 'drop-shadow(0 0 8px #a78bfa) brightness(1.3)'
  else if (isLinked && linkedMode) filter = 'drop-shadow(0 0 6px #f59e0b) brightness(1.2)'

  return (
    <div
      onClick={() => isClickable && onClick(q, r, tile)}
      style={{
        position: 'absolute',
        left,
        top,
        width: HEX_W,
        height: HEX_H,
        opacity,
        cursor: isClickable ? 'pointer' : 'default',
        filter,
        userSelect: 'none',
      }}
    >
      {tile ? (
        // DB tile — filled colored hex
        <div
          style={{
            width: '100%',
            height: '100%',
            clipPath: HEX_CLIP,
            backgroundColor: tileColor(tile.type, tile.terrain_type),
            transform: 'scale(0.95)',
            transformOrigin: 'center',
          }}
        />
      ) : (
        // Empty slot — dim outline only
        <div
          style={{
            width: '100%',
            height: '100%',
            clipPath: HEX_CLIP,
            backgroundColor: 'rgba(255,255,255,0.03)',
            transform: 'scale(0.95)',
            transformOrigin: 'center',
          }}
        />
      )}
    </div>
  )
}
