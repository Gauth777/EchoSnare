'use client'

import React, { useEffect, useState, useRef } from 'react'
import dynamic from 'next/dynamic'
import { motion } from 'framer-motion'
import Corners from './Corners'
import MagneticButton from './MagneticButton'

// 3D R3F Particle/Node Network Canvas — layered together with the Radar Concentric background
const ParticleNetwork = dynamic(() => import('./ParticleNetwork'), {
  ssr: false,
  loading: () => null,
})

const DECODE_GLYPHS = 'ABCDEFGHKMNPRSTUVXYZ023456789<>/#$%&*+='

function DecodeText({ text, delay = 0 }: { text: string; delay?: number }) {
  const [out, setOut] = useState(text)

  useEffect(() => {
    let revealed = 0
    let frame = 0
    let id: ReturnType<typeof setInterval>
    const start = setTimeout(() => {
      id = setInterval(() => {
        frame++
        if (frame % 3 === 0) revealed++
        if (revealed >= text.length) {
          setOut(text)
          clearInterval(id)
          return
        }
        setOut(
          text
            .split('')
            .map((ch, i) => {
              if (i < revealed || ch === ' ') return ch
              return DECODE_GLYPHS[Math.floor(Math.random() * DECODE_GLYPHS.length)]
            })
            .join('')
        )
      }, 36)
    }, delay)
    return () => {
      clearTimeout(start)
      clearInterval(id)
    }
  }, [text, delay])

  return <>{out}</>
}

export default function Hero() {
  const [typed, setTyped] = useState('')
  const heroContentRef = useRef<HTMLDivElement>(null)
  const PHRASE = 'Detect. Trace. Neutralize.'

  useEffect(() => {
    let i = 0
    const id = setInterval(() => {
      i++
      setTyped(PHRASE.slice(0, i))
      if (i >= PHRASE.length) clearInterval(id)
    }, 55)
    return () => clearInterval(id)
  }, [])

  const chips = [
    { k: 'GROQ LLAMA-3.3-70B', c: '#00D4AA' },
    { k: 'NEO4J GRAPH', c: '#F59E0B' },
    { k: 'ELA + 3-MODEL ENSEMBLE', c: '#7C3AED' },
    { k: 'SARVAM AI', c: '#FB923C' },
  ]

  return (
    <section className="relative min-h-[94vh] flex items-center border-b border-[#141820] overflow-hidden pt-28 pb-20">
      {/* 3D R3F Particle / Node Network layered over the radar background */}
      <ParticleNetwork />

      {/* Subtle depth gradient allowing both concentric radar background & 3D particle nodes to shine */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(950px circle at 25% 45%, rgba(0, 0, 0, 0.75) 0%, rgba(0, 0, 0, 0.4) 60%, transparent 85%)',
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'linear-gradient(180deg, rgba(0, 0, 0, 0.6) 0%, transparent 25%, transparent 75%, #000000 100%)',
        }}
      />

      {/* Hero Content Container */}
      <div
        ref={heroContentRef}
        className="relative max-w-7xl mx-auto px-6 md:px-10 w-full z-10"
      >
        <div className="max-w-2xl">
          {/* Badge row */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="inline-flex items-center gap-2.5 px-3.5 py-1.5 mb-8 border border-[#00D4AA]/30 bg-[#00D4AA]/[0.08] backdrop-blur-md"
            style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)' }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#00D4AA] animate-pulse" />
            <span className="text-[10px] md:text-[11px] font-semibold tracking-[0.18em] text-[#00D4AA]">
              10 AI AGENTS · LIVE INFERENCE · NOTHING MOCKED
            </span>
          </motion.div>

          {/* Heading */}
          <motion.h1
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight leading-[1.04] mb-6"
          >
            <span className="bg-gradient-to-b from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
              An AI that
            </span>
            <br />
            <span className="bg-gradient-to-r from-[#00D4AA] via-[#38BDF8] to-[#A855F7] bg-clip-text text-transparent drop-shadow-[0_0_35px_rgba(0,212,170,0.35)]">
              <DecodeText text="fights AI." delay={300} />
            </span>
          </motion.h1>

          {/* Intro paragraph */}
          <motion.p
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="text-base sm:text-lg leading-relaxed text-slate-300 max-w-xl mb-4"
          >
            Misinformation in India spreads through WhatsApp forwards, coordinated bot networks,
            and AI-generated images — in Hindi, Hinglish, and English.{' '}
            <span className="text-white font-medium">EchoSnare hunts all three, in real time.</span>
          </motion.p>

          {/* Typewriter terminal readout */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="text-xs sm:text-sm font-semibold tracking-[0.24em] text-[#00D4AA] mb-9 min-h-[22px]"
            style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)' }}
          >
            {typed}
            <span className="animate-pulse">▌</span>
          </motion.div>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.5 }}
            className="flex flex-wrap items-center gap-4 mb-11"
          >
            <MagneticButton href="/dashboard" variant="primary">
              ACCESS MISSION CONTROL →
            </MagneticButton>

            <MagneticButton href="#system" variant="secondary">
              SEE THE SYSTEM
            </MagneticButton>
          </motion.div>

          {/* Live chips — high-contrast illuminated badges */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="flex flex-wrap gap-2.5"
          >
            {chips.map(chip => (
              <span
                key={chip.k}
                className="text-[10px] md:text-[11px] font-bold tracking-[0.14em] px-3 py-1.5 bg-[#09101c]/95 backdrop-blur-md border rounded flex items-center gap-2 shadow-md transition-all hover:scale-105"
                style={{
                  fontFamily: 'var(--font-jetbrains-mono, monospace)',
                  color: '#FFFFFF',
                  borderColor: chip.c,
                  boxShadow: `0 0 14px ${chip.c}40`,
                }}
              >
                <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: chip.c }} />
                <span>{chip.k}</span>
              </span>
            ))}
          </motion.div>
        </div>

        {/* Live simulation tactical legend (desktop view) */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.8 }}
          className="hidden lg:flex absolute right-10 bottom-4 flex-col gap-2.5 p-4 bg-[#090f1a]/95 backdrop-blur-md border border-[#22334d] shadow-2xl"
          style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)' }}
        >
          <Corners color="#00D4AA" size={8} />
          <span className="text-[10px] tracking-widest text-[#00D4AA] font-bold uppercase mb-0.5">
            NETWORK GRAPH TELEMETRY
          </span>
          {[
            ['#3B82F6', 'AUTHENTIC ACCOUNT'],
            ['#EF4444', 'AMPLIFYING FALSEHOOD'],
            ['#00D4AA', 'DETECTED BY ECHOSNARE'],
          ].map(([c, l]) => (
            <span key={l} className="flex items-center gap-2.5 text-[10.5px] font-semibold text-slate-100 tracking-wider">
              <span className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: c }} />
              {l}
            </span>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
