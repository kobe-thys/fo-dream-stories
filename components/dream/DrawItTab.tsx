'use client'
import { useRef, useState, useEffect } from 'react'
import { uploadToStorage, storagePath } from '@/lib/storage'

interface DrawItTabProps {
  childProfileId: string
  tileId: string
  onSubmit: (text: string, rawUrl: string | null) => void
}

type DrawState = 'drawing' | 'processing' | 'confirming' | 'error'

export default function DrawItTab({ childProfileId, tileId, onSubmit }: DrawItTabProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [drawState, setDrawState] = useState<DrawState>('drawing')
  const [hasStrokes, setHasStrokes] = useState(false)
  const [description, setDescription] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [photoError, setPhotoError] = useState('')
  const rawUrlRef = useRef<string | null>(null)
  const strokesRef = useRef<{ x: number; y: number }[][]>([])
  const currentStrokeRef = useRef<{ x: number; y: number }[]>([])
  const isDrawingRef = useRef(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = 'white'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.strokeStyle = 'black'
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }, [])

  function getPos(e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect()
    if ('touches' in e) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top }
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top }
  }

  function startDraw(e: React.MouseEvent | React.TouchEvent) {
    const canvas = canvasRef.current; if (!canvas) return
    isDrawingRef.current = true
    currentStrokeRef.current = [getPos(e, canvas)]
  }

  function draw(e: React.MouseEvent | React.TouchEvent) {
    if (!isDrawingRef.current) return
    const canvas = canvasRef.current; if (!canvas) return
    const ctx = canvas.getContext('2d'); if (!ctx) return
    const pos = getPos(e, canvas)
    const prev = currentStrokeRef.current[currentStrokeRef.current.length - 1]
    ctx.beginPath(); ctx.moveTo(prev.x, prev.y); ctx.lineTo(pos.x, pos.y); ctx.stroke()
    currentStrokeRef.current.push(pos)
  }

  function endDraw() {
    if (!isDrawingRef.current) return
    isDrawingRef.current = false
    strokesRef.current.push([...currentStrokeRef.current])
    currentStrokeRef.current = []
    setHasStrokes(true)
  }

  function undo() {
    strokesRef.current.pop()
    const canvas = canvasRef.current; if (!canvas) return
    const ctx = canvas.getContext('2d'); if (!ctx) return
    ctx.fillStyle = 'white'; ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.strokeStyle = 'black'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
    strokesRef.current.forEach(stroke => {
      if (stroke.length < 2) return
      ctx.beginPath(); ctx.moveTo(stroke[0].x, stroke[0].y)
      stroke.forEach(p => ctx.lineTo(p.x, p.y)); ctx.stroke()
    })
    setHasStrokes(strokesRef.current.length > 0)
  }

  function clear() {
    strokesRef.current = []
    setHasStrokes(false)
    const canvas = canvasRef.current; if (!canvas) return
    const ctx = canvas.getContext('2d'); if (!ctx) return
    ctx.fillStyle = 'white'; ctx.fillRect(0, 0, canvas.width, canvas.height)
  }

  async function analyseImage(blob: Blob, mimeType: string) {
    setDrawState('processing')
    try {
      // Upload to Supabase Storage (spec: raw_input_url)
      const ext = mimeType === 'image/png' ? 'png' : 'jpg'
      const path = storagePath(childProfileId, tileId, ext)
      rawUrlRef.current = await uploadToStorage('dream-inputs', path, blob, mimeType)

      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = ev => resolve((ev.target?.result as string).split(',')[1])
        reader.onerror = () => reject(new Error('Failed to read image file'))
        reader.readAsDataURL(blob)
      })
      const res = await fetch('/api/describe-drawing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mimeType }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setDescription(json.description)
      setDrawState('confirming')
    } catch {
      setErrorMsg("We had trouble reading your drawing — want to describe it in words instead?")
      setDrawState('error')
    }
  }

  async function submitDrawing() {
    const canvas = canvasRef.current; if (!canvas) return
    canvas.toBlob(blob => {
      if (blob) analyseImage(blob, 'image/png')
    }, 'image/png')
  }

  function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/') || file.size > 10 * 1024 * 1024) {
      setPhotoError('Please upload an image file under 10MB.')
      return
    }
    setPhotoError('')
    analyseImage(file, file.type)
  }

  if (drawState === 'processing') return <p className="text-muted-foreground text-sm text-center py-4">Reading your drawing...</p>

  if (drawState === 'confirming') {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-foreground text-sm bg-muted rounded-xl p-4 leading-relaxed">{description}</p>
        <button onClick={() => onSubmit(description, rawUrlRef.current)} className="w-full py-3 rounded-xl bg-violet-600 text-white font-semibold text-sm">Use this drawing</button>
        <button onClick={() => { setDescription(''); setDrawState('drawing') }} className="w-full py-3 rounded-xl bg-slate-100 text-slate-700 text-sm">Try again</button>
      </div>
    )
  }

  if (drawState === 'error') {
    return (
      <div className="flex flex-col gap-3 py-4">
        <p className="text-muted-foreground text-sm text-center">{errorMsg}</p>
        <button onClick={() => setDrawState('drawing')} className="w-full py-3 rounded-xl bg-slate-100 text-slate-700 text-sm">Try again</button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <canvas
        ref={canvasRef}
        data-testid="drawing-canvas"
        width={320} height={320}
        className="w-full rounded-xl border border-border touch-none"
        style={{ touchAction: 'none' }}
        onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw}
        onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw}
      />
      <div className="flex gap-2">
        <button onClick={undo} disabled={!hasStrokes} className="flex-1 py-2 rounded-xl bg-slate-100 text-slate-600 text-sm disabled:opacity-40">Undo</button>
        <button onClick={clear} disabled={!hasStrokes} className="flex-1 py-2 rounded-xl bg-slate-100 text-slate-600 text-sm disabled:opacity-40">Clear</button>
      </div>
      <label className="w-full py-2 rounded-xl border border-border text-center text-muted-foreground text-sm cursor-pointer hover:bg-muted transition-colors">
        Upload a photo instead
        <input type="file" accept="image/*" onChange={handlePhotoUpload} className="sr-only" />
      </label>
      {photoError && <p className="text-red-500 text-xs text-center">{photoError}</p>}
      <button
        onClick={submitDrawing}
        disabled={!hasStrokes}
        className="w-full py-3 rounded-xl bg-violet-600 text-white font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed"
        aria-label="Use this drawing"
      >
        Use this drawing
      </button>
    </div>
  )
}
