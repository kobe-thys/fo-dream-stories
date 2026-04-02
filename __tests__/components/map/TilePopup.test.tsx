import { render, screen, fireEvent } from '@testing-library/react'
import TilePopup from '@/components/map/TilePopup'
import { MappedTile } from '@/lib/types'

const storyTile: MappedTile = {
  id: 'tile-1', type: 'story', name: 'The Tinkle Trunk',
  position_q: 1, position_r: 0, terrain_type: null,
  model: null, rotation: 0, story_id: 'story-1',
  sensory_moment_text: null,
  created_at: '2026-01-01T00:00:00Z',
  childState: 'grey', token_image_url: null,
  story: {
    id: 'story-1', title: 'The Tinkle Trunk',
    story_text: 'Once upon a time...',
    audio_url: null,
    alex_dream: 'Alex found a golden trumpet.',
    alex_dream_image_url: null,
    default_token_image_url: null,
    fo_image_url: null,
  },
}

const noop = () => {}

describe('TilePopup', () => {
  it('shows listen + read buttons for grey story tile', () => {
    render(<TilePopup tile={storyTile} onClose={noop} onListeningMode={noop} onReadingMode={noop} onSubmitDream={noop} onReadAgain={noop} />)
    expect(screen.getByText(/Listen$/i)).toBeInTheDocument()
    expect(screen.getByText(/Read$/i)).toBeInTheDocument()
  })

  it('shows submit dream for revealed tile', () => {
    render(<TilePopup tile={{ ...storyTile, childState: 'revealed' }} onClose={noop} onListeningMode={noop} onReadingMode={noop} onSubmitDream={noop} onReadAgain={noop} />)
    expect(screen.getByText(/Submit my dream/i)).toBeInTheDocument()
  })

  it('shows listen/read again + submit new dream for completed tile', () => {
    render(<TilePopup tile={{ ...storyTile, childState: 'completed' }} onClose={noop} onListeningMode={noop} onReadingMode={noop} onSubmitDream={noop} onReadAgain={noop} />)
    expect(screen.getByText(/Listen \/ read again/i)).toBeInTheDocument()
    expect(screen.getByText(/Submit new dream/i)).toBeInTheDocument()
  })

  it('calls onClose when backdrop is clicked', () => {
    const onClose = jest.fn()
    render(<TilePopup tile={storyTile} onClose={onClose} onListeningMode={noop} onReadingMode={noop} onSubmitDream={noop} onReadAgain={noop} />)
    fireEvent.click(screen.getByTestId('popup-backdrop'))
    expect(onClose).toHaveBeenCalled()
  })

  it('shows FO landscape message for terrain tile', () => {
    const terrain: MappedTile = { ...storyTile, type: 'terrain', childState: 'grey', story: null, story_id: null }
    render(<TilePopup tile={terrain} onClose={noop} onListeningMode={noop} onReadingMode={noop} onSubmitDream={noop} onReadAgain={noop} />)
    expect(screen.getByText(/No story here/i)).toBeInTheDocument()
  })

  it('shows listen + read for grey story tile (second)', () => {
    const storyTile2: MappedTile = { ...storyTile, type: 'story', name: 'Another Story', childState: 'grey' }
    render(<TilePopup tile={storyTile2} onClose={noop} onListeningMode={noop} onReadingMode={noop} onSubmitDream={noop} onReadAgain={noop} />)
    expect(screen.getByText(/Listen$/i)).toBeInTheDocument()
    expect(screen.getByText(/Read$/i)).toBeInTheDocument()
  })

  it('shows token image in completed popup when token_image_url is set', () => {
    render(<TilePopup tile={{ ...storyTile, childState: 'completed', token_image_url: 'https://example.com/token.png' }} onClose={noop} onListeningMode={noop} onReadingMode={noop} onSubmitDream={noop} onReadAgain={noop} />)
    expect(screen.getByRole('img', { name: /your dream/i })).toBeInTheDocument()
  })
})
