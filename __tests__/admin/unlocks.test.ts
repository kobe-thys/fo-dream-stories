/** @jest-environment node */
jest.mock('@/lib/admin', () => ({
  isAdmin: jest.fn(),
  adminClient: jest.fn(),
}))

import { isAdmin } from '@/lib/admin'
import { GET } from '@/app/api/admin/unlocks/route'

const mockIsAdmin = isAdmin as jest.MockedFunction<typeof isAdmin>

describe('GET /api/admin/unlocks', () => {
  it('returns 403 when not admin', async () => {
    mockIsAdmin.mockResolvedValue(false)
    const res = await GET()
    expect(res.status).toBe(403)
  })
})
