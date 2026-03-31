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

function applyStateToMaterial(
  mat: THREE.MeshStandardMaterial,
  origColor: THREE.Color,
  tile: MappedTile,
  t: number
) {
  mat.transparent = false
  mat.opacity = 1
  mat.emissive.set(0x000000)
  mat.emissiveIntensity = 0

  if (tile.childState === 'grey') {
    // Visible but unexplored — slightly darker than full colour, textures still readable
    mat.color.set(0xbbbbbb)
    return
  }

  if (tile.childState === 'completed') {
    mat.color.copy(origColor)
    mat.emissive.set(0xf59e0b)
    mat.emissiveIntensity = 0.2 + 0.15 * Math.sin(t * 2)
    return
  }

  // revealed — full original colour
  mat.color.copy(origColor)
}

export default function DreamerHexTile({ tile, isSelected, onClick }: DreamerHexTileProps) {
  const modelPath = `/models/${tile.model}`
  const { scene } = useGLTF(modelPath)
  const groupRef = useRef<THREE.Group>(null!)
  const timeRef = useRef(0)

  const { x, z } = axialToWorld(tile.position_q, tile.position_r)
  const targetY = isSelected ? 0.5 : 0

  // Clone scene once per tile; also capture each material's original colour
  const { clonedScene, originalColors } = useMemo(() => {
    const clone = scene.clone(true)
    const origColors = new Map<THREE.MeshStandardMaterial, THREE.Color>()
    clone.traverse(child => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh
        if (Array.isArray(mesh.material)) {
          mesh.material = mesh.material.map(m => {
            const c = (m as THREE.MeshStandardMaterial).clone()
            origColors.set(c, c.color.clone())
            return c
          })
        } else {
          const c = (mesh.material as THREE.MeshStandardMaterial).clone()
          origColors.set(c, c.color.clone())
          mesh.material = c
        }
      }
    })
    return { clonedScene: clone, originalColors: origColors }
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
          const orig = originalColors.get(mat as THREE.MeshStandardMaterial) ?? new THREE.Color(1, 1, 1)
          applyStateToMaterial(mat as THREE.MeshStandardMaterial, orig, tile, timeRef.current)
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
      scale={[1.72, 1.72, 1.72]}
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
