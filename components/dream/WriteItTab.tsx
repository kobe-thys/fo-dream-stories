'use client'
import { useState } from 'react'

interface WriteItTabProps {
  onSubmit: (text: string) => void
}

export default function WriteItTab({ onSubmit }: WriteItTabProps) {
  const [text, setText] = useState('')
  const trimmed = text.trim()

  return (
    <div className="flex flex-col gap-4">
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="Describe your dream..."
        rows={4}
        className="w-full rounded-xl border border-border bg-input text-foreground px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
      />
      <button
        disabled={trimmed.length === 0}
        onClick={() => onSubmit(trimmed)}
        className="w-full py-3 rounded-xl bg-violet-600 text-white font-semibold text-sm hover:bg-violet-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Use this dream
      </button>
    </div>
  )
}
