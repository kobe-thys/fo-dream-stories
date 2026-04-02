'use client'
import { useState, useRef } from 'react'
import { Story } from '@/lib/types'

interface Props {
  story: Story
  onUpdated: (story: Story) => void
}

export default function AlexImageSection({ story, onUpdated }: Props) {
  const [generating, setGenerating] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleRegenerate() {
    if (!story.alex_dream) { setError("Add Alex's Dream text first — it's used as the image prompt."); return }
    setGenerating(true)
    setError('')
    const res = await fetch('/api/admin/regenerate-alex-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storyId: story.id, alexDream: story.alex_dream }),
    })
    const json = await res.json()
    setGenerating(false)
    if (!res.ok) { setError(json.error); return }
    onUpdated({ ...story, alex_dream_image_url: json.imageUrl })
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingImage(true)
    const fd = new FormData()
    fd.append('image', file)
    const res = await fetch(`/api/admin/stories/${story.id}/upload-alex-dream-image`, {
      method: 'POST',
      body: fd,
    })
    const json = await res.json()
    setUploadingImage(false)
    if (!res.ok) { setError(json.error); return }
    onUpdated({ ...story, alex_dream_image_url: json.url })
  }

  return (
    <div className="flex flex-col gap-4">
      {story.alex_dream_image_url ? (
        <div className="flex gap-6 items-start">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={story.alex_dream_image_url}
            alt="Alex's dream"
            className="w-48 h-48 rounded-xl object-cover"
          />
          <div className="flex flex-col gap-3">
            <p className="text-sm text-gray-400">Current Alex dream image</p>
            <button
              onClick={handleRegenerate}
              disabled={generating}
              className="px-4 py-2 bg-amber-600/30 text-amber-400 rounded-lg text-sm hover:bg-amber-600/50 disabled:opacity-50 w-fit"
            >
              {generating ? 'Generating…' : 'Regenerate image'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingImage}
              className="px-4 py-2 bg-gray-700 text-gray-300 rounded-lg text-sm hover:bg-gray-600 disabled:opacity-50 w-fit"
            >
              {uploadingImage ? 'Uploading…' : 'Upload image'}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-gray-500">No Alex&apos;s Dream image yet. Add Alex&apos;s Dream text above and generate one.</p>
          <button
            onClick={handleRegenerate}
            disabled={generating || !story.alex_dream}
            className="px-4 py-2 bg-amber-600/30 text-amber-400 rounded-lg text-sm hover:bg-amber-600/50 disabled:opacity-50 w-fit"
          >
            {generating ? 'Generating…' : 'Generate Alex dream image'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingImage}
            className="px-4 py-2 bg-gray-700 text-gray-300 rounded-lg text-sm hover:bg-gray-600 disabled:opacity-50 w-fit"
          >
            {uploadingImage ? 'Uploading…' : 'Upload image'}
          </button>
        </div>
      )}
      {error && <p className="text-red-400 text-sm">{error}</p>}
    </div>
  )
}
