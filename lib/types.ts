export interface ChildProfile {
  id: string
  family_id: string
  name: string
  date_of_birth: string // ISO date string: "2018-04-12"
  avatar_color: string  // hex colour for avatar placeholder
  created_at: string
}

export interface Family {
  id: string
  email: string
  created_at: string
}

// Derived helper — never stored, always calculated
export function getAge(dateOfBirth: string): number {
  const today = new Date()
  const dob = new Date(dateOfBirth)
  let age = today.getFullYear() - dob.getFullYear()
  const monthDiff = today.getMonth() - dob.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) age--
  return age
}
