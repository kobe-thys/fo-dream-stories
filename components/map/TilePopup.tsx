'use client'
import { useState } from 'react'
import { MappedTile } from '@/lib/types'

interface TilePopupProps {
  tile: MappedTile
  onClose: () => void
  onListeningMode: () => void
  onReadingMode: () => void
  onSubmitDream: () => void
  onReadAgain: () => void
}

const HEX_CLIP = 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)'

function AlexDreamModal({ tile, onClose }: { tile: MappedTile; onClose: () => void }) {
  const [flipped, setFlipped] = useState(false)
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.92)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        zIndex: 60, gap: 24,
      }}
    >
      {/* Large flippable hex */}
      <div
        onClick={e => { e.stopPropagation(); setFlipped(f => !f) }}
        style={{ perspective: 800, cursor: 'pointer' }}
      >
        <div style={{
          width: 190, height: 220,
          position: 'relative',
          transformStyle: 'preserve-3d',
          transition: 'transform 0.7s ease',
          transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
        }}>
          {/* Front — story tile */}
          <div style={{
            position: 'absolute', inset: 0,
            clipPath: HEX_CLIP,
            backgroundColor: tile.type === 'mother_tree' ? '#7c3aed' : '#1e40af',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backfaceVisibility: 'hidden',
          }}>
            <span style={{ color: 'white', fontSize: 13, fontWeight: 700, textAlign: 'center', padding: '0 12px' }}>
              {tile.name}
            </span>
          </div>
          {/* Back — Alex's dream image */}
          <div style={{
            position: 'absolute', inset: 0,
            clipPath: HEX_CLIP,
            backgroundColor: '#1e1b4b',
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
            overflow: 'hidden',
          }}>
            {tile.alex_dream_image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={tile.alex_dream_image_url}
                alt="Alex's dream"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            )}
          </div>
        </div>
      </div>

      {!flipped ? (
        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>Tap the tile to reveal Alex&apos;s dream ✨</p>
      ) : (
        <div style={{ textAlign: 'center', maxWidth: 280, padding: '0 16px' }}>
          <p style={{ color: '#fbbf24', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Alex&apos;s Dream</p>
          <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14, lineHeight: 1.6 }}>{tile.alex_tip}</p>
        </div>
      )}

      <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>Tap anywhere to close</p>
    </div>
  )
}

export default function TilePopup({
  tile, onClose, onListeningMode, onReadingMode, onSubmitDream, onReadAgain
}: TilePopupProps) {
  const [showAlexDream, setShowAlexDream] = useState(false)

  return (
    <>
      {/* Backdrop */}
      <div data-testid="popup-backdrop" onClick={onClose} className="fixed inset-0 z-30" />

      {/* Popup */}
      <div className="fixed left-1/2 top-[38%] -translate-x-1/2 -translate-y-1/2 z-40 w-80 bg-white rounded-2xl shadow-2xl p-5">
        <h2 className="text-slate-800 font-bold text-lg mb-1">{tile.name}</h2>

        {/* Unlocked — show story mode buttons */}
        {tile.childState === 'unlocked' && (
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
          </>
        )}

        {/* Alex's dream — shown in any state when available */}
        {tile.alex_dream_image_url && tile.childState !== 'completed' && (
          <button
            onClick={() => setShowAlexDream(true)}
            className="w-full mt-3 py-2 rounded-xl border border-amber-300 text-amber-600 font-semibold text-sm hover:bg-amber-50 transition-colors"
          >
            ✨ See Alex&apos;s dream
          </button>
        )}

        {/* Listened — prompt dream submission */}
        {tile.childState === 'listened' && (
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

        {/* Completed — show token, alex tip, read again, alex dream reveal */}
        {tile.childState === 'completed' && (
          <>
            {tile.token_image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={tile.token_image_url}
                alt="Your dream"
                className="w-full rounded-xl mb-3 object-cover aspect-square"
              />
            )}
            {tile.alex_dream_image_url && (
              <button
                onClick={() => setShowAlexDream(true)}
                className="w-full py-3 rounded-xl bg-amber-500 text-white font-semibold text-sm hover:bg-amber-600 transition-colors mb-2"
              >
                ✨ See Alex&apos;s dream
              </button>
            )}
            {tile.alex_tip && !tile.alex_dream_image_url && (
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

      {showAlexDream && (
        <AlexDreamModal tile={tile} onClose={() => setShowAlexDream(false)} />
      )}
    </>
  )
}
