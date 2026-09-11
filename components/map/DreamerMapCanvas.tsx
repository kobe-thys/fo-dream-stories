'use client'
import { Suspense, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { MappedTile } from '@/lib/types'
import DreamerHexTile from './DreamerHexTile'
import DreamAtmosphere from './DreamAtmosphere'
import MapCompass from './MapCompass'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'

interface DreamerMapCanvasProps {
  tiles: MappedTile[]
  selectedTileId: string | null
  onTileClick: (tile: MappedTile | null) => void
}

export default function DreamerMapCanvas({ tiles, selectedTileId, onTileClick }: DreamerMapCanvasProps) {
  const controlsRef = useRef<OrbitControlsImpl | null>(null)
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
          {/*
            Sky, fog and light. Previously this was a flat ambient plus a white key
            rendering into an empty canvas — the dark green behind the world was the
            page showing through, which is why it read as a model on a webpage.
            `Environment preset="sunset"` went with it: it threw warm orange onto
            every surface, fighting the Kenney palette for no benefit, since every
            tile is metallic 0 / roughness 1 and reflects almost nothing.
          */}
          <DreamAtmosphere />

          <OrbitControls
            ref={controlsRef}
            makeDefault
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

      {/* Outside the Canvas so it stays fixed to the viewport when the map pans. */}
      <MapCompass controlsRef={controlsRef} />
    </div>
  )
}
