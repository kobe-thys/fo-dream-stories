'use client'
import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { MappedTile } from '@/lib/types'
import { axialToWorld } from '@/lib/hex'

interface DreamerHexTileProps {
  tile: MappedTile
  isSelected: boolean
  onClick: (tile: MappedTile) => void
}

function applyStateToMaterial(mat: THREE.MeshStandardMaterial, tile: MappedTile, t: number) {
  mat.transparent = true

  if (tile.childState === 'revealed') {
    mat.color.set(0x444444)
    mat.opacity = 0.5
    mat.emissive.set(0x000000)
    mat.emissiveIntensity = 0
    return
  }

  if (tile.childState === 'unlocked' && tile.type !== 'terrain') {
    // Story tile unlocked but not yet listened: greyscale
    const lum = mat.color.r * 0.299 + mat.color.g * 0.587 + mat.color.b * 0.114
    mat.color.set(new THREE.Color(lum, lum, lum))
    mat.opacity = 1
    mat.emissive.set(0x000000)
    mat.emissiveIntensity = 0
    return
  }

  if (tile.childState === 'listened') {
    mat.opacity = 1
    mat.emissive.set(0xf59e0b)
    mat.emissiveIntensity = 0.1 + 0.05 * Math.sin(t * 2)
    return
  }

  if (tile.childState === 'completed') {
    mat.opacity = 1
    mat.emissive.set(0xf59e0b)
    mat.emissiveIntensity = 0.2 + 0.15 * Math.sin(t * 2)
    return
  }

  // terrain unlocked or any other state: full colour
  mat.opacity = 1
  mat.emissive.set(0x000000)
  mat.emissiveIntensity = 0
}

export default function DreamerHexTile({ tile, isSelected, onClick }: DreamerHexTileProps) {
  const modelPath = `/models/${tile.model}`
  const { scene } = useGLTF(modelPath)
  const groupRef = useRef<THREE.Group>(null!)
  const timeRef = useRef(0)

  const { x, z } = axialToWorld(tile.position_q, tile.position_r)
  const targetY = isSelected ? 0.5 : 0

  // Clone scene once per tile to avoid mutating the shared GLB cache
  const clonedScene = useMemo(() => {
    const clone = scene.clone(true)
    clone.traverse(child => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh
        if (Array.isArray(mesh.material)) {
          mesh.material = mesh.material.map(m => (m as THREE.MeshStandardMaterial).clone())
        } else {
          mesh.material = (mesh.material as THREE.MeshStandardMaterial).clone()
        }
      }
    })
    return clone
  }, [scene])

  useFrame((_, delta) => {
    timeRef.current += delta

    // Smooth Y lerp for selection lift
    if (groupRef.current) {
      groupRef.current.position.y = THREE.MathUtils.lerp(
        groupRef.current.position.y,
        targetY,
        0.1
      )
    }

    // Apply state-based material overrides every frame
    clonedScene.traverse(child => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
        for (const mat of materials) {
          applyStateToMaterial(mat as THREE.MeshStandardMaterial, tile, timeRef.current)
        }
      }
    })
  })

  const rotationY = (tile.rotation ?? 0) * (Math.PI / 3)

  return (
    <group
      ref={groupRef}
      position={[x, 0, z]}
      rotation={[0, rotationY, 0]}
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
