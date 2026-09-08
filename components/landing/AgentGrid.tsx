'use client'

import React, { useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Corners from './Corners'
import dynamic from 'next/dynamic'

const NetworkGraph3D = dynamic(() => import('./NetworkGraph3D'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[240px] bg-[#070709]/90 rounded border border-[#161a22] flex items-center justify-center text-xs text-slate-500 font-mono">
      LOADING 3D GRAPH TOPOLOGY...
    </div>
  ),
})

// All 10 specialized agents mapped into 6 system capability modules in clean numerical sequence
const CAPABILITIES = [
  {
    tag: 'AGENTS 01 · 06',
    agentsBreakdown: 'Agent 01: Forward Chain Detector · Agent 06: Groq Llama-3.3-70B',
    color: '#00D4AA',
    title: 'Content & WhatsApp Intel',
    body: 'Groq Llama-3.3-70B scores any claim for misinformation, blended with forward-chain pattern detection built for Hindi, Hinglish, and English.',
    proof: 'Live LLM inference',
    has3DPreview: false,
  },
  {
    tag: 'AGENT 02',
    agentsBreakdown: 'Agent 02: 3-Model Ensemble (ViT + ResNet + Swin) & Pillow ELA',
    color: '#8B6CFF',
    title: 'Deepfake & Image Forensics',
    body: 'Error Level Analysis heatmaps plus a three-model classifier ensemble. An image is only called AI-generated when two models independently agree.',
    proof: '3-model ensemble',
    has3DPreview: false,
  },
  {
    tag: 'AGENT 03',
    agentsBreakdown: 'Agent 03: Neo4j AuraDB Force-Directed Topology Mapper',
    color: '#F59E0B',
    title: 'Network Graph Mapping',
    body: 'Neo4j-backed campaign topology. Origin nodes, bot clusters, and amplifier chains rendered as an explorable force-directed graph.',
    proof: 'Neo4j AuraDB',
    has3DPreview: true,
  },
  {
    tag: 'AGENTS 04 · 05',
    agentsBreakdown: 'Agent 04: Fact-Checker Feeds Cross-Ref · Agent 05: LangGraph Pipeline',
    color: '#3B82F6',
    title: 'Threat Classification',
    body: 'A LangGraph pipeline chains every signal into one verdict: organic misinformation, coordinated inauthentic behaviour, or state-level operation.',
    proof: 'LangGraph orchestration',
    has3DPreview: false,
  },
  {
    tag: 'AGENTS 07 · 08 · 09',
    agentsBreakdown: 'Agent 07: 60s Posting Sync · Agent 08: Stylometry · Agent 09: Live Ingestion',
    color: '#EF4444',
    title: 'Coordination Detection',
    body: 'Enter any real account. Posts are ingested live, then analysed for 60-second posting sync, stylometric fingerprints, and LLM-generation signals.',
    proof: 'Live account ingestion',
    has3DPreview: false,
  },
  {
    tag: 'AGENT 10',
    agentsBreakdown: 'Agent 10: Sarvam AI Regional & Code-Mixed NLP',
    color: '#FB923C',
    title: 'Indian Language Detection',
    body: 'Sarvam AI identifies code-mixed and regional text — because misinformation in India does not arrive in English.',
    proof: '10+ Indian languages',
    has3DPreview: false,
  },
]

// Full 10 individual agents directory
const INDIVIDUAL_AGENTS = [
  { id: '01', name: 'WhatsAppAnalyzer', role: 'Forward-chain and virus warning heuristic detector', tech: 'Custom Regex + Graph Logic', color: '#00D4AA' },
  { id: '02', name: 'DeepfakeForensics', role: '3-model AI vision ensemble + Error Level Analysis (ELA)', tech: 'ViT + ResNet + Swin + ELA', color: '#8B6CFF' },
  { id: '03', name: 'GraphTopologyMapper', role: 'Neo4j force-directed coordination network mapping', tech: 'Neo4j AuraDB + Cypher', color: '#F59E0B' },
  { id: '04', name: 'FactCheckCrossRef', role: 'Cross-references AltNews, BOOM, Quint, FactChecker feeds', tech: 'Live RSS Ingestion', color: '#3B82F6' },
  { id: '05', name: 'ThreatClassifier', role: 'LangGraph multi-agent consensus and severity adjudication', tech: 'LangGraph StateGraph', color: '#3B82F6' },
  { id: '06', name: 'ContentAnalyzer', role: 'Zero-shot claim truthfulness and narrative decomposition', tech: 'Groq Llama-3.3-70B', color: '#00D4AA' },
  { id: '07', name: 'TemporalSyncDetector', role: 'Sub-60s simultaneous posting pattern and burst correlation', tech: 'Temporal Clustering', color: '#EF4444' },
  { id: '08', name: 'StylometricFingerprint', role: 'Detects identical rhetorical structures across handles', tech: 'scikit-learn NLP', color: '#EF4444' },
  { id: '09', name: 'AccountNetworkIngestion', role: 'Live account scraping and social graph expansion', tech: 'Bluesky Public API', color: '#EF4444' },
  { id: '10', name: 'SarvamLanguageDetector', role: 'Identifies Hinglish and 10+ regional Indian dialects', tech: 'Sarvam AI Multi-Lingual', color: '#FB923C' },
]

function TiltCard({
  item,
  index,
  activePreview,
  setActivePreview,
}: {
  item: (typeof CAPABILITIES)[number]
  index: number
  activePreview: boolean
  setActivePreview: (state: boolean) => void
}) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [rotX, setRotX] = useState(0)
  const [rotY, setRotY] = useState(0)
  const [glow, setGlow] = useState({ x: 50, y: 50, opacity: 0 })

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = cardRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const px = (e.clientX - rect.left) / rect.width
    const py = (e.clientY - rect.top) / rect.height

    setRotX((0.5 - py) * 8)
    setRotY((px - 0.5) * 10)
    setGlow({ x: px * 100, y: py * 100, opacity: 1 })
  }

  const handleMouseLeave = () => {
    setRotX(0)
    setRotY(0)
    setGlow(prev => ({ ...prev, opacity: 0 }))
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.6, delay: (index % 3) * 0.1, ease: [0.16, 1, 0.3, 1] }}
      className={`relative ${item.has3DPreview && activePreview ? 'md:col-span-2 lg:col-span-2' : ''}`}
      style={{ perspective: 1000 }}
    >
      <div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{
          transform: `perspective(1000px) rotateX(${rotX}deg) rotateY(${rotY}deg) translateY(${glow.opacity ? -4 : 0}px)`,
          transition: 'transform 0.22s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.25s, box-shadow 0.25s',
          borderColor: glow.opacity ? item.color : '#161a22',
          boxShadow: glow.opacity
            ? `0 20px 48px -16px ${item.color}35, inset 0 0 20px ${item.color}06`
            : '0 4px 20px rgba(0,0,0,0.5)',
        }}
        className="relative overflow-hidden border bg-[#0a0a0c]/85 backdrop-blur-md p-6 sm:p-7 flex flex-col justify-between h-full group"
      >
        {/* Specular cursor-following radial light */}
        <div
          className="absolute inset-0 pointer-events-none transition-opacity duration-300"
          style={{
            opacity: glow.opacity,
            background: `radial-gradient(460px circle at ${glow.x}% ${glow.y}%, ${item.color}15, transparent 65%)`,
          }}
        />

        {/* Reticle corners */}
        <Corners color={`${item.color}80`} size={9} />

        <div>
          {/* Tag & controls */}
          <div className="flex items-center justify-between gap-2 mb-2">
            <span
              className="text-[10px] font-bold tracking-[0.18em]"
              style={{
                fontFamily: 'var(--font-jetbrains-mono, monospace)',
                color: item.color,
              }}
            >
              {item.tag}
            </span>

            {/* If 3D Preview is available, show teaser toggle button */}
            {item.has3DPreview && (
              <button
                type="button"
                onClick={() => setActivePreview(!activePreview)}
                className="text-[9.5px] font-bold tracking-wider uppercase px-2 py-0.5 border rounded cursor-pointer transition-all flex items-center gap-1.5"
                style={{
                  fontFamily: 'var(--font-jetbrains-mono, monospace)',
                  borderColor: `${item.color}60`,
                  backgroundColor: activePreview ? `${item.color}20` : `${item.color}08`,
                  color: item.color,
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B] animate-ping" />
                {activePreview ? 'HIDE 3D PREVIEW' : 'LAUNCH 3D PREVIEW'}
              </button>
            )}
          </div>

          {/* Sub-agents breakdown label */}
          <div
            className="text-[9.5px] text-slate-500 mb-3 tracking-wider font-mono truncate"
            title={item.agentsBreakdown}
          >
            {item.agentsBreakdown}
          </div>

          {/* Title */}
          <h3 className="text-xl font-bold text-white mb-2.5 group-hover:text-slate-100 transition-colors">
            {item.title}
          </h3>

          {/* Body */}
          <p className="text-sm leading-relaxed text-slate-400 mb-6">
            {item.body}
          </p>

          {/* Interactive 3D preview for Network Graph card */}
          {item.has3DPreview && activePreview && (
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.4 }}
              className="mb-5"
            >
              <NetworkGraph3D />
            </motion.div>
          )}
        </div>

        {/* Proof tag */}
        <div>
          <div
            className="inline-flex items-center gap-2 text-[10px] tracking-[0.12em] font-semibold uppercase px-2.5 py-1 border"
            style={{
              fontFamily: 'var(--font-jetbrains-mono, monospace)',
              color: item.color,
              borderColor: `${item.color}35`,
              backgroundColor: `${item.color}08`,
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            {item.proof}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

export default function AgentGrid() {
  const [show3DPreview, setShow3DPreview] = useState(true)
  const [showFullRoster, setShowFullRoster] = useState(false)

  return (
    <section
      id="system"
      className="relative border-t border-b border-[#141820] py-28 overflow-hidden"
    >
      <div className="max-w-7xl mx-auto px-6 md:px-10">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="mb-14 flex flex-col md:flex-row md:items-end justify-between gap-6"
        >
          <div>
            <div
              className="text-xs font-bold tracking-[0.2em] text-[#00D4AA] mb-3 uppercase flex items-center gap-2"
              style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)' }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#00D4AA]" />
              02 · THE SYSTEM
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white leading-tight max-w-2xl mb-4">
              Ten specialised agents. One investigation.
            </h2>
            <p className="text-base sm:text-lg leading-relaxed text-slate-400 max-w-xl">
              Every agent runs real inference on input you provide — no canned results, no staged
              datasets. Type an account, paste a claim, drop an image URL.
            </p>
          </div>

          {/* Toggle to inspect all 10 agents individual matrix */}
          <button
            type="button"
            onClick={() => setShowFullRoster(!showFullRoster)}
            className="self-start md:self-auto text-xs tracking-wider uppercase px-4 py-2 font-bold text-[#00D4AA] border border-[#00D4AA]/40 bg-[#00D4AA]/[0.08] hover:bg-[#00D4AA]/15 transition-all cursor-pointer flex items-center gap-2 shrink-0"
            style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)' }}
          >
            <span className="w-2 h-2 rounded-full bg-[#00D4AA] animate-pulse" />
            {showFullRoster ? 'HIDE 10-AGENT DIRECTORY' : 'VIEW ALL 10 AGENTS (01–10)'}
          </button>
        </motion.div>

        {/* Expandable All 10 Individual Agents Roster */}
        <AnimatePresence>
          {showFullRoster && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.4 }}
              className="mb-12 overflow-hidden border border-[#00D4AA]/30 bg-[#070709]/95 backdrop-blur-xl p-6"
            >
              <div className="flex items-center justify-between mb-4 border-b border-[#161a22] pb-3">
                <div
                  className="text-xs font-bold tracking-widest text-[#00D4AA] uppercase"
                  style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)' }}
                >
                  ECHOSNARE AUTONOMOUS AGENT DIRECTORY · AGENTS 01 THROUGH 10
                </div>
                <div className="text-[10px] text-slate-500 font-mono">
                  10/10 REGISTERED & ACTIVE
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                {INDIVIDUAL_AGENTS.map(agent => (
                  <div
                    key={agent.id}
                    className="p-3 bg-[#0a0a0c] border border-[#161a22] hover:border-slate-500 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span
                        className="text-[10px] font-bold"
                        style={{ color: agent.color, fontFamily: 'var(--font-jetbrains-mono, monospace)' }}
                      >
                        AGENT {agent.id}
                      </span>
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: agent.color }}
                      />
                    </div>
                    <div className="text-xs font-bold text-white mb-1">{agent.name}</div>
                    <div className="text-[10.5px] text-slate-400 leading-snug mb-2">{agent.role}</div>
                    <div
                      className="text-[9px] text-slate-500 tracking-wider font-mono border-t border-[#161a22] pt-1.5"
                    >
                      {agent.tech}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 6 Core Capability Modules (Grouping all 10 agents in strict sequence: 01/06 -> 02 -> 03 -> 04/05 -> 07/08/09 -> 10) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {CAPABILITIES.map((c, i) => (
            <TiltCard
              key={c.title}
              item={c}
              index={i}
              activePreview={show3DPreview}
              setActivePreview={setShow3DPreview}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
