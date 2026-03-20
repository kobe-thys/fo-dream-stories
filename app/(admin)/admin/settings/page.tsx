'use client'
import { useEffect, useState } from 'react'
import { AppSettings } from '@/lib/types'

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch('/api/admin/settings').then(r => r.json()).then(setSettings)
  }, [])

  async function save() {
    if (!settings) return
    setSaving(true)
    const res = await fetch('/api/admin/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ beta_cap: settings.beta_cap, beta_open: settings.beta_open }),
    })
    const json = await res.json()
    setSaving(false)
    if (res.ok) { setSettings(json); setSaved(true); setTimeout(() => setSaved(false), 2000) }
  }

  if (!settings) return <p className="text-gray-500">Loading settings...</p>

  return (
    <div className="flex flex-col gap-8 max-w-md">
      <h1 className="text-2xl font-bold">Settings</h1>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 flex flex-col gap-5">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest">Beta access</h2>

        <label className="flex items-center justify-between">
          <span className="text-sm text-gray-200">Signups open</span>
          <input
            type="checkbox"
            checked={settings.beta_open}
            onChange={e => setSettings(s => s ? { ...s, beta_open: e.target.checked } : s)}
            className="w-5 h-5 cursor-pointer"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-gray-400 uppercase tracking-wide">Max families (beta cap)</span>
          <input
            type="number"
            min={1}
            value={settings.beta_cap}
            onChange={e => setSettings(s => s ? { ...s, beta_cap: parseInt(e.target.value) } : s)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm w-32"
          />
        </label>

        <button
          onClick={save}
          disabled={saving}
          className="px-6 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 disabled:opacity-50 w-fit"
        >
          {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save settings'}
        </button>
      </div>
    </div>
  )
}
