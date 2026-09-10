'use client'

import { useState, useEffect, useRef } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

type Severity = 'HIGH' | 'MED' | 'LOW'

interface AlertItem {
  id:        string
  severity:  Severity
  message:   string
  campaign:  string
  timestamp: number
  isNew:     boolean
}

function formatRelativeTime(ts: number): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000))
  if (diffSec < 35) return 'just now'
  if (diffSec < 90) return '1m ago'
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  return `${diffHr}h ago`
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const FONT: React.CSSProperties = {
  fontFamily: 'var(--font-jetbrains-mono, "Fira Code", monospace)',
}

const SEV_COLOR: Record<Severity, string> = {
  HIGH: '#EF4444',
  MED:  '#F59E0B',
  LOW:  '#00D4AA',
}

const INITIAL_ALERTS_DATA: Omit<AlertItem, 'isNew' | 'timestamp'>[] = [
  {
    id: 'i1', severity: 'HIGH',
    message:  'Coordinated burst detected — 847 accounts sharing identical narrative within 4 min window',
    campaign: 'Operation Pulse',
  },
  {
    id: 'i2', severity: 'HIGH',
    message:  'State-level pattern identified — 94% confidence',
    campaign: 'Operation Pulse',
  },
  {
    id: 'i3', severity: 'MED',
    message:  'Deepfake image flagged in 3 active campaigns',
    campaign: 'MedFear',
  },
  {
    id: 'i4', severity: 'MED',
    message:  'Health misinfo cluster expanding — 312 accounts',
    campaign: 'MedFear',
  },
  {
    id: 'i5', severity: 'LOW',
    message:  'Bot cluster expanding — monitoring active',
    campaign: 'ReviewStorm',
  },
]

// 8-item rotating pool for live simulation
const ALERT_POOL: Omit<AlertItem, 'id' | 'timestamp' | 'isNew'>[] = [
  { severity: 'HIGH', message: 'Cross-platform amplification surge — 3 platforms synchronised',      campaign: 'Operation Pulse' },
  { severity: 'HIGH', message: 'Narrative velocity spike — 3.4× above 24h baseline',                campaign: 'Operation Pulse' },
  { severity: 'MED',  message: 'New amplifier cluster joined — 12 accounts added in 6 min',          campaign: 'Operation Pulse' },
  { severity: 'MED',  message: 'Audio deepfake detected — 89% confidence rating',                    campaign: 'MedFear'         },
  { severity: 'MED',  message: 'Geographic spread detected — 4 new districts in 30 min',             campaign: 'MedFear'         },
  { severity: 'LOW',  message: 'Sentiment manipulation spike — competing products targeted',          campaign: 'ReviewStorm'     },
  { severity: 'HIGH', message: 'State actor fingerprint matched — 91% pattern similarity',           campaign: 'MedFear'         },
  { severity: 'LOW',  message: 'Bot cluster dormancy broken — 78 accounts reactivated',              campaign: 'ReviewStorm'     },
]

// ─── Component ────────────────────────────────────────────────────────────────

