import { render, screen, fireEvent } from '@testing-library/react'
import WriteItTab from '@/components/dream/WriteItTab'

describe('WriteItTab', () => {
  it('renders a textarea', () => {
    render(<WriteItTab onSubmit={jest.fn()} />)
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('submit button is disabled when textarea is empty', () => {
    render(<WriteItTab onSubmit={jest.fn()} />)
    expect(screen.getByRole('button', { name: /use this dream/i })).toBeDisabled()
  })

  it('submit button enables when text is entered', () => {
    render(<WriteItTab onSubmit={jest.fn()} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'I flew over mountains' } })
    expect(screen.getByRole('button', { name: /use this dream/i })).not.toBeDisabled()
  })

  it('calls onSubmit with the text when submitted', () => {
    const onSubmit = jest.fn()
    render(<WriteItTab onSubmit={onSubmit} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'I flew over mountains' } })
    fireEvent.click(screen.getByRole('button', { name: /use this dream/i }))
    expect(onSubmit).toHaveBeenCalledWith('I flew over mountains')
  })
})
