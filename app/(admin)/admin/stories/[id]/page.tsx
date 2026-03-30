import { adminClient, isAdmin } from '@/lib/admin'
import { redirect, notFound } from 'next/navigation'
import StoryForm from '@/components/admin/StoryForm'

export default async function StoryEditPage({ params }: { params: Promise<{ id: string }> }) {
  if (!await isAdmin()) redirect('/map')
  const { id } = await params
  const db = adminClient()
  const { data, error } = await db.from('stories').select('*').eq('id', id).single()
  if (error || !data) notFound()

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">{data.title}</h1>
      <StoryForm story={data} />
    </div>
  )
}
