'use client'
import { useRef } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'

export default function MapCompass() {
  const { camera } = useThree()
  const controls = useThree(state => state.controls) as OrbitControlsImpl | null
  const needleRef = useRef<HTMLDivElement>(null)

  useFrame(() => {
    if (!controls?.getAzimuthalAngle || !needleRef.current) return
    const az = controls.getAzimuthalAngle()
    needleRef.current.style.transform = `rotate(${-az}rad)`
  })

  function handleReset() {
    if (!controls) return
    const target = controls.target as THREE.Vector3
    const { y } = camera.position
    const dx = camera.position.x - target.x
    const dz = camera.position.z - target.z
    const r = Math.sqrt(dx * dx + dz * dz)
    camera.position.set(target.x, y, target.z + r)
    camera.lookAt(target)
    controls.update()
  }

  return (
    <Html fullscreen zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
      <button
        onClick={handleReset}
        title="Reset to north-up"
        style={{
          position: 'absolute',
          bottom: 20,
          right: 20,
          pointerEvents: 'auto',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 0,
          lineHeight: 0,
        }}
      >
        <div ref={needleRef} style={{ width: 44, height: 44 }}>
          <svg viewBox="0 0 44 44" width="44" height="44">
            <circle cx="22" cy="22" r="21" fill="rgba(0,0,0,0.55)" stroke="rgba(255,255,255,0.18)" strokeWidth="1"/>
            {/* North needle — red */}
            <path d="M22,5 L19,22 L22,20 L25,22 Z" fill="#ef4444"/>
            {/* South needle — white */}
            <path d="M22,39 L19,22 L22,24 L25,22 Z" fill="rgba(255,255,255,0.4)"/>
            {/* Center dot */}
            <circle cx="22" cy="22" r="2" fill="rgba(255,255,255,0.65)"/>
            {/* N label on north needle */}
            <text x="22" y="13" textAnchor="middle" dominantBaseline="middle" fill="white" fontSize="7" fontWeight="bold" fontFamily="sans-serif">N</text>
          </svg>
        </div>
      </button>
    </Html>
  )
}
