'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ChildProfile, getAge } from '@/lib/types'
import FOMascot from '@/components/fo/FOMascot'

export default function SelectProfilePage() {
  const router = useRouter()
  const [profiles, setProfiles] = useState<ChildProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [managing, setManaging] = useState(false)
  const [working, setWorking] = useState<string | null>(null) // profile id being acted on

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data } = await supabase
        .from('child_profiles')
        .select('*')
        .order('created_at', { ascending: true })
      setProfiles(data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  function handleSelect(profile: ChildProfile) {
    if (managing) return
    sessionStorage.setItem('activeProfileId', profile.id)
    sessionStorage.setItem('activeProfileName', profile.name)
    router.push('/map')
  }

  async function handleReset(profile: ChildProfile) {
    if (!confirm(`Reset ${profile.name}'s map? This will clear all tile progress and dreams.`)) return
    setWorking(profile.id)
    const res = await fetch(`/api/profiles/${profile.id}/reset`, { method: 'POST' })
    setWorking(null)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      alert(`Reset failed (${res.status}): ${body.error ?? 'unknown error'}`)
      return
    }
    alert(`${profile.name}'s map has been reset.`)
  }

  async function handleRemove(profile: ChildProfile) {
    if (!confirm(`Remove ${profile.name}? This cannot be undone — all their dreams will be deleted.`)) return
    setWorking(profile.id)
    await fetch(`/api/profiles/${profile.id}`, { method: 'DELETE' })
    setProfiles(prev => prev.filter(p => p.id !== profile.id))
    setWorking(null)
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading...</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <h1 className="text-2xl font-bold text-foreground mb-2">Who&apos;s exploring tonight?</h1>
      <p className="text-muted-foreground mb-10">Choose your dreamer</p>

      <div className="flex flex-wrap justify-center gap-4">
        {profiles.map(profile => {
          const age = getAge(profile.date_of_birth)
          const initials = profile.name.slice(0, 2).toUpperCase()
          const busy = working === profile.id
          return (
            <div key={profile.id} className="flex flex-col items-center gap-2 w-32">
              <button
                onClick={() => handleSelect(profile)}
                disabled={managing || busy}
                className="flex flex-col items-center gap-3 p-4 rounded-2xl hover:bg-slate-800 transition-colors w-full disabled:opacity-60"
              >
                <div
                  className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold text-white"
                  style={{ backgroundColor: profile.avatar_color }}
                >
                  {initials}
                </div>
                <span className="text-white font-medium text-sm">{profile.name}</span>
                <span className="text-slate-400 text-xs">Age {age}</span>
              </button>

              {managing && (
                <div className="flex gap-1 w-full">
                  <button
                    onClick={() => handleReset(profile)}
                    disabled={busy}
                    className="flex-1 py-1.5 rounded-lg bg-slate-700 text-slate-300 text-xs hover:bg-slate-600 transition-colors disabled:opacity-50"
                  >
                    {busy ? '…' : 'Reset'}
                  </button>
                  <button
                    onClick={() => handleRemove(profile)}
                    disabled={busy}
                    className="flex-1 py-1.5 rounded-lg bg-red-900 text-red-300 text-xs hover:bg-red-800 transition-colors disabled:opacity-50"
                  >
                    {busy ? '…' : 'Remove'}
                  </button>
                </div>
              )}
            </div>
          )
        })}

        {profiles.length < 4 && (
          <button
            onClick={() => router.push('/create-profile')}
            className="flex flex-col items-center gap-3 p-4 rounded-2xl hover:bg-slate-800 transition-colors w-32"
          >
            <div className="w-20 h-20 rounded-full border-2 border-dashed border-slate-600 flex items-center justify-center text-slate-400 text-3xl">
              +
            </div>
            <span className="text-slate-400 text-sm">Add dreamer</span>
          </button>
        )}
      </div>

      <button
        onClick={() => setManaging(m => !m)}
        className="mt-8 text-slate-500 hover:text-slate-300 text-sm transition-colors"
      >
        {managing ? 'Done managing' : 'Manage dreamers'}
      </button>

      <FOMascot message="Which dreamer are we tonight?" />
    </main>
  )
}
