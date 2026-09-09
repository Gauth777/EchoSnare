'use client'

import React, { useMemo, useRef, useState, useEffect } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

interface NodeData {
  pos: THREE.Vector3
  basePos: THREE.Vector3
  velocity: THREE.Vector3
  isThreat: boolean
  threatPhase: number
  size: number
}

function GraphScene({ mouse }: { mouse: React.MutableRefObject<{ x: number; y: number }> }) {
  const groupRef = useRef<THREE.Group>(null)
  const linesGeometryRef = useRef<THREE.BufferGeometry>(null)
  const pointsRef = useRef<THREE.Points>(null)
  const threatPointsRef = useRef<THREE.Points>(null)

  // Generate 3D nodes
  const { nodes, normalIndices, threatIndices } = useMemo(() => {
    const count = 120
    const nodeArr: NodeData[] = []
    const normIdx: number[] = []
    const thrtIdx: number[] = []

    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(Math.random() * 2 - 1)
      const r = 14 + Math.random() * 22
      const x = r * Math.sin(phi) * Math.cos(theta) * 1.5
      const y = r * Math.sin(phi) * Math.sin(theta) * 0.9
      const z = (r * Math.cos(phi) - 6) * 0.9

      const isThreat = i % 14 === 0 // ~8-9 threats
      if (isThreat) {
        thrtIdx.push(i)
      } else {
        normIdx.push(i)
      }

      nodeArr.push({
        pos: new THREE.Vector3(x, y, z),
        basePos: new THREE.Vector3(x, y, z),
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 0.008,
          (Math.random() - 0.5) * 0.008,
          (Math.random() - 0.5) * 0.008
        ),
        isThreat,
        threatPhase: Math.random() * Math.PI * 2,
        size: isThreat ? 5.5 : 2.5 + Math.random() * 2.5,
      })
    }
    return { nodes: nodeArr, normalIndices: normIdx, threatIndices: thrtIdx }
  }, [])

  // Float positions buffer
  const normalPositions = useMemo(() => new Float32Array(normalIndices.length * 3), [normalIndices])
  const threatPositions = useMemo(() => new Float32Array(threatIndices.length * 3), [threatIndices])

  // Connection lines buffer (max pairs)
  const maxLines = 360
  const linePositions = useMemo(() => new Float32Array(maxLines * 2 * 3), [maxLines])
  const lineColors = useMemo(() => new Float32Array(maxLines * 2 * 3), [maxLines])

  const maxDist = 9.5
  const maxDistSq = maxDist * maxDist

  useFrame((state, delta) => {
    const time = state.clock.getElapsedTime()

    // Gentle camera parallax following mouse
    if (groupRef.current) {
      groupRef.current.rotation.y = THREE.MathUtils.damp(
        groupRef.current.rotation.y,
        time * 0.03 + mouse.current.x * 0.25,
        2.5,
        delta
      )
      groupRef.current.rotation.x = THREE.MathUtils.damp(
        groupRef.current.rotation.x,
        -mouse.current.y * 0.18 + Math.sin(time * 0.15) * 0.04,
        2.5,
        delta
      )
    }

    // Update node positions with drift
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i]
      node.pos.add(node.velocity)

      // Soft boundary pull back to basePos
      const distToBase = node.pos.distanceTo(node.basePos)
      if (distToBase > 3.5) {
        node.velocity.add(
          node.basePos.clone().sub(node.pos).normalize().multiplyScalar(0.001)
        )
      }
    }

    // Populate normal points
    for (let i = 0; i < normalIndices.length; i++) {
      const idx = normalIndices[i]
      const p = nodes[idx].pos
      normalPositions[i * 3] = p.x
      normalPositions[i * 3 + 1] = p.y
      normalPositions[i * 3 + 2] = p.z
    }
    if (pointsRef.current) {
      const attr = pointsRef.current.geometry.attributes.position
      if (attr) {
        attr.needsUpdate = true
      }
    }

    // Populate threat points
    for (let i = 0; i < threatIndices.length; i++) {
      const idx = threatIndices[i]
      const p = nodes[idx].pos
      threatPositions[i * 3] = p.x
      threatPositions[i * 3 + 1] = p.y
      threatPositions[i * 3 + 2] = p.z
    }
    if (threatPointsRef.current) {
      const attr = threatPointsRef.current.geometry.attributes.position
      if (attr) {
        attr.needsUpdate = true
      }
    }

    // Compute dynamic line connections between close nodes
    let lineCount = 0
    const colorCyan = new THREE.Color('#00D4AA')
    const colorBlue = new THREE.Color('#3B82F6')
    const colorRed = new THREE.Color('#EF4444')

    for (let i = 0; i < nodes.length && lineCount < maxLines; i++) {
      const nodeA = nodes[i]
      for (let j = i + 1; j < nodes.length && lineCount < maxLines; j++) {
        const nodeB = nodes[j]
        const dx = nodeA.pos.x - nodeB.pos.x
        const dy = nodeA.pos.y - nodeB.pos.y
        const dz = nodeA.pos.z - nodeB.pos.z
        const d2 = dx * dx + dy * dy + dz * dz

        if (d2 < maxDistSq) {
          const ratio = 1 - Math.sqrt(d2) / maxDist
          const ptr = lineCount * 6

          linePositions[ptr] = nodeA.pos.x
          linePositions[ptr + 1] = nodeA.pos.y
          linePositions[ptr + 2] = nodeA.pos.z

          linePositions[ptr + 3] = nodeB.pos.x
          linePositions[ptr + 4] = nodeB.pos.y
          linePositions[ptr + 5] = nodeB.pos.z

          const isThreatLink = nodeA.isThreat || nodeB.isThreat
          const c = isThreatLink ? colorRed : (i % 2 === 0 ? colorCyan : colorBlue)
          const brightness = ratio * (isThreatLink ? 0.75 : 0.35)

          lineColors[ptr] = c.r * brightness
          lineColors[ptr + 1] = c.g * brightness
          lineColors[ptr + 2] = c.b * brightness

          lineColors[ptr + 3] = c.r * brightness
          lineColors[ptr + 4] = c.g * brightness
          lineColors[ptr + 5] = c.b * brightness

          lineCount++
        }
      }
    }

    // Clear unused line segments
    for (let p = lineCount * 6; p < maxLines * 6; p++) {
      linePositions[p] = 0
      lineColors[p] = 0
    }

    if (linesGeometryRef.current) {
      linesGeometryRef.current.attributes.position.needsUpdate = true
      linesGeometryRef.current.attributes.color.needsUpdate = true
      linesGeometryRef.current.setDrawRange(0, lineCount * 2)
    }
  })

  // Circular sprite texture for clean circular points
  const dotTexture = useMemo(() => {
    if (typeof document === 'undefined') return null
    const canvas = document.createElement('canvas')
    canvas.width = 64
    canvas.height = 64
    const ctx = canvas.getContext('2d')
    if (ctx) {
      const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
      grad.addColorStop(0, 'rgba(255,255,255,1)')
      grad.addColorStop(0.4, 'rgba(255,255,255,0.8)')
      grad.addColorStop(0.8, 'rgba(255,255,255,0.15)')
      grad.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, 64, 64)
    }
    return new THREE.CanvasTexture(canvas)
  }, [])

  return (
    <group ref={groupRef}>
      {/* Normal nodes (Cyan / Teal) */}
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[normalPositions, 3]}
          />
        </bufferGeometry>
        <pointsMaterial
          size={1.6}
          map={dotTexture ?? undefined}
          transparent
          opacity={0.85}
          color="#00D4AA"
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>

      {/* Threat nodes (Pulsing Red) */}
      <points ref={threatPointsRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[threatPositions, 3]}
          />
        </bufferGeometry>
        <pointsMaterial
          size={3.2}
          map={dotTexture ?? undefined}
          transparent
          opacity={0.95}
          color="#EF4444"
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>

      {/* Dynamic line connections */}
      <lineSegments>
        <bufferGeometry ref={linesGeometryRef}>
          <bufferAttribute
            attach="attributes-position"
            args={[linePositions, 3]}
          />
          <bufferAttribute
            attach="attributes-color"
            args={[lineColors, 3]}
          />
        </bufferGeometry>
        <lineBasicMaterial
          vertexColors
          transparent
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          opacity={0.8}
        />
      </lineSegments>
    </group>
  )
}

