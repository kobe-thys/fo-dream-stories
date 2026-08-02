import { render } from '@testing-library/react'
import DreamerHexTile from '@/components/map/DreamerHexTile'
import { MappedTile } from '@/lib/types'

const mockUseGLTF = jest.fn()

jest.mock('@react-three/drei', () => ({
  useGLTF: (path: string) => mockUseGLTF(path),
}))
jest.mock('@react-three/fiber', () => ({
  useFrame: jest.fn(),
}))

function fakeScene() {
  return { clone: () => ({ traverse: () => {} }) }
}

const baseTile: MappedTile = {
  id: 't1',
  type: 'story',
  name: 'Mother Tree',
  position_q: 0,
  position_r: 0,
  terrain_type: null,
  model: 'grass.glb',
  rotation: 0,
  story_id: null,
  sensory_moment_text: null,
  scale_x: 1,
  scale_y: 1,
  scale_z: 1,
  created_at: '2026-01-01T00:00:00Z',
  childState: 'grey',
  token_image_url: null,
  story: null,
}

beforeEach(() => {
  mockUseGLTF.mockReset()
  mockUseGLTF.mockReturnValue({ scene: fakeScene() })
  jest.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe('DreamerHexTile model guard', () => {
  it('never requests a model when the tile has none', () => {
    // Regression: this used to fetch "/models/null", 404, and suspend the whole
    // Canvas forever -- blanking the entire map, not just this tile.
    render(<DreamerHexTile tile={{ ...baseTile, model: null }} isSelected={false} onClick={jest.fn()} />)
    expect(mockUseGLTF).not.toHaveBeenCalled()
  })

  it('loads the model when one is set', () => {
    render(<DreamerHexTile tile={baseTile} isSelected={false} onClick={jest.fn()} />)
    expect(mockUseGLTF).toHaveBeenCalledWith('/models/grass.glb')
  })

  it('URL-encodes model names containing spaces', () => {
    render(
      <DreamerHexTile
        tile={{ ...baseTile, model: '0 - mother tree2.glb' }}
        isSelected={false}
        onClick={jest.fn()}
      />
    )
    expect(mockUseGLTF).toHaveBeenCalledWith('/models/0%20-%20mother%20tree2.glb')
  })

  it('falls back to a placeholder when the model fails to load', () => {
    mockUseGLTF.mockImplementation(() => { throw new Error('404 loading GLB') })
    // Must not throw: the error boundary swaps in the placeholder for this tile
    // while every other tile keeps rendering.
    expect(() =>
      render(<DreamerHexTile tile={baseTile} isSelected={false} onClick={jest.fn()} />)
    ).not.toThrow()
  })
})
