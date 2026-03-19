// __tests__/lib/types.test.ts
import { getAge } from '@/lib/types'

describe('getAge', () => {
  // Uses fixed dates to avoid month-overflow edge cases (e.g. December + 1 month = January next year)
  it('returns correct age when birthday has already passed this year', () => {
    // Born 2000-01-15 — if today is 2026-03-19, birthday has passed → age 26
    expect(getAge('2000-01-15')).toBe(26)
  })

  it('returns correct age when birthday has not yet occurred this year', () => {
    // Born 2000-12-25 — if today is 2026-03-19, birthday not yet → age 25
    expect(getAge('2000-12-25')).toBe(25)
  })
})
