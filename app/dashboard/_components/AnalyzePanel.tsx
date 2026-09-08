'use client'

import { useState, useRef, useEffect } from 'react'
import type { AnalysisResult } from '@/types'

// ─── Constants ────────────────────────────────────────────────────────────────

const FONT: React.CSSProperties = {
  fontFamily: 'var(--font-jetbrains-mono, "Fira Code", monospace)',
}

const SEV_COLOR: Record<string, string> = {
  HIGH: '#EF4444',
  MED:  '#F59E0B',
  LOW:  '#22C55E',
}

const QUICK_TESTS = [
  {
    label: 'Test: Election Claim',
    text:  'BREAKING: Election Commission official confirms voting dates secretly changed in 4 Maharashtra districts. EVM machines in 847 polling booths pre-programmed with results. Statement suppressed by media. RT before deleted.',
  },
  {
    label: 'Test: Vaccine Misinfo',
    text:  "URGENT: WHO internal data (hidden from public) shows 1 in 50 recipients develop autoimmune syndrome from COVID boosters. German lab confirms mRNA fragments in breast milk 6+ months post-dose. Health ministry covering up 12,000 adverse event reports.",
  },
  {
    label: 'Test: Fake Review',
    text:  'WOW Amazing product!!! Bought TechPro X200 and it is BEST in world!! All family buy now. Very fast ship 5 stars. My neighbour also buy and love it. Price very good quality very good. 100% recommend everyone buy now!!',
  },
  {
    label: 'Test: WhatsApp',
    text:  'FWD: Doctors confirm nimbu paani cures cancer. Government hiding this. Share karo!',
  },
]

function scoreColor(pct: number): string {
  if (pct < 40) return '#22C55E'
  if (pct < 70) return '#F59E0B'
  return '#EF4444'
}

function matchCampaign(category: string): string | null {
  const s = category.toLowerCase()
  if (/election|vot|evm|politi|democrat/.test(s)) return 'Operation Pulse'
  if (/health|vaccine|medical|who|pharma|covid|immun/.test(s)) return 'MedFear'
  if (/review|product|consumer|rating|commercial|shop/.test(s)) return 'ReviewStorm'
  return null
}

