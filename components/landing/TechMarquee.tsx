'use client'

import React from 'react'

const STACK = [
  'FastAPI',
  'LangGraph',
  'Groq Llama-3.3-70B',
  'Neo4j AuraDB',
  'Sarvam AI',
  'Hugging Face',
  'scikit-learn',
  'Next.js',
  'D3.js',
  'Bluesky API',
  'Pillow ELA',
]

export default function TechMarquee() {
  return (
    <section className="relative border-t border-b border-[#141820] bg-[#050507]/80 backdrop-blur-md py-6 overflow-hidden select-none group">
      {/* Side gradient fades to pure black */}
      <div className="absolute top-0 bottom-0 left-0 w-24 bg-gradient-to-r from-[#000000] to-transparent z-10 pointer-events-none" />
      <div className="absolute top-0 bottom-0 right-0 w-24 bg-gradient-to-l from-[#000000] to-transparent z-10 pointer-events-none" />

      <div className="flex w-max animate-[lp-marquee_32s_linear_infinite] group-hover:[animation-play-state:paused]">
        {[...STACK, ...STACK, ...STACK].map((t, i) => (
          <span
            key={`${t}-${i}`}
            className="text-xs tracking-[0.18em] font-semibold text-slate-400 hover:text-[#00D4AA] transition-colors px-6 whitespace-nowrap inline-flex items-center gap-6"
            style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)' }}
          >
            <span>{t.toUpperCase()}</span>
            <span className="text-[#00D4AA]/35 text-[9px]">◆</span>
          </span>
        ))}
      </div>
    </section>
  )
}
