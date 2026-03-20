'use client'
import { useRef, useState, useEffect } from 'react'
import { uploadToStorage, storagePath } from '@/lib/storage'

interface SayItTabProps {
  childProfileId: string
  tileId: string
  onSubmit: (text: string, rawUrl: string | null) => void
}

type RecordState = 'idle' | 'recording' | 'processing' | 'confirming' | 'error'
const MAX_RECORDING_MS = 3 * 60 * 1000 // 3 minutes

export default function SayItTab({ childProfileId, tileId, onSubmit }: SayItTabProps) {
  const [recordState, setRecordState] = useState<RecordState>('idle')
  const [transcription, setTranscription] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [seconds, setSeconds] = useState(0)
  const mediaRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined)
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const rawUrlRef = useRef<string | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    return () => {
      mediaRef.current?.stop()
      clearInterval(timerRef.current)
      clearTimeout(autoStopRef.current)
      streamRef.current?.getTracks().forEach(t => t.stop())
    }
  }, [])

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
      const recorder = new MediaRecorder(stream, { mimeType })
      mediaRef.current = recorder
      chunksRef.current = []

      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      recorder.onstop = async () => {
        clearInterval(timerRef.current)
        clearTimeout(autoStopRef.current)
        stream.getTracks().forEach(t => t.stop())
        setRecordState('processing')
        try {
          const blob = new Blob(chunksRef.current, { type: mimeType })

          // Upload raw audio to Supabase Storage (spec: raw_input_url)
          const ext = mimeType === 'audio/mp4' ? 'm4a' : 'webm'
          const path = storagePath(childProfileId, tileId, ext)
          rawUrlRef.current = await uploadToStorage('dream-inputs', path, blob, mimeType)

          // Transcribe via Whisper
          const formData = new FormData()
          formData.append('audio', blob, `recording.${ext}`)
          const res = await fetch('/api/transcribe', { method: 'POST', body: formData })
          const json = await res.json()
          if (!res.ok) throw new Error(json.error)
          setTranscription(json.text)
          setRecordState('confirming')
        } catch {
          setErrorMsg("We couldn't hear that clearly — want to type it instead?")
          setRecordState('error')
        }
      }

      recorder.start(250) // timeslice ensures audio frames are flushed every 250ms
      setRecordState('recording')
      setSeconds(0)
      timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000)
      autoStopRef.current = setTimeout(() => recorder.stop(), MAX_RECORDING_MS)
    } catch {
      setErrorMsg('Could not access microphone')
      setRecordState('error')
    }
  }

  function stopRecording() {
    mediaRef.current?.stop()
  }

  if (recordState === 'idle') {
    return (
      <div className="flex flex-col items-center gap-4 py-4">
        <button
          onClick={startRecording}
          className="w-20 h-20 rounded-full bg-red-500 text-white font-semibold text-sm flex items-center justify-center hover:bg-red-600 transition-colors shadow-lg"
        >
          🎤<br />Tap to record
        </button>
      </div>
    )
  }

  if (recordState === 'recording') {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return (
      <div className="flex flex-col items-center gap-4 py-4">
        <div className="w-4 h-4 rounded-full bg-red-500 animate-pulse" />
        <p className="text-muted-foreground text-sm">{mins}:{String(secs).padStart(2, '0')}</p>
        <button
          onClick={stopRecording}
          className="px-6 py-3 rounded-xl bg-slate-700 text-white text-sm hover:bg-slate-800 transition-colors"
        >
          Tap to stop
        </button>
      </div>
    )
  }

  if (recordState === 'processing') {
    return <p className="text-muted-foreground text-sm text-center py-4">Listening to your dream...</p>
  }

  if (recordState === 'confirming') {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-foreground text-sm bg-muted rounded-xl p-4 leading-relaxed">{transcription}</p>
        <button
          onClick={() => onSubmit(transcription, rawUrlRef.current)}
          className="w-full py-3 rounded-xl bg-violet-600 text-white font-semibold text-sm"
        >
          Use this dream
        </button>
        <button
          onClick={() => { setTranscription(''); setRecordState('idle') }}
          className="w-full py-3 rounded-xl bg-slate-100 text-slate-700 text-sm"
        >
          Try again
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 py-4">
      <p className="text-muted-foreground text-sm text-center">{errorMsg}</p>
      <button onClick={() => setRecordState('idle')} className="w-full py-3 rounded-xl bg-slate-100 text-slate-700 text-sm">
        Try again
      </button>
    </div>
  )
}
