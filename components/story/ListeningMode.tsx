'use client'
import { useEffect, useRef, useState } from 'react'
import { MappedTile } from '@/lib/types'
import DreamMode from './DreamMode'

interface ListeningModeProps {
  tile: MappedTile
  onComplete: () => void
  onFallback: () => void
}

type Status = 'loading' | 'playing' | 'dream'

export default function ListeningMode({ tile, onComplete, onFallback }: ListeningModeProps) {
  const [status, setStatus] = useState<Status>('loading')
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    if (tile.audio_url) {
      const audio = new Audio(tile.audio_url)
      audioRef.current = audio
      audio.oncanplaythrough = () => setStatus('playing')
      audio.onended = () => setStatus('dream')
      audio.onerror = () => onFallback()
      audio.play().catch(() => onFallback())
    } else if (tile.story_text) {
      // TTS fallback via browser speechSynthesis
      const delay = setTimeout(() => {
        const utterance = new SpeechSynthesisUtterance(tile.story_text!)
        utterance.onend = () => setStatus('dream')
        window.speechSynthesis.speak(utterance)
        setStatus('playing')
      }, 300)
      return () => clearTimeout(delay)
    } else {
      onFallback()
    }

    return () => {
      audioRef.current?.pause()
      window.speechSynthesis?.cancel()
    }
  }, [tile, onFallback])

  if (status === 'dream') {
    return <DreamMode onComplete={onComplete} minimumSeconds={120} />
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, backgroundColor: '#000',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      zIndex: 50,
    }}>
      {status === 'loading' && (
        <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 16 }}>Preparing your story...</p>
      )}
      {status === 'playing' && (
        <>
          <div style={{
            width: 60, height: 60, borderRadius: '50%',
            backgroundColor: 'rgba(255,255,255,0.15)',
            animation: 'pulse 2s ease-in-out infinite',
          }} />
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, marginTop: 16 }}>
            {tile.audio_url ? 'Now playing...' : 'Listening...'}
          </p>
        </>
      )}
      <style>{`@keyframes pulse { 0%,100%{opacity:.3;transform:scale(1)} 50%{opacity:.8;transform:scale(1.3)} }`}</style>
    </div>
  )
}
