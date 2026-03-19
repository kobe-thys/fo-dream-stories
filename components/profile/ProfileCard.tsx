'use client'
import { ChildProfile, getAge } from '@/lib/types'

interface Props {
  profile: ChildProfile
  onClick: () => void
}

export default function ProfileCard({ profile, onClick }: Props) {
  const age = getAge(profile.date_of_birth)
  const initials = profile.name.slice(0, 2).toUpperCase()

  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-3 p-4 rounded-2xl hover:bg-slate-800 transition-colors w-32"
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
  )
}
