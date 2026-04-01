'use client'
import { useState } from 'react'
import { MappedTile } from '@/lib/types'
import DreamersGalleryModal from '@/components/dream/DreamersGalleryModal'

interface TilePopupProps {
  tile: MappedTile
  onClose: () => void
  onListeningMode: () => void
  onReadingMode: () => void
  onSubmitDream: () => void
  onReadAgain: () => void
  onSeeOtherDreamers?: () => void
}

function getFOMessage(tile: MappedTile): string {
  if (tile.type === 'terrain') {
    return "I love this landscape! No story here though — keep searching for the next adventure!"
  }
  if (tile.childState === 'grey') {
    return "I know this story well. I helped write it. Ready to begin your adventure?"
  }
  if (tile.childState === 'revealed') {
    return "You've heard the story! What did you find in there? Tell us your dream!"
  }
  // completed
  return "Your dream is captured on the map! You can listen again or share your adventure."
}

const foImg = (foImageUrl: string | null | undefined) =>
  foImageUrl ?? '/fo-reading.png'

export default function TilePopup({
  tile, onClose, onListeningMode, onReadingMode, onSubmitDream, onReadAgain, onSeeOtherDreamers,
}: TilePopupProps) {
  const [showGallery, setShowGallery] = useState(false)
  const isTerrain = tile.type === 'terrain'
  const foMessage = getFOMessage(tile)
  const foSrc = isTerrain ? '/fo-reading.png' : foImg(tile.story?.fo_image_url)

  return (
    <>
      {/* Backdrop — pointer-events-none so canvas tile clicks still register */}
      <div data-testid="popup-backdrop" onClick={onClose} className="fixed inset-0 z-30" style={{ pointerEvents: 'none' }} />

      {/* Right panel */}
      <div className="fixed right-4 top-20 z-40 w-72 bg-white rounded-2xl shadow-2xl overflow-hidden">

        {/* FO + speech bubble */}
        <div className="bg-indigo-50 flex flex-col items-center pt-4 pb-3 px-4 gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={foSrc} alt="FO" width={80} height={80} className="object-contain drop-shadow" />
          {/* Speech bubble */}
          <div className="relative bg-white rounded-xl px-3 py-2 shadow-sm text-slate-700 text-xs leading-snug text-center">
            {foMessage}
            {/* Tail pointing up toward FO */}
            <span
              aria-hidden="true"
              className="absolute -top-2 left-1/2 -translate-x-1/2 w-0 h-0"
              style={{
                borderLeft: '7px solid transparent',
                borderRight: '7px solid transparent',
                borderBottom: '8px solid white',
              }}
            />
          </div>
        </div>

        {/* Tile name */}
        <div className="px-4 pt-3 pb-1">
          <h2 className="font-bold text-slate-800 text-sm">{tile.name ?? tile.story?.title ?? (isTerrain ? 'Terrain' : 'Story')}</h2>
          {isTerrain && tile.sensory_moment_text && (
            <p className="text-slate-500 text-xs mt-1 leading-snug">{tile.sensory_moment_text}</p>
          )}
        </div>

        {/* Action buttons */}
        <div className="px-4 pb-4 pt-2 flex flex-col gap-2">

          {/* Story grey → listen + read */}
          {!isTerrain && tile.childState === 'grey' && (
            <>
              <button
                onClick={onListeningMode}
                className="w-full py-2.5 rounded-xl bg-violet-600 text-white font-semibold text-sm hover:bg-violet-700 transition-colors"
              >
                🎧 Listen
              </button>
              <button
                onClick={onReadingMode}
                className="w-full py-2.5 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 transition-colors"
              >
                📖 Read
              </button>
            </>
          )}

          {/* Story revealed → listen again + read again + submit */}
          {!isTerrain && tile.childState === 'revealed' && (
            <>
              <button
                onClick={onListeningMode}
                className="w-full py-2.5 rounded-xl bg-violet-600 text-white font-semibold text-sm hover:bg-violet-700 transition-colors"
              >
                🎧 Listen again
              </button>
              <button
                onClick={onReadingMode}
                className="w-full py-2.5 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 transition-colors"
              >
                📖 Read again
              </button>
              <button
                onClick={onSubmitDream}
                className="w-full py-2.5 rounded-xl bg-amber-500 text-white font-semibold text-sm hover:bg-amber-600 transition-colors"
              >
                ✨ Submit my dream
              </button>
            </>
          )}

          {/* Story completed → token + actions */}
          {!isTerrain && tile.childState === 'completed' && (
            <>
              {tile.token_image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={tile.token_image_url}
                  alt="Your dream"
                  className="w-full rounded-xl mb-1 object-cover aspect-square"
                />
              )}
              <button
                onClick={onReadAgain}
                className="w-full py-2.5 rounded-xl bg-violet-600 text-white font-semibold text-sm hover:bg-violet-700 transition-colors"
              >
                🎧 Listen / read again
              </button>
              <button
                onClick={onSubmitDream}
                className="w-full py-2.5 rounded-xl bg-amber-500 text-white font-semibold text-sm hover:bg-amber-600 transition-colors"
              >
                🌙 Submit new dream
              </button>
              <button
                onClick={() => { setShowGallery(true); onSeeOtherDreamers?.() }}
                className="w-full py-2.5 rounded-xl bg-slate-100 text-slate-700 font-semibold text-sm hover:bg-slate-200 transition-colors"
              >
                👀 See other dreamers&apos; dreams
              </button>
            </>
          )}
        </div>

        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-slate-400 hover:text-slate-600 text-xl leading-none z-10"
          aria-label="Close"
        >
          ×
        </button>
      </div>

      {showGallery && (
        <DreamersGalleryModal
          tileId={tile.id}
          tileName={tile.name ?? tile.story?.title ?? 'Story'}
          onClose={() => setShowGallery(false)}
        />
      )}
    </>
  )
}
