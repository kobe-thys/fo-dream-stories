'use client'
import { useState } from 'react'

interface DreamModeProps {
  onComplete: () => void
  minimumSeconds?: number
}

export default function DreamMode({ onComplete }: DreamModeProps) {
  const [showMessage, setShowMessage] = useState(false)

  function handleTap() {
    if (!showMessage) { setShowMessage(true); return }
    onComplete()
  }

  return (
    <div
      data-testid="dream-mode"
      onClick={handleTap}
      style={{
        position: 'fixed', inset: 0, backgroundColor: '#000',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 32, zIndex: 50, cursor: 'pointer', padding: '0 32px',
      }}
    >
      {!showMessage && (
        <>
          <div style={{
            width: 60, height: 60, borderRadius: '50%',
            backgroundColor: 'rgba(255,255,255,0.15)',
            animation: 'pulse 2s ease-in-out infinite',
          }} />
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 15, textAlign: 'center', lineHeight: 1.7, fontStyle: 'italic' }}>
            Keep your eyes closed...<br />let your imagination run wild.
          </p>
          <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 13 }}>Tap when you&apos;re ready ✨</p>
        </>
      )}
      {showMessage && (
        <p style={{
          color: 'rgba(255,255,255,0.85)', fontSize: 18, textAlign: 'center',
          lineHeight: 1.6, fontStyle: 'italic',
        }}>
          Sweet dreams.<br />Come back and tell us what you found.
        </p>
      )}
      <style>{`@keyframes pulse { 0%,100%{opacity:.3;transform:scale(1)} 50%{opacity:.8;transform:scale(1.3)} }`}</style>
    </div>
  )
}
