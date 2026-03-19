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
