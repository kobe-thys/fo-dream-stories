import Link from 'next/link'
import { adminClient, isAdmin } from '@/lib/admin'
import { redirect } from 'next/navigation'

export default async function StoriesPage() {
  if (!await isAdmin()) redirect('/map')
  const db = adminClient()
  const { data: stories } = await db
    .from('stories')
    .select('id, title, story_text, audio_url, alex_dream, fo_image_url')
    .order('created_at', { ascending: true })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Stories</h1>
        <Link href="/admin/stories/new" className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-500 text-sm">
          + New story
        </Link>
      </div>

      {!stories?.length && (
        <p className="text-gray-500">No stories yet. Create your first story.</p>
      )}

      <div className="flex flex-col gap-2">
        {(stories ?? []).map(s => (
          <Link
            key={s.id}
            href={`/admin/stories/${s.id}`}
            className="flex items-center justify-between bg-gray-900 border border-gray-800 rounded-xl px-5 py-4 hover:border-gray-700 transition-colors"
          >
            <span className="font-medium">{s.title}</span>
            <div className="flex gap-3 text-xs">
              <span className={s.story_text ? 'text-green-400' : 'text-gray-600'}>text {s.story_text ? '✓' : '✗'}</span>
              <span className={s.audio_url ? 'text-green-400' : 'text-gray-600'}>audio {s.audio_url ? '✓' : '✗'}</span>
              <span className={s.alex_dream ? 'text-green-400' : 'text-gray-600'}>alex dream {s.alex_dream ? '✓' : '✗'}</span>
              <span className={s.fo_image_url ? 'text-green-400' : 'text-gray-600'}>FO image {s.fo_image_url ? '✓' : '✗'}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
