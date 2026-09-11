'use client'
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

/**
 * The dream world's sky, air and light.
 *
 * WHY THIS EXISTS
 * The map used to render into an empty canvas: no sky, no fog, no background. The
 * dark green behind it was the PAGE showing through, which is why the world read as
 * "a 3D model floating on a webpage" rather than a place. Nothing was wrong with the
 * tiles; there was simply no scene around them.
 *
 * Three things do almost all the work here, in order of impact:
 *
 *   1. A sky. Anything is better than page background, because the eye reads a
 *      horizon as depth.
 *   2. Fog matched to the horizon colour. This is the single strongest "this is a
 *      world" cue -- distant tiles dissolve into the sky instead of ending on a hard
 *      cut, which is what made the map look like a cardboard model on a table.
 *   3. Light with a direction and a colour temperature. The old setup was a flat
 *      ambient 0.8 plus a white key, which flattens every low-poly facet -- exactly
 *      the shading the Kenney palette depends on to read as form.
 *
 * The palette is deliberately dusk, not night: this is a bedtime product, and the
 * world should feel like the hour before sleep rather than a dark level.
 */

// Horizon colour is shared by the sky gradient and the fog. They MUST match, or
// distant tiles fade into a colour the sky never reaches and the illusion breaks.
export const HORIZON = '#2a4a5e'
const ZENITH = '#131a33'
const GROUND_BOUNCE = '#1d3a4a'

/** A gradient backdrop. An inverted sphere is cheaper and calmer than a skybox. */
function SkyDome() {
  const uniforms = useMemo(() => ({
    top: { value: new THREE.Color(ZENITH) },
    bottom: { value: new THREE.Color(HORIZON) },
  }), [])

  // BackSide alone turns the sphere inside out. Do NOT also negative-scale it --
  // that inverts the winding a second time, the triangles become front-facing,
  // BackSide culls them, and the dome renders nothing at all.
  return (
    <mesh renderOrder={-1} frustumCulled={false}>
      <sphereGeometry args={[220, 32, 16]} />
      <shaderMaterial
        uniforms={uniforms}
        depthWrite={false}
        side={THREE.BackSide}
        vertexShader={`
          varying vec3 vPos;
          void main() {
            vPos = position;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          uniform vec3 top;
          uniform vec3 bottom;
          varying vec3 vPos;
          void main() {
            // Ease the blend so the horizon band is wide and soft rather than a line.
            float h = normalize(vPos).y * 0.5 + 0.5;
            gl_FragColor = vec4(mix(bottom, top, smoothstep(0.35, 0.95, h)), 1.0);
          }
        `}
      />
    </mesh>
  )
}

/**
 * Slow drifting motes. Deliberately few and dim -- this should read as air, not as
 * a particle effect. Rotating the whole field is far cheaper than animating points
 * individually, and at this speed nobody can tell the difference.
 */
function DreamMotes({ count = 160 }: { count?: number }) {
  const ref = useRef<THREE.Points>(null)

  const geometry = useMemo(() => {
    const pos = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      // A flat-ish disc above the world, so motes stay in frame at map zoom levels.
      const a = Math.random() * Math.PI * 2
      const rad = 6 + Math.random() * 26
      pos[i * 3] = Math.cos(a) * rad
      pos[i * 3 + 1] = 2 + Math.random() * 14
      pos[i * 3 + 2] = Math.sin(a) * rad
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    return g
  }, [count])

  const reduced = typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

  useFrame((_, delta) => {
    if (ref.current && !reduced) ref.current.rotation.y += delta * 0.012
  })

  return (
    <points ref={ref} geometry={geometry} frustumCulled={false}>
      <pointsMaterial
        size={0.09}
        color="#cfe6ff"
        transparent
        opacity={0.5}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  )
}

export default function DreamAtmosphere() {
  return (
    <>
      {/* Base colour behind everything, so there is never a white flash on load. */}
      <color attach="background" args={[HORIZON]} />

      {/*
        Fog is the reason the world gains depth. It is tuned against OrbitControls'
        8..50 distance range and a map ~26 units across: `near` sits beyond the
        camera's default 25 so whatever the child is looking at stays crisp, and
        `far` is deliberately well past the far edge. Pulling `far` in tighter looks
        better at default zoom and then washes the whole world out at maxDistance —
        fog is measured from the CAMERA, not from the map, so a value that reads as
        gentle depth up close becomes a white-out when you pull back.
      */}
      <fog attach="fog" args={[HORIZON, 30, 120]} />

      <SkyDome />
      <DreamMotes />

      {/*
        Sky/ground hemisphere instead of flat ambient. Flat ambient lifts every face
        by the same amount, which erases the facet shading low-poly art depends on.
      */}
      <hemisphereLight args={['#bcd7ff', GROUND_BOUNCE, 0.85]} />

      {/*
        Warm key, low and to the side, so hex faces catch light at different angles.
        The shadow map stays at the size it was before this change — a visual pass
        should not quietly cost mobile frame rate. Raise it only if shadows read
        too coarse.
      */}
      <directionalLight
        position={[14, 16, 9]}
        intensity={1.15}
        color="#ffd9b0"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-near={1}
        shadow-camera-far={90}
        shadow-camera-left={-40}
        shadow-camera-right={40}
        shadow-camera-top={40}
        shadow-camera-bottom={-40}
        shadow-bias={-0.0006}
      />

      {/* Cool counter-light so shadowed sides read as dusk rather than as black. */}
      <directionalLight position={[-12, 8, -10]} intensity={0.35} color="#7fa6d8" />
    </>
  )
}
