'use client'

import { useEffect, useRef, useState } from 'react'
import type { GraphNode, GraphEdge } from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  nodes: GraphNode[]
  edges: GraphEdge[]
  campaignName: string
  onReady?: () => void
}

// D3 mutates nodes with x/y/vx/vy/index — extend GraphNode so TypeScript accepts those
type SimNode = GraphNode & { index?: number }
type SimEdge = { source: string | SimNode; target: string | SimNode; weight: number }
type TooltipState = { x: number; y: number; node: SimNode } | null

// ─── Helpers ─────────────────────────────────────────────────────────────────

const FONT = 'var(--font-jetbrains-mono, "Fira Code", monospace)'

function nodeColor(t: string): string {
  switch (t) {
    case 'origin':     return '#EF4444'
    case 'bot':        return '#F59E0B'
    case 'amplifier':  return '#8B9AB5'
    case 'legitimate': return '#00D4AA'
    default:           return '#4A5568'
  }
}

function nodeRadius(t: string): number {
  switch (t) {
    case 'origin':     return 18
    case 'bot':        return 12
    case 'amplifier':  return 7
    case 'legitimate': return 6
    default:           return 5
  }
}

function edgeOpacity(srcType: string): number {
  if (srcType === 'origin') return 0.6
  if (srcType === 'bot')    return 0.3
  return 0.15
}

function edgeWidth(srcType: string): number {
  if (srcType === 'origin') return 2
  if (srcType === 'bot')    return 1
  return 0.5
}

