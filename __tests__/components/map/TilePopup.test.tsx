import { render, screen, fireEvent } from '@testing-library/react'
import TilePopup from '@/components/map/TilePopup'
import { MappedTile } from '@/lib/types'

const storyTile: MappedTile = {
  id: 'tile-1', type: 'story', name: 'The Tinkle Trunk',
  position_q: 1, position_r: 0, terrain_type: null,
  story_text: 'Once upon a time...', audio_url: null,
  alex_tip: 'Alex found a golden trumpet.', alex_dream_image_url: null,
  sensory_moment_text: null, default_token_image_url: null,
  created_at: '2026-01-01T00:00:00Z',
  childState: 'unlocked', token_image_url: null,
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

  it('shows Alex Dream text in completed popup when alex_tip is set', () => {
    render(<TilePopup tile={{ ...storyTile, childState: 'completed' }} onClose={noop} onListeningMode={noop} onReadingMode={noop} onSubmitDream={noop} onReadAgain={noop} />)
    expect(screen.getByText("Alex found a golden trumpet.")).toBeInTheDocument()
  })

  it('calls onClose when backdrop is clicked', () => {
    const onClose = jest.fn()
    render(<TilePopup tile={storyTile} onClose={onClose} onListeningMode={noop} onReadingMode={noop} onSubmitDream={noop} onReadAgain={noop} />)
    fireEvent.click(screen.getByTestId('popup-backdrop'))
    expect(onClose).toHaveBeenCalled()
  })

  it('shows FO welcome for mother_tree tile (no mode buttons)', () => {
    const motherTree: MappedTile = {
      ...storyTile, type: 'mother_tree', name: 'Mother Tree', childState: 'unlocked',
    }
    render(<TilePopup tile={motherTree} onClose={noop} onListeningMode={noop} onReadingMode={noop} onSubmitDream={noop} onReadAgain={noop} />)
    expect(screen.queryByText(/Listening mode/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Reading mode/i)).not.toBeInTheDocument()
    expect(screen.getByText(/heart of the dream world/i)).toBeInTheDocument()
  })
})
