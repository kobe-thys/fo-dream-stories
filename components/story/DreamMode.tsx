'use client'

interface DreamModeProps {
  onComplete: () => void
  minimumSeconds?: number
}

export default function DreamMode({ onComplete }: DreamModeProps) {
  return (
    <div
      data-testid="dream-mode"
      onClick={onComplete}
      style={{
        position: 'fixed', inset: 0, backgroundColor: '#000',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 32, zIndex: 50, cursor: 'pointer', padding: '0 32px',
      }}
    >
      <div style={{
        width: 60, height: 60, borderRadius: '50%',
        backgroundColor: 'rgba(255,255,255,0.15)',
        animation: 'pulse 2s ease-in-out infinite',
      }} />
      <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 15, textAlign: 'center', lineHeight: 1.7, fontStyle: 'italic' }}>
        Keep your eyes closed...<br />let your imagination run wild.
      </p>
      <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 13 }}>Tap when you&apos;re ready ✨</p>
      <style>{`@keyframes pulse { 0%,100%{opacity:.3;transform:scale(1)} 50%{opacity:.8;transform:scale(1.3)} }`}</style>
    </div>
  )
}
