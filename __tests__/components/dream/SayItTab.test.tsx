import { render, screen } from '@testing-library/react'
import SayItTab from '@/components/dream/SayItTab'

describe('SayItTab', () => {
  it('renders the record button initially', () => {
    render(<SayItTab childProfileId="c1" tileId="t1" onSubmit={jest.fn()} />)
    expect(screen.getByText(/Tap to record/i)).toBeInTheDocument()
  })
})
