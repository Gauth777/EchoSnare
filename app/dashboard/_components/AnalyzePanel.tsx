'use client'

import { useState } from 'react'
import type { InvestigationResult } from '@/types'

const MONO: React.CSSProperties = { fontFamily: 'var(--font-jetbrains-mono, "Fira Code", monospace)' }
const BORDER = '1px solid #1E2D4A'

const TOPIC_PRESETS = [
  { label: 'Delhi strike today', query: 'Delhi strike today', type: 'topic' },
  { label: 'Samay Raina controversy', query: 'Samay Raina controversy', type: 'topic' },
  { label: 'EVM voting hack claim', query: 'EVM voting hack claim', type: 'topic' },
  { label: 'Bluesky Handle', query: 'jay.bsky.social', type: 'handle' },
  { label: 'WhatsApp Forward', query: 'FWD: WHO internal report confirms nimbu paani cures cancer! Share before deleted.', type: 'text' },
]

interface Props {
  onInvestigationComplete?: (data: InvestigationResult) => void
}

export default function AnalyzePanel({ onInvestigationComplete }: Props) {
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState<'topic' | 'text'>('topic')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleInvestigate(selectedQuery?: string) {
    const q = selectedQuery || query
    if (!q.trim() || loading) return

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/investigate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, mode }),
      })

      if (!response.ok) throw new Error('Investigation request failed')
      const data = (await response.json()) as InvestigationResult
      if (onInvestigationComplete) {
        onInvestigationComplete(data)
      }
    } catch {
      setError('Investigation failed. Verify Python backend status and try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section style={{ borderTop: '3px solid #00D4AA', borderBottom: BORDER, background: '#0F1A2B' }}>
      <div style={{ padding: '20px 22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#00D4AA', boxShadow: '0 0 10px #00D4AA' }} />
            <span style={{ ...MONO, fontSize: 11, fontWeight: 700, color: '#F4F7FB', letterSpacing: '0.14em' }}>
              WHAT DO YOU WANT TO INVESTIGATE?
            </span>
          </div>

          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => setMode('topic')}
              style={{
                ...MONO,
                padding: '5px 10px',
                fontSize: 10,
                fontWeight: 650,
                border: mode === 'topic' ? '1px solid #00D4AA' : '1px solid #263957',
                background: mode === 'topic' ? '#122B3F' : '#091220',
                color: mode === 'topic' ? '#00D4AA' : '#8798B1',
                cursor: 'pointer',
              }}
            >
              INVESTIGATE TOPIC / CLAIM
            </button>
            <button
              onClick={() => setMode('text')}
              style={{
                ...MONO,
                padding: '5px 10px',
                fontSize: 10,
                fontWeight: 650,
                border: mode === 'text' ? '1px solid #00D4AA' : '1px solid #263957',
                background: mode === 'text' ? '#122B3F' : '#091220',
                color: mode === 'text' ? '#00D4AA' : '#8798B1',
                cursor: 'pointer',
              }}
            >
              ANALYZE DIRECT TEXT
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleInvestigate()}
              placeholder={
                mode === 'topic'
                  ? 'Enter a topic, event, person, claim, handle (e.g. @jay.bsky.social), or URL…'
                  : 'Paste exact social media text, forward excerpt, or claim to evaluate…'
              }
              style={{
                ...MONO,
                width: '100%',
                boxSizing: 'border-box',
                background: '#091322',
                color: '#F4F7FB',
                border: '1px solid #2C4263',
                padding: '13px 16px',
                fontSize: 13,
                outline: 'none',
              }}
            />
          </div>

          <button
            onClick={() => handleInvestigate()}
            disabled={loading || !query.trim()}
            style={{
              ...MONO,
              padding: '0 24px',
              border: 0,
              background: loading || !query.trim() ? '#203248' : '#00D4AA',
              color: loading || !query.trim() ? '#6A7D96' : '#07131F',
              fontWeight: 750,
              fontSize: 11,
              letterSpacing: '0.12em',
              cursor: loading || !query.trim() ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {loading ? 'EXECUTING PIPELINE…' : 'START INVESTIGATION →'}
          </button>
        </div>

        <div style={{ ...MONO, display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 9, color: '#64748B', letterSpacing: '0.08em' }}>QUICK PRESETS:</span>
          {TOPIC_PRESETS.map(preset => (
            <button
              key={preset.label}
              onClick={() => {
                setQuery(preset.query)
                setMode(preset.type as 'topic' | 'text')
                handleInvestigate(preset.query)
              }}
              style={{
                ...MONO,
                border: '1px solid #20334E',
                background: '#0D1829',
                color: '#94A3B8',
                padding: '4px 8px',
                fontSize: 9,
                cursor: 'pointer',
              }}
            >
              {preset.label}
            </button>
          ))}
        </div>

        {error && (
          <div style={{ ...MONO, marginTop: 10, color: '#EF4444', fontSize: 11 }}>
            ⚠️ {error}
          </div>
        )}
      </div>
    </section>
  )
}
