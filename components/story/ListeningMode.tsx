'use client'
import { useEffect, useRef, useState } from 'react'
import { MappedTile } from '@/lib/types'
import DreamMode from './DreamMode'

interface ListeningModeProps {
  tile: MappedTile
  onComplete: () => void
  onFallback: () => void
}

type Status = 'ready' | 'playing' | 'dream'

export default function ListeningMode({ tile, onComplete, onFallback }: ListeningModeProps) {
  const [status, setStatus] = useState<Status>('ready')
  const audioRef = useRef<HTMLAudioElement | null>(null)

  function requestFullscreen() {
    try {
      const el = document.documentElement
      if (el.requestFullscreen) el.requestFullscreen().catch(() => {})
    } catch {}
  }

  function exitFullscreen() {
    try {
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    } catch {}
  }

  function startListening() {
    requestFullscreen()

    if (tile.audio_url) {
      const audio = new Audio(tile.audio_url)
      audioRef.current = audio
      audio.oncanplaythrough = () => setStatus('playing')
      audio.onended = () => setStatus('dream')
      audio.onerror = () => onFallback()
      audio.play().catch(() => onFallback())
    } else if (tile.story_text) {
      const utterance = new SpeechSynthesisUtterance(tile.story_text)
      utterance.rate = 0.85
      utterance.pitch = 1.0
      utterance.onend = () => setStatus('dream')
      window.speechSynthesis.speak(utterance)
      setStatus('playing')
    } else {
      onFallback()
    }
  }

  useEffect(() => {
    return () => {
      audioRef.current?.pause()
      window.speechSynthesis?.cancel()
      exitFullscreen()
    }
  }, [])

  if (status === 'dream') {
    exitFullscreen()
    return <DreamMode onComplete={onComplete} minimumSeconds={120} />
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, backgroundColor: '#000',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      zIndex: 50, padding: '2rem',
    }}>
      {status === 'ready' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, maxWidth: 360, textAlign: 'center' }}>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            {tile.name}
          </p>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 16, lineHeight: 1.6 }}>
            Lie down in your favourite sleeping position and get comfortable...
          </p>
          <button
            onClick={startListening}
            style={{
              marginTop: 8,
              padding: '14px 36px',
              borderRadius: 999,
              backgroundColor: '#7c3aed',
              color: 'white',
              fontSize: 16,
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Begin the story ✨
          </button>
        </div>
      )}

      {status === 'playing' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, maxWidth: 480, width: '100%' }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            backgroundColor: 'rgba(124,58,237,0.3)',
            animation: 'pulse 2s ease-in-out infinite',
            flexShrink: 0,
          }} />
          {tile.story_text && (
            <div style={{
              maxHeight: '55vh', overflowY: 'auto', textAlign: 'center',
              scrollbarWidth: 'none',
            }}>
              <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 15, lineHeight: 1.8 }}>
                {tile.story_text}
              </p>
            </div>
          )}
          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>
            {tile.audio_url ? 'Now playing...' : 'Listening...'}
          </p>
        </div>
      )}

      <style>{`@keyframes pulse { 0%,100%{opacity:.3;transform:scale(1)} 50%{opacity:.8;transform:scale(1.3)} }`}</style>
    </div>
  )
}
