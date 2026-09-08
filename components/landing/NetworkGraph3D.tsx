'use client'

import React, { useRef, useMemo, useState, useEffect } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Html } from '@react-three/drei'
import * as THREE from 'three'

interface GraphNode {
  id: string
  label: string
  role: 'c2' | 'amplifier' | 'bot' | 'target'
  pos: [number, number, number]
  color: string
  size: number
  risk: string
  metric: string
}

interface GraphLink {
  source: number
  target: number
}

const MOCK_NODES: GraphNode[] = [
  { id: 'n0', label: 'C2_ORIGIN_HQ', role: 'c2', pos: [0, 0, 0], color: '#EF4444', size: 0.65, risk: 'CRITICAL 98/100', metric: '60s sync burst' },
  { id: 'n1', label: 'AMP_CLUSTER_01', role: 'amplifier', pos: [2.2, 1.2, -0.6], color: '#F59E0B', size: 0.45, risk: 'HIGH 84/100', metric: '124 retweets/min' },
  { id: 'n2', label: 'AMP_CLUSTER_02', role: 'amplifier', pos: [-2.1, 1.4, 0.8], color: '#F59E0B', size: 0.45, risk: 'HIGH 82/100', metric: '98 retweets/min' },
  { id: 'n3', label: 'AMP_CLUSTER_03', role: 'amplifier', pos: [0.8, -2.1, 1.2], color: '#F59E0B', size: 0.45, risk: 'HIGH 79/100', metric: '140 retweets/min' },
  { id: 'n4', label: 'BOT_RELAY_41', role: 'bot', pos: [3.4, 2.3, -1.2], color: '#3B82F6', size: 0.32, risk: 'ELEVATED 68/100', metric: 'LLM stylometry match' },
  { id: 'n5', label: 'BOT_RELAY_42', role: 'bot', pos: [3.1, -0.4, -1.8], color: '#3B82F6', size: 0.32, risk: 'ELEVATED 71/100', metric: 'Coordinated latency 1.2s' },
  { id: 'n6', label: 'BOT_RELAY_88', role: 'bot', pos: [-3.2, 2.5, 1.4], color: '#3B82F6', size: 0.32, risk: 'ELEVATED 64/100', metric: 'Identical phrasing' },
  { id: 'n7', label: 'BOT_RELAY_89', role: 'bot', pos: [-3.5, 0.2, 1.9], color: '#3B82F6', size: 0.32, risk: 'ELEVATED 67/100', metric: 'Zero follower fan-out' },
  { id: 'n8', label: 'TARGET_COMMUNITY', role: 'target', pos: [1.6, -3.2, 2.2], color: '#00D4AA', size: 0.5, risk: 'EXPOSED 87%', metric: 'WhatsApp cross-vector' },
  { id: 'n9', label: 'INFILTRATED_GROUP', role: 'target', pos: [-1.4, -3.1, -1.5], color: '#00D4AA', size: 0.42, risk: 'EXPOSED 74%', metric: 'Hinglish forward ring' },
]

const MOCK_LINKS: GraphLink[] = [
  { source: 0, target: 1 },
  { source: 0, target: 2 },
  { source: 0, target: 3 },
  { source: 1, target: 4 },
  { source: 1, target: 5 },
  { source: 2, target: 6 },
  { source: 2, target: 7 },
  { source: 3, target: 8 },
  { source: 3, target: 9 },
  { source: 1, target: 3 },
  { source: 2, target: 3 },
]

