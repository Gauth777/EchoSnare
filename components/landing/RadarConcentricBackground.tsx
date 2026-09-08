'use client'

import React, { useEffect, useRef, useState } from 'react'

/**
 * RadarConcentricBackground
 * 
 * Full-page fixed background rendering continuous concentric radar rings expanding outward
 * from a central origin anchored near the Hero headline.
 * Features multi-frequency rings, radar compass azimuth tick marks, rotating beam sweep,
 * and ambient constellation points.
 */
export default function RadarConcentricBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mouseRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 })
  const scrollRef = useRef(0)
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(mq.matches)

    const onPointerMove = (e: PointerEvent) => {
      mouseRef.current.targetX = (e.clientX / window.innerWidth - 0.5) * 36
      mouseRef.current.targetY = (e.clientY / window.innerHeight - 0.5) * 28
    }

    const onScroll = () => {
      scrollRef.current = window.scrollY
    }

    window.addEventListener('pointermove', onPointerMove, { passive: true })
    window.addEventListener('scroll', onScroll, { passive: true })

    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('scroll', onScroll)
    }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let raf = 0
    let width = 0
    let height = 0
    let dpr = 1

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      width = window.innerWidth
      height = window.innerHeight
      canvas.width = Math.floor(width * dpr)
      canvas.height = Math.floor(height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    resize()
    window.addEventListener('resize', resize)

    // Pulse settings
    const RING_COUNT = width < 768 ? 4 : 6
    const MAX_RADIUS = Math.hypot(width, height) * 0.9
    const CYCLE_DURATION = 8500
    const startTime = performance.now()

    // Ambient constellation background dust particles
    const dustCount = width < 768 ? 24 : 48
    const dust = Array.from({ length: dustCount }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: 0.6 + Math.random() * 1.2,
      baseAlpha: 0.15 + Math.random() * 0.35,
      speed: 0.001 + Math.random() * 0.002,
      phase: Math.random() * Math.PI * 2,
    }))

    const render = (now: number) => {
      // Clear base deep void black
      ctx.fillStyle = '#020408'
      ctx.fillRect(0, 0, width, height)

      // Smooth mouse interpolation
      mouseRef.current.x += (mouseRef.current.targetX - mouseRef.current.x) * 0.05
      mouseRef.current.y += (mouseRef.current.targetY - mouseRef.current.y) * 0.05

      // Radar origin point anchored in upper-center of hero, subtly shifted by mouse & scroll
      const scrollDrift = Math.min(130, scrollRef.current * 0.07)
      const originX = width * 0.5 + mouseRef.current.x
      const originY = height * 0.38 + mouseRef.current.y - scrollDrift

      // Radial multi-tone ambient glow (deep cyber teal and electric azure)
      const centerGlow = ctx.createRadialGradient(originX, originY, 0, originX, originY, width * 0.5)
      centerGlow.addColorStop(0, 'rgba(0, 212, 170, 0.06)')
      centerGlow.addColorStop(0.35, 'rgba(0, 168, 255, 0.025)')
      centerGlow.addColorStop(0.7, 'rgba(5, 10, 20, 0.01)')
      centerGlow.addColorStop(1, 'rgba(2, 4, 8, 0)')
      ctx.fillStyle = centerGlow
      ctx.fillRect(0, 0, width, height)

      // Draw faint constellation dust
      for (const p of dust) {
        const px = p.x * width
        const py = p.y * height
        const alpha = p.baseAlpha * (0.6 + 0.4 * Math.sin(now * p.speed + p.phase))
        ctx.fillStyle = `rgba(148, 185, 235, ${alpha})`
        ctx.beginPath()
        ctx.arc(px, py, p.r, 0, Math.PI * 2)
        ctx.fill()
      }

      // Tactical coordinate grid lines
      ctx.strokeStyle = 'rgba(30, 45, 65, 0.22)'
      ctx.lineWidth = 1
      ctx.setLineDash([2, 12])

      // Horizontal crosshair
      ctx.beginPath()
      ctx.moveTo(0, originY)
      ctx.lineTo(width, originY)
      ctx.stroke()

      // Vertical crosshair
      ctx.beginPath()
      ctx.moveTo(originX, 0)
      ctx.lineTo(originX, height)
      ctx.stroke()

      // 45-degree diagonal radar bearings
      ctx.beginPath()
      ctx.moveTo(originX - MAX_RADIUS, originY - MAX_RADIUS)
      ctx.lineTo(originX + MAX_RADIUS, originY + MAX_RADIUS)
      ctx.stroke()

      ctx.beginPath()
      ctx.moveTo(originX - MAX_RADIUS, originY + MAX_RADIUS)
      ctx.lineTo(originX + MAX_RADIUS, originY - MAX_RADIUS)
      ctx.stroke()
      ctx.setLineDash([])

      // Static radar HUD ring with degree tick marks
      const hudRadius = Math.min(width, height) * 0.38
      ctx.beginPath()
      ctx.arc(originX, originY, hudRadius, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(0, 212, 170, 0.12)'
      ctx.lineWidth = 1
      ctx.stroke()

      // Degree tick marks (every 15 degrees)
      for (let deg = 0; deg < 360; deg += 15) {
        const rad = (deg * Math.PI) / 180
        const isMajor = deg % 45 === 0
        const len = isMajor ? 8 : 4
        const x1 = originX + Math.cos(rad) * (hudRadius - len / 2)
        const y1 = originY + Math.sin(rad) * (hudRadius - len / 2)
        const x2 = originX + Math.cos(rad) * (hudRadius + len / 2)
        const y2 = originY + Math.sin(rad) * (hudRadius + len / 2)

        ctx.beginPath()
        ctx.moveTo(x1, y1)
        ctx.lineTo(x2, y2)
        ctx.strokeStyle = isMajor ? 'rgba(0, 212, 170, 0.35)' : 'rgba(0, 212, 170, 0.15)'
        ctx.lineWidth = isMajor ? 1.2 : 0.8
        ctx.stroke()
      }

      if (reducedMotion) {
        const staticRadii = [80, 180, 320, 520, 780]
        ctx.lineWidth = 1
        for (const r of staticRadii) {
          ctx.beginPath()
          ctx.arc(originX, originY, r, 0, Math.PI * 2)
          ctx.strokeStyle = 'rgba(0, 212, 170, 0.1)'
          ctx.stroke()
        }
        return
      }

      const elapsed = now - startTime

      // Dynamic Expanding Concentric Rings (Teal & Azure pulses)
      for (let i = 0; i < RING_COUNT; i++) {
        const progress = ((elapsed / CYCLE_DURATION) + (i / RING_COUNT)) % 1
        const radius = Math.max(1, progress * MAX_RADIUS)

        // Opacity curve: fast attack, sustained glide, graceful tail-off
        let opacity = 0
        if (progress < 0.12) {
          opacity = (progress / 0.12) * 0.16
        } else {
          opacity = Math.max(0, 0.16 * Math.pow(1 - (progress - 0.12) / 0.88, 1.4))
        }

        const isAzurePulse = i % 2 === 1
        const color = isAzurePulse ? `rgba(0, 168, 255, ${opacity})` : `rgba(0, 212, 170, ${opacity})`

        ctx.beginPath()
        ctx.arc(originX, originY, radius, 0, Math.PI * 2)
        ctx.strokeStyle = color
        ctx.lineWidth = progress < 0.3 ? 1.2 : 1
        ctx.stroke()

        // Subtle secondary echo ring
        if (progress > 0.25 && progress < 0.75) {
          ctx.beginPath()
          ctx.arc(originX, originY, radius * 0.98, 0, Math.PI * 2)
          ctx.strokeStyle = `rgba(59, 130, 246, ${opacity * 0.3})`
          ctx.lineWidth = 0.7
          ctx.stroke()
        }
      }

      // Rotating radar beam sweep
      const sweepAngle = (elapsed * 0.00045) % (Math.PI * 2)
      const sweepRadius = Math.min(width, height) * 0.85

      const sweepGrad = ctx.createRadialGradient(originX, originY, 0, originX, originY, sweepRadius)
      sweepGrad.addColorStop(0, 'rgba(0, 212, 170, 0.065)')
      sweepGrad.addColorStop(0.6, 'rgba(0, 168, 255, 0.025)')
      sweepGrad.addColorStop(1, 'rgba(0, 212, 170, 0)')

      ctx.save()
      ctx.beginPath()
      ctx.moveTo(originX, originY)
      ctx.arc(originX, originY, sweepRadius, sweepAngle - 0.4, sweepAngle)
      ctx.closePath()
      ctx.fillStyle = sweepGrad
      ctx.fill()
      ctx.restore()

      // Center Origin Beacon
      const pulse = 0.5 + 0.5 * Math.sin(now * 0.004)
      ctx.beginPath()
      ctx.arc(originX, originY, 2.5 + pulse * 1.5, 0, Math.PI * 2)
      ctx.fillStyle = '#00D4AA'
      ctx.shadowBlur = 10
      ctx.shadowColor = '#00D4AA'
      ctx.fill()
      ctx.shadowBlur = 0

      raf = requestAnimationFrame(render)
    }

    raf = requestAnimationFrame(render)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [reducedMotion])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="fixed inset-0 w-full h-full pointer-events-none z-0"
      style={{
        backgroundColor: '#020408',
      }}
    />
  )
}
