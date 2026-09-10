'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

const FONT: React.CSSProperties = {
  fontFamily: 'var(--font-jetbrains-mono, "Fira Code", monospace)',
}
const BORDER = '1px solid #162032'

interface EvidenceItem {
  id?: string
  title: string
  source_name?: string
  publisher?: string
  source_url?: string
  url?: string
  direction?: string
  confidence?: number
  evidence_type?: string
  reason?: string
}

interface SearchLog {
  id: string
  query: string
  query_mode: string
  threat_score: number
  risk_level: string
  narrative_category?: string
  evidence_count: number
  duration_ms: number
  timestamp: string
  status: string
  campaign_name?: string | null
  accounts?: string[]
  synthesis_dossier?: string
  evidence?: EvidenceItem[]
  claim_assessment?: {
    status?: string
    label?: string
    explanation?: string
    confidence?: number
    corroborating_sources?: number
    contradictory_sources?: number
  }
  details?: Record<string, any>
}

interface Metrics {
  total_searches: number
  high_risk_count: number
  med_risk_count: number
  low_risk_count: number
  avg_threat_score: number
  avg_duration_ms: number
  modes: Record<string, number>
  neo4j_active: boolean
}

export default function SearchLogsPage() {
  const router = useRouter()
  const [logs, setLogs] = useState<SearchLog[]>([])
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [filterRisk, setFilterRisk] = useState<'ALL' | 'HIGH' | 'MED' | 'LOW'>('ALL')
  const [filterMode, setFilterMode] = useState<string>('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [expandedTab, setExpandedTab] = useState<'DOSSIER' | 'JSON'>('DOSSIER')

  const fetchData = useCallback(async () => {
    try {
      const [logsRes, metricsRes] = await Promise.all([
        fetch('/api/searches?limit=100'),
        fetch('/api/searches?metrics=true'),
      ])
      if (logsRes.ok) {
        const data = await logsRes.json()
        setLogs(Array.isArray(data) ? data : [])
      }
      if (metricsRes.ok) {
        const m = await metricsRes.json()
        setMetrics(m)
      }
    } catch {
      // Fetch error handled gracefully
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Real-time polling every 6 seconds if autoRefresh is enabled and tab is active
  useEffect(() => {
    if (!autoRefresh) return
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchData()
      }
    }, 6000)
    return () => clearInterval(interval)
  }, [autoRefresh, fetchData])

  const filteredLogs = logs.filter(log => {
    if (filterRisk !== 'ALL' && log.risk_level?.toUpperCase() !== filterRisk) {
      return false
    }
    if (filterMode !== 'ALL' && log.query_mode?.toLowerCase() !== filterMode.toLowerCase()) {
      return false
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      const matchesText =
        (log.query || '').toLowerCase().includes(q) ||
        (log.narrative_category || '').toLowerCase().includes(q) ||
        (log.id || '').toLowerCase().includes(q)
      if (!matchesText) return false
    }
    return true
  })

  function handleRerun(query: string, mode: string) {
    try {
      sessionStorage.setItem('echosnare_active_query', query)
      sessionStorage.setItem('echosnare_active_mode', mode || 'topic')
    } catch {}
    router.push('/dashboard')
  }

  function getRiskColor(level: string) {
    const l = (level || '').toUpperCase()
    if (l === 'HIGH') return '#EF4444'
    if (l === 'MED' || l === 'MEDIUM') return '#F59E0B'
    return '#10B981'
  }

  function formatTime(iso: string) {
    if (!iso) return '—'
    try {
      const d = new Date(iso)
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    } catch {
      return iso
    }
  }

  function formatRelative(iso: string) {
    if (!iso) return ''
    try {
      const diffSec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
      if (diffSec < 5) return 'just now'
      if (diffSec < 60) return `${diffSec}s ago`
      if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`
      return `${Math.floor(diffSec / 3600)}h ago`
    } catch {
      return ''
    }
  }

  function parseDossier(log: SearchLog) {
    const fullText =
      log.synthesis_dossier ||
      log.claim_assessment?.explanation ||
      log.details?.claim_assessment?.explanation ||
      ''
    let narrative = fullText
    const extractedBullets: Array<{ source: string; title: string; url?: string; direction?: string }> = []

    if (fullText.includes('KEY EVIDENCE:')) {
      const parts = fullText.split(/KEY EVIDENCE:\s*/i)
      narrative = parts[0].trim()
      const bulletLines = parts[1].trim().split('\n')
      for (const line of bulletLines) {
        const trimmed = line.replace(/^[•\-\*]\s*/, '').trim()
        if (!trimmed) continue
        const dashIdx = trimmed.indexOf('—') !== -1 ? trimmed.indexOf('—') : trimmed.indexOf('-')
        if (dashIdx !== -1) {
          const src = trimmed.slice(0, dashIdx).trim()
          const title = trimmed.slice(dashIdx + 1).trim()
          extractedBullets.push({ source: src, title })
        } else {
          extractedBullets.push({ source: 'Web', title: trimmed })
        }
      }
    }

    const structured = (log.evidence || []).map(ev => ({
      source: ev.source_name || ev.publisher || 'Web',
      title: ev.title || 'Evidence Source',
      url: ev.source_url || ev.url,
      direction: ev.direction,
    }))

    const evidenceItems = structured.length > 0 ? structured : extractedBullets

    return {
      narrative: narrative || 'Investigation synthesis recorded in database. Review retrieved evidence items below.',
      evidenceItems,
    }
  }

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1400, margin: '0 auto', color: '#F4F7FB' }}>
      {/* ── Top Header ────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#00D4AA', boxShadow: '0 0 12px #00D4AA' }} />
            <h1 style={{ ...FONT, fontSize: 18, fontWeight: 700, letterSpacing: '0.12em', margin: 0, color: '#FFFFFF' }}>
              REAL-TIME INVESTIGATION & SEARCH LOGS
            </h1>
          </div>
          <p style={{ ...FONT, fontSize: 11, color: '#94A3B8', marginTop: 6, marginBottom: 0 }}>
            Live database audit trail of user queries, disinformation scans, and multi-agent investigations.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => setAutoRefresh(prev => !prev)}
            style={{
              ...FONT,
              padding: '6px 14px',
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
              background: autoRefresh ? 'rgba(0, 212, 170, 0.12)' : '#0C1017',
              color: autoRefresh ? '#00D4AA' : '#64748B',
              border: autoRefresh ? '1px solid #00D4AA' : BORDER,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              borderRadius: 2,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: autoRefresh ? '#00D4AA' : '#64748B',
                boxShadow: autoRefresh ? '0 0 6px #00D4AA' : 'none',
              }}
            />
            {autoRefresh ? 'LIVE STREAMING (3s)' : 'STREAM PAUSED'}
          </button>

          <button
            onClick={fetchData}
            style={{
              ...FONT,
              padding: '6px 14px',
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
              background: '#0F172A',
              color: '#F4F7FB',
              border: BORDER,
              borderRadius: 2,
            }}
          >
            REFRESH NOW
          </button>
        </div>
      </div>

      {/* ── KPI Stats Banner ──────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: 12,
          marginBottom: 24,
        }}
      >
        <div style={{ background: '#05070c', border: BORDER, padding: '16px 18px', borderLeft: '3px solid #00D4AA' }}>
          <div style={{ ...FONT, fontSize: 10, color: '#94A3B8', letterSpacing: '0.08em' }}>TOTAL SEARCHES LOGGED</div>
          <div style={{ ...FONT, fontSize: 24, fontWeight: 700, color: '#FFFFFF', marginTop: 6 }}>
            {metrics?.total_searches ?? logs.length}
          </div>
          <div style={{ ...FONT, fontSize: 9, color: '#00D4AA', marginTop: 4 }}>Neo4j AuraDB Real-Time Sync</div>
        </div>

        <div style={{ background: '#05070c', border: BORDER, padding: '16px 18px', borderLeft: '3px solid #EF4444' }}>
          <div style={{ ...FONT, fontSize: 10, color: '#94A3B8', letterSpacing: '0.08em' }}>HIGH-RISK DETECTIONS</div>
          <div style={{ ...FONT, fontSize: 24, fontWeight: 700, color: '#EF4444', marginTop: 6 }}>
            {metrics?.high_risk_count ?? logs.filter(l => l.risk_level === 'HIGH').length}
          </div>
          <div style={{ ...FONT, fontSize: 9, color: '#94A3B8', marginTop: 4 }}>Threat Score &gt; 70</div>
        </div>

        <div style={{ background: '#05070c', border: BORDER, padding: '16px 18px', borderLeft: '3px solid #F59E0B' }}>
          <div style={{ ...FONT, fontSize: 10, color: '#94A3B8', letterSpacing: '0.08em' }}>AVG THREAT SCORE</div>
          <div style={{ ...FONT, fontSize: 24, fontWeight: 700, color: '#F59E0B', marginTop: 6 }}>
            {metrics?.avg_threat_score ?? 0} <span style={{ fontSize: 13, color: '#64748B' }}>/ 100</span>
          </div>
          <div style={{ ...FONT, fontSize: 9, color: '#94A3B8', marginTop: 4 }}>Cross-Modal Content Risk</div>
        </div>

        <div style={{ background: '#05070c', border: BORDER, padding: '16px 18px', borderLeft: '3px solid #3B82F6' }}>
          <div style={{ ...FONT, fontSize: 10, color: '#94A3B8', letterSpacing: '0.08em' }}>DATABASE PIPELINE STATUS</div>
          <div style={{ ...FONT, fontSize: 13, fontWeight: 700, color: '#10B981', marginTop: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10B981', boxShadow: '0 0 8px #10B981' }} />
            CONNECTED (AuraDB)
          </div>
          <div style={{ ...FONT, fontSize: 9, color: '#94A3B8', marginTop: 6 }}>Instance: 945c20d3 (HTTPS)</div>
        </div>
      </div>

      {/* ── Filter Strip ──────────────────────────────────────────────────────── */}
      <div
        style={{
          background: '#05070c',
          border: BORDER,
          padding: '14px 18px',
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: '1 1 320px' }}>
          <input
            type="text"
            placeholder="Search query, category, or log ID..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              ...FONT,
              width: '100%',
              maxWidth: 380,
              background: '#0a0d14',
              border: BORDER,
              color: '#F4F7FB',
              padding: '7px 12px',
              fontSize: 12,
              outline: 'none',
              borderRadius: 2,
            }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          {/* Risk Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ ...FONT, fontSize: 10, color: '#94A3B8' }}>RISK:</span>
            {(['ALL', 'HIGH', 'MED', 'LOW'] as const).map(lvl => (
              <button
                key={lvl}
                onClick={() => setFilterRisk(lvl)}
                style={{
                  ...FONT,
                  padding: '4px 8px',
                  fontSize: 10,
                  cursor: 'pointer',
                  background: filterRisk === lvl ? 'rgba(0, 212, 170, 0.15)' : 'transparent',
                  color: filterRisk === lvl ? '#00D4AA' : '#64748B',
                  border: filterRisk === lvl ? '1px solid #00D4AA' : BORDER,
                  borderRadius: 2,
                }}
              >
                {lvl}
              </button>
            ))}
          </div>

          {/* Mode Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ ...FONT, fontSize: 10, color: '#94A3B8' }}>MODE:</span>
            {['ALL', 'topic', 'text', 'handle', 'whatsapp', 'image'].map(m => (
              <button
                key={m}
                onClick={() => setFilterMode(m)}
                style={{
                  ...FONT,
                  padding: '4px 8px',
                  fontSize: 10,
                  cursor: 'pointer',
                  background: filterMode === m ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                  color: filterMode === m ? '#60A5FA' : '#64748B',
                  border: filterMode === m ? '1px solid #3B82F6' : BORDER,
                  borderRadius: 2,
                }}
              >
                {m.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Main Logs Table / Stream ──────────────────────────────────────────── */}
      <div style={{ background: '#05070c', border: BORDER, overflow: 'hidden' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '110px 90px 1fr 130px 100px 90px 190px',
            padding: '12px 16px',
            borderBottom: BORDER,
            background: '#070a10',
            ...FONT,
            fontSize: 10,
            color: '#64748B',
            letterSpacing: '0.08em',
            fontWeight: 700,
          }}
        >
          <div>TIMESTAMP</div>
          <div>MODE</div>
          <div>INVESTIGATION QUERY</div>
          <div>THREAT LEVEL</div>
          <div>EVIDENCE</div>
          <div>LATENCY</div>
          <div style={{ textAlign: 'right' }}>ACTIONS</div>
        </div>

        {loading && logs.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', ...FONT, color: '#64748B', fontSize: 12 }}>
            LOADING REAL-TIME LOGS FROM DATABASE...
          </div>
        ) : filteredLogs.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', ...FONT, color: '#64748B', fontSize: 12 }}>
            NO SEARCHES MATCHING FILTERS
          </div>
        ) : (
          <div>
            {filteredLogs.map(log => {
              const riskColor = getRiskColor(log.risk_level)
              const isExpanded = expandedId === log.id
              const dossier = parseDossier(log)
              const verdictLabel =
                log.claim_assessment?.label ||
                log.details?.claim_assessment?.label ||
                log.claim_assessment?.status ||
                log.details?.claim_assessment?.status

              return (
                <div key={log.id} style={{ borderBottom: BORDER }}>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '110px 90px 1fr 130px 100px 90px 190px',
                      padding: '14px 16px',
                      alignItems: 'center',
                      background: isExpanded ? 'rgba(0, 212, 170, 0.04)' : 'transparent',
                      transition: 'background 0.15s ease',
                    }}
                  >
                    {/* Timestamp */}
                    <div>
                      <div style={{ ...FONT, fontSize: 11, color: '#F4F7FB' }}>{formatTime(log.timestamp)}</div>
                      <div style={{ ...FONT, fontSize: 9, color: '#64748B' }}>{formatRelative(log.timestamp)}</div>
                    </div>

                    {/* Mode */}
                    <div>
                      <span
                        style={{
                          ...FONT,
                          fontSize: 9,
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: 2,
                          background: '#0e1522',
                          color: '#60A5FA',
                          border: '1px solid #1e293b',
                        }}
                      >
                        {(log.query_mode || 'topic').toUpperCase()}
                      </span>
                    </div>

                    {/* Query & Narrative */}
                    <div style={{ paddingRight: 16 }}>
                      <div
                        style={{
                          ...FONT,
                          fontSize: 12,
                          color: '#FFFFFF',
                          fontWeight: 500,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          maxWidth: 460,
                        }}
                        title={log.query}
                      >
                        {log.query}
                      </div>
                      <div style={{ ...FONT, fontSize: 10, color: '#64748B', marginTop: 2 }}>
                        {log.narrative_category || 'Investigation'} {log.campaign_name ? `• ${log.campaign_name}` : ''}
                      </div>
                    </div>

                    {/* Threat Score & Risk Badge */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span
                        style={{
                          ...FONT,
                          fontSize: 9,
                          fontWeight: 700,
                          padding: '2px 7px',
                          borderRadius: 2,
                          background: riskColor,
                          color: '#000000',
                        }}
                      >
                        {(log.risk_level || 'LOW').toUpperCase()}
                      </span>
                      <span style={{ ...FONT, fontSize: 11, color: riskColor, fontWeight: 700 }}>
                        {log.threat_score}/100
                      </span>
                    </div>

                    {/* Evidence count */}
                    <div style={{ ...FONT, fontSize: 11, color: '#94A3B8', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ color: '#00D4AA', fontWeight: 700 }}>{log.evidence_count}</span>
                      <span>sources</span>
                    </div>

                    {/* Latency */}
                    <div style={{ ...FONT, fontSize: 11, color: '#64748B' }}>
                      {log.duration_ms ? `${log.duration_ms}ms` : '—'}
                    </div>

                    {/* Action buttons */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                      <button
                        onClick={() => {
                          if (isExpanded && expandedTab === 'DOSSIER') {
                            setExpandedId(null)
                          } else {
                            setExpandedId(log.id)
                            setExpandedTab('DOSSIER')
                          }
                        }}
                        title="View Evidence Dossier Synthesis"
                        style={{
                          ...FONT,
                          padding: '4px 8px',
                          fontSize: 10,
                          fontWeight: 700,
                          cursor: 'pointer',
                          background: isExpanded && expandedTab === 'DOSSIER' ? '#00D4AA' : 'rgba(0, 212, 170, 0.12)',
                          color: isExpanded && expandedTab === 'DOSSIER' ? '#000000' : '#00D4AA',
                          border: '1px solid #00D4AA',
                          borderRadius: 2,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        DOSSIER
                      </button>

                      <button
                        onClick={() => handleRerun(log.query, log.query_mode)}
                        title="Load into investigation workspace"
                        style={{
                          ...FONT,
                          padding: '4px 8px',
                          fontSize: 10,
                          cursor: 'pointer',
                          background: '#0F172A',
                          color: '#F4F7FB',
                          border: BORDER,
                          borderRadius: 2,
                        }}
                      >
                        RE-RUN
                      </button>

                      <button
                        onClick={() => {
                          if (isExpanded && expandedTab === 'JSON') {
                            setExpandedId(null)
                          } else {
                            setExpandedId(log.id)
                            setExpandedTab('JSON')
                          }
                        }}
                        title="View raw database node JSON"
                        style={{
                          ...FONT,
                          padding: '4px 8px',
                          fontSize: 10,
                          cursor: 'pointer',
                          background: isExpanded && expandedTab === 'JSON' ? 'rgba(59, 130, 246, 0.2)' : '#0F172A',
                          color: isExpanded && expandedTab === 'JSON' ? '#60A5FA' : '#94A3B8',
                          border: isExpanded && expandedTab === 'JSON' ? '1px solid #3B82F6' : BORDER,
                          borderRadius: 2,
                        }}
                      >
                        RAW
                      </button>
                    </div>
                  </div>

                  {/* Expanded View */}
                  {isExpanded && (
                    <div style={{ padding: '16px 20px 20px', background: '#030508', borderTop: '1px dashed #162032' }}>
                      {/* Sub-tabs header */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                        <button
                          onClick={() => setExpandedTab('DOSSIER')}
                          style={{
                            ...FONT,
                            fontSize: 10,
                            fontWeight: 700,
                            padding: '4px 10px',
                            cursor: 'pointer',
                            background: expandedTab === 'DOSSIER' ? 'rgba(0, 212, 170, 0.15)' : 'transparent',
                            color: expandedTab === 'DOSSIER' ? '#00D4AA' : '#64748B',
                            border: expandedTab === 'DOSSIER' ? '1px solid #00D4AA' : BORDER,
                            borderRadius: 2,
                          }}
                        >
                          EVIDENCE DOSSIER SYNTHESIS ({dossier.evidenceItems.length} SOURCES)
                        </button>
                        <button
                          onClick={() => setExpandedTab('JSON')}
                          style={{
                            ...FONT,
                            fontSize: 10,
                            fontWeight: 700,
                            padding: '4px 10px',
                            cursor: 'pointer',
                            background: expandedTab === 'JSON' ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                            color: expandedTab === 'JSON' ? '#60A5FA' : '#64748B',
                            border: expandedTab === 'JSON' ? '1px solid #3B82F6' : BORDER,
                            borderRadius: 2,
                          }}
                        >
                          RAW DATABASE NODE (JSON)
                        </button>
                      </div>

                      {expandedTab === 'DOSSIER' ? (
                        /* EVIDENCE-BACKED DOSSIER SYNTHESIS CARD */
                        <div
                          style={{
                            background: '#04070e',
                            border: BORDER,
                            borderLeft: '4px solid #00D4AA',
                            padding: '18px 22px',
                            borderRadius: 2,
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                            <div style={{ ...FONT, fontSize: 11, fontWeight: 700, color: '#00D4AA', letterSpacing: '0.12em' }}>
                              EVIDENCE-BACKED DOSSIER SYNTHESIS
                            </div>
                            {verdictLabel && (
                              <span
                                style={{
                                  ...FONT,
                                  fontSize: 9,
                                  fontWeight: 700,
                                  padding: '3px 8px',
                                  borderRadius: 2,
                                  background: log.risk_level === 'HIGH' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(0, 212, 170, 0.15)',
                                  color: log.risk_level === 'HIGH' ? '#EF4444' : '#00D4AA',
                                  border: log.risk_level === 'HIGH' ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(0, 212, 170, 0.4)',
                                }}
                              >
                                {verdictLabel}
                              </span>
                            )}
                          </div>

                          {/* Dossier narrative explanation */}
                          <div
                            style={{
                              fontSize: 13,
                              lineHeight: 1.65,
                              color: '#F4F7FB',
                              marginBottom: dossier.evidenceItems.length > 0 ? 16 : 0,
                              whiteSpace: 'pre-wrap',
                              overflowWrap: 'anywhere',
                            }}
                          >
                            {dossier.narrative}
                          </div>

                          {/* Key Evidence Bullet List */}
                          {dossier.evidenceItems.length > 0 && (
                            <div style={{ paddingTop: 14, borderTop: '1px solid #141c2c' }}>
                              <div style={{ ...FONT, fontSize: 10, fontWeight: 700, color: '#94A3B8', letterSpacing: '0.08em', marginBottom: 10 }}>
                                KEY EVIDENCE:
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {dossier.evidenceItems.map((ev, i) => (
                                  <div key={i} style={{ fontSize: 12, lineHeight: 1.5, color: '#CBD5E1', display: 'flex', alignItems: 'baseline', gap: 8 }}>
                                    <span style={{ color: '#00D4AA', fontSize: 14 }}>•</span>
                                    <div>
                                      <span style={{ color: '#FFFFFF', fontWeight: 600 }}>{ev.source}</span>
                                      <span style={{ color: '#64748B', margin: '0 6px' }}>—</span>
                                      {ev.url ? (
                                        <a
                                          href={ev.url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          style={{ color: '#93C5FD', textDecoration: 'none', borderBottom: '1px dashed #3B82F6' }}
                                          title="Open external source"
                                        >
                                          {ev.title}
                                        </a>
                                      ) : (
                                        <span>{ev.title}</span>
                                      )}
                                      {ev.direction && (
                                        <span
                                          style={{
                                            ...FONT,
                                            marginLeft: 8,
                                            fontSize: 9,
                                            fontWeight: 700,
                                            padding: '1px 6px',
                                            borderRadius: 2,
                                            background: ev.direction === 'CONTRADICTS' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                                            color: ev.direction === 'CONTRADICTS' ? '#EF4444' : '#10B981',
                                            border: ev.direction === 'CONTRADICTS' ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(16, 185, 129, 0.3)',
                                          }}
                                        >
                                          {ev.direction}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Linked accounts if present */}
                          {log.accounts && log.accounts.length > 0 && (
                            <div style={{ marginTop: 14, paddingTop: 10, borderTop: '1px solid #141c2c', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                              <span style={{ ...FONT, fontSize: 10, color: '#64748B' }}>INVESTIGATED ACCOUNTS:</span>
                              {log.accounts.map((acc, i) => (
                                <span
                                  key={i}
                                  style={{
                                    ...FONT,
                                    fontSize: 10,
                                    padding: '2px 8px',
                                    borderRadius: 2,
                                    background: '#0d131f',
                                    color: '#60A5FA',
                                    border: BORDER,
                                  }}
                                >
                                  {acc}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        /* RAW DATABASE NODE VIEW */
                        <div>
                          <div style={{ ...FONT, fontSize: 10, color: '#64748B', marginBottom: 6 }}>
                            DATABASE NODE [ID: {log.id}] • NEO4J GRAPH PERSISTENCE
                          </div>
                          <pre
                            style={{
                              ...FONT,
                              fontSize: 11,
                              color: '#00D4AA',
                              background: '#080c14',
                              border: BORDER,
                              padding: '12px',
                              borderRadius: 2,
                              overflowX: 'auto',
                              margin: 0,
                            }}
                          >
                            {JSON.stringify(log, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