function NodeMesh({
  node,
  hovered,
  setHovered,
}: {
  node: GraphNode
  hovered: string | null
  setHovered: (id: string | null) => void
}) {
  const meshRef = useRef<THREE.Mesh>(null)
  const isSelected = hovered === node.id

  useFrame(state => {
    if (!meshRef.current) return
    const t = state.clock.getElapsedTime()
    if (node.role === 'c2') {
      const scale = 1 + Math.sin(t * 3.5) * 0.12
      meshRef.current.scale.set(scale, scale, scale)
    }
  })

  return (
    <group position={node.pos}>
      <mesh
        ref={meshRef}
        onPointerOver={e => {
          e.stopPropagation()
          setHovered(node.id)
        }}
        onPointerOut={() => setHovered(null)}
      >
        <sphereGeometry args={[node.size, 24, 24]} />
        <meshStandardMaterial
          color={node.color}
          emissive={node.color}
          emissiveIntensity={isSelected ? 1.6 : node.role === 'c2' ? 0.9 : 0.4}
          roughness={0.2}
          metalness={0.8}
        />
      </mesh>

      {/* Halo ring for origin C2 */}
      {node.role === 'c2' && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[node.size * 1.3, node.size * 1.5, 32]} />
          <meshBasicMaterial color="#EF4444" side={THREE.DoubleSide} transparent opacity={0.6} />
        </mesh>
      )}

      {/* Floating tooltip on hover */}
      {isSelected && (
        <Html distanceFactor={14} zIndexRange={[100, 0]} pointerEvents="none">
          <div
            className="p-2.5 rounded border border-[#1e2430] bg-[#070709]/95 backdrop-blur-md text-white shadow-2xl pointer-events-none whitespace-nowrap -translate-x-1/2 -translate-y-full mb-3"
            style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)' }}
          >
            <div className="flex items-center gap-2 text-[10px] tracking-wider text-[#00D4AA]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#EF4444] animate-ping" />
              {node.label}
            </div>
            <div className="text-[11px] font-semibold text-slate-200 mt-1">{node.risk}</div>
            <div className="text-[9.5px] text-slate-400">{node.metric}</div>
          </div>
        </Html>
      )}
    </group>
  )
}

function Edges({ hovered }: { hovered: string | null }) {
  const linePoints = useMemo(() => {
    const points: THREE.Vector3[] = []
    for (const link of MOCK_LINKS) {
      const src = MOCK_NODES[link.source].pos
      const tgt = MOCK_NODES[link.target].pos
      points.push(new THREE.Vector3(...src), new THREE.Vector3(...tgt))
    }
    return points
  }, [])

  const lineGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry().setFromPoints(linePoints)
    return geo
  }, [linePoints])

  return (
    <lineSegments geometry={lineGeo}>
      <lineBasicMaterial color="#1f2636" transparent opacity={0.7} />
    </lineSegments>
  )
}

function GraphSceneInner({ hovered, setHovered }: { hovered: string | null; setHovered: (id: string | null) => void }) {
  const groupRef = useRef<THREE.Group>(null)

  useFrame((_, delta) => {
    if (groupRef.current && !hovered) {
      groupRef.current.rotation.y += delta * 0.12
    }
  })

  return (
    <group ref={groupRef}>
      <ambientLight intensity={0.7} />
      <pointLight position={[6, 8, 8]} intensity={1.5} color="#00D4AA" />
      <pointLight position={[-6, -4, -6]} intensity={1.2} color="#EF4444" />

      <Edges hovered={hovered} />

      {MOCK_NODES.map(node => (
        <NodeMesh key={node.id} node={node} hovered={hovered} setHovered={setHovered} />
      ))}
    </group>
  )
}

export default function NetworkGraph3D() {
  const [hovered, setHovered] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div className="w-full h-full min-h-[220px] bg-[#070709]/80 flex items-center justify-center text-xs text-slate-500 font-mono">
        INITIALIZING GRAPH RENDERER...
      </div>
    )
  }

  return (
    <div className="relative w-full h-[260px] rounded-lg overflow-hidden border border-[#161a22] bg-[#060608]/90 group">
      {/* Top telemetry badge */}
      <div className="absolute top-2.5 left-3 z-10 flex items-center gap-2 pointer-events-none">
        <span className="w-2 h-2 rounded-full bg-[#EF4444] animate-pulse" />
        <span
          className="text-[10px] tracking-widest text-slate-300 font-bold uppercase"
          style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)' }}
        >
          NEO4J LIVE TOPOLOGY · FORCE-DIRECTED 3D
        </span>
      </div>

      {/* Orbit hint badge */}
      <div className="absolute bottom-2.5 right-3 z-10 pointer-events-none text-[9px] tracking-wider text-slate-500 font-mono uppercase bg-[#070709]/90 px-2 py-0.5 rounded border border-[#161a22]">
        DRAG TO ORBIT · HOVER NODES
      </div>

      <Canvas
        camera={{ position: [0, 0, 8.5], fov: 45 }}
        gl={{ antialias: true, alpha: true }}
      >
        <GraphSceneInner hovered={hovered} setHovered={setHovered} />
        <OrbitControls
          enableZoom={false}
          enablePan={false}
          autoRotate={!hovered}
          autoRotateSpeed={0.8}
          rotateSpeed={0.8}
        />
      </Canvas>
    </div>
  )
}
