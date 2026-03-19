import { MappedTile } from '@/lib/types'
import { HEX_WIDTH, HEX_HEIGHT } from '@/lib/hex'

interface HexTileProps {
  tile: MappedTile
  x: number           // pixel x offset from grid centre
  y: number           // pixel y offset from grid centre
  onClick?: (tile: MappedTile) => void
}

// Pointy-top hexagon clip path (percentage-based, works at any size)
const HEX_CLIP = 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)'

function tileBackground(tile: MappedTile): string {
  if (tile.type === 'mother_tree') return '#7c3aed'
  if (tile.type === 'terrain') {
    if (tile.childState === 'locked') return '#374151'
    switch (tile.terrain_type) {
      case 'forest':   return '#166534'
      case 'land':     return '#78716c'
      case 'water':    return '#1e40af'
      case 'mountain': return '#6b7280'
      default:         return '#4b5563'
    }
  }
  // story tile
  switch (tile.childState) {
    case 'unlocked':
    case 'listened':
    case 'completed': return '#1e40af'
    case 'locked':    return '#374151'
    default:          return '#374151'
  }
}

// CSS filter: drop-shadow traces the clipped hex shape, unlike border which is clipped away
function tileFilter(tile: MappedTile): string {
  if (tile.childState === 'completed') return 'drop-shadow(0 0 6px #d97706)'
  if (tile.type === 'mother_tree') return 'drop-shadow(0 0 6px #a78bfa)'
  return 'none'
}

function showName(tile: MappedTile): boolean {
  // Locked terrain tiles show nothing — they look like fog
  return !(tile.type === 'terrain' && tile.childState === 'locked')
}

function isClickable(tile: MappedTile): boolean {
  return tile.type === 'mother_tree' || tile.childState !== 'locked'
}

export default function HexTile({ tile, x, y, onClick }: HexTileProps) {
  return (
    <div
      data-type={tile.type}
      data-state={tile.childState}
      onClick={() => isClickable(tile) && onClick?.(tile)}
      style={{
        position: 'absolute',
        left: x - HEX_WIDTH / 2,
        top: y - HEX_HEIGHT / 2,
        width: HEX_WIDTH,
        height: HEX_HEIGHT,
        clipPath: HEX_CLIP,
        backgroundColor: tileBackground(tile),
        filter: tileFilter(tile),
        cursor: isClickable(tile) ? 'pointer' : 'default',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'filter 0.2s',
      }}
    >
      {showName(tile) && (
        <span
          style={{
            color: 'white',
            fontSize: 9,
            fontWeight: 600,
            textAlign: 'center',
            padding: '0 6px',
            lineHeight: 1.2,
            pointerEvents: 'none',
            textShadow: '0 1px 2px rgba(0,0,0,0.6)',
          }}
        >
          {tile.name}
        </span>
      )}
    </div>
  )
}
