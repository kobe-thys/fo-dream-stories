import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import ImageAcceptance from '@/components/dream/ImageAcceptance'
import { MappedTile } from '@/lib/types'

const tile: MappedTile = {
  id: 't1', type: 'story', name: 'The Tinkle Trunk',
  position_q: 1, position_r: 0, terrain_type: null,
  model: null, rotation: 0, story_id: 'story-1',
  sensory_moment_text: null,
  created_at: '2026-01-01T00:00:00Z',
  childState: 'revealed', token_image_url: null,
  story: {
    id: 'story-1', title: 'The Tinkle Trunk',
    story_text: null, audio_url: null, alex_dream: null,
    alex_dream_image_url: null,
    default_token_image_url: '/default.png',
    fo_image_url: null,
  },
}

global.fetch = jest.fn()

describe('ImageAcceptance', () => {
  beforeEach(() => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ imageUrl: 'https://storage.example.com/dream.png' }),
    })
  })

  it('shows loading state initially', () => {
    render(<ImageAcceptance text="flying" inputType="text" rawInputUrl={null} tile={tile} childProfileId="c1" onComplete={jest.fn()} onError={jest.fn()} />)
    expect(screen.getByText(/Creating your dream/i)).toBeInTheDocument()
  })

  it('shows the generated image after loading', async () => {
    render(<ImageAcceptance text="flying" inputType="text" rawInputUrl={null} tile={tile} childProfileId="c1" onComplete={jest.fn()} onError={jest.fn()} />)
    await waitFor(() => screen.getByAltText('Your dream'))
    expect(screen.getByAltText('Your dream')).toBeInTheDocument()
  })

  it('calls onComplete with imageUrl when Accept is clicked', async () => {
    const onComplete = jest.fn()
    render(<ImageAcceptance text="flying" inputType="text" rawInputUrl={null} tile={tile} childProfileId="c1" onComplete={onComplete} onError={jest.fn()} />)
    await waitFor(() => screen.getByText(/Accept/i))
    fireEvent.click(screen.getByText(/Accept/i))
    await waitFor(() => screen.getByText(/Back to the map/i))
    fireEvent.click(screen.getByText(/Back to the map/i))
    await waitFor(() => expect(onComplete).toHaveBeenCalledWith({ tokenImageUrl: 'https://storage.example.com/dream.png' }))
  })
})
