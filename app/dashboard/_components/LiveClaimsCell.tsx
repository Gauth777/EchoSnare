'use client'

import { useEffect, useState } from 'react'

const MONO: React.CSSProperties = {
  fontFamily: 'var(--font-jetbrains-mono, "Fira Code", monospace)',
}

// 5th Overview metric — live claim count from the fact-checker feed
export default function LiveClaimsCell() {
  const [count, setCount] = useState<number | null>(null)

  useEffect(() => {
    fetch('/api/live-feed')
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (data && typeof data.total_count === 'number') setCount(data.total_count)
      })
      .catch(() => { /* keep "--" */ })
  }, [])

  return (
    <div style={{ padding: '16px 24px' }}>
      <div
        style={{
          ...MONO,
          fontSize: '10px',
          letterSpacing: '0.1em',
          color: '#4A5568',
          marginBottom: '10px',
        }}
      >
        LIVE CLAIMS TODAY
      </div>
      <div
        style={{
          ...MONO,
          fontSize: '32px',
          fontWeight: 700,
          color: '#22C55E',
          lineHeight: 1,
          letterSpacing: '-0.01em',
        }}
      >
        {count ?? '--'}
      </div>
    </div>
  )
}
