'use client'
import { useEffect, useState } from 'react'
import ModerationCard from '@/components/admin/ModerationCard'

interface Submission {
  id: string
  transcribed_text: string | null
  token_image_url: string | null
  input_type: string
  created_at: string
  child_profiles: { name: string; date_of_birth: string } | null
  tiles: { name: string } | null
}

export default function ModerationPage() {
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/moderation').then(r => r.json()).then(data => {
      setSubmissions(data)
      setLoading(false)
    })
  }, [])

  if (loading) return <p className="text-gray-500">Loading shared dreams...</p>

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Moderation</h1>
        <p className="text-sm text-gray-400 mt-1">{submissions.length} shared dream{submissions.length !== 1 ? 's' : ''}</p>
      </div>
      {submissions.length === 0
        ? <p className="text-gray-600">No shared dreams yet.</p>
        : submissions.map(s => (
          <ModerationCard
            key={s.id}
            submission={s}
            onRemoved={id => setSubmissions(prev => prev.filter(s => s.id !== id))}
          />
        ))}
    </div>
  )
}
