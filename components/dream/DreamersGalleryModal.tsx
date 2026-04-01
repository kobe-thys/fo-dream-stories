'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getAge } from '@/lib/types'

interface SharedDream {
  id: string
  token_image_url: string | null
  transcribed_text: string | null
  created_at: string
  child_profiles: {
    name: string
    date_of_birth: string
  } | null
}

interface Props {
  tileId: string
  tileName: string
  onClose: () => void
}

export default function DreamersGalleryModal({ tileId, tileName, onClose }: Props) {
  const [dreams, setDreams] = useState<SharedDream[]>([])
  const [loading, setLoading] = useState(true)
  const [enlarged, setEnlarged] = useState<SharedDream | null>(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data } = await supabase
        .from('dream_submissions')
        .select('id, token_image_url, transcribed_text, created_at, child_profiles(name, date_of_birth)')
        .eq('tile_id', tileId)
        .eq('is_shared', true)
        .order('created_at', { ascending: false })
      setDreams((data ?? []) as unknown as SharedDream[])
      setLoading(false)
    }
    load()
  }, [tileId])

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-t-3xl w-full max-w-lg p-5 pb-8"
        style={{ maxHeight: '80vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-slate-800 text-base">Other dreamers at {tileName}</h2>
          <button onClick={onClose} className="text-slate-400 text-xl leading-none">×</button>
        </div>

        {loading && <p className="text-slate-400 text-sm text-center py-6">Loading dreams...</p>}

        {!loading && dreams.length === 0 && (
          <p className="text-slate-400 text-sm text-center py-6">
            No shared dreams yet — be the first!
          </p>
        )}

        {!loading && dreams.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            {dreams.map(dream => {
              const name = dream.child_profiles?.name ?? 'Unknown'
              const age = dream.child_profiles?.date_of_birth
                ? getAge(dream.child_profiles.date_of_birth)
                : null
              return (
                <button
                  key={dream.id}
                  onClick={() => setEnlarged(dream)}
                  className="flex flex-col rounded-2xl overflow-hidden bg-slate-50 hover:bg-slate-100 transition-colors text-left"
                >
                  {dream.token_image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={dream.token_image_url}
                      alt={`${name}'s dream`}
                      className="w-full aspect-square object-cover"
                    />
                  ) : (
                    <div className="w-full aspect-square bg-slate-200 flex items-center justify-center text-3xl">
                      🌙
                    </div>
                  )}
                  <div className="px-2 py-1.5">
                    <p className="text-slate-700 text-xs font-semibold">
                      {name}{age !== null ? `, age ${age}` : ''}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Enlarged view */}
      {enlarged && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center p-6"
          style={{ backgroundColor: 'rgba(0,0,0,0.85)' }}
          onClick={() => setEnlarged(null)}
        >
          <div className="bg-white rounded-2xl overflow-hidden max-w-sm w-full" onClick={e => e.stopPropagation()}>
            {enlarged.token_image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={enlarged.token_image_url} alt="dream" className="w-full object-cover" />
            )}
            <div className="p-4">
              <p className="font-semibold text-slate-800 text-sm mb-1">
                {enlarged.child_profiles?.name ?? 'Unknown'}
                {enlarged.child_profiles?.date_of_birth
                  ? `, age ${getAge(enlarged.child_profiles.date_of_birth)}`
                  : ''}
              </p>
              {enlarged.transcribed_text && (
                <p className="text-slate-600 text-sm leading-snug">{enlarged.transcribed_text}</p>
              )}
              <button onClick={() => setEnlarged(null)} className="mt-3 text-slate-400 text-xs">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
