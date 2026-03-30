import { render, screen, fireEvent } from '@testing-library/react'
import TilePopup from '@/components/map/TilePopup'
import { MappedTile } from '@/lib/types'

const storyTile: MappedTile = {
  id: 'tile-1', type: 'story', name: 'The Tinkle Trunk',
  position_q: 1, position_r: 0, terrain_type: null,
  model: null, rotation: 0, story_id: 'story-1',
  sensory_moment_text: null,
  created_at: '2026-01-01T00:00:00Z',
  childState: 'unlocked', token_image_url: null,
  story: {
    id: 'story-1', title: 'The Tinkle Trunk',
    story_text: 'Once upon a time...',
    audio_url: null,
    alex_tip: 'Alex found a golden trumpet.',
    alex_dream_image_url: null,
    default_token_image_url: null,
    fo_image_url: null,
  },
}

const noop = () => {}

describe('TilePopup', () => {
  it('shows mode buttons for unlocked story tile', () => {
    render(<TilePopup tile={storyTile} onClose={noop} onListeningMode={noop} onReadingMode={noop} onSubmitDream={noop} onReadAgain={noop} />)
    expect(screen.getByText(/Listening mode/i)).toBeInTheDocument()
    expect(screen.getByText(/Reading mode/i)).toBeInTheDocument()
  })

  it('shows Tell us your dream for listened tile', () => {
    render(<TilePopup tile={{ ...storyTile, childState: 'listened' }} onClose={noop} onListeningMode={noop} onReadingMode={noop} onSubmitDream={noop} onReadAgain={noop} />)
    expect(screen.getByText(/Tell us your dream/i)).toBeInTheDocument()
  })

  it('shows Read it again for completed tile', () => {
    render(<TilePopup tile={{ ...storyTile, childState: 'completed' }} onClose={noop} onListeningMode={noop} onReadingMode={noop} onSubmitDream={noop} onReadAgain={noop} />)
    expect(screen.getByText(/Read it again/i)).toBeInTheDocument()
  })

  it('shows Alex Dream text in completed popup when alex_tip is set (no image)', () => {
    render(<TilePopup tile={{ ...storyTile, childState: 'completed' }} onClose={noop} onListeningMode={noop} onReadingMode={noop} onSubmitDream={noop} onReadAgain={noop} />)
    expect(screen.getByText("Alex found a golden trumpet.")).toBeInTheDocument()
  })

  it('calls onClose when backdrop is clicked', () => {
    const onClose = jest.fn()
    render(<TilePopup tile={storyTile} onClose={onClose} onListeningMode={noop} onReadingMode={noop} onSubmitDream={noop} onReadAgain={noop} />)
    fireEvent.click(screen.getByTestId('popup-backdrop'))
    expect(onClose).toHaveBeenCalled()
  })

  it('shows mode buttons for unlocked mother_tree tile', () => {
    const motherTree: MappedTile = {
      ...storyTile, type: 'mother_tree', name: 'Mother Tree', childState: 'unlocked',
    }
    render(<TilePopup tile={motherTree} onClose={noop} onListeningMode={noop} onReadingMode={noop} onSubmitDream={noop} onReadAgain={noop} />)
    expect(screen.getByText(/Listening mode/i)).toBeInTheDocument()
    expect(screen.getByText(/Reading mode/i)).toBeInTheDocument()
  })

  it('shows See Alex dream button when alex_dream_image_url is set and not completed', () => {
    render(<TilePopup tile={{ ...storyTile, story: { ...storyTile.story!, alex_dream_image_url: 'https://example.com/img.png' } }} onClose={noop} onListeningMode={noop} onReadingMode={noop} onSubmitDream={noop} onReadAgain={noop} />)
    expect(screen.getByText(/See Alex/i)).toBeInTheDocument()
  })

  it('shows token image in completed popup when token_image_url is set', () => {
    render(<TilePopup tile={{ ...storyTile, childState: 'completed', token_image_url: 'https://example.com/token.png' }} onClose={noop} onListeningMode={noop} onReadingMode={noop} onSubmitDream={noop} onReadAgain={noop} />)
    expect(screen.getByRole('img', { name: /your dream/i })).toBeInTheDocument()
  })
})
