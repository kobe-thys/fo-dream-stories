'use client'
import { useEffect, useState } from 'react'

interface Stats {
  familyCount: number
  profileCount: number
  submissionCount: number
  sharedCount: number
  topStories: { name: string; count: number }[]
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
      <p className="text-3xl font-bold text-white">{value}</p>
      <p className="text-sm text-gray-400 mt-1">{label}</p>
    </div>
  )
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    fetch('/api/admin/stats').then(r => r.json()).then(setStats)
  }, [])

  if (!stats) return <p className="text-gray-500">Loading stats...</p>

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Families" value={stats.familyCount} />
        <StatCard label="Child profiles" value={stats.profileCount} />
        <StatCard label="Dream submissions" value={stats.submissionCount} />
        <StatCard label="Shared dreams" value={stats.sharedCount} />
      </div>
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-4">Top stories by submissions</h2>
        {stats.topStories.length === 0
          ? <p className="text-gray-500 text-sm">No submissions yet.</p>
          : stats.topStories.map(s => (
            <div key={s.name} className="flex justify-between py-2 border-b border-gray-800 last:border-0">
              <span className="text-gray-200 text-sm">{s.name}</span>
              <span className="text-gray-400 text-sm">{s.count}</span>
            </div>
          ))}
      </div>
    </div>
  )
}
