/**
 * @jest-environment node
 */
// Mock fetch for downloading the OpenAI image
global.fetch = jest.fn()

jest.mock('openai', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    images: {
      generate: jest.fn().mockResolvedValue({
        data: [{ url: 'https://openai.com/image.png' }],
      }),
    },
  })),
}))

jest.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    storage: {
      from: jest.fn().mockReturnValue({
        upload: jest.fn().mockResolvedValue({ error: null }),
        getPublicUrl: jest.fn().mockReturnValue({ data: { publicUrl: 'https://storage.example.com/dream.png' } }),
      }),
    },
  }),
}))

import { POST } from '@/app/api/generate-image/route'

describe('POST /api/generate-image', () => {
  beforeEach(() => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(8)),
    })
  })

  it('returns a storage URL', async () => {
    const request = new Request('http://localhost/api/generate-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'flying', childProfileId: 'c1', tileId: 't1' }),
    })
    const response = await POST(request)
    const json = await response.json()
    expect(response.status).toBe(200)
    expect(json.imageUrl).toBe('https://storage.example.com/dream.png')
  })
})
