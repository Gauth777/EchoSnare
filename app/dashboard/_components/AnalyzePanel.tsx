'use client'

import { useState, useEffect } from 'react'
import type { InvestigationResult } from '@/types'

const MONO: React.CSSProperties = { fontFamily: 'var(--font-jetbrains-mono, "Fira Code", monospace)' }
const BORDER = '1px solid #162032'

const TOPIC_PRESETS = [
  { label: 'Delhi NEET protest (@neet_leak)', query: '@neet_leak_alert: NEET 2024 paper leaked in Delhi exam centers, answer key circulating #NEETScam', type: 'text' },
  { label: 'Account: @TruthVoter2024', query: '@TruthVoter2024: EVM machine tampered in South Delhi polling center #EVMHack', type: 'text' },
  { label: 'Delhi strike today', query: 'Delhi strike today', type: 'topic' },
  { label: 'Samay Raina controversy', query: 'Samay Raina controversy', type: 'topic' },
  { label: 'WhatsApp Miracle Cure', query: 'FWD: WHO internal report confirms nimbu paani cures cancer! Share before deleted.', type: 'text' },
  { label: 'Bluesky Handle', query: 'jay.bsky.social', type: 'handle' },
]

interface Props {
  onInvestigationComplete?: (data: InvestigationResult) => void
}

export default function AnalyzePanel({ onInvestigationComplete }: Props) {
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState<'topic' | 'text'>('topic')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Restore previous query and mode from sessionStorage across tab navigation
  useEffect(() => {
    try {
      const savedQuery = sessionStorage.getItem('echosnare_active_query')
      const savedMode = sessionStorage.getItem('echosnare_active_mode')
      if (savedQuery) setQuery(savedQuery)
      if (savedMode === 'topic' || savedMode === 'text') setMode(savedMode)
    } catch {}
  }, [])

  async function handleInvestigate(selectedQuery?: string) {
    const q = selectedQuery || query
    if (!q.trim() || loading) return

    setLoading(true)
    setError(null)

    // Save active query and mode immediately
    try {
      sessionStorage.setItem('echosnare_active_query', q)
      sessionStorage.setItem('echosnare_active_mode', mode)
    } catch {}

    try {
      const response = await fetch('/api/investigate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, mode }),
      })

      if (!response.ok) throw new Error('Investigation request failed')
      const data = (await response.json()) as InvestigationResult

      // Persist completed investigation in sessionStorage
      try {
        sessionStorage.setItem('echosnare_active_investigation', JSON.stringify(data))
      } catch {}

      // Dispatch event for network graph and other panels to catch immediately
      window.dispatchEvent(new CustomEvent('echosnare:investigation-complete', { detail: data }))

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
    <section style={{ borderTop: '3px solid #00D4AA', borderBottom: BORDER, background: '#07090e' }}>
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
                border: mode === 'topic' ? '1px solid #00D4AA' : '1px solid #162032',
                background: mode === 'topic' ? 'rgba(0, 212, 170, 0.12)' : '#04060a',
                color: mode === 'topic' ? '#00D4AA' : '#94A3B8',
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
                border: mode === 'text' ? '1px solid #00D4AA' : '1px solid #162032',
                background: mode === 'text' ? 'rgba(0, 212, 170, 0.12)' : '#04060a',
                color: mode === 'text' ? '#00D4AA' : '#94A3B8',
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
                background: '#04060a',
                color: '#F4F7FB',
                border: '1px solid #162032',
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
              background: loading || !query.trim() ? '#121a28' : '#00D4AA',
              color: loading || !query.trim() ? '#64748B' : '#000000',
              fontWeight: 750,
              fontSize: 11,
              letterSpacing: '0.12em',
              cursor: loading || !query.trim() ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap',
              boxShadow: loading || !query.trim() ? 'none' : '0 0 15px rgba(0, 212, 170, 0.3)',
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
                border: '1px solid #162032',
                background: '#04060a',
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

        <div style={{ ...MONO, display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, fontSize: 10, color: '#00D4AA', opacity: 0.9 }}>
          <span>💡</span>
          <span>
            <strong>Track Specific Account:</strong> Prefix your message with any handle like <code>@user_handle: fake claim...</code> to evaluate that account as the primary origin hub and visualize its propagation network.
          </span>
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
