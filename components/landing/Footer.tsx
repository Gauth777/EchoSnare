'use client'

import React from 'react'

export default function Footer() {
  return (
    <footer className="border-t border-[#141820] bg-[#000000] py-8 px-6 md:px-10 relative z-10">
      <div
        className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs tracking-[0.14em] text-slate-500 font-medium"
        style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)' }}
      >
        <div className="flex items-center gap-2 text-slate-400">
          <span className="text-[#00D4AA] font-bold">ECHOSNARE v1.0</span>
          <span>·</span>
          <span>DETECT. TRACE. NEUTRALIZE.</span>
        </div>

        <div className="flex items-center gap-2 text-slate-300">
          <span className="w-2 h-2 rounded-full bg-[#22C55E] animate-pulse inline-block" />
          <span>ALL SYSTEMS OPERATIONAL</span>
        </div>
      </div>
    </footer>
  )
}
