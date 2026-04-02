'use client'
import { getAge } from '@/lib/types'
import { useState } from 'react'

interface Submission {
  id: string
  transcribed_text: string | null
  token_image_url: string | null
  input_type: string
  created_at: string
  child_profiles: { name: string; date_of_birth: string } | null
  tiles: { name: string } | null
}

interface Props {
  submission: Submission
  onRemoved: (id: string) => void
}

export default function ModerationCard({ submission, onRemoved }: Props) {
  const [expanded, setExpanded] = useState(false)
  const age = submission.child_profiles?.date_of_birth
    ? getAge(submission.child_profiles.date_of_birth)
    : '?'

  async function handleRemove() {
    if (!confirm('Remove this dream from public view?')) return
    await fetch('/api/admin/moderation', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: submission.id }),
    })
    onRemoved(submission.id)
  }

  return (
    <>
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex gap-4">
        {submission.token_image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={submission.token_image_url}
            alt="Dream"
            onClick={() => setExpanded(true)}
            className="w-20 h-20 rounded-lg object-cover shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
          />
        )}
        <div className="flex flex-col gap-1 flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white">
              {submission.child_profiles?.name ?? 'Unknown'}, age {age}
            </span>
            <span className="text-xs text-gray-500">·</span>
            <span className="text-xs text-gray-400">{submission.tiles?.name}</span>
            <span className="text-xs text-gray-500">·</span>
            <span className="text-xs text-gray-500">{submission.input_type}</span>
          </div>
          <p className="text-sm text-gray-300 line-clamp-3">{submission.transcribed_text}</p>
          <p className="text-xs text-gray-600">{new Date(submission.created_at).toLocaleDateString()}</p>
        </div>
        <button
          onClick={handleRemove}
          className="shrink-0 px-3 py-1 bg-red-900/40 text-red-400 rounded-lg text-xs hover:bg-red-900/70 self-start"
        >
          Remove
        </button>
      </div>

      {expanded && submission.token_image_url && (
        <div
          onClick={() => setExpanded(false)}
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center cursor-pointer"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={submission.token_image_url}
            alt="Dream (expanded)"
            style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: 12 }}
            onClick={e => e.stopPropagation()}
          />
          <button
            onClick={() => setExpanded(false)}
            className="absolute top-4 right-4 text-white/60 hover:text-white text-2xl"
          >
            ✕
          </button>
        </div>
      )}
    </>
  )
}
