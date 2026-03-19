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

// ── Map types ──────────────────────────────────────────────────────────────

export type TileType = 'mother_tree' | 'story' | 'terrain'
export type TerrainType = 'forest' | 'land' | 'water' | 'mountain'
// Note: 'locked' has been retired. Tiles with no child_tile_states row are invisible.
export type TileState = 'revealed' | 'unlocked' | 'listened' | 'completed'

export interface Tile {
  id: string
  type: TileType
  name: string
  position_q: number
  position_r: number
  terrain_type: TerrainType | null
  story_text: string | null
  audio_url: string | null
  alex_tip: string | null
  alex_dream_image_url: string | null
  sensory_moment_text: string | null
  default_token_image_url: string | null
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

// Tile enriched with the child's current state + latest dream token
export interface MappedTile extends Tile {
  childState: TileState
  token_image_url: string | null  // from latest dream_submissions row for this child+tile
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
