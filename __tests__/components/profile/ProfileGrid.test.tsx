import { render, screen } from '@testing-library/react'
import ProfileGrid from '@/components/profile/ProfileGrid'

const profiles = [
  { id: '1', family_id: 'f1', name: 'Emma', date_of_birth: '2017-03-01', avatar_color: '#7c3aed', created_at: '' },
  { id: '2', family_id: 'f1', name: 'Lucas', date_of_birth: '2019-07-14', avatar_color: '#1d4ed8', created_at: '' },
]

describe('ProfileGrid', () => {
  it('renders all profiles', () => {
    render(<ProfileGrid profiles={profiles} onSelect={() => {}} onAdd={() => {}} />)
    expect(screen.getByText('Emma')).toBeInTheDocument()
    expect(screen.getByText('Lucas')).toBeInTheDocument()
  })

  it('shows add button when fewer than 4 profiles', () => {
    render(<ProfileGrid profiles={profiles} onSelect={() => {}} onAdd={() => {}} />)
    expect(screen.getByRole('button', { name: /add/i })).toBeInTheDocument()
  })

  it('hides add button when 4 profiles exist', () => {
    const fourProfiles = [...profiles,
      { id: '3', family_id: 'f1', name: 'Zara', date_of_birth: '2020-01-01', avatar_color: '#166534', created_at: '' },
      { id: '4', family_id: 'f1', name: 'Sam', date_of_birth: '2015-06-30', avatar_color: '#b45309', created_at: '' },
    ]
    render(<ProfileGrid profiles={fourProfiles} onSelect={() => {}} onAdd={() => {}} />)
    expect(screen.queryByRole('button', { name: /add/i })).not.toBeInTheDocument()
  })
})
