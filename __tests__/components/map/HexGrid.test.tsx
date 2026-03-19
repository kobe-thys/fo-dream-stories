import { render, screen, fireEvent } from '@testing-library/react'
import HexGrid from '@/components/map/HexGrid'
import { MappedTile } from '@/lib/types'

jest.mock('react-zoom-pan-pinch', () => ({
  TransformWrapper: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TransformComponent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

function makeTile(id: string, q: number, r: number, state: MappedTile['childState'] = 'unlocked'): MappedTile {
  return {
    id,
    type: 'story',
    name: `Tile ${id}`,
    position_q: q,
    position_r: r,
    terrain_type: null,
    story_text: null,
    audio_url: null,
    alex_tip: null,
    alex_dream_image_url: null,
    sensory_moment_text: null,
    default_token_image_url: null,
    created_at: '2026-01-01T00:00:00Z',
    childState: state,
    token_image_url: null,
  }
}

describe('HexGrid', () => {
  it('renders a tile for each entry in the tiles array', () => {
    const tiles = [makeTile('1', 0, 0), makeTile('2', 1, 0), makeTile('3', -1, 0)]
    render(<HexGrid tiles={tiles} />)
    expect(screen.getAllByText(/^Tile /)).toHaveLength(3)
  })

  it('calls onTileClick with the correct tile when a tile is clicked', () => {
    const onClick = jest.fn()
    const tiles = [makeTile('1', 0, 0)]
    render(<HexGrid tiles={tiles} onTileClick={onClick} />)
    fireEvent.click(screen.getByText('Tile 1'))
    expect(onClick).toHaveBeenCalledWith(tiles[0])
  })
})
