'use client'
import { useEffect, useRef, useState } from 'react'
import { MappedTile } from '@/lib/types'
import DreamMode from './DreamMode'

interface ListeningModeProps {
  tile: MappedTile
  onComplete: () => void
  onFallback: () => void
  onStop?: () => void
}

type Status = 'ready' | 'playing' | 'dream'

export default function ListeningMode({ tile, onComplete, onFallback, onStop }: ListeningModeProps) {
  const [status, setStatus] = useState<Status>('ready')
  const [isPaused, setIsPaused] = useState(false)
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

    if (tile.story?.audio_url) {
      const audio = new Audio(tile.story.audio_url)
      audioRef.current = audio
      audio.oncanplaythrough = () => setStatus('playing')
      audio.onended = () => setStatus('dream')
      audio.onerror = () => onFallback()
      audio.play().catch(() => onFallback())
    } else if (tile.story?.story_text) {
      const utterance = new SpeechSynthesisUtterance(tile.story.story_text)
      utterance.rate = 0.85
      utterance.pitch = 1.0
      utterance.onend = () => setStatus('dream')
      window.speechSynthesis.speak(utterance)
      setStatus('playing')
    } else {
      onFallback()
    }
  }

  function togglePause() {
    if (audioRef.current) {
      if (isPaused) { audioRef.current.play().catch(() => {}); setIsPaused(false) }
      else { audioRef.current.pause(); setIsPaused(true) }
    } else {
      if (isPaused) { window.speechSynthesis?.resume(); setIsPaused(false) }
      else { window.speechSynthesis?.pause(); setIsPaused(true) }
    }
  }

  function handleStop() {
    audioRef.current?.pause()
    window.speechSynthesis?.cancel()
    exitFullscreen()
    if (onStop) onStop()
    else onFallback()
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
            {tile.name ?? ''}
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
            animation: isPaused ? 'none' : 'pulse 2s ease-in-out infinite',
            opacity: isPaused ? 0.3 : 1,
            flexShrink: 0,
          }} />
          {tile.story?.story_text && (
            <div style={{
              maxHeight: '45vh', overflowY: 'auto', textAlign: 'center',
              scrollbarWidth: 'none',
            }}>
              <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 15, lineHeight: 1.8 }}>
                {tile.story.story_text}
              </p>
            </div>
          )}
          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>
            {isPaused ? 'Paused' : (tile.story?.audio_url ? 'Now playing...' : 'Listening...')}
          </p>
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={togglePause}
              style={{
                padding: '10px 24px', borderRadius: 999,
                backgroundColor: 'rgba(124,58,237,0.6)',
                color: 'white', fontSize: 14, border: 'none', cursor: 'pointer',
              }}
            >
              {isPaused ? '▶ Resume' : '⏸ Pause'}
            </button>
            <button
              onClick={handleStop}
              style={{
                padding: '10px 24px', borderRadius: 999,
                backgroundColor: 'rgba(255,255,255,0.1)',
                color: 'rgba(255,255,255,0.6)', fontSize: 14, border: 'none', cursor: 'pointer',
              }}
            >
              ✕ Stop
            </button>
          </div>
        </div>
      )}

      <style>{`@keyframes pulse { 0%,100%{opacity:.3;transform:scale(1)} 50%{opacity:.8;transform:scale(1.3)} }`}</style>
    </div>
  )
}
