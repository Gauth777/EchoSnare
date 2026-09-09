'use client'

import React, { useEffect, useState, useRef } from 'react'
import { motion, useInView } from 'framer-motion'

const THREAT_STATS = [
  {
    index: '01',
    value: 87,
    suffix: '%',
    label: 'of Indians encountered fake news online',
    source: 'Microsoft Digital Civility Index',
    accentColor: '#EF4444',
  },
  {
    index: '02',
    value: 500,
    suffix: 'M+',
    label: 'WhatsApp users — misinformation’s fastest vector',
    source: 'Meta, India Disclosure',
    accentColor: '#00D4AA',
  },
  {
    index: '03',
    value: 6,
    suffix: 'x',
    label: 'faster than truth — how falsehoods spread',
    source: 'MIT, Science Magazine',
    accentColor: '#EF4444',
  },
]

function CountUp({ to, suffix = '' }: { to: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const isInView = useInView(ref, { once: true, amount: 0.5 })
  const [n, setN] = useState(0)

  useEffect(() => {
    if (!isInView) return
    const start = performance.now()
    const dur = 1400
    let raf = 0
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / dur)
      const eased = 1 - Math.pow(1 - p, 3)
      setN(Math.round(to * eased))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [isInView, to])

  return (
    <span ref={ref}>
      {n}
      {suffix}
    </span>
  )
}

function ProfessionalStatCard({
  item,
  index,
}: {
  item: (typeof THREAT_STATS)[number]
  index: number
}) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [rotX, setRotX] = useState(0)
  const [rotY, setRotY] = useState(0)
  const [isHovered, setIsHovered] = useState(false)

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = cardRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const px = (e.clientX - rect.left) / rect.width
    const py = (e.clientY - rect.top) / rect.height

    // Restrained, subtle 3D tilt for a premium feel
    setRotX((0.5 - py) * 6)
    setRotY((px - 0.5) * 8)
    setIsHovered(true)
  }

  const handleMouseLeave = () => {
    setRotX(0)
    setRotY(0)
    setIsHovered(false)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{
        duration: 0.6,
        delay: index * 0.12,
        ease: [0.16, 1, 0.3, 1],
      }}
      style={{ perspective: 1000 }}
    >
      <div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{
          transform: `perspective(1000px) rotateX(${rotX}deg) rotateY(${rotY}deg) translateY(${isHovered ? -4 : 0}px)`,
          transition: 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.25s, box-shadow 0.25s',
          borderColor: isHovered ? '#2E3D56' : '#171E2C',
          boxShadow: isHovered
            ? '0 20px 40px -15px rgba(0,0,0,0.8), 0 0 1px 1px rgba(255,255,255,0.05)'
            : '0 4px 20px rgba(0,0,0,0.5)',
        }}
        className="relative bg-[#090C13] border p-8 flex flex-col justify-between h-full group rounded-sm"
      >
        {/* Subtle accent highlight line at top */}
        <div
          className="absolute top-0 left-0 w-8 h-[2px] transition-all duration-300 group-hover:w-full"
          style={{ backgroundColor: item.accentColor }}
        />

        <div>
          {/* Subtle index / label */}
          <div className="flex items-center justify-between text-xs font-mono text-slate-500 mb-6 tracking-widest uppercase">
            <span>INDEX // {item.index}</span>
            <span
              className="w-1.5 h-1.5 rounded-full opacity-60 group-hover:opacity-100 transition-opacity"
              style={{ backgroundColor: item.accentColor }}
            />
          </div>

          {/* Clean, monolithic stat number */}
          <div
            className="text-6xl sm:text-7xl font-bold tracking-tight text-white leading-none mb-5"
            style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)' }}
          >
            <CountUp to={item.value} suffix={item.suffix} />
          </div>

          {/* Description */}
          <p className="text-base text-slate-300 leading-relaxed font-normal mb-8">
            {item.label}
          </p>
        </div>

        {/* Source citation */}
        <div className="pt-4 border-t border-[#141A26] flex items-center justify-between text-xs text-slate-500 font-mono tracking-wider">
          <span className="uppercase text-[10px]">Source</span>
          <span className="text-slate-400 text-[11px] font-medium">{item.source}</span>
        </div>
      </div>
    </motion.div>
  )
}

export default function ThreatStats() {
  return (
    <section id="threat" className="relative max-w-7xl mx-auto px-6 md:px-10 py-28 overflow-hidden">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="mb-16"
      >
        <div
          className="text-xs font-semibold tracking-[0.2em] text-[#EF4444] mb-3 uppercase flex items-center gap-2 font-mono"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[#EF4444]" />
          01 · THE THREAT
        </div>
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-white leading-tight max-w-2xl mb-4">
          Falsehood outruns the fact-check. Every time.
        </h2>
        <p className="text-base sm:text-lg text-slate-400 max-w-xl leading-relaxed">
          By the time a claim is manually debunked, it has already reached millions of family group
          chats. Detection has to happen at the speed of the campaign — not the newsroom.
        </p>
      </motion.div>

      {/* Grid of Classic Professional Threat Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {THREAT_STATS.map((s, i) => (
          <ProfessionalStatCard key={s.label} item={s} index={i} />
        ))}
      </div>
    </section>
  )
}
