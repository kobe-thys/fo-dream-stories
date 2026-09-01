'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

/**
 * Tile workshop — three ways to make a tile, all finished by the worker.
 *
 *   Forge      an idea in words -> concept drawing -> (revise)* -> tile
 *   Normalize  a GLB you generated elsewhere -> tile
 *   Compose    two installed models stacked -> tile
 *
 * Almost nothing here runs the work. Vercel cannot: a tile needs minutes and ~8 GB,
 * and public/ is not writable in production. This page writes a job row and watches
 * it; the worker on Kobe's machine builds, previews, and on accept installs and
 * pushes.
 *
 * The ONE exception is drawing a concept. That is a single ~35s API call, and
 * putting it behind the queue would make the revise loop feel dead, so it runs on
 * Vercel via /api/admin/forge/concept and returns the image straight back. Drafts
 * live in component state, so abandoned ideas never reach the queue -- a row is
 * written only when a drawing is approved.
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
  kind: string
  base_model: string | null
  overlay_model: string | null
  overlay_rot: number
  artwork_rot: number
  align_cut: boolean
  base_top_color: string | null
  base_side_color: string | null
  shift_x: number
  shift_z: number
  top_scale: number
  idea: string | null
  concept_path: string | null
  polycount: number
  skirt: number | null
}

/** One drawing in the forge's idea → draw → revise loop. */
interface Concept {
  path: string
  url: string
  note: string          // "first draft", or the change that produced it
}

// Kenney surface colours, measured off the kit — the usual choices for a base top.
const BASE_COLOURS = [
  { label: 'Grass',  hex: '#48c1a3' },
  { label: 'Dirt',   hex: '#f1976c' },
  { label: 'Water',  hex: '#8fdbff' },
  { label: 'Sand',   hex: '#e6cfa1' },
  { label: 'Stone',  hex: '#9fa3b5' },
]

