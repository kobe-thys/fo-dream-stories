'use client'
import { useRef, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { MappedTile } from '@/lib/types'
import { axialToWorld, MODEL_SCALE } from '@/lib/hex'
import TileErrorBoundary from './TileErrorBoundary'

interface DreamerHexTileProps {
  tile: MappedTile
  isSelected: boolean
  onClick: (tile: MappedTile) => void
}

/** Shown when a tile has no model, or when its model fails to load. */
function PlaceholderTile({ tile, isSelected, onClick }: DreamerHexTileProps) {
  const { x, z } = axialToWorld(tile.position_q, tile.position_r)
  return (
    <mesh
      position={[x, 0, z]}
      onClick={e => { e.stopPropagation(); onClick(tile) }}
    >
      <cylinderGeometry args={[0.85 * MODEL_SCALE, 0.85 * MODEL_SCALE, 0.15, 6]} />
      <meshStandardMaterial color={isSelected ? '#a78bfa' : '#4b5563'} transparent opacity={0.65} />
    </mesh>
  )
}

function DreamerHexTileModel({ tile, isSelected, onClick }: DreamerHexTileProps) {
  // Model names come from the DB and have historically contained spaces.
  const modelPath = `/models/${encodeURIComponent(tile.model as string)}`
  const { scene } = useGLTF(modelPath)
  const groupRef = useRef<THREE.Group>(null!)
  const timeRef = useRef(0)

  const { x, z } = axialToWorld(tile.position_q, tile.position_r)
  const targetY = isSelected ? 0.5 : 0

  // Clone once per tile, capturing each material's original colour AND texture so
  // the grey state can be undone. The flat material list is cached here too --
  // re-walking the scene graph every frame was measurable on heavy tiles.
  const { clonedScene, materials, originalColors, originalMaps } = useMemo(() => {
    const clone = scene.clone(true)
    const mats: THREE.MeshStandardMaterial[] = []
    const origColors = new Map<THREE.MeshStandardMaterial, THREE.Color>()
    const origMaps = new Map<THREE.MeshStandardMaterial, THREE.Texture | null>()
    clone.traverse(child => {
      const mesh = child as THREE.Mesh
      if (!mesh.isMesh) return
      const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      const cloned = list.map(m => {
        const c = (m as THREE.MeshStandardMaterial).clone()
        origColors.set(c, c.color.clone())
        origMaps.set(c, c.map)
        mats.push(c)
        return c
      })
      mesh.material = Array.isArray(mesh.material) ? cloned : cloned[0]
    })
    return { clonedScene: clone, materials: mats, originalColors: origColors, originalMaps: origMaps }
  }, [scene])

  // Appearance is rewritten only when the child's state actually changes. This
  // used to run for every material of every tile on every frame.
  useEffect(() => {
    for (const mat of materials) {
      const origColor = originalColors.get(mat) ?? new THREE.Color(1, 1, 1)
      const origMap = originalMaps.get(mat) ?? null

      mat.transparent = false
      mat.opacity = 1
      mat.emissive.set(0x000000)
      mat.emissiveIntensity = 0

      if (tile.childState === 'grey') {
        // Drop the texture so grey reads as solid rather than as a tinted texture
        mat.map = null
        mat.color.set(0x888888)
      } else {
        mat.map = origMap
        mat.color.copy(origColor)
        if (tile.childState === 'completed') mat.emissive.set(0xf59e0b)
      }
      mat.needsUpdate = true
    }
  }, [tile.childState, materials, originalColors, originalMaps])

  useFrame((_, delta) => {
    // Smooth Y lerp for the selection lift
    if (groupRef.current) {
      groupRef.current.position.y = THREE.MathUtils.lerp(groupRef.current.position.y, targetY, 0.1)
    }
    // The only per-frame material work left: the completed tile's glow pulse.
    if (tile.childState !== 'completed') return
    timeRef.current += delta
    const pulse = 0.2 + 0.15 * Math.sin(timeRef.current * 2)
    for (const mat of materials) mat.emissiveIntensity = pulse
  })

  const rotationY = (tile.rotation ?? 0) * (Math.PI / 3)

  return (
    <group
      ref={groupRef}
      position={[x, 0, z]}
      rotation={[0, rotationY, 0]}
      scale={[
        MODEL_SCALE * (tile.scale_x ?? 1),
        MODEL_SCALE * (tile.scale_y ?? 1),
        MODEL_SCALE * (tile.scale_z ?? 1),
      ]}
      onClick={e => { e.stopPropagation(); onClick(tile) }}
    >
      <primitive object={clonedScene} />

      {/* Selection ring — hexagonal ring mesh under the tile */}
      {isSelected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
          <ringGeometry args={[0.85, 0.95, 6]} />
          <meshBasicMaterial color="#a78bfa" transparent opacity={0.9} />
        </mesh>
      )}
    </group>
  )
}

export default function DreamerHexTile(props: DreamerHexTileProps) {
  // useGLTF must never be called conditionally, so the guard lives here and the
  // hook stays inside DreamerHexTileModel. A tile with no model would otherwise
  // request "/models/null", 404, and suspend the entire Canvas forever -- one bad
  // tile blanking the whole dream world.
  if (!props.tile.model) return <PlaceholderTile {...props} />

  return (
    <TileErrorBoundary fallback={<PlaceholderTile {...props} />}>
      <DreamerHexTileModel {...props} />
    </TileErrorBoundary>
  )
}
