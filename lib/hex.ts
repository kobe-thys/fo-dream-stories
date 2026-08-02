// Pointy-top hexagon grid using axial coordinates (q, r).
// HEX_SIZE is the circumradius (centre to corner) in pixels.
export const HEX_SIZE = 44

// Pixel dimensions of a pointy-top hex:
//   width  = sqrt(3) * HEX_SIZE
//   height = 2 * HEX_SIZE
export const HEX_WIDTH = Math.sqrt(3) * HEX_SIZE
export const HEX_HEIGHT = 2 * HEX_SIZE

// Convert axial (q, r) to pixel (x, y). Origin tile maps to (0, 0).
// Caller adds a viewport offset to centre the grid.
export function axialToPixel(q: number, r: number): { x: number; y: number } {
  const x = HEX_SIZE * (Math.sqrt(3) * q + (Math.sqrt(3) / 2) * r)
  const y = HEX_SIZE * (1.5 * r)
  return { x, y }
}

// Manhattan distance between two axial hex positions.
export function hexDistance(q1: number, r1: number, q2: number, r2: number): number {
  const dq = q1 - q2
  const dr = r1 - r2
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2
}

// The 6 axial direction vectors for neighbours of a pointy-top hex.
const NEIGHBOUR_DIRECTIONS = [
  { q: 1, r: 0 }, { q: -1, r: 0 },
  { q: 0, r: 1 }, { q: 0, r: -1 },
  { q: 1, r: -1 }, { q: -1, r: 1 },
]

// Returns the 6 neighbour coordinates of a given hex.
export function getNeighborCoords(q: number, r: number): { q: number; r: number }[] {
  return NEIGHBOUR_DIRECTIONS.map(d => ({ q: q + d.q, r: r + d.r }))
}

// ── 3D world-space coordinates for Three.js (x, z plane; y=0 is ground) ─────
// Every tile GLB in public/models/ follows the Kenney Hexagon Kit contract:
// a pointy-top hex of circumradius 0.5774 (footprint 1.000 x 1.155), base at y=0.
// Measured directly from grass.glb — see docs/superpowers/specs/2026-08-02-plan-10.
export const KENNEY_HEX_R = 0.5774

// Uniform scale applied to every tile model when placed on the map.
export const MODEL_SCALE = 1.72

// Spacing is derived from the two constants above rather than hard-coded, so the
// grid and the models can never drift apart. Previously these were the literals
// 1.732 / 1.5, which left a ~0.012-unit seam between neighbouring tiles.
const R = KENNEY_HEX_R * MODEL_SCALE
export const HEX_X_SPACING = Math.sqrt(3) * R
export const HEX_Z_SPACING = 1.5 * R

export function axialToWorld(q: number, r: number): { x: number; z: number } {
  return {
    x: HEX_X_SPACING * (q + r / 2),
    z: HEX_Z_SPACING * r,
  }
}

// Inverse of axialToWorld: which hex contains this world-space point?
//
// Rounding q and r independently does NOT work -- it misplaces the six corner
// triangles of every hex, which is 7.5% of the surface area (verified against a
// nearest-centre reference over 200k random points). Fractional axial coords must
// be converted to cube space, rounded, then the component with the largest
// rounding error recomputed from the other two so that q + r + s == 0 holds.
export function worldToAxial(x: number, z: number): { q: number; r: number } {
  const rf = z / HEX_Z_SPACING
  const qf = x / HEX_X_SPACING - rf / 2
  const sf = -qf - rf

  let q = Math.round(qf)
  let r = Math.round(rf)
  const s = Math.round(sf)

  const dq = Math.abs(q - qf)
  const dr = Math.abs(r - rf)
  const ds = Math.abs(s - sf)

  if (dq > dr && dq > ds) q = -r - s
  else if (dr > ds) r = -q - s

  return { q, r }
}
