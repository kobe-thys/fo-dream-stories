'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

/**
 * Admin normalizer — enqueue tile jobs for the worker on Kobe's machine.
 *
 * Nothing here runs the normalizer. Vercel cannot: heavy tiles need minutes and
 * ~8 GB, and public/ is not writable in production. This page uploads the source
 * to Storage, writes a job row, and watches it. The worker does the rest.
 */

interface Job {
  id: string
  created_at: string
  output_name: string
  surface: number
  base_top: number | null
  status: string
  preview_url: string | null
  log: string | null
  measured_r: number | null
  measured_plate_top: number | null
  triangles: number | null
  bytes: number | null
}

// Measured off the Kenney kit — see the tile geometry contract in CLAUDE.md.
const SURFACES = [
  { label: 'Grass / sand / stone', value: 0.2, hint: 'land tiles — two layers' },
  { label: 'Water / dirt', value: 0.1, hint: 'one layer, sits lower' },
  { label: 'River channel', value: 0.162, hint: 'matches river water' },
]

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function NormalizerPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [file, setFile] = useState<File | null>(null)
  const [outputName, setOutputName] = useState('')
  const [surface, setSurface] = useState(0.2)
  const [baseTop, setBaseTop] = useState('')
  const [budget, setBudget] = useState(8000)
  const [matchWater, setMatchWater] = useState(false)
  const [rebuildBase, setRebuildBase] = useState(true)
  const [paletteLock, setPaletteLock] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/tile-jobs')
    if (res.ok) setJobs(await res.json())
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(load, 4000)   // jobs run for minutes; polling is plenty
    return () => clearInterval(t)
  }, [load])

  function pick(f: File | null) {
    setFile(f)
    if (f && !outputName) {
      setOutputName(f.name.toLowerCase().replace(/\.glb$/i, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '.glb')
    }
  }

  async function submit() {
    if (!file || !outputName) return
    setBusy(true); setError(null)
    try {
      const sig = await fetch('/api/admin/tile-jobs/upload', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name }),
      })
      if (!sig.ok) throw new Error((await sig.json()).error || 'Could not get an upload URL')
      const { path, token } = await sig.json()

      // Straight to Storage — Vercel caps a serverless request body at 4.5 MB and
      // sources run to 33 MB.
      const up = await supabase.storage.from('tile-sources').uploadToSignedUrl(path, token, file)
      if (up.error) throw new Error(`Upload failed: ${up.error.message}`)

      const res = await fetch('/api/admin/tile-jobs', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_path: path, output_name: outputName, surface,
          base_top: baseTop === '' ? undefined : Number(baseTop),
          budget, match_water: matchWater, palette_lock: paletteLock, rebuild_base: rebuildBase,
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Could not queue the job')
      setFile(null); setOutputName(''); setBaseTop('')
      if (fileRef.current) fileRef.current.value = ''
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  async function decide(id: string, status: 'accepted' | 'failed') {
    await fetch('/api/admin/tile-jobs', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    })
    load()
  }

  const badge = (s: string) => ({
    queued: 'bg-gray-700 text-gray-200',
    running: 'bg-blue-900 text-blue-200 animate-pulse',
    preview_ready: 'bg-amber-900 text-amber-200',
    accepted: 'bg-purple-900 text-purple-200 animate-pulse',
    installed: 'bg-green-900 text-green-200',
    failed: 'bg-red-950 text-red-300',
  }[s] ?? 'bg-gray-700 text-gray-200')

  return (
    <div className="max-w-5xl space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-gray-100">Tile normalizer</h1>
        <p className="text-sm text-gray-400 mt-1">
          Upload a generated GLB, say which surface it should sit on, and the worker on
          your machine normalizes it to the Kenney contract. Review the preview before
          it is installed.
        </p>
      </div>

      {/* ── new job ── */}
      <div className="border border-gray-800 rounded-xl p-5 space-y-4 bg-gray-900/40">
        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className="text-xs text-gray-400">Source GLB</span>
            <input
              ref={fileRef} type="file" accept=".glb"
              onChange={e => pick(e.target.files?.[0] ?? null)}
              className="mt-1 block w-full text-xs text-gray-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-gray-700 file:bg-gray-800 file:text-gray-200"
            />
            {file && <span className="text-[11px] text-gray-500">{(file.size / 1e6).toFixed(1)} MB</span>}
          </label>

          <label className="block">
            <span className="text-xs text-gray-400">Output name</span>
            <input
              value={outputName} onChange={e => setOutputName(e.target.value)}
              placeholder="syrup-tree.glb"
              className="mt-1 w-full bg-gray-950 border border-gray-700 rounded-lg px-2 py-1.5 text-sm text-gray-100"
            />
          </label>
        </div>

        <div>
          <span className="text-xs text-gray-400">Surface height</span>
          <div className="mt-1 flex gap-2 flex-wrap">
            {SURFACES.map(s => (
              <button
                key={s.value} onClick={() => setSurface(s.value)}
                className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                  surface === s.value
                    ? 'bg-purple-900 border-purple-600 text-purple-100'
                    : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700'}`}
              >
                {s.label} <span className="opacity-60">{s.value}</span>
              </button>
            ))}
          </div>
          <p className="text-[11px] text-gray-500 mt-1">
            {SURFACES.find(s => s.value === surface)?.hint}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <label className="block">
            <span className="text-xs text-gray-400">Base top (optional)</span>
            <input
              value={baseTop} onChange={e => setBaseTop(e.target.value)} placeholder="auto"
              className="mt-1 w-full bg-gray-950 border border-gray-700 rounded-lg px-2 py-1.5 text-sm text-gray-100"
            />
            <span className="text-[11px] text-gray-500">
              Where the plate ends in the source. Set it for tall models — the auto guess picks canopy.
            </span>
          </label>
          <label className="block">
            <span className="text-xs text-gray-400">Triangle budget</span>
            <input
              type="number" value={budget} onChange={e => setBudget(Number(e.target.value))}
              className="mt-1 w-full bg-gray-950 border border-gray-700 rounded-lg px-2 py-1.5 text-sm text-gray-100"
            />
            <span className="text-[11px] text-gray-500">Trellis exports plateau — raise to ~60000.</span>
          </label>
          <div className="space-y-1.5 pt-5 text-xs text-gray-300">
            <label className="flex gap-2 items-center">
              <input type="checkbox" checked={rebuildBase} onChange={e => setRebuildBase(e.target.checked)} />
              Rebuild base as exact hex prism
            </label>
            <label className="flex gap-2 items-center">
              <input type="checkbox" checked={paletteLock} onChange={e => setPaletteLock(e.target.checked)} />
              Lock to Kenney palette
            </label>
            <label className="flex gap-2 items-center">
              <input type="checkbox" checked={matchWater} onChange={e => setMatchWater(e.target.checked)} />
              Match water colour <span className="text-gray-500">(only if it has water)</span>
            </label>
          </div>
        </div>

        {error && <div className="text-xs text-red-400 bg-red-950/50 border border-red-900 rounded-lg px-3 py-2">{error}</div>}

        <button
          onClick={submit} disabled={!file || !outputName || busy}
          className="px-4 py-2 bg-purple-700 text-white rounded-lg text-sm hover:bg-purple-600 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {busy ? 'Uploading…' : 'Queue normalization'}
        </button>
      </div>

      {/* ── jobs ── */}
      <div className="space-y-3">
        <h2 className="text-sm font-medium text-gray-300">Recent jobs</h2>
        {jobs.length === 0 && <p className="text-xs text-gray-500">Nothing yet.</p>}
        {jobs.map(j => (
          <div key={j.id} className="border border-gray-800 rounded-xl p-4 flex gap-4 bg-gray-900/30">
            {j.preview_url
              ? <img src={j.preview_url} alt="" className="w-32 h-32 object-contain bg-gray-950 rounded-lg border border-gray-800" />
              : <div className="w-32 h-32 grid place-content-center bg-gray-950 rounded-lg border border-gray-800 text-[11px] text-gray-600">no preview</div>}

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-100 font-medium">{j.output_name}</span>
                <span className={`px-2 py-0.5 rounded text-[11px] ${badge(j.status)}`}>{j.status}</span>
              </div>
              <div className="text-[11px] text-gray-400 mt-1 space-x-3 font-mono">
                <span>surface {j.surface}</span>
                {j.base_top != null && <span>base-top {j.base_top}</span>}
                {j.measured_plate_top != null && (
                  <span className={Math.abs(j.measured_plate_top - j.surface) <= 0.02 ? 'text-green-400' : 'text-red-400'}>
                    plate {j.measured_plate_top}
                  </span>
                )}
                {j.measured_r != null && <span>R {j.measured_r}</span>}
                {j.triangles != null && <span>{j.triangles.toLocaleString()} tris</span>}
                {j.bytes != null && <span>{(j.bytes / 1024).toFixed(0)} KB</span>}
              </div>
              {j.log && (
                <pre className="mt-2 text-[10px] text-gray-500 bg-gray-950 border border-gray-800 rounded p-2 overflow-x-auto whitespace-pre-wrap max-h-28">
                  {j.log}
                </pre>
              )}
              {j.status === 'preview_ready' && (
                <div className="mt-2 flex gap-2">
                  <button onClick={() => decide(j.id, 'accepted')}
                    className="px-3 py-1.5 bg-green-800 text-green-100 rounded-lg text-xs hover:bg-green-700">
                    Install &amp; deploy
                  </button>
                  <button onClick={() => decide(j.id, 'failed')}
                    className="px-3 py-1.5 bg-gray-800 text-gray-300 border border-gray-700 rounded-lg text-xs hover:bg-gray-700">
                    Discard
                  </button>
                </div>
              )}
              {j.status === 'installed' && (
                <p className="mt-2 text-[11px] text-green-400">
                  Pushed — Vercel deploys in ~60s, then refresh the map builder.
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
