'use client'
import { MappedTile } from '@/lib/types'

interface TilePopupProps {
  tile: MappedTile
  onClose: () => void
  onListeningMode: () => void
  onReadingMode: () => void
  onSubmitDream: () => void
  onReadAgain: () => void
}

export default function TilePopup({
  tile, onClose, onListeningMode, onReadingMode, onSubmitDream, onReadAgain
}: TilePopupProps) {
  return (
    <>
      {/* Backdrop */}
      <div
        data-testid="popup-backdrop"
        onClick={onClose}
        className="fixed inset-0 z-30"
      />
      {/* Popup */}
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-40 w-72 bg-white rounded-2xl shadow-2xl p-5">
        <h2 className="text-slate-800 font-bold text-lg mb-1">{tile.name}</h2>

        {tile.type === 'mother_tree' && (
          <p className="text-violet-600 text-sm leading-snug">
            The heart of the dream world. Stories branch out from here — tap a neighbouring tile to begin.
          </p>
        )}

        {/* Note: revealed tiles are handled by map page (tap → unlock). They never open this popup. */}

        {tile.type !== 'mother_tree' && tile.childState === 'unlocked' && (
          <>
            <p className="text-slate-500 text-sm mb-4">A story awaits...</p>
            <div className="flex flex-col gap-2">
              <button
                onClick={onListeningMode}
                className="w-full py-3 rounded-xl bg-violet-600 text-white font-semibold text-sm hover:bg-violet-700 transition-colors"
              >
                🎧 Listening mode
              </button>
              <button
                onClick={onReadingMode}
                className="w-full py-3 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 transition-colors"
              >
                📖 Reading mode
              </button>
            </div>
            {tile.alex_dream_image_url && (
              <p className="text-slate-400 text-xs mt-3 text-center">
                Tap the tile to peek at Alex&apos;s dream
              </p>
            )}
          </>
        )}

        {tile.type !== 'mother_tree' && tile.childState === 'listened' && (
          <>
            <p className="text-amber-600 text-sm mb-4 animate-pulse">How did your adventure end?</p>
            <button
              onClick={onSubmitDream}
              className="w-full py-3 rounded-xl bg-amber-500 text-white font-semibold text-sm hover:bg-amber-600 transition-colors"
            >
              Tell us your dream
            </button>
          </>
        )}

        {tile.type !== 'mother_tree' && tile.childState === 'completed' && (
          <>
            {tile.token_image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={tile.token_image_url}
                alt="Your dream"
                className="w-full rounded-xl mb-3 object-cover aspect-square"
              />
            )}
            {tile.alex_tip && (
              <div className="bg-amber-50 rounded-xl p-3 mb-3">
                <p className="text-amber-800 text-xs font-semibold mb-1">Alex&apos;s Dream</p>
                <p className="text-amber-900 text-sm leading-snug">{tile.alex_tip}</p>
              </div>
            )}
            <button
              onClick={onReadAgain}
              className="w-full py-3 rounded-xl bg-slate-100 text-slate-700 font-semibold text-sm hover:bg-slate-200 transition-colors"
            >
              Read it again
            </button>
          </>
        )}

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-slate-400 hover:text-slate-600 text-lg leading-none"
          aria-label="Close"
        >
          ×
        </button>
      </div>
    </>
  )
}
