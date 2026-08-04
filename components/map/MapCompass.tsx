'use client'
import { useEffect, useRef, type RefObject } from 'react'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'

/**
 * Screen-fixed compass / reset button.
 *
 * This renders as PLAIN DOM alongside the <Canvas>, not inside it. It used to use
 * drei's <Html fullscreen>, which anchors to a 3D position (the origin) -- so panning
 * the map carried the compass off-screen, defeating its purpose as a way back.
 * Being outside the Canvas means it is genuinely fixed to the viewport.
 *
 * The parent must be position:relative.
 */
export default function MapCompass({
  controlsRef,
}: {
  controlsRef: RefObject<OrbitControlsImpl | null>
}) {
  const needleRef = useRef<HTMLDivElement>(null)

  // Poll the azimuth on rAF. We are outside the Canvas so useFrame is unavailable,
  // and writing the transform directly avoids a React render per frame.
  useEffect(() => {
    let raf = 0
    const tick = () => {
      const c = controlsRef.current
      if (c?.getAzimuthalAngle && needleRef.current) {
        needleRef.current.style.transform = `rotate(${-c.getAzimuthalAngle()}rad)`
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [controlsRef])

  return (
    <button
      onClick={() => controlsRef.current?.reset()}
      title="Reset view (north-up, centred)"
      style={{
        position: 'absolute',
        bottom: 20,
        right: 20,
        zIndex: 10,
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: 0,
        lineHeight: 0,
      }}
    >
      <div ref={needleRef} style={{ width: 44, height: 44 }}>
        <svg viewBox="0 0 44 44" width="44" height="44">
          <circle cx="22" cy="22" r="21" fill="rgba(0,0,0,0.55)" stroke="rgba(255,255,255,0.18)" strokeWidth="1" />
          {/* North needle — red */}
          <path d="M22,5 L19,22 L22,20 L25,22 Z" fill="#ef4444" />
          {/* South needle — white */}
          <path d="M22,39 L19,22 L22,24 L25,22 Z" fill="rgba(255,255,255,0.4)" />
          {/* Center dot */}
          <circle cx="22" cy="22" r="2" fill="rgba(255,255,255,0.65)" />
          {/* N label on north needle */}
          <text x="22" y="13" textAnchor="middle" dominantBaseline="middle" fill="white" fontSize="7" fontWeight="bold" fontFamily="sans-serif">N</text>
        </svg>
      </div>
    </button>
  )
}
