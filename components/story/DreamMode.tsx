'use client'
import { useEffect, useRef, useState } from 'react'

interface DreamModeProps {
  onComplete: () => void
  minimumSeconds?: number
}

export default function DreamMode({ onComplete, minimumSeconds = 120 }: DreamModeProps) {
  const [timerDone, setTimerDone] = useState(false)
  const [showMessage, setShowMessage] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    timerRef.current = setTimeout(() => setTimerDone(true), minimumSeconds * 1000)
    return () => clearTimeout(timerRef.current)
  }, [minimumSeconds])

  function handleTap() {
    if (!timerDone) return
    if (!showMessage) { setShowMessage(true); return }
    onComplete()
  }

  return (
    <div
      data-testid="dream-mode"
      onClick={handleTap}
      style={{
        position: 'fixed', inset: 0, backgroundColor: '#000',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 50, cursor: timerDone ? 'pointer' : 'default',
      }}
    >
      {!showMessage && (
        <div style={{
          width: 60, height: 60, borderRadius: '50%',
          backgroundColor: 'rgba(255,255,255,0.15)',
          animation: 'pulse 2s ease-in-out infinite',
        }} />
      )}
      {showMessage && (
        <p style={{
          color: 'rgba(255,255,255,0.85)', fontSize: 18, textAlign: 'center',
          padding: '0 32px', lineHeight: 1.6, fontStyle: 'italic',
        }}>
          Sweet dreams.<br />Come back and tell us what you found.
        </p>
      )}
      <style>{`@keyframes pulse { 0%,100%{opacity:.3;transform:scale(1)} 50%{opacity:.8;transform:scale(1.3)} }`}</style>
    </div>
  )
}
