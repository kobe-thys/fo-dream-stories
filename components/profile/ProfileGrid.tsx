'use client'
import { ChildProfile } from '@/lib/types'
import ProfileCard from './ProfileCard'

interface Props {
  profiles: ChildProfile[]
  onSelect: (profile: ChildProfile) => void
  onAdd: () => void
}

export default function ProfileGrid({ profiles, onSelect, onAdd }: Props) {
  return (
    <div className="flex flex-wrap justify-center gap-4">
      {profiles.map(profile => (
        <ProfileCard key={profile.id} profile={profile} onClick={() => onSelect(profile)} />
      ))}
      {profiles.length < 4 && (
        <button
          onClick={onAdd}
          className="flex flex-col items-center gap-3 p-4 rounded-2xl hover:bg-slate-800 transition-colors w-32"
        >
          <div className="w-20 h-20 rounded-full border-2 border-dashed border-slate-600 flex items-center justify-center text-slate-400 text-3xl">
            +
          </div>
          <span className="text-slate-400 text-sm">Add dreamer</span>
        </button>
      )}
    </div>
  )
}
