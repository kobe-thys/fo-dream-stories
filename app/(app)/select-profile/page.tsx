'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import ProfileGrid from '@/components/profile/ProfileGrid'
import { ChildProfile } from '@/lib/types'

export default function SelectProfilePage() {
  const router = useRouter()
  const [profiles, setProfiles] = useState<ChildProfile[]>([])
  const [loading, setLoading] = useState(true)

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
    sessionStorage.setItem('activeProfileId', profile.id)
    sessionStorage.setItem('activeProfileName', profile.name)
    router.push('/map')
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-950">
        <p className="text-slate-400">Loading...</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-slate-950 px-4">
      <h1 className="text-2xl font-bold text-white mb-2">Who's exploring tonight?</h1>
      <p className="text-slate-400 mb-10">Choose your dreamer</p>
      <ProfileGrid
        profiles={profiles}
        onSelect={handleSelect}
        onAdd={() => router.push('/create-profile')}
      />
    </main>
  )
}
