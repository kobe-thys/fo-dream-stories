// __tests__/components/auth/LoginForm.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LoginForm from '@/components/auth/LoginForm'

describe('LoginForm', () => {
  it('renders email and password fields and a submit button', () => {
    render(<LoginForm />)
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /log in/i })).toBeInTheDocument()
  })

  it('shows validation error when submitted empty', async () => {
    render(<LoginForm />)
    await userEvent.click(screen.getByRole('button', { name: /log in/i }))
    expect(screen.getByText(/email is required/i)).toBeInTheDocument()
  })
})