// After D3 resolves forceLink, source/target are SimNode objects; handle both states
function srcId(d: SimEdge): string {
  return typeof d.source === 'string' ? d.source : (d.source as SimNode).id
}
function tgtId(d: SimEdge): string {
  return typeof d.target === 'string' ? d.target : (d.target as SimNode).id
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function NetworkGraph({ nodes, edges, campaignName, onReady }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef       = useRef<SVGSVGElement>(null)
  const simRef       = useRef<{ stop: () => void } | null>(null)
  const [tooltip, setTooltip] = useState<TooltipState>(null)

  useEffect(() => {
    const container = containerRef.current
    const svgEl     = svgRef.current
    if (!container || !svgEl) return

    const width  = container.clientWidth
    const height = container.clientHeight
    if (width === 0 || height === 0) return

    let cancelled = false

    import('d3').then(d3 => {
      if (cancelled) return

      svgEl.setAttribute('width',  String(width))
      svgEl.setAttribute('height', String(height))

      // Deep-copy nodes and seed center starting positions (entrance animation)
      const simNodes: SimNode[] = nodes.map(n => ({
        ...n,
        x: width  / 2 + (Math.random() - 0.5) * 24,
        y: height / 2 + (Math.random() - 0.5) * 24,
      }))

      // D3 forceLink expects source/target as string IDs initially
      const simEdges: SimEdge[] = edges.map(e => ({
        source: typeof e.source === 'string' ? e.source : (e.source as GraphNode).id,
        target: typeof e.target === 'string' ? e.target : (e.target as GraphNode).id,
        weight: e.weight,
      }))

      // Map for node lookups in event handlers
      const nodeById = new Map(simNodes.map(n => [n.id, n]))

      const svg = d3.select(svgEl)
      svg.selectAll('*').remove()

      // ── Background ──────────────────────────────────────────────────────────
      svg.append('rect')
        .attr('width', width).attr('height', height)
        .attr('fill', '#080E1A')

      const defs = svg.append('defs')
      const gridId = `stgrid-${campaignName.replace(/\W+/g, '')}`
      defs.append('pattern')
        .attr('id', gridId)
        .attr('width', 24).attr('height', 24)
        .attr('patternUnits', 'userSpaceOnUse')
        .append('path')
        .attr('d', 'M 24 0 L 0 0 0 24')
        .attr('fill', 'none')
        .attr('stroke', '#1E2D4A')
        .attr('stroke-width', '0.3')

      svg.append('rect')
        .attr('width', width).attr('height', height)
        .attr('fill', `url(#${gridId})`)
        .attr('opacity', 0.4)

      // ── Force simulation ─────────────────────────────────────────────────
      const simulation = d3.forceSimulation<SimNode>(simNodes)
        .force('link',
          d3.forceLink<SimNode, SimEdge>(simEdges)
            .id(d => d.id)
            .distance(60)
            .strength(0.7))
        .force('charge',    d3.forceManyBody<SimNode>().strength(-150))
        .force('center',    d3.forceCenter(width / 2, height / 2))
        .force('collision', d3.forceCollide<SimNode>().radius(d => nodeRadius(d.type) + 3))
        .alphaDecay(0.02)

      simRef.current = simulation

      // ── Edges ────────────────────────────────────────────────────────────
      const linkGroup = svg.append('g')
      const link = linkGroup
        .selectAll<SVGLineElement, SimEdge>('line')
        .data(simEdges)
        .enter()
        .append('line')
        .attr('stroke', '#ffffff')
        .attr('stroke-width', (d: SimEdge) => edgeWidth(nodeById.get(srcId(d))?.type ?? ''))
        .attr('opacity',      (d: SimEdge) => edgeOpacity(nodeById.get(srcId(d))?.type ?? ''))

      // ── Background click → reset edge highlights ─────────────────────────
      svg.on('click', () => {
        link
          .attr('stroke', '#ffffff')
          .attr('opacity',      (d: SimEdge) => edgeOpacity(nodeById.get(srcId(d))?.type ?? ''))
          .attr('stroke-width', (d: SimEdge) => edgeWidth(nodeById.get(srcId(d))?.type ?? ''))
        setTooltip(null)
      })

      // ── Drag behavior ────────────────────────────────────────────────────
      const drag = d3.drag<SVGCircleElement, SimNode>()
        .on('start', (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart()
          d.fx = d.x ?? 0
          d.fy = d.y ?? 0
        })
        .on('drag', (event, d) => {
          d.fx = event.x
          d.fy = event.y
        })
        .on('end', (event, d) => {
          if (!event.active) simulation.alphaTarget(0)
          d.fx = null
          d.fy = null
        })

      // ── Nodes ────────────────────────────────────────────────────────────
      const nodeGroup = svg.append('g')
      const node = nodeGroup
        .selectAll<SVGCircleElement, SimNode>('circle.st-node')
        .data(simNodes)
        .enter()
        .append('circle')
        .attr('class',   d => d.type === 'origin' ? 'st-node st-origin-node' : 'st-node')
        .attr('r',       d => nodeRadius(d.type))
        .attr('fill',    d => nodeColor(d.type))
        .attr('opacity', 0)
        .attr('cursor',  d => d.type === 'bot' ? 'pointer' : 'default')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .call(drag as any)
        .on('mouseover', (event: MouseEvent, d: SimNode) => {
          const rect = containerRef.current?.getBoundingClientRect()
          if (!rect) return
          setTooltip({ x: event.clientX - rect.left, y: event.clientY - rect.top, node: d })
        })
        .on('mousemove', (event: MouseEvent) => {
          const rect = containerRef.current?.getBoundingClientRect()
          if (!rect) return
          setTooltip(prev =>
            prev ? { ...prev, x: event.clientX - rect.left, y: event.clientY - rect.top } : null,
          )
        })
        .on('mouseout', () => setTooltip(null))
        .on('click', (event: MouseEvent, d: SimNode) => {
          event.stopPropagation()
          if (d.type !== 'bot') return
          // Highlight edges connected to this bot; dim everything else
          link
            .attr('stroke', (l: SimEdge) => {
              const s = srcId(l), t = tgtId(l)
              return s === d.id || t === d.id ? '#F59E0B' : '#ffffff'
            })
            .attr('opacity', (l: SimEdge) => {
              const s = srcId(l), t = tgtId(l)
              return s === d.id || t === d.id ? 1 : 0.07
            })
            .attr('stroke-width', (l: SimEdge) => {
              const s = srcId(l), t = tgtId(l)
              return s === d.id || t === d.id ? 2.5 : 0.3
            })
        })

      // Entrance animation — nodes spread from center to final positions
      node.transition().duration(1200)
        .attr('opacity', d => (d.type === 'amplifier' || d.type === 'legitimate') ? 0.8 : 1)
        .on('end', () => { if (!cancelled) onReady?.() })

      // ── Bot cluster labels ────────────────────────────────────────────────
      const botLabels = nodeGroup
        .selectAll<SVGTextElement, SimNode>('text.st-bot-label')
        .data(simNodes.filter(n => n.type === 'bot'))
        .enter()
        .append('text')
        .attr('class', 'st-bot-label')
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'central')
        .attr('fill', '#080E1A')
        .attr('font-size', '7')
        .attr('font-weight', '700')
        .attr('font-family', FONT)
        .attr('pointer-events', 'none')
        .attr('opacity', 0)
        .text(d => `C${(d.clusterId ?? 0) + 1}`)

      botLabels.transition().duration(1200).attr('opacity', 1)

      // ── Legend ───────────────────────────────────────────────────────────
      const LEGEND = [
        { color: '#EF4444', r: 6, label: 'Origin C2'   },
        { color: '#F59E0B', r: 5, label: 'Bot Account' },
        { color: '#8B9AB5', r: 4, label: 'Amplifier'   },
        { color: '#00D4AA', r: 4, label: 'Legitimate'  },
      ]
      const lg = svg.append('g').attr('transform', `translate(12,${height - 22})`)
      LEGEND.forEach((item, i) => {
        const g = lg.append('g').attr('transform', `translate(${i * 116},0)`)
        g.append('circle')
          .attr('r', item.r).attr('cx', item.r).attr('cy', 0)
          .attr('fill', item.color).attr('opacity', 0.85)
        g.append('text')
          .attr('x', item.r * 2 + 5).attr('y', 3)
          .attr('fill', '#4A5568')
          .attr('font-size', '9')
          .attr('font-family', FONT)
          .text(item.label)
      })

      // ── Tick ─────────────────────────────────────────────────────────────
      simulation.on('tick', () => {
        const cx = (d: SimNode) => Math.max(nodeRadius(d.type), Math.min(width  - nodeRadius(d.type), d.x ?? 0))
        const cy = (d: SimNode) => Math.max(nodeRadius(d.type), Math.min(height - nodeRadius(d.type), d.y ?? 0))

        link
          .attr('x1', d => cx(d.source as SimNode))
          .attr('y1', d => cy(d.source as SimNode))
          .attr('x2', d => cx(d.target as SimNode))
          .attr('y2', d => cy(d.target as SimNode))

        node.attr('cx', cx).attr('cy', cy)
        botLabels.attr('x', cx).attr('y', cy)
      })
    })

    return () => {
      cancelled = true
      simRef.current?.stop()
      setTooltip(null)
    }
    // campaignName uniquely identifies the dataset; nodes/edges always co-change with it
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignName])

  // Tooltip position — clamp so it doesn't overflow the right edge
  const containerW = containerRef.current?.clientWidth ?? 800
  const tipLeft = tooltip ? Math.min(tooltip.x + 14, containerW - 190) : 0
  const tipTop  = tooltip ? Math.max(tooltip.y - 50, 8) : 0

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      <svg ref={svgRef} style={{ display: 'block' }} />

      {tooltip && (
        <div
          style={{
            position:        'absolute',
            left:            tipLeft,
            top:             tipTop,
            backgroundColor: '#0D1526',
            border:          '1px solid #1E2D4A',
            padding:         '10px 14px',
            fontFamily:      FONT,
            fontSize:        '11px',
            color:           '#E2E8F0',
            pointerEvents:   'none',
            zIndex:          20,
            minWidth:        '168px',
          }}
        >
          <div style={{ fontSize: '9px', color: '#4A5568', letterSpacing: '0.1em', marginBottom: '8px' }}>
            NODE DETAILS
          </div>
          <div style={{ color: nodeColor(tooltip.node.type), fontSize: '10px', marginBottom: '4px', letterSpacing: '0.06em' }}>
            {tooltip.node.type.toUpperCase()}
          </div>
          <div style={{ color: '#8B9AB5', marginBottom: '6px' }}>
            {tooltip.node.accountId ?? tooltip.node.label}
          </div>
          {tooltip.node.posts != null && (
            <div style={{ color: '#4A5568', marginBottom: '2px' }}>
              {'Posts: '}<span style={{ color: '#E2E8F0' }}>{tooltip.node.posts.toLocaleString()}</span>
            </div>
          )}
          {tooltip.node.followers != null && (
            <div style={{ color: '#4A5568' }}>
              {'Followers: '}<span style={{ color: '#E2E8F0' }}>{tooltip.node.followers.toLocaleString()}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
