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
  is_admin: boolean
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

// ── Story ────────────────────────────────────────────────────────────────────

export interface Story {
  id: string
  title: string
  story_text: string | null
  audio_url: string | null
  alex_dream: string | null
  default_token_image_url: string | null
  alex_dream_image_url: string | null
  fo_image_url: string | null
  created_at?: string
}

// ── Map types ────────────────────────────────────────────────────────────────

export type TileType = 'undefined' | 'story' | 'terrain'
export type TerrainType = 'forest' | 'land' | 'water' | 'mountain'
export type TileState = 'grey' | 'revealed' | 'completed'

export interface Tile {
  id: string
  type: TileType
  name: string | null
  position_q: number
  position_r: number
  terrain_type: TerrainType | null
  model: string | null
  rotation: number
  story_id: string | null
  sensory_moment_text: string | null
  created_at: string
}

export interface ChildTileState {
  id: string
  child_profile_id: string
  tile_id: string
  state: TileState
  listened_at: string | null
  completed_at: string | null
}

// Tile enriched with the child's current state + latest dream token + joined story
export interface MappedTile extends Tile {
  childState: TileState
  token_image_url: string | null
  story: Story | null
}

export interface DreamSubmission {
  id: string
  child_profile_id: string
  tile_id: string
  input_type: 'text' | 'voice' | 'drawing'
  raw_input_url: string | null
  transcribed_text: string | null
  generated_image_url: string | null
  token_image_url: string | null
  is_shared: boolean
  created_at: string
}

export interface AppSettings {
  id: 1
  beta_cap: number
  beta_open: boolean
}
