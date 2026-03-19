'use client'
import { useEffect, useState } from 'react'

export default function MapPage() {
  const [profileName, setProfileName] = useState('')

  useEffect(() => {
    const name = sessionStorage.getItem('activeProfileName') ?? 'Dreamer'
    setProfileName(name)
  }, [])

  return (
    <main className="min-h-screen bg-slate-950 flex flex-col items-center justify-center">
      <h1 className="text-white text-xl font-bold mb-2">
        {profileName}'s Dream World
      </h1>
      <p className="text-slate-400 text-sm">The map is coming soon...</p>
    </main>
  )
}