export default function AlertFeed() {
  const [alerts, setAlerts] = useState<AlertItem[]>(() => {
    const baseOffsets = [2 * 60 * 1000, 11 * 60 * 1000, 23 * 60 * 1000, 45 * 60 * 1000, 75 * 60 * 1000]
    return INITIAL_ALERTS_DATA.map((a, i) => ({
      ...a,
      timestamp: Date.now() - (baseOffsets[i] || 60000),
      isNew: false,
    }))
  })
  const [isLoading, setIsLoading] = useState(true)
  const [, setTick] = useState(0)

  const poolRef     = useRef(0)
  const counterRef  = useRef(0)
  const flashTimers = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => {
    const t = setTimeout(() => setIsLoading(false), 700)
    return () => clearTimeout(t)
  }, [])

  // Periodically refresh relative times
  useEffect(() => {
    const tickInterval = setInterval(() => {
      setTick(prev => prev + 1)
    }, 10000)
    return () => clearInterval(tickInterval)
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      const template = ALERT_POOL[poolRef.current % ALERT_POOL.length]
      poolRef.current++
      const newId = `live-${Date.now()}-${++counterRef.current}`

      setAlerts(prev => {
        const next: AlertItem = { ...template, id: newId, timestamp: Date.now(), isNew: true }
        return [next, ...prev].slice(0, 20)
      })

      // Drop the isNew flag after 2s (animation finishes, border transitions to severity color)
      const t = setTimeout(() => {
        setAlerts(prev => prev.map(a => a.id === newId ? { ...a, isNew: false } : a))
      }, 2000)
      flashTimers.current.push(t)
    }, 25000)

    return () => {
      clearInterval(interval)
      flashTimers.current.forEach(clearTimeout)
    }
  }, [])

  function exportEvidence() {
    const payload = {
      exported_at: new Date().toISOString(),
      source:      'EchoSnare v1.0.0',
      total:       alerts.length,
      alerts: alerts.map(({ id, severity, message, campaign, timestamp }) => ({
        id, severity, message, campaign, timestamp: formatRelativeTime(timestamp),
      })),
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `echosnare-evidence-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* ── Panel header ─────────────────────────────────────────────────── */}
      <div
        style={{
          ...FONT,
          display:       'flex',
          alignItems:    'center',
          height:        '36px',
          flexShrink:    0,
          padding:       '0 16px',
          borderBottom:  '1px solid #162032',
          background:    '#05070c',
          fontSize:      '10px',
          letterSpacing: '0.1em',
          color:         '#94A3B8',
          gap:           '8px',
        }}
      >
        {/* Pulsing red dot */}
        <span
          className="st-pulse-dot"
          style={{
            display:         'inline-block',
            width:           '6px',
            height:          '6px',
            borderRadius:    '50%',
            backgroundColor: '#EF4444',
            flexShrink:      0,
          }}
        />
        <span>LIVE ALERTS</span>
        <span style={{ marginLeft: 'auto' }}>{`${alerts.length} TODAY`}</span>
      </div>

      {/* ── Scrollable alert list ────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', background: '#07090e' }}>
        {isLoading && [...Array(5)].map((_, i) => (
          <div key={i} style={{ padding: '10px 14px', borderBottom: '1px solid #162032' }}>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
              <div className="st-skeleton" style={{ width: '32px', height: '16px', animationDelay: `${i*0.1}s` }} />
              <div className="st-skeleton" style={{ flex: 1, height: '10px', animationDelay: `${i*0.1+0.05}s` }} />
              <div className="st-skeleton" style={{ width: '40px', height: '10px', animationDelay: `${i*0.1+0.1}s` }} />
            </div>
            <div className="st-skeleton" style={{ height: '10px', width: '90%', marginBottom: '4px', animationDelay: `${i*0.1+0.15}s` }} />
            <div className="st-skeleton" style={{ height: '10px', width: '70%', animationDelay: `${i*0.1+0.2}s` }} />
          </div>
        ))}
        {!isLoading && alerts.map(alert => (
          <div
            key={alert.id}
            className={`st-alert-card sev-${alert.severity}${alert.isNew ? ' st-alert-new' : ''}`}
            style={{
              padding:         '10px 14px',
              borderBottom:    '1px solid #162032',
              backgroundColor: '#04060a',
            }}
          >
            {/* Row 1: severity badge + campaign + timestamp */}
            <div
              style={{
                ...FONT,
                display:      'flex',
                alignItems:   'center',
                gap:          '8px',
                marginBottom: '5px',
              }}
            >
              <span
                style={{
                  fontSize:        '9px',
                  fontWeight:      700,
                  letterSpacing:   '0.08em',
                  padding:         '2px 6px',
                  backgroundColor: SEV_COLOR[alert.severity],
                  color:           '#000000',
                  flexShrink:      0,
                }}
              >
                {alert.severity}
              </span>
              <span
                style={{
                  fontSize:     '10px',
                  color:        '#CBD5E1',
                  flex:         1,
                  minWidth:     0,
                  overflow:     'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace:   'nowrap',
                }}
              >
                {alert.campaign}
              </span>
              <span style={{ fontSize: '9px', color: '#94A3B8', whiteSpace: 'nowrap', flexShrink: 0 }}>
                {formatRelativeTime(alert.timestamp)}
              </span>
            </div>

            {/* Row 2: message body */}
            <div style={{ ...FONT, fontSize: '11px', color: '#E2E8F0', lineHeight: 1.5 }}>
              {alert.message}
            </div>
          </div>
        ))}
      </div>

      {/* ── Evidence export ──────────────────────────────────────────────────── */}
      <div
        style={{
          flexShrink:  0,
          padding:     '12px 14px',
          borderTop:   '1px solid #162032',
          background:  '#05070c',
        }}
      >
        <button
          onClick={exportEvidence}
          style={{
            ...FONT,
            width:           '100%',
            padding:         '8px 0',
            fontSize:        '11px',
            fontWeight:      600,
            letterSpacing:   '0.1em',
            backgroundColor: 'transparent',
            color:           '#00D4AA',
            border:          '1px solid #162032',
            cursor:          'pointer',
          }}
        >
          EXPORT EVIDENCE →
        </button>
      </div>

    </div>
  )
}
