import { render, screen } from '@testing-library/react'
import DrawItTab from '@/components/dream/DrawItTab'

describe('DrawItTab', () => {
  it('renders a canvas', () => {
    render(<DrawItTab childProfileId="c1" tileId="t1" onSubmit={jest.fn()} />)
    expect(screen.getByTestId('drawing-canvas')).toBeInTheDocument()
  })

  it('submit button is disabled initially (blank canvas)', () => {
    render(<DrawItTab childProfileId="c1" tileId="t1" onSubmit={jest.fn()} />)
    expect(screen.getByRole('button', { name: /use this drawing/i })).toBeDisabled()
  })
})
