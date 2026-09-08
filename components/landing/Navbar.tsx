'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, useScroll } from 'framer-motion'

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [hoveredNav, setHoveredNav] = useState<string | null>(null)
  const { scrollY } = useScroll()

  useEffect(() => {
    return scrollY.on('change', latest => {
      setScrolled(latest > 30)
    })
  }, [scrollY])

  const navItems = [
    { label: 'THREAT', href: '#threat' },
    { label: 'SYSTEM', href: '#system' },
    { label: 'PIPELINE', href: '#pipeline' },
  ]

  return (
    <motion.header
      initial={{ y: -60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-[#040405]/90 backdrop-blur-xl border-b border-[#141820] shadow-[0_4px_30px_rgba(0,0,0,0.8)] py-3'
          : 'bg-transparent border-b border-transparent py-4'
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 md:px-10 flex items-center justify-between">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-3 group outline-none">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00D4AA] opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#00D4AA]" />
          </span>
          <div className="flex flex-col">
            <span
              className="text-sm font-bold tracking-[0.24em] text-white group-hover:text-[#00D4AA] transition-colors"
              style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)' }}
            >
              ECHOSNARE
            </span>
            <span
              className="text-[8px] tracking-[0.2em] text-slate-500 uppercase -mt-0.5"
              style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)' }}
            >
              AI DEFENSE COMMAND
            </span>
          </div>
        </Link>

        {/* Navigation Links */}
        <nav className="hidden md:flex items-center gap-8">
          {navItems.map(item => (
            <a
              key={item.label}
              href={item.href}
              onMouseEnter={() => setHoveredNav(item.label)}
              onMouseLeave={() => setHoveredNav(null)}
              className="relative py-1 text-xs tracking-[0.18em] font-semibold text-slate-100 hover:text-[#00D4AA] transition-colors"
              style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)' }}
            >
              {item.label}
              {hoveredNav === item.label && (
                <motion.span
                  layoutId="navUnderline"
                  className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#00D4AA] to-[#3B82F6] shadow-[0_0_8px_#00D4AA]"
                  transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
                />
              )}
            </a>
          ))}
        </nav>

        {/* CTA Button */}
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard"
            className="group relative inline-flex items-center gap-2 overflow-hidden px-5 py-2 text-xs font-bold tracking-wider text-black transition-transform active:scale-95"
            style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)' }}
          >
            {/* Background pill */}
            <span className="absolute inset-0 bg-[#00D4AA] group-hover:bg-[#2ae0b9] transition-colors duration-200" />

            {/* Subtle sweep highlight */}
            <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out" />

            <span className="relative z-10 flex items-center gap-1.5 font-bold">
              LAUNCH
              <span className="inline-block transition-transform duration-200 group-hover:translate-x-0.5">→</span>
            </span>
          </Link>
        </div>
      </div>
    </motion.header>
  )
}
