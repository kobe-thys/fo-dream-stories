import Image from 'next/image'
import { MappedTile } from '@/lib/types'
import { HEX_WIDTH, HEX_HEIGHT } from '@/lib/hex'

interface HexTileProps {
  tile: MappedTile
  x: number
  y: number
  isSelected?: boolean
  isFlipped?: boolean
  onClick?: (tile: MappedTile) => void
}

const HEX_CLIP = 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)'

function tileBackground(tile: MappedTile): string {
  if (tile.childState === 'revealed') return '#374151'
  if (tile.type === 'mother_tree') return '#7c3aed'
  if (tile.type === 'terrain') {
    switch (tile.terrain_type) {
      case 'forest':   return '#166534'
      case 'land':     return '#78716c'
      case 'water':    return '#1e40af'
      case 'mountain': return '#6b7280'
      default:         return '#4b5563'
    }
  }
  return '#1e40af' // story tile: unlocked/listened/completed
}

function tileFilter(tile: MappedTile): string {
  if (tile.childState === 'completed') return 'drop-shadow(0 0 6px #d97706)'
  if (tile.childState === 'listened') return 'drop-shadow(0 0 8px #f59e0b)'
  if (tile.type === 'mother_tree') return 'drop-shadow(0 0 6px #a78bfa)'
  return 'none'
}

function tileLabel(tile: MappedTile): string | null {
  if (tile.childState === 'revealed') return '?'
  if (tile.type === 'terrain') return null
  return tile.name
}

export default function HexTile({ tile, x, y, isSelected = false, isFlipped = false, onClick }: HexTileProps) {
  const label = tileLabel(tile)
  const baseTransform = isSelected ? 'scale(1.15) translateY(-8px)' : 'scale(1)'
  const flipTransform = isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)'

  return (
    <div
      data-type={tile.type}
      data-state={tile.childState}
      style={{
        position: 'absolute',
        left: x - HEX_WIDTH / 2,
        top: y - HEX_HEIGHT / 2,
        width: HEX_WIDTH,
        height: HEX_HEIGHT,
        perspective: 600,
        transform: baseTransform,
        transition: 'transform 0.2s',
        zIndex: isSelected ? 10 : 1,
        cursor: 'pointer',
      }}
      onClick={() => onClick?.(tile)}
    >
      {/* Inner flip container */}
      <div
        style={{
          width: '100%',
          height: '100%',
          position: 'relative',
          transformStyle: 'preserve-3d',
          transition: 'transform 0.4s',
          transform: flipTransform,
        }}
      >
        {/* Front face */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            clipPath: HEX_CLIP,
            backgroundColor: tileBackground(tile),
            filter: tileFilter(tile),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backfaceVisibility: 'hidden',
            opacity: tile.childState === 'revealed' ? 0.7 : 1,
          }}
        >
          {label && (
            <span style={{
              color: 'white',
              fontSize: tile.childState === 'revealed' ? 16 : 9,
              fontWeight: 600,
              textAlign: 'center',
              padding: '0 6px',
              lineHeight: 1.2,
              pointerEvents: 'none',
              textShadow: '0 1px 2px rgba(0,0,0,0.6)',
            }}>
              {label}
            </span>
          )}
          {tile.childState === 'completed' && tile.token_image_url && (
            <Image
              src={tile.token_image_url}
              alt="Dream token"
              fill
              className="object-cover opacity-60"
              style={{ clipPath: HEX_CLIP }}
            />
          )}
        </div>

        {/* Back face — Alex's dream image (only rendered when tile has alex_dream_image_url) */}
        {tile.alex_dream_image_url && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              clipPath: HEX_CLIP,
              backgroundColor: '#1e1b4b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
              overflow: 'hidden',
            }}
          >
            <Image
              src={tile.alex_dream_image_url}
              alt="Alex's dream"
              fill
              className="object-cover opacity-80"
            />
          </div>
        )}
      </div>
    </div>
  )
}
