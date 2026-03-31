'use client'
import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { MapControls, Environment } from '@react-three/drei'
import { MappedTile } from '@/lib/types'
import { axialToWorld } from '@/lib/hex'
import DreamerHexTile from './DreamerHexTile'

interface DreamerMapCanvasProps {
  tiles: MappedTile[]
  selectedTileId: string | null
  onTileClick: (tile: MappedTile | null) => void
}

export default function DreamerMapCanvas({ tiles, selectedTileId, onTileClick }: DreamerMapCanvasProps) {
  // Centre camera on Mother Tree
  const motherTile = tiles.find(t => t.type === 'mother_tree')
  const { x: mx, z: mz } = motherTile
    ? axialToWorld(motherTile.position_q, motherTile.position_r)
    : { x: 0, z: 0 }

  return (
    <div style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }}>
      <Canvas
        shadows
        camera={{ position: [mx, 12, mz + 22], fov: 50 }}
        onPointerMissed={() => onTileClick(null)}
      >
        <Suspense fallback={null}>
          {/* Lighting */}
          <ambientLight intensity={0.8} />
          <directionalLight
            position={[10, 20, 10]}
            intensity={1}
            castShadow
            shadow-mapSize-width={1024}
            shadow-mapSize-height={1024}
          />

          {/* Environment for ambient reflections */}
          <Environment preset="sunset" />

          {/* Controls: pan + zoom only, no rotation */}
          <MapControls
            target={[mx, 0, mz]}
            enableRotate={false}
            enablePan={true}
            enableZoom={true}
            minDistance={8}
            maxDistance={50}
            screenSpacePanning={false}
          />

          {/* Tiles (skip undefined-type tiles) */}
          {tiles
            .filter(t => t.type !== 'undefined')
            .map(tile => (
              <DreamerHexTile
                key={tile.id}
                tile={tile}
                isSelected={selectedTileId === tile.id}
                onClick={onTileClick}
              />
            ))
          }
        </Suspense>
      </Canvas>
    </div>
  )
}
