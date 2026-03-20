/**
 * @jest-environment node
 */
jest.mock('@/lib/admin', () => ({
  isAdmin: jest.fn(),
  adminClient: jest.fn(),
}))

import { isAdmin, adminClient } from '@/lib/admin'
import { GET, POST } from '@/app/api/admin/tiles/route'

const mockIsAdmin = isAdmin as jest.MockedFunction<typeof isAdmin>
const mockAdminClient = adminClient as jest.MockedFunction<typeof adminClient>

describe('GET /api/admin/tiles', () => {
  it('returns 403 when not admin', async () => {
    mockIsAdmin.mockResolvedValue(false)
    const res = await GET()
    expect(res.status).toBe(403)
  })

  it('returns tile list when admin', async () => {
    mockIsAdmin.mockResolvedValue(true)
    mockAdminClient.mockReturnValue({
      from: () => ({
        select: () => ({
          order: () => ({
            order: () => ({ data: [{ id: '1', name: 'Mother Tree', type: 'mother_tree' }], error: null }),
          }),
        }),
      }),
    } as any)
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
  })
})
