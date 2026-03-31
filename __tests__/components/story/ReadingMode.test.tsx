import { render, screen, fireEvent } from '@testing-library/react'
import ReadingMode from '@/components/story/ReadingMode'
import { MappedTile } from '@/lib/types'

const tile: MappedTile = {
  id: 't1', type: 'story', name: 'Raindrop Castle',
  position_q: 0, position_r: -1, terrain_type: null,
  model: null, rotation: 0, story_id: 'story-1',
  sensory_moment_text: null,
  created_at: '2026-01-01T00:00:00Z',
  childState: 'grey', token_image_url: null,
  story: {
    id: 'story-1', title: 'Raindrop Castle',
    story_text: 'High above the clouds lived a castle made of raindrops.',
    audio_url: null, alex_tip: null, alex_dream_image_url: null,
    default_token_image_url: null, fo_image_url: null,
  },
}

describe('ReadingMode', () => {
  it('renders the tile name', () => {
    render(<ReadingMode tile={tile} onComplete={jest.fn()} />)
    expect(screen.getByText('Raindrop Castle')).toBeInTheDocument()
  })

  it('renders the story text', () => {
    render(<ReadingMode tile={tile} onComplete={jest.fn()} />)
    expect(screen.getByText(/High above the clouds/)).toBeInTheDocument()
  })

  it('renders a placeholder when story_text is null', () => {
    render(<ReadingMode tile={{ ...tile, story: null }} onComplete={jest.fn()} />)
    expect(screen.getByText(/Story coming soon/i)).toBeInTheDocument()
  })

  it('shows DreamMode after Start dreaming is tapped', () => {
    render(<ReadingMode tile={tile} onComplete={jest.fn()} />)
    fireEvent.click(screen.getByText(/Start dreaming/i))
    expect(screen.getByTestId('dream-mode')).toBeInTheDocument()
  })
})
