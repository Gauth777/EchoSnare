'use client'

import { useEffect, useRef, useState } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VerdictData {
  verdict:            'HIGH' | 'MEDIUM' | 'LOW'
  confidence:         number
  summary:            string
  temporal_score:     number
  linguistic_score:   number
  ai_operation_score: number
  accounts_analyzed:  number
  flagged_accounts:   number
}

interface Props {
  data: VerdictData
  /** Handles analyzed — embedded in the exported report */
  accounts?: string[]
  /** Linguistic cluster count — used in the narrative text */
  clusters?: number
  /** Raw analysis sections — embedded verbatim in the exported report */
  sections?: {
    temporal_coordination?: unknown
    linguistic_fingerprint?: unknown
    ai_operation?: unknown
  }
}

// ─── Constants ────────────────────────────────────────────────────────────────

const FONT: React.CSSProperties = {
  fontFamily: 'var(--font-jetbrains-mono, "Fira Code", monospace)',
}
const BORDER = '1px solid #162032'

const VERDICT_COLOR: Record<VerdictData['verdict'], string> = {
  HIGH:   '#EF4444',
  MEDIUM: '#F59E0B',
  LOW:    '#00D4AA',
}

function scoreColor(score: number): string {
  if (score < 40) return '#22C55E'
  if (score <= 70) return '#F59E0B'
  return '#EF4444'
}

// ─── Score arc (matches the dashboard overview threat-score gauges) ───────────

function ScoreArc({ score, name }: { score: number; name: string }) {
  const R = 32
  const C = 2 * Math.PI * R
  const filled = (score / 100) * C
  const color = scoreColor(score)

  return (
    <div
      style={{
        display:       'flex',
        flexDirection: 'column',
        alignItems:    'center',
        flex:          1,
        padding:       '8px',
      }}
    >
      <svg width="80" height="80" viewBox="0 0 80 80">
        <circle cx="40" cy="40" r={R} fill="none" stroke="#162032" strokeWidth="4" />
        <circle
          cx="40" cy="40" r={R}
          fill="none" stroke={color} strokeWidth="4"
          strokeDasharray={`${filled} ${C - filled}`}
          strokeLinecap="butt"
          transform="rotate(-90 40 40)"
        />
        <text
          x="40" y="38" textAnchor="middle"
          fill="#E2E8F0" fontSize="16" fontWeight="700"
          fontFamily="inherit" dominantBaseline="middle"
        >
          {score}
        </text>
      </svg>
      <span
        style={{
          ...FONT,
          fontSize:      '9px',
          letterSpacing: '0.1em',
          color:         '#94A3B8',
          marginTop:     '6px',
          textAlign:     'center',
        }}
      >
        {name}
      </span>
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function VerdictPanel({ data, accounts = [], clusters = 0, sections = {} }: Props) {
  const [exported, setExported] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const color = VERDICT_COLOR[data.verdict]

  const narrative =
    data.verdict === 'HIGH'
      ? `${data.flagged_accounts} of ${data.accounts_analyzed} accounts exhibit strong temporal and linguistic alignment across ${clusters} topic clusters, consistent with coordinated multi-account operation.`
      : data.verdict === 'MEDIUM'
      ? `${data.flagged_accounts} of ${data.accounts_analyzed} accounts show moderate behavioral similarity. Several accounts share posting intervals but linguistic fingerprints show partial variation.`
      : `Analysis across ${data.accounts_analyzed} accounts reveals independent posting behaviors and distinct linguistic patterns. No evidence of coordinated entity control.`

  function handleExport() {
    const payload = {
      export_type:       'echosnare_coordination_report',
      version:           '1.0',
      generated_at:      new Date().toISOString(),
      analyzed_accounts: accounts,
      verdict: {
        coordination_level: data.verdict,
        confidence:         data.confidence,
        summary:            data.summary,
        accounts_analyzed:  data.accounts_analyzed,
        flagged_accounts:   data.flagged_accounts,
      },
      component_scores: {
        temporal_coordination: data.temporal_score,
        linguistic_similarity: data.linguistic_score,
        ai_operation_pattern:  data.ai_operation_score,
      },
      sections,
    }

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `echosnare-coordination-report-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    setExported(true)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setExported(false), 2500)
  }

  return (
    <div
      style={{
        border:          `1px solid ${color}`,
        backgroundColor: '#07090e',
        padding:         '20px',
      }}
    >
      <div
        style={{
          display:  'flex',
          gap:      '24px',
          flexWrap: 'wrap',
        }}
      >
        {/* Left — verdict + narrative */}
        <div style={{ flex: '1 1 340px', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '16px', flexWrap: 'wrap', marginBottom: '14px' }}>
            <span
              style={{
                ...FONT,
                fontSize:      '11px',
                fontWeight:    700,
                letterSpacing: '0.18em',
                color:         '#94A3B8',
              }}
            >
              COORDINATION VERDICT
            </span>
            <span style={{ ...FONT, fontSize: '22px', fontWeight: 700, color, lineHeight: 1 }}>
              {data.verdict}
            </span>
            <span style={{ ...FONT, fontSize: '11px', letterSpacing: '0.1em', color: '#E2E8F0' }}>
              CONFIDENCE: {Math.round(data.confidence * 100)}%
            </span>
          </div>
          <div style={{ ...FONT, fontSize: '12px', color: '#CBD5E1', lineHeight: 1.7, maxWidth: '560px' }}>
            {narrative}
          </div>
        </div>

        {/* Right — three circular score indicators */}
        <div style={{ display: 'flex', flex: '0 1 320px', minWidth: '280px' }}>
          <ScoreArc score={data.temporal_score}     name="TEMPORAL" />
          <ScoreArc score={data.linguistic_score}   name="LINGUISTIC" />
          <ScoreArc score={data.ai_operation_score} name="AI OPERATION" />
        </div>
      </div>

      {/* Bottom — export */}
      <div
        style={{
          display:        'flex',
          justifyContent: 'flex-end',
          borderTop:      BORDER,
          marginTop:      '16px',
          paddingTop:     '16px',
        }}
      >
        <button
          onClick={handleExport}
          style={{
            ...FONT,
            fontSize:        '10px',
            fontWeight:      700,
            letterSpacing:   '0.1em',
            color:           '#000000',
            backgroundColor: '#00D4AA',
            border:          'none',
            padding:         '10px 18px',
            cursor:          'pointer',
            boxShadow:       '0 0 15px rgba(0, 212, 170, 0.3)',
          }}
        >
          EXPORT COORDINATION REPORT →
        </button>
      </div>

      {/* Toast */}
      {exported && (
        <div
          style={{
            ...FONT,
            position:        'fixed',
            right:           '24px',
            bottom:          '24px',
            backgroundColor: '#04060a',
            border:          '1px solid #00D4AA',
            color:           '#00D4AA',
            fontSize:        '11px',
            letterSpacing:   '0.08em',
            padding:         '12px 18px',
            zIndex:          100,
          }}
        >
          ✓ Report exported
        </div>
      )}
    </div>
  )
}
