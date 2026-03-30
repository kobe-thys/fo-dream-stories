import { render, screen } from '@testing-library/react'
import FOMascot from '@/components/fo/FOMascot'

describe('FOMascot', () => {
  it('renders the message text', () => {
    render(<FOMascot message="Hello, dreamer!" />)
    expect(screen.getByText('Hello, dreamer!')).toBeInTheDocument()
  })

  it('renders the FO image with correct alt text', () => {
    render(<FOMascot message="Hello!" />)
    expect(screen.getByAltText('Friendly Onion')).toBeInTheDocument()
  })

  it('renders a fallback message when no message is given', () => {
    render(<FOMascot />)
    expect(screen.getByText(/Mother Tree/i)).toBeInTheDocument()
  })
})
