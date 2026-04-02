import { render, screen, fireEvent } from '@testing-library/react'
import DreamMode from '@/components/story/DreamMode'

describe('DreamMode', () => {
  it('renders the black screen with pulsing light', () => {
    render(<DreamMode onComplete={jest.fn()} />)
    expect(screen.getByTestId('dream-mode')).toBeInTheDocument()
  })

  it('calls onComplete on tap', () => {
    const onComplete = jest.fn()
    render(<DreamMode onComplete={onComplete} />)
    fireEvent.click(screen.getByTestId('dream-mode'))
    expect(onComplete).toHaveBeenCalled()
  })
})
