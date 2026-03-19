'use client'
import { useState } from 'react'
import { MappedTile } from '@/lib/types'
import WriteItTab from './WriteItTab'
import SayItTab from './SayItTab'
import DrawItTab from './DrawItTab'
import ImageAcceptance from './ImageAcceptance'

interface DreamSubmissionDrawerProps {
  tile: MappedTile
  childProfileId: string
  onClose: () => void
  onComplete: (result: { tokenImageUrl: string }) => void
}

type Tab = 'write' | 'say' | 'draw'

export default function DreamSubmissionDrawer({ tile, childProfileId, onClose, onComplete }: DreamSubmissionDrawerProps) {
  const [activeTab, setActiveTab] = useState<Tab>('write')
  const [dreamText, setDreamText] = useState<string | null>(null)
  const [rawInputUrl, setRawInputUrl] = useState<string | null>(null)
  const [inputType, setInputType] = useState<'text' | 'voice' | 'drawing'>('text')

  function handleText(text: string, type: 'text' | 'voice' | 'drawing', rawUrl: string | null = null) {
    setInputType(type)
    setDreamText(text)
    setRawInputUrl(rawUrl)
  }

  if (dreamText) {
    return (
      <>
        <div onClick={onClose} className="fixed inset-0 bg-black/40 z-40" />
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-background rounded-t-2xl p-6 max-h-[90vh] overflow-y-auto">
          <ImageAcceptance
            text={dreamText}
            inputType={inputType}
            rawInputUrl={rawInputUrl}
            tile={tile}
            childProfileId={childProfileId}
            onComplete={onComplete}
            onError={() => setDreamText(null)}
          />
        </div>
      </>
    )
  }

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 bg-black/40 z-40" />
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-background rounded-t-2xl p-6 max-h-[85vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-foreground font-bold text-lg">How did your adventure end?</h2>
          <button onClick={onClose} className="text-muted-foreground text-xl leading-none">×</button>
        </div>
        {/* Tabs */}
        <div className="flex gap-1 bg-muted rounded-xl p-1 mb-5">
          {([['write', 'Write it'], ['say', 'Say it'], ['draw', 'Draw it']] as [Tab, string][]).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === id ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'}`}
            >
              {label}
            </button>
          ))}
        </div>
        {activeTab === 'write' && <WriteItTab onSubmit={text => handleText(text, 'text')} />}
        {activeTab === 'say' && <SayItTab childProfileId={childProfileId} tileId={tile.id} onSubmit={(text, rawUrl) => handleText(text, 'voice', rawUrl)} />}
        {activeTab === 'draw' && <DrawItTab childProfileId={childProfileId} tileId={tile.id} onSubmit={(text, rawUrl) => handleText(text, 'drawing', rawUrl)} />}
      </div>
    </>
  )
}
