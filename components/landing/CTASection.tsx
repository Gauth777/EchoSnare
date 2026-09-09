'use client'

import React, { useRef, useState } from 'react'
import { motion } from 'framer-motion'
import Corners from './Corners'
import MagneticButton from './MagneticButton'

export default function CTASection() {
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

    setRotX((0.5 - py) * 7)
    setRotY((px - 0.5) * 9)
    setGlow({ x: px * 100, y: py * 100, opacity: 1 })
  }

  const handleMouseLeave = () => {
    setRotX(0)
    setRotY(0)
    setGlow(prev => ({ ...prev, opacity: 0 }))
  }

  return (
    <section id="cta" className="relative py-32 px-6 md:px-10 overflow-hidden text-center">
      {/* Subtle depth lighting */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(750px circle at 50% 50%, rgba(0,212,170,0.07) 0%, rgba(59,130,246,0.02) 50%, transparent 75%)',
        }}
      />

      <div className="max-w-3xl mx-auto" style={{ perspective: 1000 }}>
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          <div
            ref={cardRef}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            style={{
              transform: `perspective(1000px) rotateX(${rotX}deg) rotateY(${rotY}deg) translateY(${glow.opacity ? -6 : 0}px)`,
              transition: 'transform 0.22s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.25s, box-shadow 0.25s',
              borderColor: glow.opacity ? '#00D4AA' : '#161a22',
              boxShadow: glow.opacity
                ? '0 30px 60px -20px rgba(0, 212, 170, 0.3), inset 0 0 30px rgba(0, 212, 170, 0.05)'
                : '0 16px 50px rgba(0,0,0,0.85)',
            }}
            className="relative p-8 sm:p-14 border bg-[#06080d]/90 backdrop-blur-xl overflow-hidden group text-center"
          >
            {/* Specular cursor-following radial light */}
            <div
              className="absolute inset-0 pointer-events-none transition-opacity duration-300"
              style={{
                opacity: glow.opacity,
                background: `radial-gradient(550px circle at ${glow.x}% ${glow.y}%, rgba(0,212,170,0.14), transparent 65%)`,
              }}
            />

            <Corners color="#00D4AA" size={16} />

            <div
              className="text-xs font-bold tracking-[0.2em] text-[#00D4AA] mb-5 uppercase inline-flex items-center gap-2"
              style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)' }}
            >
              <span className="w-2 h-2 rounded-full bg-[#00D4AA] animate-ping" />
              SYSTEM STATUS: ALL AGENTS ACTIVE
            </div>

            <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white mb-5 leading-tight group-hover:text-slate-100 transition-colors">
              Run it yourself.
            </h2>

            <p className="text-base sm:text-lg leading-relaxed text-slate-300 max-w-xl mx-auto mb-10">
              Paste any claim. Type any real account. Drop any image URL. The dashboard is live —
              every score you see is computed the moment you ask for it.
            </p>

            <div className="flex justify-center">
              <MagneticButton href="/dashboard" variant="primary">
                ACCESS MISSION CONTROL <span className="text-[#00D4AA] group-hover:text-white transition-colors">→</span>
              </MagneticButton>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
