'use client'
import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Environment } from '@react-three/drei'
import { MappedTile } from '@/lib/types'
import DreamerHexTile from './DreamerHexTile'

interface DreamerMapCanvasProps {
  tiles: MappedTile[]
  selectedTileId: string | null
  onTileClick: (tile: MappedTile | null) => void
}

export default function DreamerMapCanvas({ tiles, selectedTileId, onTileClick }: DreamerMapCanvasProps) {
  const cx = 0
  const cz = 0

  return (
    <div style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }}>
      <Canvas
        shadows
        camera={{ position: [cx, 18, cz + 18], fov: 50 }}
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

          <OrbitControls
            target={[cx, 0, cz]}
            enableRotate={true}
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
