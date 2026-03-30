'use client'
import { useState } from 'react'
import { MappedTile } from '@/lib/types'
import DreamMode from './DreamMode'

interface ReadingModeProps {
  tile: MappedTile
  onComplete: () => void
}

export default function ReadingMode({ tile, onComplete }: ReadingModeProps) {
  const [dreamModeActive, setDreamModeActive] = useState(false)

  if (dreamModeActive) {
    return <DreamMode onComplete={onComplete} minimumSeconds={120} />
  }

  return (
    <main className="min-h-screen bg-background flex flex-col px-6 pt-12 pb-24 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold text-foreground mb-6">{tile.name ?? ''}</h1>
      <div className="flex-1 overflow-y-auto">
        <p className="text-foreground text-lg leading-relaxed">
          {tile.story?.story_text ?? 'Story coming soon — check back after the admin has added content.'}
        </p>
      </div>
      <button
        onClick={() => setDreamModeActive(true)}
        className="fixed bottom-8 left-1/2 -translate-x-1/2 px-8 py-4 rounded-2xl bg-violet-600 text-white font-semibold text-base shadow-lg hover:bg-violet-700 transition-colors"
      >
        Start dreaming ✨
      </button>
    </main>
  )
}
