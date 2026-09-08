'use client'

import { useEffect, useRef, useState } from 'react'
import type { AnalysisResult } from '@/types'

const MONO: React.CSSProperties = { fontFamily: 'var(--font-jetbrains-mono, "Fira Code", monospace)' }

const QUICK_TESTS = [
  { label: 'Election claim', text: 'BREAKING: Election Commission official confirms voting dates secretly changed in 4 Maharashtra districts. EVM machines in 847 polling booths pre-programmed with results. Statement suppressed by media. RT before deleted.' },
  { label: 'Vaccine misinfo', text: 'URGENT: WHO internal data shows 1 in 50 recipients develop autoimmune syndrome from COVID boosters. Government hiding this. Share before deleted.' },
  { label: 'Fake review', text: 'WOW Amazing product!!! Bought TechPro X200 and it is BEST in world!! Very fast ship 5 stars. 100% recommend everyone buy now!!' },
  { label: 'WhatsApp forward', text: 'FWD: Doctors confirm nimbu paani cures cancer. Government hiding this. Share karo!' },
]

const SEVERITY: Record<string, { label: string; color: string }> = {
  HIGH: { label: 'HIGH', color: '#FF5A67' },
  MED: { label: 'MEDIUM', color: '#FFC14D' },
  LOW: { label: 'LOW', color: '#34D399' },
}

function scoreColor(score: number) {
  if (score < 40) return '#34D399'
  if (score < 70) return '#FFC14D'
  return '#FF5A67'
}

function matchedCampaign(category: string) {
  const value = category.toLowerCase()
  if (/election|vot|evm|politi|democrat/.test(value)) return 'Operation Pulse'
  if (/health|vaccine|medical|who|pharma|covid|immun/.test(value)) return 'MedFear'
  if (/review|product|consumer|rating|commercial|shop/.test(value)) return 'ReviewStorm'
  return null
}