const CAMPAIGN_META: Record<string, { threat: string; color: string }> = {
  'Operation Pulse': { threat: 'HIGH', color: '#EF4444' },
  'MedFear':         { threat: 'HIGH', color: '#EF4444' },
  'ReviewStorm':     { threat: 'MED',  color: '#F59E0B' },
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AnalyzePanel() {
  const [expanded,    setExpanded]    = useState(true)
  const [content,     setContent]     = useState('')
  const [loading,     setLoading]     = useState(false)
  const [result,      setResult]      = useState<AnalysisResult | null>(null)
  const [error,       setError]       = useState<string | null>(null)
  const [displayText, setDisplayText] = useState('')
  const [isTyping,    setIsTyping]    = useState(false)
  const [animScore,   setAnimScore]   = useState(0)

  const typeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const scoreTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (typeTimerRef.current)  clearInterval(typeTimerRef.current)
      if (scoreTimerRef.current) clearTimeout(scoreTimerRef.current)
    }
  }, [])

  // Progress bar: mount at 0, then animate to real score
  useEffect(() => {
    if (scoreTimerRef.current) clearTimeout(scoreTimerRef.current)
    if (!result) { setAnimScore(0); return }
    setAnimScore(0)
    scoreTimerRef.current = setTimeout(
      () => setAnimScore(Math.round(result.confidence * 100)),
      80,
    )
  }, [result])

  function startTypewriter(text: string) {
    if (typeTimerRef.current) clearInterval(typeTimerRef.current)
    setDisplayText('')
    setIsTyping(true)
    let i = 0
    typeTimerRef.current = setInterval(() => {
      i++
      if (i <= text.length) {
        setDisplayText(text.slice(0, i))
      } else {
        clearInterval(typeTimerRef.current!)
        typeTimerRef.current = null
        setIsTyping(false)
      }
    }, 18)
  }

  async function handleAnalyze() {
    if (!content.trim() || loading) return
    setLoading(true)
    setError(null)
    setResult(null)
    setDisplayText('')
    setIsTyping(false)
    if (typeTimerRef.current) { clearInterval(typeTimerRef.current); typeTimerRef.current = null }

    try {
      const res = await fetch('/api/analyze', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ content }),
      })
      if (!res.ok) throw new Error('request failed')
      const data = (await res.json()) as AnalysisResult
      setResult(data)
      startTypewriter(data.summary)
    } catch {
      setError('Analysis failed. Check API configuration.')
    } finally {
      setLoading(false)
    }
  }

  function handleViewNetwork(campaignName: string) {
    window.dispatchEvent(
      new CustomEvent('shadowtrace:campaign-select', { detail: { campaignName } }),
    )
    document.getElementById('st-graph-section')?.scrollIntoView({ behavior: 'smooth' })
  }

  const matched = result ? matchCampaign(result.narrative_category) : null

  return (
    <div style={{
      borderTop:    '2px solid #00D4AA',
      borderBottom: '1px solid #1E2D4A',
    }}>

      {/* ── Header / collapse toggle ──────────────────────────────────────── */}
      <button
        onClick={() => setExpanded(v => !v)}
        style={{
          ...FONT,
          width:           '100%',
          display:         'flex',
          alignItems:      'center',
          justifyContent:  'space-between',
          padding:         '0 16px',
          height:          '40px',
          fontSize:        '11px',
          letterSpacing:   '0.12em',
          color:           '#E2E8F0',
          background:      '#0D1526',
          border:          'none',
          borderBottom:    expanded ? '1px solid #1E2D4A' : 'none',
          cursor:          'pointer',
          textAlign:       'left',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{
            display:         'inline-block',
            width:           '6px',
            height:          '6px',
            borderRadius:    '50%',
            backgroundColor: '#00D4AA',
            flexShrink:      0,
          }} />
          ANALYZE CONTENT
          <span style={{
            fontSize:        '9px',
            letterSpacing:   '0.08em',
            color:           '#00D4AA',
            border:          '1px solid #00D4AA',
            padding:         '1px 6px',
            marginLeft:      '4px',
          }}>
            AI · LIVE
          </span>
        </span>
        <span style={{ fontSize: '16px', lineHeight: 1, color: '#00D4AA' }}>{expanded ? '−' : '+'}</span>
      </button>

      {expanded && (
        <div style={{ display: 'grid', gridTemplateColumns: '45% 55%' }}>

          {/* ── Left: Input ────────────────────────────────────────────────── */}
          <div style={{ padding: '16px', borderRight: '1px solid #1E2D4A' }}>

            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="Paste a news headline, social post, or article excerpt to analyze..."
              rows={6}
              className="placeholder:text-[#2A3F5F]"
              style={{
                ...FONT,
                width:           '100%',
                fontSize:        '12px',
                color:           '#E2E8F0',
                backgroundColor: '#080E1A',
                border:          '1px solid #2A3F5F',
                padding:         '10px 12px',
                resize:          'vertical',
                outline:         'none',
                display:         'block',
                boxSizing:       'border-box',
              }}
              onFocus={e => { e.target.style.borderColor = '#00D4AA' }}
              onBlur ={e => { e.target.style.borderColor = '#2A3F5F' }}
            />

            {/* Quick-test pre-fill buttons */}
            <div style={{ display: 'flex', gap: '6px', marginTop: '10px', flexWrap: 'wrap' }}>
              {QUICK_TESTS.map(qt => (
                <button
                  key={qt.label}
                  onClick={() => setContent(qt.text)}
                  style={{
                    ...FONT,
                    padding:         '4px 10px',
                    fontSize:        '10px',
                    letterSpacing:   '0.04em',
                    color:           '#00D4AA',
                    backgroundColor: 'transparent',
                    border:          '1px solid #1E2D4A',
                    cursor:          'pointer',
                  }}
                >
                  {qt.label}
                </button>
              ))}
            </div>

            {/* Analyze CTA */}
            <button
              onClick={handleAnalyze}
              disabled={loading || !content.trim()}
              style={{
                ...FONT,
                display:         'block',
                width:           '100%',
                marginTop:       '10px',
                padding:         '10px 0',
                fontSize:        '11px',
                fontWeight:      600,
                letterSpacing:   '0.12em',
                border:          'none',
                cursor:          loading || !content.trim() ? 'not-allowed' : 'pointer',
                backgroundColor: loading || !content.trim() ? '#1A2840' : '#00D4AA',
                color:           loading || !content.trim() ? '#4A5568' : '#080E1A',
              }}
            >
              {loading ? 'ANALYZING...' : 'ANALYZE →'}
            </button>

          </div>

          {/* ── Right: Results ──────────────────────────────────────────────── */}
          <div style={{ ...FONT, padding: '16px', fontSize: '11px' }}>

            {!result && !error && !loading && (
              <div style={{ paddingTop: '6px' }}>
                <div style={{ color: '#4A5568', fontSize: '10px', letterSpacing: '0.1em', marginBottom: '12px' }}>
                  ANALYSIS OUTPUT
                </div>
                <div style={{ color: '#2A3F5F', lineHeight: 1.7 }}>
                  Paste content on the left and click{' '}
                  <span style={{ color: '#00D4AA' }}>ANALYZE →</span>
                  {' '}to run the multi-agent AI pipeline.
                </div>
              </div>
            )}

            {loading && (
              <div style={{ color: '#4A5568', paddingTop: '6px' }}>
                Running analysis via Groq LLaMA-3.3-70B...
              </div>
            )}

            {error && (
              <div style={{ color: '#EF4444' }}>{error}</div>
            )}

            {result && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

                {/* AI Content Score */}
                <div>
                  <div style={{
                    display:        'flex',
                    justifyContent: 'space-between',
                    alignItems:     'center',
                    marginBottom:   '7px',
                  }}>
                    <span style={{ fontSize: '10px', color: '#4A5568', letterSpacing: '0.1em' }}>
                      AI-GENERATED PROBABILITY
                    </span>
                    <span style={{ color: scoreColor(animScore), fontWeight: 700 }}>
                      {animScore}%
                    </span>
                  </div>
                  <div style={{
                    height:          '5px',
                    backgroundColor: '#0D1526',
                    border:          '1px solid #1E2D4A',
                  }}>
                    <div style={{
                      height:          '100%',
                      width:           `${animScore}%`,
                      backgroundColor: scoreColor(animScore),
                      transition:      'width 0.85s ease, background-color 0.4s ease',
                    }} />
                  </div>
                </div>

                {/* Misinformation Risk */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '10px', color: '#4A5568', letterSpacing: '0.08em', minWidth: '130px' }}>
                    MISINFORMATION RISK
                  </span>
                  <span style={{
                    fontSize:        '9px',
                    fontWeight:      700,
                    letterSpacing:   '0.08em',
                    padding:         '2px 8px',
                    backgroundColor: SEV_COLOR[result.threat_level] ?? '#4A5568',
                    color:           '#080E1A',
                  }}>
                    {result.threat_level === 'MED' ? 'MEDIUM' : result.threat_level}
                  </span>
                  <span style={{ color: '#4A5568' }}>·</span>
                  <span style={{ color: '#8B9AB5' }}>{result.narrative_category}</span>
                </div>

                {/* Keywords Detected */}
                {result.indicators?.length > 0 && (
                  <div>
                    <div style={{ fontSize: '10px', color: '#4A5568', letterSpacing: '0.08em', marginBottom: '6px' }}>
                      KEYWORDS DETECTED
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                      {result.indicators.map((kw, i) => (
                        <span
                          key={i}
                          style={{
                            fontSize:        '10px',
                            color:           '#8B9AB5',
                            padding:         '2px 8px',
                            border:          '1px solid #1E2D4A',
                            backgroundColor: '#0D1526',
                          }}
                        >
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Matched Campaign */}
                {matched && (
                  <div>
                    <div style={{ fontSize: '10px', color: '#4A5568', letterSpacing: '0.08em', marginBottom: '6px' }}>
                      MATCHED CAMPAIGN
                    </div>
                    <div style={{
                      padding:         '10px 12px',
                      border:          '1px solid #00D4AA',
                      backgroundColor: '#080E1A',
                      display:         'flex',
                      alignItems:      'center',
                      justifyContent:  'space-between',
                    }}>
                      <div>
                        <div style={{ color: '#E2E8F0', fontWeight: 600, marginBottom: '2px' }}>
                          {matched}
                        </div>
                        <div style={{ fontSize: '10px', color: CAMPAIGN_META[matched]?.color, letterSpacing: '0.04em' }}>
                          {`THREAT: ${CAMPAIGN_META[matched]?.threat}`}
                        </div>
                      </div>
                      <button
                        onClick={() => handleViewNetwork(matched)}
                        style={{
                          ...FONT,
                          padding:         '5px 12px',
                          fontSize:        '10px',
                          fontWeight:      600,
                          letterSpacing:   '0.06em',
                          border:          '1px solid #00D4AA',
                          color:           '#00D4AA',
                          backgroundColor: 'transparent',
                          cursor:          'pointer',
                        }}
                      >
                        VIEW NETWORK →
                      </button>
                    </div>
                  </div>
                )}

                {/* AI Threat Assessment — typewriter */}
                <div>
                  <div style={{ fontSize: '10px', color: '#4A5568', letterSpacing: '0.08em', marginBottom: '6px' }}>
                    AI THREAT ASSESSMENT
                  </div>
                  <div style={{ color: '#8B9AB5', lineHeight: 1.65, minHeight: '44px' }}>
                    {displayText}
                    {isTyping && (
                      <span
                        className="st-cursor-blink"
                        style={{
                          display:         'inline-block',
                          width:           '1px',
                          height:          '12px',
                          backgroundColor: '#00D4AA',
                          marginLeft:      '1px',
                          verticalAlign:   'text-bottom',
                        }}
                      />
                    )}
                  </div>
                </div>

              </div>
            )}

          </div>
        </div>
      )}

    </div>
  )
}
