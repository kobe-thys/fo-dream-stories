/**
 * @jest-environment node
 */
// Mock OpenAI before importing the route
jest.mock('openai', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    audio: {
      transcriptions: {
        create: jest.fn().mockResolvedValue({ text: 'I dreamed of flying' }),
      },
    },
  })),
}))

import { POST } from '@/app/api/transcribe/route'

describe('POST /api/transcribe', () => {
  it('returns transcribed text', async () => {
    const formData = new FormData()
    formData.append('audio', new Blob([new Uint8Array(6000)], { type: 'audio/webm' }), 'audio.webm')
    const request = new Request('http://localhost/api/transcribe', {
      method: 'POST',
      body: formData,
    })
    const response = await POST(request)
    const json = await response.json()
    expect(response.status).toBe(200)
    expect(json.text).toBe('I dreamed of flying')
  })
})
