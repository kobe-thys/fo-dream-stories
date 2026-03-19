import { storagePath } from '@/lib/storage'

describe('storagePath', () => {
  it('returns a path with the correct prefix', () => {
    const path = storagePath('child-1', 'tile-1', 'png')
    expect(path.startsWith('child-1/tile-1/')).toBe(true)
  })

  it('ends with the correct extension', () => {
    const path = storagePath('child-1', 'tile-1', 'webm')
    expect(path.endsWith('.webm')).toBe(true)
  })

  it('generates unique paths on each call', () => {
    const a = storagePath('c', 't', 'png')
    const b = storagePath('c', 't', 'png')
    expect(a).not.toBe(b)
  })
})
