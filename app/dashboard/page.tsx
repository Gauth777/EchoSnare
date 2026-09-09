'use client'

import { useState, useEffect } from 'react'
import type { InvestigationResult } from '@/types'
import NetworkGraphPanel from './_components/NetworkGraphPanel'
import AnalyzePanel from './_components/AnalyzePanel'
import AlertFeed from './_components/AlertFeed'
import LiveClaimsCell from './_components/LiveClaimsCell'
import InvestigationWorkflow from './_components/InvestigationWorkflow'
import EvidencePanel from './_components/EvidencePanel'

const MONO: React.CSSProperties = { fontFamily: 'var(--font-jetbrains-mono, "Fira Code", monospace)' }
const BORDER = '1px solid #162032'

const TIMELINE_DATA = [
  { name: 'Operation Pulse', threat: 'HIGH', color: '#EF4444', activity: [2, 3, 4, 9, 10, 13, 14, 15, 20, 21, 22, 23] },
  { name: 'MedFear', threat: 'HIGH', color: '#F59E0B', activity: [8, 9, 10, 11, 14, 15, 16, 17, 19] },
  { name: 'ReviewStorm', threat: 'MED', color: '#60A5FA', activity: [0, 1, 6, 7, 8, 12, 13, 18, 20, 21] },
] as const

function SectionHeader({ title, detail }: { title: string; detail?: string }) {
  return (
    <div
      style={{
        ...MONO,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        minHeight: 46,
        padding: '0 20px',
        borderBottom: BORDER,
        background: '#05070c',
        color: '#E2E8F0',
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.12em',
      }}
    >
      <span>{title}</span>
      {detail && <span style={{ color: '#94A3B8', fontSize: 10, letterSpacing: '0.08em' }}>{detail}</span>}
    </div>
  )
}

function MetricCell({ label, value, valueColor, borderRight = true }: { label: string; value: string; valueColor?: string; borderRight?: boolean }) {
  return (
    <div style={{ padding: '18px 20px', borderRight: borderRight ? BORDER : 'none', background: '#07090e' }}>
      <div style={{ ...MONO, fontSize: 10, fontWeight: 700, color: '#94A3B8', letterSpacing: '0.12em', marginBottom: 8 }}>{label}</div>
      <div style={{ ...MONO, fontSize: 30, fontWeight: 800, lineHeight: 1.05, color: valueColor ?? '#F4F7FB' }}>{value}</div>
    </div>
  )
}

function ActivityTimeline() {
  const HOURS = Array.from({ length: 24 }, (_, i) => i)
  return (
    <div style={{ padding: '20px', background: '#07090e' }}>
      <div style={{ display: 'flex', marginLeft: 166, marginBottom: 8 }}>
        {HOURS.map(h => (
          <div key={h} style={{ width: `${100 / 24}%`, ...MONO, fontSize: 9, color: h % 4 === 0 ? '#94A3B8' : 'transparent' }}>
            {`${String(h).padStart(2, '0')}:00`}
          </div>
        ))}
      </div>
      {TIMELINE_DATA.map(row => (
        <div key={row.name} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <div style={{ width: 156, flexShrink: 0, ...MONO, display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: '#CBD5E1' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: row.color }} />
            {row.name}
          </div>
          <div style={{ flex: 1, display: 'flex', gap: 2 }}>
            {HOURS.map(h => {
              const active = row.activity.includes(h as never)
              return (
                <div
                  key={h}
                  style={{
                    flex: 1,
                    height: 18,
                    border: `1px solid ${active ? row.color : '#162032'}`,
                    background: active ? row.color : '#04060a',
                    opacity: active ? 0.85 : 1,
                  }}
                />
              )
            })}
          </div>
        </div>
      ))}
      <div style={{ marginLeft: `${166 + (14 / 24) * 100}%`, ...MONO, fontSize: 9, color: '#00D4AA', letterSpacing: '0.06em' }}>
        ● LIVE CURRENT
      </div>
    </div>
  )
}

