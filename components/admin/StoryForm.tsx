'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Story } from '@/lib/types'
import AudioUpload from './AudioUpload'
import AlexImageSection from './AlexImageSection'

interface StoryFormProps {
  story: Story
  isNew?: boolean
}

export default function StoryForm({ story: initialStory, isNew = false }: StoryFormProps) {
  const router = useRouter()
  const [story, setStory] = useState<Story>(initialStory)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const [uploadingFo, setUploadingFo] = useState(false)
  const [generatingAudio, setGeneratingAudio] = useState(false)

  function set(field: keyof Story, value: string | null) {
    setStory(prev => ({ ...prev, [field]: value }))
  }

  async function handleSave() {
    setSaving(true)
    setError('')
    const url = isNew ? '/api/admin/stories' : `/api/admin/stories/${story.id}`
    const method = isNew ? 'POST' : 'PATCH'
    const body = isNew
      ? { title: story.title }
      : { title: story.title, story_text: story.story_text, alex_dream: story.alex_dream }
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const json = await res.json()
    setSaving(false)
    if (!res.ok) { setError(json.error); return }
    if (isNew) router.push(`/admin/stories/${json.id}`)
    else router.refresh()
  }

  async function handleDelete() {
    if (!confirm(`Delete "${story.title}"? This cannot be undone.`)) return
    setDeleting(true)
    await fetch(`/api/admin/stories/${story.id}`, { method: 'DELETE' })
    router.push('/admin/stories')
  }

  async function handleGenerateAudio() {
    if (!confirm('Generate audio with ElevenLabs? This will overwrite any existing audio_url.')) return
    setGeneratingAudio(true)
    setError('')
    const res = await fetch(`/api/admin/stories/${story.id}/generate-audio`, { method: 'POST' })
    const json = await res.json()
    setGeneratingAudio(false)
    if (!res.ok) { setError(json.error); return }
    set('audio_url', json.url)
  }

  async function handleFoImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingFo(true)
    const fd = new FormData()
    fd.append('image', file)
    const res = await fetch(`/api/admin/stories/${story.id}/upload-fo-image`, { method: 'POST', body: fd })
    const json = await res.json()
    setUploadingFo(false)
    if (!res.ok) { setError(json.error); return }
    set('fo_image_url', json.url)
  }

  return (
    <div className="flex flex-col gap-8 max-w-2xl">
      <div className="flex flex-col gap-2">
        <label className="text-xs text-gray-400 uppercase tracking-wider">Title</label>
        <input
          value={story.title}
          onChange={e => set('title', e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white"
        />
      </div>

      {!isNew && (
        <>
          <div className="flex flex-col gap-2">
            <label className="text-xs text-gray-400 uppercase tracking-wider">Story Text</label>
            <textarea
              value={story.story_text ?? ''}
              onChange={e => set('story_text', e.target.value || null)}
              rows={10}
              className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white resize-y font-mono text-sm"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs text-gray-400 uppercase tracking-wider">Alex&apos;s Dream</label>
            <textarea
              value={story.alex_dream ?? ''}
              onChange={e => set('alex_dream', e.target.value || null)}
              rows={3}
              className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white resize-y"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs text-gray-400 uppercase tracking-wider">Audio</label>
            <AudioUpload
              currentUrl={story.audio_url}
              onUploaded={url => set('audio_url', url)}
            />
            {story.story_text && (
              <button
                onClick={handleGenerateAudio}
                disabled={generatingAudio}
                className="mt-1 px-4 py-2 bg-emerald-700 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50 text-sm w-fit"
              >
                {generatingAudio ? 'Generating…' : '🎙 Generate audio with ElevenLabs'}
              </button>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs text-gray-400 uppercase tracking-wider">FO Mascot Image</label>
            {story.fo_image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={story.fo_image_url} alt="FO mascot" className="w-32 h-32 object-contain rounded-lg mb-2" />
            )}
            <input
              type="file"
              accept="image/*"
              onChange={handleFoImageUpload}
              disabled={uploadingFo}
              className="text-sm text-gray-400"
            />
            {uploadingFo && <p className="text-xs text-gray-500">Uploading…</p>}
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs text-gray-400 uppercase tracking-wider">Alex&apos;s Dream Image</label>
            <AlexImageSection story={story} onUpdated={setStory} />
          </div>
        </>
      )}

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <div className="flex gap-4 items-center">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-500 disabled:opacity-50"
        >
          {saving ? 'Saving…' : isNew ? 'Create story' : 'Save changes'}
        </button>
        {!isNew && (
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="px-4 py-2 text-red-400 hover:text-red-300 text-sm disabled:opacity-50"
          >
            {deleting ? 'Deleting…' : 'Delete story'}
          </button>
        )}
      </div>
    </div>
  )
}
