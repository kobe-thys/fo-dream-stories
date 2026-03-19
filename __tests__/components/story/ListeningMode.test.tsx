import { render, screen, waitFor } from '@testing-library/react'
import ListeningMode from '@/components/story/ListeningMode'
import { MappedTile } from '@/lib/types'

const tile: MappedTile = {
  id: 't1', type: 'story', name: 'The Tinkle Trunk',
  position_q: 1, position_r: 0, terrain_type: null,
  story_text: 'Once upon a time there was a trunk.', audio_url: null,
  alex_tip: null, alex_dream_image_url: null,
  sensory_moment_text: null, default_token_image_url: null,
  created_at: '2026-01-01T00:00:00Z',
  childState: 'unlocked', token_image_url: null,
}

// Mock speechSynthesis
const mockSpeak = jest.fn()
const mockCancel = jest.fn()
Object.defineProperty(window, 'speechSynthesis', {
  value: { speak: mockSpeak, cancel: mockCancel, speaking: false },
  writable: true,
})
Object.defineProperty(window, 'SpeechSynthesisUtterance', {
  value: class { onend: (() => void) | null = null; text = '' },
  writable: true,
})

describe('ListeningMode', () => {
  beforeEach(() => { mockSpeak.mockClear(); mockCancel.mockClear() })

  it('shows loading state initially', () => {
    render(<ListeningMode tile={tile} onComplete={jest.fn()} onFallback={jest.fn()} />)
    expect(screen.getByText(/Preparing/i)).toBeInTheDocument()
  })

  it('calls speechSynthesis.speak when tile has no audio_url', async () => {
    render(<ListeningMode tile={tile} onComplete={jest.fn()} onFallback={jest.fn()} />)
    await waitFor(() => expect(mockSpeak).toHaveBeenCalled())
  })
})
