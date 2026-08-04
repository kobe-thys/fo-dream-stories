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
  base_top_color: string | null
  base_side_color: string | null
  shift_x: number
  shift_z: number
  top_scale: number
}

// Kenney surface colours, measured off the kit — the usual choices for a base top.
const BASE_COLOURS = [
  { label: 'Grass',  hex: '#48c1a3' },
  { label: 'Water',  hex: '#8fdbff' },
  { label: 'Sand',   hex: '#e6cfa1' },
  { label: 'Stone',  hex: '#9fa3b5' },
  { label: 'Dirt',   hex: '#be9b8b' },
]

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

  // Re-preview from the already-built tile — seconds, not a re-normalize.
  async function requestAdjust(job: Job, patch: Partial<Job>) {
    await fetch('/api/admin/tile-jobs', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: job.id, status: 'adjust',
        shift_x: patch.shift_x ?? job.shift_x ?? 0,
        shift_z: patch.shift_z ?? job.shift_z ?? 0,
        top_scale: patch.top_scale ?? job.top_scale ?? 1,
        base_top_color: patch.base_top_color !== undefined ? patch.base_top_color : job.base_top_color,
        base_side_color: patch.base_side_color !== undefined ? patch.base_side_color : job.base_side_color,
      }),
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
              Where the flat hex plate stops and the artwork begins. Leave blank first —
              every job logs a height profile with a suggested value.
            </span>
          </label>
          <label className="block">
            <span className="text-xs text-gray-400">Triangle budget</span>
            <input
              type="number" value={budget} onChange={e => setBudget(Number(e.target.value))}
              className="mt-1 w-full bg-gray-950 border border-gray-700 rounded-lg px-2 py-1.5 text-sm text-gray-100"
            />
            <div className="mt-1 flex gap-1">
              {[8000, 60000, 120000].map(b => (
                <button key={b} onClick={() => setBudget(b)}
                  className={`px-2 py-0.5 rounded text-[11px] border ${budget === b
                    ? 'bg-purple-900 border-purple-600 text-purple-100'
                    : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'}`}>
                  {b.toLocaleString()}
                </button>
              ))}
            </div>
            <span className="text-[11px] text-gray-500">
              Trellis exports plateau far above 8,000 — if a job fails on budget, the log
              shows what it reached; set this just above it.
            </span>
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
            {/* next/image does not work with Supabase Storage URLs — project
                convention is a plain <img>, see CLAUDE.md. */}
            {j.preview_url
              // eslint-disable-next-line @next/next/no-img-element
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
                <pre className="mt-2 text-[10px] text-gray-500 bg-gray-950 border border-gray-800 rounded p-2 overflow-x-auto whitespace-pre max-h-64 font-mono">
                  {j.log}
                </pre>
              )}
              {j.status === 'preview_ready' && (
                <AdjustPanel
                  // Remount when the APPLIED values change, so the fields resync
                  // after a re-preview. Unchanged values keep the key stable, so
                  // the 4s poll never clobbers what is being typed.
                  key={`${j.id}:${j.shift_x}:${j.shift_z}:${j.top_scale}:${j.base_top_color}`}
                  job={j} onApply={requestAdjust} onDecide={decide}
                />
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

/**
 * Batched adjust controls.
 *
 * Every change used to fire a job immediately, and each re-preview costs a CPU
 * render — ~50s on a heavy tile. So changes are held locally and sent once, on
 * Apply.
 *
 * Axis directions are stated because they are not guessable: the preview camera is
 * fixed at (2.6, 2.2, 3.4) looking at the origin, which puts +X toward the
 * lower-right of the image and +Z toward the lower-left.
 */
function AdjustPanel({
  job, onApply, onDecide,
}: {
  job: Job
  onApply: (job: Job, patch: Partial<Job>) => void
  onDecide: (id: string, status: 'accepted' | 'failed') => void
}) {
  const [topColor, setTopColor] = useState<string | null>(job.base_top_color)
  const [shiftX, setShiftX] = useState(String(job.shift_x ?? 0))
  const [shiftZ, setShiftZ] = useState(String(job.shift_z ?? 0))
  const [pct, setPct] = useState(String(Math.round(((job.top_scale ?? 1) - 1) * 100)))

  const dirty =
    topColor !== job.base_top_color ||
    Number(shiftX) !== (job.shift_x ?? 0) ||
    Number(shiftZ) !== (job.shift_z ?? 0) ||
    Number(pct) !== Math.round(((job.top_scale ?? 1) - 1) * 100)

  const num = (s: string) => (s.trim() === '' || s === '-' ? 0 : Number(s))
  const valid =
    Number.isFinite(num(shiftX)) && Math.abs(num(shiftX)) <= 0.5 &&
    Number.isFinite(num(shiftZ)) && Math.abs(num(shiftZ)) <= 0.5 &&
    Number.isFinite(num(pct)) && num(pct) >= -50 && num(pct) <= 100

  const field = 'w-20 bg-gray-950 border border-gray-700 rounded px-2 py-1 text-xs text-gray-100 font-mono'

  return (
    <div className="mt-3 border-t border-gray-800 pt-3 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[11px] text-gray-400 w-24">Base top colour</span>
        {BASE_COLOURS.map(c => (
          <button key={c.hex} title={`${c.label} ${c.hex}`} onClick={() => setTopColor(c.hex)}
            className={`w-6 h-6 rounded border-2 ${topColor === c.hex ? 'border-white' : 'border-gray-700'}`}
            style={{ background: c.hex }} />
        ))}
        <button onClick={() => setTopColor(null)}
          className={`text-[11px] px-2 py-0.5 rounded border ${topColor === null
            ? 'bg-gray-700 border-white text-gray-100'
            : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'}`}>
          sampled
        </button>
      </div>

      <div className="flex items-end gap-3 flex-wrap">
        <label className="text-[11px] text-gray-400">
          Shift X
          <input value={shiftX} onChange={e => setShiftX(e.target.value)} className={`${field} block mt-0.5`} />
        </label>
        <label className="text-[11px] text-gray-400">
          Shift Z
          <input value={shiftZ} onChange={e => setShiftZ(e.target.value)} className={`${field} block mt-0.5`} />
        </label>
        <label className="text-[11px] text-gray-400">
          Size %
          <input value={pct} onChange={e => setPct(e.target.value)} className={`${field} block mt-0.5`} />
        </label>
        <button
          disabled={!dirty || !valid}
          onClick={() => onApply(job, {
            base_top_color: topColor,
            shift_x: num(shiftX),
            shift_z: num(shiftZ),
            top_scale: 1 + num(pct) / 100,
          })}
          className="px-3 py-1.5 bg-blue-800 text-blue-100 rounded-lg text-xs hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Apply &amp; re-preview
        </button>
        {dirty && (
          <button
            onClick={() => {
              setTopColor(job.base_top_color)
              setShiftX(String(job.shift_x ?? 0)); setShiftZ(String(job.shift_z ?? 0))
              setPct(String(Math.round(((job.top_scale ?? 1) - 1) * 100)))
            }}
            className="px-2 py-1.5 text-[11px] text-gray-400 hover:text-gray-200">
            revert
          </button>
        )}
      </div>

      <p className="text-[11px] text-gray-600 leading-relaxed">
        In the preview, <b className="text-gray-400">+X</b> moves the artwork toward the
        lower-right, <b className="text-gray-400">+Z</b> toward the lower-left. Units are
        tile widths, so 0.05 ≈ 5% of a hex. Shift ±0.5, size −50% to +100%.
        The hex base never moves — only the artwork on top of it.
        {!valid && <span className="text-red-400"> Value out of range.</span>}
      </p>

      <div className="flex gap-2">
        <button onClick={() => onDecide(job.id, 'accepted')}
          className="px-3 py-1.5 bg-green-800 text-green-100 rounded-lg text-xs hover:bg-green-700">
          Install &amp; deploy
        </button>
        <button onClick={() => onDecide(job.id, 'failed')}
          className="px-3 py-1.5 bg-gray-800 text-gray-300 border border-gray-700 rounded-lg text-xs hover:bg-gray-700">
          Discard
        </button>
      </div>
    </div>
  )
}
