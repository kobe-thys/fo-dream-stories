import { MappedTile } from '@/lib/types'


interface FOMascotProps {
  message?: string
  selectedTile?: MappedTile | null
}

function getContextualMessage(tile: MappedTile | null | undefined, fallback?: string): string {
  if (!tile) return fallback ?? 'Welcome! Tap the Mother Tree to begin your first adventure.'
  if (tile.type === 'terrain') return 'Beautiful landscape! Tap to explore it.'
  if (tile.childState === 'grey') {
    return 'A new story awaits! Choose listening mode to close your eyes while I read. 🎧'
  }
  if (tile.childState === 'revealed') return 'You\'ve heard the story! Now share your dream — what did you imagine? 🌙'
  if (tile.childState === 'completed') return 'Wonderful! Your dream has been captured. ⭐'
  return fallback ?? 'Tap a tile to begin an adventure!'
}

export default function FOMascot({ message, selectedTile }: FOMascotProps) {
  const text = getContextualMessage(selectedTile, message)
  const hasPopup = !!selectedTile

  return (
    <div
      className="fixed z-20 pointer-events-none flex items-end gap-3"
      style={hasPopup
        ? { bottom: 20, left: '50%', transform: 'translateX(-50%)', flexDirection: 'row-reverse' }
        : { bottom: 12, right: 12, flexDirection: 'row-reverse' }
      }
    >
      {/* Speech bubble */}
      <div className="relative bg-white text-slate-800 rounded-2xl px-4 py-3 shadow-lg leading-snug"
        style={{ maxWidth: hasPopup ? 260 : 200, fontSize: hasPopup ? 13 : 12 }}
      >
        {text}
        {/* Tail pointing toward FO (right side) */}
        <span
          aria-hidden="true"
          className="absolute bottom-4 right-0 translate-x-full w-0 h-0"
          style={{
            borderTop: '7px solid transparent',
            borderBottom: '7px solid transparent',
            borderLeft: '8px solid white',
          }}
        />
      </div>

      {/* FO image — story-specific when fo_image_url is set, fallback to default */}
      {selectedTile?.story?.fo_image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={selectedTile.story.fo_image_url}
          alt="Friendly Onion"
          width={hasPopup ? 120 : 160}
          height={hasPopup ? 120 : 160}
          className="object-contain drop-shadow-lg flex-shrink-0"
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src="/fo-reading.png"
          alt="Friendly Onion"
          width={hasPopup ? 120 : 160}
          height={hasPopup ? 120 : 160}
          className="object-contain drop-shadow-lg flex-shrink-0"
        />
      )}
    </div>
  )
}
