/**
 * @jest-environment node
 */
jest.mock('openai', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [{ message: { content: 'A child flying over rainbow mountains' } }],
        }),
      },
    },
  })),
}))

import { POST } from '@/app/api/describe-drawing/route'

describe('POST /api/describe-drawing', () => {
  it('returns description from vision model', async () => {
    const request = new Request('http://localhost/api/describe-drawing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64: 'abc123', mimeType: 'image/png' }),
    })
    const response = await POST(request)
    const json = await response.json()
    expect(response.status).toBe(200)
    expect(json.description).toBe('A child flying over rainbow mountains')
  })
})