export default function AnalyzePanel() {
  const [expanded, setExpanded] = useState(true)
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [displayText, setDisplayText] = useState('')
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current)
  }, [])

  function typeSummary(text: string) {
    if (timerRef.current) clearInterval(timerRef.current)
    let index = 0
    setDisplayText('')
    timerRef.current = setInterval(() => {
      index += 1
      setDisplayText(text.slice(0, index))
      if (index >= text.length && timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }, 12)
  }

  async function handleAnalyze() {
    if (!content.trim() || loading) return
    setLoading(true)
    setError(null)
    setResult(null)
    setDisplayText('')
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content }),
      })
      if (!response.ok) throw new Error('request failed')
      const data = (await response.json()) as AnalysisResult
      setResult(data)
      typeSummary(data.summary)
    } catch {
      setError('Analysis failed. Check API configuration and try again.')
    } finally {
      setLoading(false)
    }
  }

  function openNetwork(campaignName: string) {
    window.dispatchEvent(new CustomEvent('shadowtrace:campaign-select', { detail: { campaignName } }))
    document.getElementById('st-graph-section')?.scrollIntoView({ behavior: 'smooth' })
  }

  const confidence = result ? Math.round(result.confidence * 100) : 0
  const severity = result ? SEVERITY[result.threat_level] ?? SEVERITY.LOW : null
  const campaign = result ? matchedCampaign(result.narrative_category) : null

  return (
    <section style={{ borderTop: '2px solid #00D4AA', borderBottom: BORDER }}>
      <button
        onClick={() => setExpanded(value => !value)}
        style={{ ...MONO, width: '100%', minHeight: 48, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 18px', border: 0, borderBottom: expanded ? BORDER : 0, background: '#0F1A2B', color: '#F4F7FB', cursor: 'pointer', textAlign: 'left' }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 10, fontWeight: 650, letterSpacing: '0.12em' }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#00D4AA' }} />
          ANALYZE CONTENT
          <span style={{ fontSize: 8, color: '#00D4AA', border: '1px solid #1F8F7B', padding: '3px 7px', letterSpacing: '0.08em' }}>AI PIPELINE</span>
        </span>
        <span style={{ fontSize: 17, color: '#00D4AA' }}>{expanded ? '−' : '+'}</span>
      </button>

      {expanded && (
        <div style={{ display: 'grid', gridTemplateColumns: '44% 56%', background: '#101A2C' }}>
          <div style={{ padding: 18, borderRight: BORDER }}>
            <div style={{ ...MONO, fontSize: 9, color: '#8798B1', letterSpacing: '0.1em', marginBottom: 8 }}>INPUT SIGNAL</div>
            <textarea
              value={content}
              onChange={event => setContent(event.target.value)}
              placeholder="Paste a social post, news claim, or article excerpt…"
              rows={7}
              style={{ ...MONO, width: '100%', boxSizing: 'border-box', resize: 'vertical', background: '#0A1321', color: '#F4F7FB', border: '1px solid #324B6E', outline: 'none', padding: '12px 13px', fontSize: 12, lineHeight: 1.55 }}
            />
            <div style={{ ...MONO, display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
              {QUICK_TESTS.map(test => (
                <button key={test.label} onClick={() => setContent(test.text)} style={{ ...MONO, border: '1px solid #304866', background: '#142239', color: '#B9C7D9', padding: '6px 8px', fontSize: 9, cursor: 'pointer' }}>{test.label}</button>
              ))}
            </div>
            <button
              onClick={handleAnalyze}
              disabled={loading || !content.trim()}
              style={{ ...MONO, width: '100%', marginTop: 10, padding: '11px 12px', border: 0, background: loading || !content.trim() ? '#22324A' : '#00D4AA', color: loading || !content.trim() ? '#7D8EA7' : '#07131F', fontWeight: 750, fontSize: 10, letterSpacing: '0.12em', cursor: loading || !content.trim() ? 'not-allowed' : 'pointer' }}
            >
              {loading ? 'RUNNING MULTI-AGENT ANALYSIS…' : 'RUN INVESTIGATION →'}
            </button>
          </div>

          <div style={{ padding: 18, minWidth: 0 }}>
            {!result && !loading && !error && (
              <div style={{ padding: '8px 0' }}>
                <div style={{ ...MONO, fontSize: 9, color: '#8798B1', letterSpacing: '0.1em', marginBottom: 10 }}>ANALYSIS OUTPUT</div>
                <div style={{ fontSize: 13, lineHeight: 1.65, color: '#B8C4D6', maxWidth: 560 }}>
                  Submit a signal to run the analysis pipeline. The result panel will surface confidence, threat level, detected indicators, and the matched campaign context.
                </div>
              </div>
            )}

            {loading && <div style={{ ...MONO, color: '#B8C4D6', fontSize: 11, lineHeight: 1.6, paddingTop: 8 }}>Running language, content, and threat analysis…</div>}
            {error && <div style={{ ...MONO, color: '#FF7A85', fontSize: 11, paddingTop: 8 }}>{error}</div>}

            {result && severity && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 18, alignItems: 'end' }}>
                  <div>
                    <div style={{ ...MONO, fontSize: 9, color: '#8798B1', letterSpacing: '0.1em', marginBottom: 8 }}>MODEL CONFIDENCE</div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
                      <span style={{ ...MONO, fontSize: 34, fontWeight: 750, color: scoreColor(confidence) }}>{confidence}%</span>
                      <span style={{ ...MONO, fontSize: 10, color: '#7F90A9' }}>confidence</span>
                    </div>
                  </div>
                  <div style={{ ...MONO, fontSize: 10, fontWeight: 750, color: severity.color, border: `1px solid ${severity.color}`, padding: '6px 9px', letterSpacing: '0.08em' }}>{severity.label} RISK</div>
                </div>

                <div style={{ height: 8, background: '#0B1524', border: '1px solid #304866' }}>
                  <div style={{ height: '100%', width: `${confidence}%`, background: scoreColor(confidence) }} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div style={{ border: BORDER, background: '#0C1727', padding: 13 }}>
                    <div style={{ ...MONO, fontSize: 9, color: '#8798B1', letterSpacing: '0.08em', marginBottom: 7 }}>NARRATIVE</div>
                    <div style={{ fontSize: 12, color: '#D8E0EA', lineHeight: 1.5 }}>{result.narrative_category}</div>
                  </div>
                  <div style={{ border: BORDER, background: '#0C1727', padding: 13 }}>
                    <div style={{ ...MONO, fontSize: 9, color: '#8798B1', letterSpacing: '0.08em', marginBottom: 7 }}>INDICATORS</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                      {(result.indicators ?? []).slice(0, 6).map((item, index) => <span key={index} style={{ ...MONO, fontSize: 9, color: '#B8C4D6', background: '#142239', border: '1px solid #304866', padding: '4px 6px' }}>{item}</span>)}
                    </div>
                  </div>
                </div>

                <div style={{ borderLeft: `2px solid ${severity.color}`, background: '#0C1727', padding: '12px 14px' }}>
                  <div style={{ ...MONO, fontSize: 9, color: '#8798B1', letterSpacing: '0.08em', marginBottom: 7 }}>SYNTHESIS</div>
                  <div style={{ fontSize: 12, lineHeight: 1.65, color: '#D8E0EA' }}>{displayText}</div>
                </div>

                {campaign && (
                  <button onClick={() => openNetwork(campaign)} style={{ ...MONO, alignSelf: 'flex-start', border: '1px solid #00A889', background: 'rgba(0,212,170,0.08)', color: '#00D4AA', padding: '8px 10px', fontSize: 9, fontWeight: 650, letterSpacing: '0.08em', cursor: 'pointer' }}>
                    OPEN {campaign.toUpperCase()} NETWORK →
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  )
}

const BORDER = '1px solid #263957'
