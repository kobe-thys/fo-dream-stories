'use client'
import { useRef, useState } from 'react'

interface AudioUploadProps {
  currentUrl: string | null
  onUploaded: (url: string) => void
}

export default function AudioUpload({ currentUrl, onUploaded }: AudioUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentUrl)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    setUploading(true)
    const formData = new FormData()
    formData.append('audio', file)
    const res = await fetch('/api/admin/upload-audio', { method: 'POST', body: formData })
    const json = await res.json()
    setUploading(false)
    if (!res.ok) { alert(json.error); return }
    setPreviewUrl(json.url)
    onUploaded(json.url)
  }

  return (
    <div className="flex flex-col gap-3">
      {previewUrl && (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <audio controls src={previewUrl} className="w-full" />
      )}
      <div className="flex gap-2 items-center">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="px-4 py-2 bg-gray-700 text-white rounded-lg text-sm hover:bg-gray-600 disabled:opacity-50"
        >
          {uploading ? 'Uploading…' : previewUrl ? 'Replace audio' : 'Upload audio'}
        </button>
        {previewUrl && (
          <a href={previewUrl} target="_blank" rel="noreferrer" className="text-xs text-gray-400 hover:text-gray-200 truncate max-w-xs">
            {previewUrl.split('/').pop()}
          </a>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
      />
    </div>
  )
}
