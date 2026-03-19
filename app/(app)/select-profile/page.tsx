'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import ProfileGrid from '@/components/profile/ProfileGrid'
import FOMascot from '@/components/fo/FOMascot'
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
      <main className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading...</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <h1 className="text-2xl font-bold text-foreground mb-2">Who&apos;s exploring tonight?</h1>
      <p className="text-muted-foreground mb-10">Choose your dreamer</p>
      <ProfileGrid
        profiles={profiles}
        onSelect={handleSelect}
        onAdd={() => router.push('/create-profile')}
      />
      <FOMascot message="Which dreamer are we tonight?" />
    </main>
  )
}
