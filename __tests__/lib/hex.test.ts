import {
  HEX_SIZE, axialToPixel, hexDistance, getNeighborCoords,
  axialToWorld, worldToAxial, HEX_X_SPACING, HEX_Z_SPACING, KENNEY_HEX_R, MODEL_SCALE,
} from '@/lib/hex'

describe('axialToPixel', () => {
  it('returns (0, 0) for origin tile', () => {
    const { x, y } = axialToPixel(0, 0)
    expect(x).toBe(0)
    expect(y).toBe(0)
  })

  it('returns correct x for (1, 0) — one step right', () => {
    const { x } = axialToPixel(1, 0)
    expect(x).toBeCloseTo(HEX_SIZE * Math.sqrt(3))
  })

  it('returns 0 y for (1, 0) — same row', () => {
    const { y } = axialToPixel(1, 0)
    expect(y).toBe(0)
  })

  it('returns correct y for (0, 1) — one row down', () => {
    const { y } = axialToPixel(0, 1)
    expect(y).toBeCloseTo(HEX_SIZE * 1.5)
  })
})

describe('hexDistance', () => {
  it('returns 0 for the same tile', () => {
    expect(hexDistance(0, 0, 0, 0)).toBe(0)
  })

  it('returns 1 for each of the 6 direct neighbours', () => {
    expect(hexDistance(0, 0, 1, 0)).toBe(1)
    expect(hexDistance(0, 0, -1, 0)).toBe(1)
    expect(hexDistance(0, 0, 0, 1)).toBe(1)
    expect(hexDistance(0, 0, 0, -1)).toBe(1)
    expect(hexDistance(0, 0, 1, -1)).toBe(1)
    expect(hexDistance(0, 0, -1, 1)).toBe(1)
  })

  it('returns 2 for two steps away', () => {
    expect(hexDistance(0, 0, 2, 0)).toBe(2)
  })
})

describe('world-space spacing', () => {
  it('derives spacing from the Kenney hex radius and model scale', () => {
    const R = KENNEY_HEX_R * MODEL_SCALE
    expect(HEX_X_SPACING).toBeCloseTo(Math.sqrt(3) * R, 6)
    expect(HEX_Z_SPACING).toBeCloseTo(1.5 * R, 6)
  })

  it('places neighbouring tiles exactly one tile-width apart', () => {
    const a = axialToWorld(0, 0)
    const b = axialToWorld(1, 0)
    expect(Math.hypot(b.x - a.x, b.z - a.z)).toBeCloseTo(HEX_X_SPACING, 6)
  })
})

describe('worldToAxial', () => {
  it('round-trips every tile centre in the map range', () => {
    for (let q = -6; q <= 6; q++) {
      for (let r = -6; r <= 6; r++) {
        const { x, z } = axialToWorld(q, r)
        expect(worldToAxial(x, z)).toEqual({ q, r })
      }
    }
  })

  // The regression this fixes: rounding q and r independently misplaces the six
  // corner triangles of every hex. Brute force over the true nearest centre is
  // the ground truth -- for a regular hex grid the Voronoi cells ARE the hexes.
  it('agrees with the nearest tile centre for arbitrary points', () => {
    function nearest(x: number, z: number) {
      let best = { q: 0, r: 0 }
      let bestD = Infinity
      for (let q = -10; q <= 10; q++) {
        for (let r = -10; r <= 10; r++) {
          const c = axialToWorld(q, r)
          const d = (c.x - x) ** 2 + (c.z - z) ** 2
          if (d < bestD) { bestD = d; best = { q, r } }
        }
      }
      return best
    }

    let seed = 12345
    const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff }

    let mismatches = 0
    for (let i = 0; i < 4000; i++) {
      const x = (rand() - 0.5) * 20
      const z = (rand() - 0.5) * 16
      const got = worldToAxial(x, z)
      const want = nearest(x, z)
      if (got.q !== want.q || got.r !== want.r) mismatches++
    }
    expect(mismatches).toBe(0)
  })

  it('resolves points near a shared hex corner to the nearer tile', () => {
    // A point nudged just inside tile (1,0) from the (0,0)/(1,0) boundary.
    const a = axialToWorld(0, 0)
    const b = axialToWorld(1, 0)
    const justPastMidpoint = { x: (a.x + b.x) / 2 + 0.01, z: (a.z + b.z) / 2 }
    expect(worldToAxial(justPastMidpoint.x, justPastMidpoint.z)).toEqual({ q: 1, r: 0 })
  })
})

describe('getNeighborCoords', () => {
  it('returns exactly 6 neighbours', () => {
    expect(getNeighborCoords(0, 0)).toHaveLength(6)
  })

  it('includes all 6 expected neighbour coordinates for origin', () => {
    const neighbours = getNeighborCoords(0, 0)
    expect(neighbours).toContainEqual({ q: 1, r: 0 })
    expect(neighbours).toContainEqual({ q: -1, r: 0 })
    expect(neighbours).toContainEqual({ q: 0, r: 1 })
    expect(neighbours).toContainEqual({ q: 0, r: -1 })
    expect(neighbours).toContainEqual({ q: 1, r: -1 })
    expect(neighbours).toContainEqual({ q: -1, r: 1 })
  })
})
