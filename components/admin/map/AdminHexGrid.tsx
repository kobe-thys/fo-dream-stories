'use client'
import { Suspense, useMemo, useCallback } from 'react'
import { Canvas, type ThreeEvent } from '@react-three/fiber'
import { OrbitControls, Environment, ContactShadows } from '@react-three/drei'
import { HEX_X_SPACING, HEX_Z_SPACING } from '@/lib/hex'
import AdminHexTile, { AdminTile } from './AdminHexTile'

function axialFromWorld(x: number, z: number): { q: number; r: number } {
  const r = Math.round(z / HEX_Z_SPACING)
  const q = Math.round(x / HEX_X_SPACING - r / 2)
  return { q, r }
}

interface Props {
  tiles: AdminTile[]
  selectedTileId: string | null
  isMoving: boolean
  isLinkingMode: boolean
  linkedTileIds: Set<string>
  allUnlocks: { from_tile_id: string; to_tile_id: string }[]
  onTileClick: (id: string, shiftKey: boolean, ctrlKey: boolean) => void
  onEmptyClick: (q: number, r: number) => void
  onDeselect: () => void
}

export default function AdminHexGrid({
  tiles, selectedTileId, isMoving, isLinkingMode, linkedTileIds, allUnlocks,
  onTileClick, onEmptyClick, onDeselect,
}: Props) {
  const tilePositions = useMemo(
    () => new Set(tiles.map(t => `${t.position_q},${t.position_r}`)),
    [tiles]
  )

  const handleGroundClick = useCallback((e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 5) return // drag, not click
    const { q, r } = axialFromWorld(e.point.x, e.point.z)
    if (tilePositions.has(`${q},${r}`)) return
    if (isMoving && selectedTileId) {
      onEmptyClick(q, r)
    } else if (!isLinkingMode) {
      if (selectedTileId) {
        onDeselect()
      } else {
        onEmptyClick(q, r)
      }
    }
  }, [tilePositions, isMoving, isLinkingMode, selectedTileId, onEmptyClick, onDeselect])

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <Canvas
        shadows
        camera={{ position: [15, 15, 15], fov: 35 }}
        onPointerMissed={onDeselect}
      >
        <Suspense fallback={null}>
          <ambientLight intensity={1} />
          <directionalLight position={[10, 20, 10]} intensity={1.2} castShadow />
          <Environment preset="city" />
          <OrbitControls makeDefault />

          {tiles.map(tile => {
            const isLinkedToSelected = isLinkingMode && linkedTileIds.has(tile.id)
            // A tile is blocked if it unlocks a DIFFERENT story tile (not the current selected)
            const linkedFrom = allUnlocks.find(u => u.to_tile_id === tile.id)?.from_tile_id
            const isBlockedByOtherStory = isLinkingMode &&
              linkedFrom !== undefined &&
              linkedFrom !== selectedTileId

            return (
              <AdminHexTile
                key={tile.id}
                tile={tile}
                isSelected={tile.id === selectedTileId}
                isMoving={isMoving && tile.id === selectedTileId}
                isLinkedToSelected={isLinkedToSelected}
                isBlockedByOtherStory={isBlockedByOtherStory}
                onClick={onTileClick}
              />
            )
          })}

          {/* Invisible ground plane for click detection */}
          <mesh
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, -0.01, 0]}
            onClick={handleGroundClick}
          >
            <planeGeometry args={[200, 200]} />
            <meshStandardMaterial transparent opacity={0} />
          </mesh>

          <ContactShadows position={[0, -0.01, 0]} opacity={0.3} scale={50} blur={2} />
        </Suspense>
      </Canvas>
    </div>
  )
}
