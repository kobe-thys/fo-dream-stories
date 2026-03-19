import { HEX_SIZE, axialToPixel, hexDistance, getNeighborCoords } from '@/lib/hex'

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
