import { render, screen, fireEvent, act } from '@testing-library/react'
import DreamMode from '@/components/story/DreamMode'

describe('DreamMode', () => {
  beforeEach(() => { jest.useFakeTimers() })
  afterEach(() => { jest.useRealTimers() })

  it('renders the black screen with pulsing light', () => {
    render(<DreamMode onComplete={jest.fn()} minimumSeconds={120} />)
    expect(screen.getByTestId('dream-mode')).toBeInTheDocument()
  })

  it('does not show sweet dreams message before minimum time', () => {
    render(<DreamMode onComplete={jest.fn()} minimumSeconds={120} />)
    fireEvent.click(screen.getByTestId('dream-mode'))
    expect(screen.queryByText(/Sweet dreams/i)).not.toBeInTheDocument()
  })

  it('shows sweet dreams message on first tap after minimum time', async () => {
    render(<DreamMode onComplete={jest.fn()} minimumSeconds={5} />)
    act(() => { jest.advanceTimersByTime(6000) })
    fireEvent.click(screen.getByTestId('dream-mode'))
    expect(screen.getByText(/Sweet dreams/i)).toBeInTheDocument()
  })

  it('calls onComplete on second tap after sweet dreams shown', async () => {
    const onComplete = jest.fn()
    render(<DreamMode onComplete={onComplete} minimumSeconds={5} />)
    act(() => { jest.advanceTimersByTime(6000) })
    fireEvent.click(screen.getByTestId('dream-mode'))
    fireEvent.click(screen.getByTestId('dream-mode'))
    expect(onComplete).toHaveBeenCalled()
  })
})
