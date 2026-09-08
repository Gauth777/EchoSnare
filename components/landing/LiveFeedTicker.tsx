'use client'

import React, { useEffect, useState } from 'react'

interface FeedItem {
  id: string
  title: string
  source: string
  risk_level: string
  published: string
}

export default function LiveFeedTicker() {
  const [items, setItems] = useState<FeedItem[]>([])

  useEffect(() => {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 10000)
    fetch('/api/live-feed', { signal: ctrl.signal })
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (d?.items?.length) setItems(d.items.slice(0, 8))
      })
      .catch(() => {})
      .finally(() => clearTimeout(t))
    return () => {
      ctrl.abort()
      clearTimeout(t)
    }
  }, [])

  if (items.length === 0) return null

  const RISK: Record<string, string> = {
    HIGH: '#EF4444',
    MED: '#F59E0B',
    LOW: '#22C55E',
  }

  return (
    <section className="border-t border-b border-[#141820] bg-[#050507]/85 backdrop-blur-md overflow-hidden flex items-stretch select-none">
      <div
        className="flex items-center gap-2.5 text-[9.5px] tracking-[0.16em] text-[#00D4AA] px-5 py-3 border-r border-[#141820] bg-[#07070a] whitespace-nowrap shrink-0 z-10"
        style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)' }}
      >
        <span className="w-2 h-2 rounded-full bg-[#00D4AA] animate-ping inline-block" />
        LIVE INTEL — REAL DEBUNKS, INGESTED NOW
      </div>

      <div className="flex items-center overflow-hidden flex-1 group">
        <div className="flex w-max animate-[lp-marquee_48s_linear_infinite] group-hover:[animation-play-state:paused]">
          {[...items, ...items].map((it, i) => (
            <span
              key={`${it.id}-${i}`}
              className="text-[11px] text-slate-400 px-6 whitespace-nowrap inline-flex items-center gap-2.5 hover:text-white transition-colors"
              style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)' }}
            >
              <span
                className="text-[9px] tracking-widest font-bold px-1.5 py-0.5 rounded border"
                style={{
                  color: RISK[it.risk_level] ?? '#F59E0B',
                  borderColor: `${RISK[it.risk_level] ?? '#F59E0B'}44`,
                  backgroundColor: `${RISK[it.risk_level] ?? '#F59E0B'}15`,
                }}
              >
                {it.risk_level}
              </span>
              <span className="text-slate-200">{it.title}</span>
              <span className="text-slate-500 text-[10px]">· {it.source.toUpperCase()}</span>
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}
