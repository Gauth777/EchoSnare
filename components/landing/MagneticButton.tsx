'use client'

import React, { useRef, useState } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'

interface MagneticButtonProps {
  children: React.ReactNode
  href?: string
  variant?: 'primary' | 'secondary'
  className?: string
  onClick?: () => void
}

export default function MagneticButton({
  children,
  href,
  variant = 'primary',
  className = '',
  onClick,
}: MagneticButtonProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState({ x: 0, y: 0 })

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const { clientX, clientY } = e
    if (!ref.current) return
    const { left, top, width, height } = ref.current.getBoundingClientRect()
    const middleX = clientX - (left + width / 2)
    const middleY = clientY - (top + height / 2)
    setPosition({ x: middleX * 0.22, y: middleY * 0.22 })
  }

  const reset = () => {
    setPosition({ x: 0, y: 0 })
  }

  const isPrimary = variant === 'primary'

  const content = (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={reset}
      animate={{ x: position.x, y: position.y }}
      transition={{ type: 'spring', stiffness: 260, damping: 18, mass: 0.1 }}
      className={`relative inline-flex items-center justify-center group overflow-hidden cursor-pointer ${className}`}
    >
      {isPrimary ? (
        <>
          {/* Solid high-contrast bright cyan button */}
          <span className="absolute inset-0 bg-[#00D4AA] group-hover:bg-[#2ae0b9] transition-colors duration-200" />

          {/* Animated specular sweep highlight */}
          <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/35 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out" />

          {/* Luminous cyan glow */}
          <span className="absolute inset-0 shadow-[0_0_35px_rgba(0,212,170,0.5)] group-hover:shadow-[0_0_50px_rgba(0,212,170,0.8)] transition-shadow duration-300 pointer-events-none" />

          {/* Deep pitch-black high-contrast text */}
          <span
            className="relative z-10 flex items-center gap-2 px-8 py-4 text-xs md:text-sm font-extrabold tracking-[0.16em] text-black transition-transform duration-200 group-hover:scale-[1.02]"
            style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)' }}
          >
            {children}
          </span>
        </>
      ) : (
        <>
          {/* Secondary high-contrast card outline style */}
          <span className="absolute inset-0 border-2 border-slate-500/80 group-hover:border-[#00D4AA] transition-colors duration-200 bg-[#0d1526]/90 backdrop-blur-md" />
          <span className="absolute inset-0 bg-[#00D4AA]/0 group-hover:bg-[#00D4AA]/10 transition-colors duration-200" />
          <span className="absolute inset-0 shadow-[0_0_20px_rgba(0,0,0,0.6)] pointer-events-none" />

          {/* Bright pure-white text that pops immediately from the background */}
          <span
            className="relative z-10 flex items-center gap-2 px-8 py-4 text-xs md:text-sm font-bold tracking-[0.16em] text-white group-hover:text-[#00D4AA] transition-colors duration-200"
            style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)' }}
          >
            {children}
          </span>
        </>
      )}
    </motion.div>
  )

  if (href) {
    if (href.startsWith('#')) {
      return (
        <a href={href} onClick={onClick} className="inline-block no-underline">
          {content}
        </a>
      )
    }
    return (
      <Link href={href} onClick={onClick} className="inline-block no-underline">
        {content}
      </Link>
    )
  }

  return (
    <button onClick={onClick} className="inline-block border-none bg-transparent p-0">
      {content}
    </button>
  )
}
