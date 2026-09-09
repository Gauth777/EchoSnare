'use client'

import React, { useEffect, useRef, useState } from 'react'

export default function CursorScanner() {
  const glowRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    if (window.matchMedia('(pointer: fine)').matches && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setEnabled(true)
    }
  }, [])

  useEffect(() => {
    if (!enabled) return
    const glow = glowRef.current
    const grid = gridRef.current
    if (!glow || !grid) return

    let tx = -1000, ty = -1000
    let x = -1000, y = -1000
    let raf = 0

    const onMove = (e: PointerEvent) => {
      tx = e.clientX
      ty = e.clientY
    }

    const tick = () => {
      x += (tx - x) * 0.2
      y += (ty - y) * 0.2
      glow.style.background = `radial-gradient(360px circle at ${x}px ${y}px, rgba(0,212,170,0.06), rgba(59,130,246,0.03) 45%, transparent 70%)`
      const mask = `radial-gradient(220px circle at ${x}px ${y}px, rgba(0,0,0,0.95), transparent 75%)`
      grid.style.setProperty('mask-image', mask)
      grid.style.setProperty('-webkit-mask-image', mask)
      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', onMove)
    }
  }, [enabled])

  if (!enabled) return null

  return (
    <>
      <div
        ref={glowRef}
        aria-hidden="true"
        className="fixed inset-0 z-40 pointer-events-none"
      />
      <div
        ref={gridRef}
        aria-hidden="true"
        className="fixed inset-0 z-40 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(0,212,170,0.2) 1px, transparent 1.6px)',
          backgroundSize: '28px 28px',
        }}
      />
    </>
  )
}