export default function ParticleNetwork() {
  const mouse = useRef({ x: 0, y: 0 })
  const [hasWebGL, setHasWebGL] = useState(true)
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    // Check for reduced motion
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(mq.matches)

    // Check WebGL availability
    try {
      const canvas = document.createElement('canvas')
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
      if (!gl) setHasWebGL(false)
    } catch {
      setHasWebGL(false)
    }

    const handlePointerMove = (e: PointerEvent) => {
      mouse.current.x = (e.clientX / window.innerWidth) * 2 - 1
      mouse.current.y = -(e.clientY / window.innerHeight) * 2 + 1
    }

    window.addEventListener('pointermove', handlePointerMove, { passive: true })
    return () => window.removeEventListener('pointermove', handlePointerMove)
  }, [])

  if (!hasWebGL || reducedMotion) {
    // Elegant static fallback with cyber glow grid
    return (
      <div
        className="absolute inset-0 pointer-events-none overflow-hidden"
        style={{
          background: 'radial-gradient(ellipse at 50% 30%, rgba(0, 212, 170, 0.08) 0%, rgba(8, 14, 26, 0.95) 75%)',
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(0, 212, 170, 0.15) 1px, transparent 0)',
          backgroundSize: '32px 32px',
        }}
      />
    )
  }

  return (
    <div
      className="absolute inset-0 pointer-events-none overflow-hidden"
      style={{ zIndex: 1 }}
    >
      <Canvas
        camera={{ position: [0, 0, 32], fov: 60 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        style={{ width: '100%', height: '100%', pointerEvents: 'none' }}
      >
        <GraphScene mouse={mouse} />
      </Canvas>
    </div>
  )
}
