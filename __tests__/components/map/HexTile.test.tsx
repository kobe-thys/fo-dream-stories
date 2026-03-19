import { render, screen, fireEvent } from '@testing-library/react'
import HexTile from '@/components/map/HexTile'
import { MappedTile } from '@/lib/types'

const baseTile: MappedTile = {
  id: 'tile-1',
  type: 'story',
  name: 'The Tinkle Trunk',
  position_q: 1,
  position_r: 0,
  terrain_type: null,
  story_text: null,
  audio_url: null,
  alex_tip: null,
  sensory_moment_text: null,
  default_token_image_url: null,
  created_at: '2026-01-01T00:00:00Z',
  childState: 'unlocked',
}

describe('HexTile', () => {
  it('renders tile name for unlocked story tiles', () => {
    render(<HexTile tile={baseTile} x={0} y={0} />)
    expect(screen.getByText('The Tinkle Trunk')).toBeInTheDocument()
  })

  it('renders tile name for locked story tiles', () => {
    render(<HexTile tile={{ ...baseTile, childState: 'locked' }} x={0} y={0} />)
    expect(screen.getByText('The Tinkle Trunk')).toBeInTheDocument()
  })

  it('does not render name for locked terrain tiles', () => {
    const terrainTile: MappedTile = {
      ...baseTile,
      type: 'terrain',
      name: 'Forest Path',
      terrain_type: 'forest',
      childState: 'locked',
    }
    render(<HexTile tile={terrainTile} x={0} y={0} />)
    expect(screen.queryByText('Forest Path')).not.toBeInTheDocument()
  })

  it('renders Mother Tree with its own data-type attribute', () => {
    const motherTree: MappedTile = {
      ...baseTile,
      type: 'mother_tree',
      name: 'Mother Tree',
      childState: 'unlocked',
    }
    const { container } = render(<HexTile tile={motherTree} x={0} y={0} />)
    expect(container.querySelector('[data-type="mother_tree"]')).toBeInTheDocument()
  })

  it('calls onClick when an unlocked tile is clicked', () => {
    const onClick = jest.fn()
    render(<HexTile tile={baseTile} x={0} y={0} onClick={onClick} />)
    const hexEl = screen.getByText('The Tinkle Trunk').closest('[data-type]')!
    fireEvent.click(hexEl)
    expect(onClick).toHaveBeenCalledWith(baseTile)
  })
})