// The skirt under every Kenney tile. Default for generated tiles so they sit in
// the same world as the stock ones.
const KENNEY_DIRT = '#f1976c'

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
  const [artRot, setArtRot] = useState('0')
  const [alignCut, setAlignCut] = useState(false)
  const [matchWater, setMatchWater] = useState(false)
  const [rebuildBase, setRebuildBase] = useState(true)
  const [paletteLock, setPaletteLock] = useState(true)
  const [tab, setTab] = useState<'forge' | 'normalize' | 'compose'>('forge')
  // Forge: idea -> drawing -> (revise)* -> approve. Drafts live here rather than in
  // tile_jobs, so abandoned ideas never reach the queue.
  const [fIdea, setFIdea] = useState('')
  const [fDrafts, setFDrafts] = useState<Concept[]>([])
  const [fPicked, setFPicked] = useState(0)
  const [fRevise, setFRevise] = useState('')
  const [fName, setFName] = useState('')
  const [fSurface, setFSurface] = useState(0.2)
  const [fPoly, setFPoly] = useState(10000)
  const [fSkirt, setFSkirt] = useState(true)
  const [fRebuild, setFRebuild] = useState(true)
  const [drawing, setDrawing] = useState(false)
  const [modelFiles, setModelFiles] = useState<string[]>([])
  const [cBase, setCBase] = useState('grass.glb')
  const [cOverlay, setCOverlay] = useState('unit-tree.glb')
  const [cName, setCName] = useState('')
  const [cDx, setCDx] = useState('0')
  const [cDz, setCDz] = useState('0')
  const [cRot, setCRot] = useState('0')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/tile-jobs')
    if (res.ok) setJobs(await res.json())
  }, [])

  useEffect(() => {
    fetch('/api/admin/models').then(r => r.json())
      .then(d => { if (Array.isArray(d)) setModelFiles(d) }).catch(() => {})
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
          artwork_rot: Number(artRot) || 0, align_cut: alignCut,
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

  /**
   * Draw the first concept, or revise the one on screen.
   *
   * A revision is sent as an EDIT of the picked drawing, not a fresh prompt, so
   * "make the towers taller" keeps the castle rather than inventing a new one.
   */
  async function draw(revise?: string) {
    if (!fIdea.trim()) return
    setDrawing(true); setError(null)
    try {
      const from = revise ? fDrafts[fPicked]?.path : undefined
      const res = await fetch('/api/admin/forge/concept', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idea: fIdea, revise, from_path: from }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Could not draw the concept')
      const { path, url } = await res.json()
      setFDrafts(d => {
        const next = [...d, { path, url, note: revise || 'first draft' }]
        setFPicked(next.length - 1)
        return next
      })
      setFRevise('')
      if (!fName) {
        setFName(fIdea.toLowerCase().split(/\s+/).slice(0, 4).join('-')
          .replace(/[^a-z0-9-]/g, '').replace(/^-|-$/g, '').slice(0, 40) + '.glb')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally { setDrawing(false) }
  }

  /** Approve the picked drawing and hand it to the worker. */
  async function approveConcept() {
    const picked = fDrafts[fPicked]
    if (!picked || !fName) return
    setBusy(true); setError(null)
    try {
      const res = await fetch('/api/admin/tile-jobs', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'forge', output_name: fName, idea: fIdea, concept_path: picked.path,
          surface: fSurface, polycount: fPoly, budget: 8000,
          // The skirt sits just under the surface: a top face reading a hair below
          // the surface height would otherwise be repainted as dirt.
          skirt: fSkirt ? Number((fSurface - 0.01).toFixed(3)) : undefined,
          rebuild_base: fRebuild,
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Could not queue the tile')
      setFDrafts([]); setFPicked(0); setFIdea(''); setFName('')
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally { setBusy(false) }
  }

  async function submitCompose() {
    if (!cName) return
    setBusy(true); setError(null)
    try {
      const res = await fetch('/api/admin/tile-jobs', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'compose', output_name: cName,
          base_model: cBase, overlay_model: cOverlay,
          shift_x: Number(cDx) || 0, shift_z: Number(cDz) || 0, overlay_rot: Number(cRot) || 0,
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Could not queue the compose')
      setCName('')
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally { setBusy(false) }
  }

  async function recompose(job: Job, patch: { shift_x: number; shift_z: number; overlay_rot: number }) {
    await fetch('/api/admin/tile-jobs', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: job.id, status: 'queued', ...patch }),
    })
    load()
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
        artwork_rot: patch.artwork_rot ?? job.artwork_rot ?? 0,
        align_cut: patch.align_cut !== undefined ? patch.align_cut : job.align_cut,
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
    <div className="max-w-6xl space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-gray-100">Tile workshop</h1>
        <p className="text-sm text-gray-400 mt-1">
          Make a tile from a written idea, normalize one you generated elsewhere, or
          stack two you already have. Every route ends the same way: the worker on your
          machine builds it, you review the preview, and only then is it installed.
        </p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {(['forge', 'normalize', 'compose'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-xs border ${tab === t
              ? 'bg-purple-900 border-purple-600 text-purple-100'
              : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700'}`}>
            {{ forge: 'Make a tile from an idea',
               normalize: 'Normalize a generated GLB',
               compose: 'Compose from existing tiles' }[t]}
          </button>
        ))}
      </div>

      {tab === 'forge' && (
        <div className="border border-gray-800 rounded-xl p-5 space-y-5 bg-gray-900/40">
          <p className="text-xs text-gray-400">
            Describe the tile. You get a drawing back in about half a minute — change
            it as many times as you like, and nothing is built until you approve one.
            Approving spends 30 Meshy credits and takes a few minutes.
          </p>

          <label className="block">
            <span className="text-xs text-gray-400">What is on this tile?</span>
            <textarea
              value={fIdea} onChange={e => setFIdea(e.target.value)} rows={3}
              placeholder="a pegasus made of ice and starlight, standing on a mound of soft clouds, wings spread"
              className="mt-1 w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100" />
          </label>

          {fDrafts.length === 0 && (
            <button onClick={() => draw()} disabled={!fIdea.trim() || drawing}
              className="px-4 py-2 bg-purple-700 text-white rounded-lg text-sm hover:bg-purple-600 disabled:opacity-40">
              {drawing ? 'Drawing…' : 'Draw it'}
            </button>
          )}

          {fDrafts.length > 0 && (
            <div className="space-y-4">
              <div className="flex gap-4 items-start flex-wrap">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={fDrafts[fPicked].url} alt="Concept drawing"
                  className="w-72 h-72 object-contain rounded-lg border border-gray-700 bg-white" />
                <div className="space-y-3 flex-1 min-w-64">
                  <div>
                    <span className="text-xs text-gray-400">Not right? Say what to change</span>
                    <textarea
                      value={fRevise} onChange={e => setFRevise(e.target.value)} rows={2}
                      placeholder="make the clouds bigger and the wings less spiky"
                      className="mt-1 w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100" />
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <button onClick={() => draw(fRevise)} disabled={!fRevise.trim() || drawing}
                      className="px-3 py-1.5 bg-gray-800 border border-gray-700 text-gray-200 rounded-lg text-xs hover:bg-gray-700 disabled:opacity-40">
                      {drawing ? 'Drawing…' : 'Change it'}
                    </button>
                    <button onClick={() => draw()} disabled={drawing}
                      className="px-3 py-1.5 bg-gray-800 border border-gray-700 text-gray-200 rounded-lg text-xs hover:bg-gray-700 disabled:opacity-40">
                      Draw another
                    </button>
                    <button onClick={() => { setFDrafts([]); setFPicked(0); setFRevise('') }}
                      className="px-3 py-1.5 text-gray-500 rounded-lg text-xs hover:text-gray-300">
                      Start over
                    </button>
                  </div>
                  <p className="text-[11px] text-gray-600">
                    &ldquo;Change it&rdquo; edits the drawing you have selected, so the design survives.
                    &ldquo;Draw another&rdquo; starts a fresh one from the same description.
                  </p>
                </div>
              </div>

              {fDrafts.length > 1 && (
                <div className="flex gap-2 flex-wrap items-center">
                  <span className="text-[11px] text-gray-500">Drafts:</span>
                  {fDrafts.map((d, i) => (
                    <button key={d.path} onClick={() => setFPicked(i)} title={d.note}
                      className={`w-14 h-14 rounded border overflow-hidden ${i === fPicked
                        ? 'border-purple-500 ring-1 ring-purple-500' : 'border-gray-700 opacity-60 hover:opacity-100'}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={d.url} alt={d.note} className="w-full h-full object-contain bg-white" />
                    </button>
                  ))}
                </div>
              )}

              <div className="border-t border-gray-800 pt-4 space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <label className="block">
                    <span className="text-xs text-gray-400">Tile name</span>
                    <input value={fName} onChange={e => setFName(e.target.value)}
                      placeholder="pegasus.glb"
                      className="mt-1 w-full bg-gray-950 border border-gray-700 rounded-lg px-2 py-1.5 text-sm text-gray-100" />
                  </label>
                  <label className="block">
                    <span className="text-xs text-gray-400">Sits on</span>
                    <select value={fSurface} onChange={e => setFSurface(Number(e.target.value))}
                      className="mt-1 w-full bg-gray-950 border border-gray-700 rounded-lg px-2 py-1.5 text-sm text-gray-100">
                      {SURFACES.map(s => (
                        <option key={s.value} value={s.value}>{s.label} — {s.value}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="flex items-end gap-4 flex-wrap">
                  <label className="text-[11px] text-gray-400">Meshy triangles
                    <input type="number" value={fPoly} min={1000} max={100000} step={1000}
                      onChange={e => setFPoly(Number(e.target.value))}
                      className="block mt-0.5 w-24 bg-gray-950 border border-gray-700 rounded px-2 py-1 text-xs text-gray-100 font-mono" /></label>
                  <label className="flex items-center gap-2 text-[11px] text-gray-400">
                    <input type="checkbox" checked={fRebuild} onChange={e => setFRebuild(e.target.checked)} />
                    Rebuild the hex base
                  </label>
                  <label className="flex items-center gap-2 text-[11px] text-gray-400">
                    <input type="checkbox" checked={fSkirt} onChange={e => setFSkirt(e.target.checked)} />
                    Force a Kenney dirt skirt
                  </label>
                  <button onClick={approveConcept} disabled={!fName || busy}
                    className="px-4 py-2 bg-purple-700 text-white rounded-lg text-sm hover:bg-purple-600 disabled:opacity-40">
                    {busy ? 'Queueing…' : 'Approve & build the tile'}
                  </button>
                </div>
                <p className="text-[11px] text-gray-600">
                  A generated hex is rarely regular enough to tile, so rebuilding the base is
                  usually right. Leave it off only when the base itself carries artwork you
                  want to keep — rebuilding flattens it.
                </p>
              </div>
            </div>
          )}
          {error && <div className="text-xs text-red-400">{error}</div>}
        </div>
      )}

      {tab === 'compose' && (
        <div className="border border-gray-800 rounded-xl p-5 space-y-4 bg-gray-900/40">
          <p className="text-xs text-gray-400">
            Stack an overlay onto a tile — a tree beside a path, a tower on a crossing.
            Both come from the models already installed, so this takes seconds.
          </p>
          <div className="grid grid-cols-3 gap-4">
            <label className="block">
              <span className="text-xs text-gray-400">Base tile</span>
              <select value={cBase} onChange={e => setCBase(e.target.value)}
                className="mt-1 w-full bg-gray-950 border border-gray-700 rounded-lg px-2 py-1.5 text-sm text-gray-100">
                {modelFiles.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-xs text-gray-400">Overlay</span>
              <select value={cOverlay} onChange={e => setCOverlay(e.target.value)}
                className="mt-1 w-full bg-gray-950 border border-gray-700 rounded-lg px-2 py-1.5 text-sm text-gray-100">
                {modelFiles.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-xs text-gray-400">Output name</span>
              <input value={cName} onChange={e => setCName(e.target.value)}
                placeholder="grass-path-straight-tower.glb"
                className="mt-1 w-full bg-gray-950 border border-gray-700 rounded-lg px-2 py-1.5 text-sm text-gray-100" />
            </label>
          </div>
          <div className="flex items-end gap-3 flex-wrap">
            <label className="text-[11px] text-gray-400">Shift X
              <input value={cDx} onChange={e => setCDx(e.target.value)}
                className="block mt-0.5 w-20 bg-gray-950 border border-gray-700 rounded px-2 py-1 text-xs text-gray-100 font-mono" /></label>
            <label className="text-[11px] text-gray-400">Shift Z
              <input value={cDz} onChange={e => setCDz(e.target.value)}
                className="block mt-0.5 w-20 bg-gray-950 border border-gray-700 rounded px-2 py-1 text-xs text-gray-100 font-mono" /></label>
            <label className="text-[11px] text-gray-400">Rotation (×60°)
              <select value={cRot} onChange={e => setCRot(e.target.value)}
                className="block mt-0.5 w-20 bg-gray-950 border border-gray-700 rounded px-2 py-1 text-xs text-gray-100 font-mono">
                {[0,1,2,3,4,5].map(r => <option key={r} value={r}>{r}</option>)}
              </select></label>
            <button onClick={submitCompose} disabled={!cName || busy}
              className="px-4 py-2 bg-purple-700 text-white rounded-lg text-sm hover:bg-purple-600 disabled:opacity-40">
              {busy ? 'Queueing…' : 'Compose'}
            </button>
          </div>
          <p className="text-[11px] text-gray-600">
            The overlay is lifted onto the base&apos;s surface automatically. +X moves it toward
            the lower-right of the preview, +Z toward the lower-left. Units are tile widths.
          </p>
          {error && <div className="text-xs text-red-400">{error}</div>}
        </div>
      )}

      {/* ── new job ── */}
      <div className={`border border-gray-800 rounded-xl p-5 space-y-4 bg-gray-900/40 ${tab === 'normalize' ? '' : 'hidden'}`}>
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

        <div className="grid grid-cols-4 gap-4">
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
            <span className="text-xs text-gray-400">Artwork rotation °</span>
            <input value={artRot} onChange={e => setArtRot(e.target.value)} placeholder="0"
              className="mt-1 w-full bg-gray-950 border border-gray-700 rounded-lg px-2 py-1.5 text-sm text-gray-100 font-mono" />
            <span className="text-[11px] text-gray-500">
              Turns the artwork on its base. The automatic correction aligns the generated
              hex, not which way the art faces. −180 to 180.
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
            <label className="flex gap-2 items-center">
              <input type="checkbox" checked={alignCut} onChange={e => setAlignCut(e.target.checked)} />
              Centre art on the cut <span className="text-gray-500">(tapered bases)</span>
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
              ? <img src={j.preview_url} alt="" className="w-80 h-64 object-contain bg-gray-950 rounded-lg border border-gray-800 shrink-0" />
              : <div className="w-80 h-64 grid place-content-center bg-gray-950 rounded-lg border border-gray-800 text-[11px] text-gray-600 shrink-0">no preview</div>}

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
                j.kind === 'compose' ? (
                  <ComposePanel job={j} onRecompose={recompose} onDecide={decide} />
                ) : <AdjustPanel
                  // Remount when the APPLIED values change, so the fields resync
                  // after a re-preview. Unchanged values keep the key stable, so
                  // the 4s poll never clobbers what is being typed.
                  key={`${j.id}:${j.shift_x}:${j.shift_z}:${j.top_scale}:${j.base_top_color}:${j.base_side_color}:${j.artwork_rot}:${j.align_cut}`}
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
  const [sideColor, setSideColor] = useState<string | null>(job.base_side_color)
  const [shiftX, setShiftX] = useState(String(job.shift_x ?? 0))
  const [shiftZ, setShiftZ] = useState(String(job.shift_z ?? 0))
  const [pct, setPct] = useState(String(Math.round(((job.top_scale ?? 1) - 1) * 100)))
  const [rot, setRot] = useState(String(job.artwork_rot ?? 0))
  const [align, setAlign] = useState(!!job.align_cut)

  const dirty =
    topColor !== job.base_top_color ||
    sideColor !== job.base_side_color ||
    Number(rot) !== (job.artwork_rot ?? 0) ||
    align !== !!job.align_cut ||
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

      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[11px] text-gray-400 w-24">Base side</span>
        {BASE_COLOURS.map(c => (
          <button key={c.hex} title={`${c.label} ${c.hex}`} onClick={() => setSideColor(c.hex)}
            className={`w-6 h-6 rounded border-2 ${(sideColor ?? KENNEY_DIRT) === c.hex ? 'border-white' : 'border-gray-700'}`}
            style={{ background: c.hex }} />
        ))}
        <span className="text-[11px] text-gray-600">defaults to dirt, like every Kenney tile</span>
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
        <label className="text-[11px] text-gray-400">
          Rotation °
          <input value={rot} onChange={e => setRot(e.target.value)} className={`${field} block mt-0.5`} />
        </label>
        <label className="text-[11px] text-gray-400 flex gap-2 items-center pb-1.5">
          <input type="checkbox" checked={align} onChange={e => setAlign(e.target.checked)} />
          centre on base
        </label>
        <button
          disabled={!dirty || !valid}
          onClick={() => onApply(job, {
            base_top_color: topColor,
            base_side_color: sideColor,
            shift_x: num(shiftX),
            shift_z: num(shiftZ),
            top_scale: 1 + num(pct) / 100,
            artwork_rot: num(rot),
            align_cut: align,
          })}
          className="px-3 py-1.5 bg-blue-800 text-blue-100 rounded-lg text-xs hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Apply &amp; re-preview
        </button>
        {dirty && (
          <button
            onClick={() => {
              setTopColor(job.base_top_color); setSideColor(job.base_side_color)
              setRot(String(job.artwork_rot ?? 0)); setAlign(!!job.align_cut)
              setShiftX(String(job.shift_x ?? 0)); setShiftZ(String(job.shift_z ?? 0))
              setPct(String(Math.round(((job.top_scale ?? 1) - 1) * 100)))
            }}
            className="px-2 py-1.5 text-[11px] text-gray-400 hover:text-gray-200">
            revert
          </button>
        )}
      </div>

      <p className="text-[11px] text-gray-600 leading-relaxed">
        Rotation turns the artwork on its base; &ldquo;centre on base&rdquo; pulls it onto the
        hex centre first, then your shift is applied on top. The base never moves.{' '}
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

/**
 * Controls for a composed tile.
 *
 * Composed tiles have no hexBase mesh, so adjust-tile.mjs has nothing to anchor a
 * nudge against. Re-composing from the two source models instead is both correct
 * and cheap — a merge takes seconds.
 */
function ComposePanel({
  job, onRecompose, onDecide,
}: {
  job: Job
  onRecompose: (job: Job, patch: { shift_x: number; shift_z: number; overlay_rot: number }) => void
  onDecide: (id: string, status: 'accepted' | 'failed') => void
}) {
  const [dx, setDx] = useState(String(job.shift_x ?? 0))
  const [dz, setDz] = useState(String(job.shift_z ?? 0))
  const [rot, setRot] = useState(String(job.overlay_rot ?? 0))

  const num = (s: string) => (s.trim() === '' || s === '-' ? 0 : Number(s))
  const dirty =
    num(dx) !== (job.shift_x ?? 0) || num(dz) !== (job.shift_z ?? 0) || Number(rot) !== (job.overlay_rot ?? 0)
  const valid = Math.abs(num(dx)) <= 0.5 && Math.abs(num(dz)) <= 0.5
  const field = 'w-20 bg-gray-950 border border-gray-700 rounded px-2 py-1 text-xs text-gray-100 font-mono'

  return (
    <div className="mt-3 border-t border-gray-800 pt-3 space-y-3">
      <div className="text-[11px] text-gray-500">
        {job.base_model} + {job.overlay_model}
      </div>
      <div className="flex items-end gap-3 flex-wrap">
        <label className="text-[11px] text-gray-400">Shift X
          <input value={dx} onChange={e => setDx(e.target.value)} className={`${field} block mt-0.5`} /></label>
        <label className="text-[11px] text-gray-400">Shift Z
          <input value={dz} onChange={e => setDz(e.target.value)} className={`${field} block mt-0.5`} /></label>
        <label className="text-[11px] text-gray-400">Rotation
          <select value={rot} onChange={e => setRot(e.target.value)} className={`${field} block mt-0.5`}>
            {[0, 1, 2, 3, 4, 5].map(r => <option key={r} value={r}>{r}×60°</option>)}
          </select></label>
        <button
          disabled={!dirty || !valid}
          onClick={() => onRecompose(job, { shift_x: num(dx), shift_z: num(dz), overlay_rot: Number(rot) })}
          className="px-3 py-1.5 bg-blue-800 text-blue-100 rounded-lg text-xs hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Re-compose
        </button>
      </div>
      <p className="text-[11px] text-gray-600">
        +X moves the overlay toward the lower-right, +Z toward the lower-left.
        {!valid && <span className="text-red-400"> Shift must be within ±0.5.</span>}
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
