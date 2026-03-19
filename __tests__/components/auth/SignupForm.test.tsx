// __tests__/components/auth/SignupForm.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SignupForm from '@/components/auth/SignupForm'

describe('SignupForm', () => {
  it('renders email, password, and confirm password fields', () => {
    render(<SignupForm />)
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    expect(screen.getByLabelText('Confirm password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument()
  })

  it('shows error when passwords do not match', async () => {
    render(<SignupForm />)
    await userEvent.type(screen.getByLabelText('Password'), 'abc123')
    await userEvent.type(screen.getByLabelText('Confirm password'), 'xyz999')
    await userEvent.click(screen.getByRole('button', { name: /create account/i }))
    expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument()
  })
})