export default function OverviewPage() {
  const [activeInvestigation, setActiveInvestigation] = useState<InvestigationResult | null>(null)

  // Restore previous investigation state on mount across tab navigation
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem('echosnare_active_investigation')
      if (saved) {
        const parsed = JSON.parse(saved) as InvestigationResult
        if (parsed?.query) {
          setActiveInvestigation(parsed)
        }
      }
    } catch {}
  }, [])

  function handleReset() {
    setActiveInvestigation(null)
    try {
      sessionStorage.removeItem('echosnare_active_investigation')
      sessionStorage.removeItem('echosnare_active_query')
    } catch {}
  }

  return (
    <div style={{ background: '#000000', minHeight: '100vh', color: '#F4F7FB' }}>
      {/* Workstation Header */}
      <div style={{ padding: '24px 24px 18px', borderBottom: BORDER, background: '#05070c' }}>
        <div style={{ ...MONO, fontSize: 10, fontWeight: 700, color: '#00D4AA', letterSpacing: '0.18em', marginBottom: 6 }}>
          ECHOSNARE THREAT INTELLIGENCE WORKSTATION
        </div>
        <h1 style={{ margin: 0, fontSize: 24, lineHeight: 1.2, fontWeight: 700, color: '#F4F7FB' }}>
          Multi-Agent Investigation & Threat Snare
        </h1>
        <p style={{ margin: '8px 0 0', maxWidth: 840, fontSize: 13, lineHeight: 1.6, color: '#CBD5E1' }}>
          Execute source-aware topic investigations, inspect live retrieved evidence, verify claim provenance across web and social channels, and analyze coordinated network graphs.
        </p>
      </div>

      <section style={{ margin: '20px 24px', border: BORDER, background: '#07090e' }}>
        {/* System Metric Bar */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr) 1.3fr', borderBottom: BORDER }}>
          <MetricCell label="BENCHMARK CAMPAIGNS" value="3" valueColor="#EF4444" />
          <MetricCell label="RETRIEVED SOURCES TODAY" value={activeInvestigation ? `${activeInvestigation.evidence.length}` : '14'} valueColor="#F59E0B" />
          <MetricCell label="LIVE ALERTS" value="18" />
          <MetricCell label="SYSTEM CONFIDENCE" value={activeInvestigation ? `${Math.round(activeInvestigation.confidence * 100)}%` : '91.3%'} valueColor="#00D4AA" />
          <LiveClaimsCell />
        </div>

        {/* Hero Query Input Bar */}
        <AnalyzePanel onInvestigationComplete={res => setActiveInvestigation(res)} />

        {/* Dynamic Investigation Results (When Active) */}
        {activeInvestigation && (
          <div>
            {/* Action Bar with Reset and Navigation */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px', background: '#05070c', borderBottom: BORDER, flexWrap: 'wrap', gap: 10 }}>
              <div style={{ ...MONO, fontSize: 11, color: '#00D4AA', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#00D4AA', boxShadow: '0 0 8px #00D4AA' }} />
                <span>ACTIVE PROMPT INVESTIGATION: &quot;{activeInvestigation.query.length > 50 ? activeInvestigation.query.slice(0, 48) + '…' : activeInvestigation.query}&quot;</span>
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <a
                  href="#st-graph-section"
                  style={{
                    ...MONO,
                    fontSize: 10,
                    fontWeight: 750,
                    color: '#000000',
                    background: '#00D4AA',
                    padding: '5px 12px',
                    textDecoration: 'none',
                    borderRadius: 2,
                    boxShadow: '0 0 10px rgba(0,212,170,0.3)',
                  }}
                >
                  VIEW LIVE GRAPH ↓
                </a>
                {activeInvestigation.accounts_detected && activeInvestigation.accounts_detected.length > 0 && (
                  <a
                    href="/dashboard/account-intel"
                    style={{
                      ...MONO,
                      fontSize: 10,
                      fontWeight: 700,
                      color: '#F4F7FB',
                      background: '#0e1626',
                      border: '1px solid #00D4AA',
                      padding: '5px 10px',
                      textDecoration: 'none',
                      borderRadius: 2,
                    }}
                  >
                    ANALYZE {activeInvestigation.accounts_detected.length} ACCOUNTS →
                  </a>
                )}
                <button
                  onClick={handleReset}
                  style={{
                    ...MONO,
                    fontSize: 10,
                    color: '#EF4444',
                    background: 'transparent',
                    border: '1px solid #EF4444',
                    padding: '4px 10px',
                    cursor: 'pointer',
                    borderRadius: 2,
                  }}
                >
                  RESET INVESTIGATION
                </button>
              </div>
            </div>

            {/* Stage Progress Bar */}
            <InvestigationWorkflow stages={activeInvestigation.stages} />

            {/* Investigation Dossier Summary */}
            <div style={{ padding: 22, background: '#07090e', borderBottom: BORDER }}>
              <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 24, alignItems: 'start' }}>
                {/* Threat Score Card */}
                <div style={{ background: '#04060a', border: BORDER, padding: 18, borderRadius: 2 }}>
                  <div style={{ ...MONO, fontSize: 10, color: '#94A3B8', letterSpacing: '0.12em', marginBottom: 8 }}>
                    THREAT RISK SCORE
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <span
                      style={{
                        ...MONO,
                        fontSize: 38,
                        fontWeight: 800,
                        color: activeInvestigation.threat_score >= 70 ? '#EF4444' : activeInvestigation.threat_score >= 40 ? '#F59E0B' : '#34D399',
                      }}
                    >
                      {activeInvestigation.threat_score}
                    </span>
                    <span style={{ ...MONO, fontSize: 12, color: '#64748B' }}>/ 100</span>
                  </div>

                  <div style={{ ...MONO, marginTop: 10, fontSize: 11, fontWeight: 700, color: activeInvestigation.risk_level === 'HIGH' ? '#EF4444' : '#F59E0B' }}>
                    SEVERITY: {activeInvestigation.risk_level}
                  </div>
                  <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>
                    Category: {activeInvestigation.narrative_category}
                  </div>
                </div>

                {/* Synthesis Dossier Text */}
                <div style={{ background: '#04060a', border: BORDER, borderLeft: '4px solid #00D4AA', padding: 18 }}>
                  <div style={{ ...MONO, fontSize: 10, fontWeight: 700, color: '#00D4AA', letterSpacing: '0.12em', marginBottom: 8 }}>
                    EVIDENCE-BACKED DOSSIER SYNTHESIS
                  </div>
                  <pre
                    style={{
                      fontFamily: 'inherit',
                      margin: 0,
                      whiteSpace: 'pre-wrap',
                      fontSize: 13,
                      lineHeight: 1.65,
                      color: '#F4F7FB',
                    }}
                  >
                    {activeInvestigation.synthesis_dossier}
                  </pre>
                </div>
              </div>

              {/* Key Findings List */}
              {activeInvestigation.key_findings && activeInvestigation.key_findings.length > 0 && (
                <div style={{ marginTop: 18 }}>
                  <div style={{ ...MONO, fontSize: 10, fontWeight: 700, color: '#94A3B8', letterSpacing: '0.12em', marginBottom: 10 }}>
                    KEY INVESTIGATION FINDINGS
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat( auto-fit, minmax(280px, 1fr) )', gap: 12 }}>
                    {activeInvestigation.key_findings.map((f, i) => (
                      <div key={i} style={{ background: '#04060a', border: BORDER, padding: 14 }}>
                        <div style={{ fontSize: 13, fontWeight: 650, color: '#F4F7FB', marginBottom: 4 }}>
                          {f.title}
                        </div>
                        <div style={{ fontSize: 12, lineHeight: 1.5, color: '#CBD5E1', marginBottom: 8 }}>
                          {f.explanation}
                        </div>
                        <div style={{ ...MONO, fontSize: 10, color: '#64748B', display: 'flex', justifyContent: 'space-between' }}>
                          <span>Source: {f.source}</span>
                          <span style={{ color: '#00D4AA' }}>{Math.round(f.confidence * 100)}% Conf</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Evidence & Provenance Panel */}
            <EvidencePanel evidence={activeInvestigation.evidence} sourceStatuses={activeInvestigation.source_statuses} />
          </div>
        )}

        {/* Network Graph & Alert Feed Section */}
        <div id="st-graph-section" style={{ display: 'flex', minHeight: 480, borderBottom: BORDER }}>
          <div style={{ flex: '0 0 65%', minWidth: 0, borderRight: BORDER, overflow: 'hidden' }}>
            <NetworkGraphPanel activeInvestigation={activeInvestigation} />
          </div>
          <div style={{ flex: '0 0 35%', minWidth: 0, overflow: 'hidden' }}>
            <AlertFeed />
          </div>
        </div>

        {/* 24h Campaign Activity Timeline */}
        <div>
          <SectionHeader title="BENCHMARK CAMPAIGN ACTIVITY — LAST 24H" detail="TIMES SHOWN IN UTC" />
          <ActivityTimeline />
        </div>
      </section>

      <div style={{ height: 40 }} />
    </div>
  )
}
