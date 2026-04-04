'use client'
import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { axialToWorld } from '@/lib/hex'
import { TileType, TerrainType } from '@/lib/types'

export interface AdminTile {
  id: string
  type: TileType
  name: string | null
  position_q: number
  position_r: number
  terrain_type: TerrainType | null
  model: string | null
  rotation: number
  story_id: string | null
  story: { id: string; title: string } | null
  published: boolean
  scale_x: number
  scale_y: number
  scale_z: number
}

// Kept for any callers that still use tileColor
export function tileColor(type: TileType): string {
  if (type === 'story') return '#7c3aed'
  if (type === 'terrain') return '#166534'
  return '#6b7280'
}

const MODEL_SCALE = 1.72

interface PlaceholderProps {
  position: [number, number, number]
  isSelected: boolean
  published: boolean
  onClick: () => void
}

function PlaceholderTile({ position, isSelected, published, onClick }: PlaceholderProps) {
  return (
    <mesh position={position} onClick={(e) => { e.stopPropagation(); onClick() }}>
      <cylinderGeometry args={[0.85, 0.85, 0.15, 6]} />
      <meshStandardMaterial
        color={isSelected ? '#a78bfa' : (published ? '#374151' : '#92400e')}
        transparent
        opacity={published ? 0.7 : 0.5}
      />
    </mesh>
  )
}

interface Props {
  tile: AdminTile
  isSelected: boolean
  isMoving: boolean
  isLinkedToSelected: boolean
  isBlockedByOtherStory: boolean
  onClick: (id: string, shiftKey: boolean, ctrlKey: boolean) => void
}

function AdminHexTileModel({ tile, isSelected, isMoving, isLinkedToSelected, isBlockedByOtherStory, onClick }: Props) {
  const { scene } = useGLTF(`/models/${tile.model}`)
  const groupRef = useRef<THREE.Group>(null!)

  const cloned = useMemo(() => {
    const c = scene.clone(true)
    c.traverse((child) => {
      const mesh = child as THREE.Mesh
      if (!mesh.isMesh) return
      const mat = (mesh.material as THREE.MeshStandardMaterial).clone()
      mat.transparent = true
      if (isBlockedByOtherStory) {
        mat.color.setHex(0x444444)
        mat.opacity = 0.4
      } else if (isLinkedToSelected) {
        mat.emissive = new THREE.Color(0x00ffff)
        mat.emissiveIntensity = 0.4
        mat.opacity = 0.8
      } else if (!tile.published) {
        mat.color.setHex(0x92400e) // amber-800 — draft tint
        mat.opacity = 0.55
      } else {
        mat.opacity = isMoving ? 0.6 : 1
      }
      mesh.material = mat
    })
    return c
  }, [scene, isMoving, isBlockedByOtherStory, isLinkedToSelected, tile.published])

  const { x, z } = axialToWorld(tile.position_q, tile.position_r)
  const targetY = (isSelected || isMoving) ? 0.8 : 0
  const targetRotY = (tile.rotation || 0) * (Math.PI / 3)

  useFrame(() => {
    if (!groupRef.current) return
    groupRef.current.position.lerp(new THREE.Vector3(x, targetY, z), 0.1)
    groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, targetRotY, 0.1)
    const moveFactor = isMoving ? 0.9 : 1
    const sx = MODEL_SCALE * (tile.scale_x ?? 1) * moveFactor
    const sy = MODEL_SCALE * (tile.scale_y ?? 1) * moveFactor
    const sz = MODEL_SCALE * (tile.scale_z ?? 1) * moveFactor
    groupRef.current.scale.lerp(new THREE.Vector3(sx, sy, sz), 0.1)
  })

  const ringColor = isLinkedToSelected ? '#00ffff' : '#a78bfa'

  return (
    <group ref={groupRef} onClick={(e) => { e.stopPropagation(); onClick(tile.id, e.shiftKey, e.ctrlKey) }}>
      <primitive object={cloned} />
      {(isSelected || isLinkedToSelected) && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
          <ringGeometry args={[0.88, 0.94, 6]} />
          <meshBasicMaterial color={ringColor} transparent opacity={0.9} />
        </mesh>
      )}
    </group>
  )
}

export default function AdminHexTile(props: Props) {
  const { tile, isSelected, onClick } = props
  const { x, z } = axialToWorld(tile.position_q, tile.position_r)

  if (!tile.model) {
    return (
      <PlaceholderTile
        position={[x, 0, z]}
        isSelected={isSelected}
        published={tile.published}
        onClick={() => onClick(tile.id, false, false)}
      />
    )
  }

  return <AdminHexTileModel {...props} />
}
