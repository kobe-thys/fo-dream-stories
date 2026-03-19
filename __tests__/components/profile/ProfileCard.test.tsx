import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ProfileCard from '@/components/profile/ProfileCard'

const profile = {
  id: '1', family_id: 'f1', name: 'Emma',
  date_of_birth: '2017-03-01', avatar_color: '#7c3aed', created_at: ''
}

describe('ProfileCard', () => {
  it('renders child name', () => {
    render(<ProfileCard profile={profile} onClick={() => {}} />)
    expect(screen.getByText('Emma')).toBeInTheDocument()
  })

  it('calls onClick when clicked', async () => {
    const onClick = jest.fn()
    render(<ProfileCard profile={profile} onClick={onClick} />)
    await userEvent.click(screen.getByText('Emma'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
