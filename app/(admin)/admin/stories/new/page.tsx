import { adminClient, isAdmin } from '@/lib/admin'
import { redirect } from 'next/navigation'
import StoryForm from '@/components/admin/StoryForm'
import { Story } from '@/lib/types'

const EMPTY_STORY: Story = {
  id: '',
  title: '',
  story_text: null,
  audio_url: null,
  alex_dream: null,
  alex_dream_image_url: null,
  default_token_image_url: null,
  fo_image_url: null,
}

export default async function NewStoryPage() {
  if (!await isAdmin()) redirect('/map')

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">New Story</h1>
      <StoryForm story={EMPTY_STORY} isNew />
    </div>
  )
}
