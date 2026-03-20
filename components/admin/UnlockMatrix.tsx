'use client'
import { useState, useEffect } from 'react'
import { Tile } from '@/lib/types'

interface Unlock { from_tile_id: string; to_tile_id: string }

export default function UnlockMatrix() {
  const [tiles, setTiles] = useState<Tile[]>([])
  const [unlocks, setUnlocks] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/tiles').then(r => r.json()),
      fetch('/api/admin/unlocks').then(r => r.json()),
    ]).then(([tileData, unlockData]: [Tile[], Unlock[]]) => {
      setTiles(tileData.filter(t => t.type !== 'terrain'))
      setUnlocks(new Set(unlockData.map(u => `${u.from_tile_id}:${u.to_tile_id}`)))
    })
  }, [])

  function toggle(fromId: string, toId: string) {
    if (fromId === toId) return
    const key = `${fromId}:${toId}`
    setUnlocks(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  async function save() {
    setSaving(true)
    const unlockList = Array.from(unlocks).map(k => {
      const [from, to] = k.split(':')
      return { from_tile_id: from, to_tile_id: to }
    })
    await fetch('/api/admin/unlocks', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unlocks: unlockList }),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (tiles.length === 0) return <p className="text-gray-500">Loading unlock graph...</p>

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-gray-400">
        Each row is a "completing X unlocks Y" relationship. Tick a cell to add an unlock rule.
      </p>
      <div className="overflow-auto">
        <table className="text-xs border-collapse">
          <thead>
            <tr>
              <th className="text-left text-gray-500 pr-4 pb-2 whitespace-nowrap">Completing →</th>
              {tiles.map(t => (
                <th key={t.id} className="text-gray-400 pb-2 px-2 font-normal whitespace-nowrap" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', maxWidth: 32 }}>
                  {t.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tiles.map(from => (
              <tr key={from.id} className="border-t border-gray-800">
                <td className="text-gray-300 pr-4 py-1 whitespace-nowrap">{from.name}</td>
                {tiles.map(to => (
                  <td key={to.id} className="text-center px-2 py-1">
                    {from.id === to.id
                      ? <span className="text-gray-700">—</span>
                      : <input
                          type="checkbox"
                          checked={unlocks.has(`${from.id}:${to.id}`)}
                          onChange={() => toggle(from.id, to.id)}
                          className="cursor-pointer"
                        />}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        onClick={save}
        disabled={saving}
        className="px-6 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 disabled:opacity-50 w-fit"
      >
        {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save unlock graph'}
      </button>
    </div>
  )
}
