'use client'

import { useEffect, useState } from 'react'
import type { ClaimAssessment, EvidenceItem, SourceStatus } from '@/types'

const MONO: React.CSSProperties = { fontFamily: 'var(--font-jetbrains-mono, "Fira Code", monospace)' }
const BORDER = '1px solid #162032'

interface Props {
  evidence: EvidenceItem[]
  sourceStatuses: SourceStatus[]
}

function sourceTypeBadge(type: string) {
  switch (type) {
    case 'web_news':
      return { label: 'WEB NEWS', bg: 'rgba(59, 130, 246, 0.15)', color: '#60A5FA', border: '#1D4ED8' }
    case 'fact_checker':
      return { label: 'FACT CHECK', bg: 'rgba(239, 68, 68, 0.15)', color: '#F87171', border: '#B91C1C' }
    case 'bluesky':
      return { label: 'BLUESKY', bg: 'rgba(14, 165, 233, 0.15)', color: '#38BDF8', border: '#0369A1' }
    case 'user_text':
      return { label: 'USER TEXT', bg: 'rgba(16, 185, 129, 0.15)', color: '#34D399', border: '#047857' }
    default:
      return { label: type.toUpperCase(), bg: 'rgba(148, 163, 184, 0.15)', color: '#94A3B8', border: '#475569' }
  }
}

function statusBadge(status: string) {
  switch (status) {
    case 'completed':
      return { label: 'ONLINE / RETRIEVED', color: '#34D399' }
    case 'limited':
      return { label: 'LIMITED DATA', color: '#F59E0B' }
    case 'unavailable':
      return { label: 'UNAVAILABLE', color: '#64748B' }
    case 'failed':
      return { label: 'FAILED / ERROR', color: '#EF4444' }
    default:
      return { label: status.toUpperCase(), color: '#94A3B8' }
  }
}

function claimPresentation(assessment?: ClaimAssessment) {
  if (!assessment) return { label: 'ASSESSMENT UNAVAILABLE', color: '#64748B' }
  switch (assessment.status) {
    case 'CONTRADICTED':
      return { label: 'NOT SUPPORTED', color: '#EF4444' }
    case 'PARTIALLY_SUPPORTED':
      return { label: 'SUPPORTED BY REPORTING', color: '#F59E0B' }
    case 'SUPPORTED':
      return { label: 'SUPPORTED', color: '#34D399' }
    default:
      return { label: 'NOT YET VERIFIED', color: '#94A3B8' }
  }
}

export default function EvidencePanel({ evidence, sourceStatuses }: Props) {
  const [claimAssessment, setClaimAssessment] = useState<ClaimAssessment | undefined>(undefined)

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem('echosnare_active_investigation')
      if (saved) {
        const parsed = JSON.parse(saved) as { claim_assessment?: ClaimAssessment }
        if (parsed?.claim_assessment) setClaimAssessment(parsed.claim_assessment)
      }
    } catch {}
  }, [evidence.length])

  const claim = claimPresentation(claimAssessment)

  return (
    <div style={{ padding: 20, background: '#07090e', borderBottom: BORDER }}>
      {claimAssessment && (
        <div style={{ marginBottom: 18, padding: '12px 14px', background: '#04060a', border: BORDER, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ ...MONO, fontSize: 9, fontWeight: 700, color: '#94A3B8', letterSpacing: '0.12em', marginBottom: 5 }}>
              CLAIM ASSESSMENT
            </div>
            <div style={{ ...MONO, fontSize: 16, fontWeight: 800, color: claim.color }}>
              {claim.label}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <div style={{ ...MONO, fontSize: 10, color: '#F4F7FB' }}>{Math.round(claimAssessment.confidence * 100)}% evidence confidence</div>
            <div style={{ ...MONO, fontSize: 10, color: '#64748B', maxWidth: 540 }}>{claimAssessment.explanation}</div>
          </div>
        </div>
      )}

      <div style={{ marginBottom: 20 }}>
        <div style={{ ...MONO, fontSize: 10, fontWeight: 700, color: '#94A3B8', letterSpacing: '0.12em', marginBottom: 10 }}>
          SOURCE PROVENANCE & CHANNEL AVAILABILITY
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {sourceStatuses.map(st => {
            const sb = statusBadge(st.status)
            return (
              <div
                key={st.source_name}
                style={{
                  ...MONO,
                  background: '#04060a',
                  border: BORDER,
                  padding: '8px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  fontSize: 11,
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: sb.color }} />
                <span style={{ color: '#E2E8F0', fontWeight: 600 }}>{st.source_name}</span>
                <span style={{ color: sb.color, fontSize: 9, fontWeight: 700 }}>{sb.label}</span>
                {st.count > 0 && <span style={{ color: '#00D4AA', fontSize: 10 }}>({st.count} items)</span>}
                {st.warning_or_error && st.status !== 'completed' && (
                  <span title={st.warning_or_error} style={{ color: '#64748B', fontSize: 9 }}>ⓘ</span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div>
        <div style={{ ...MONO, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', letterSpacing: '0.12em' }}>
            RETRIEVED EVIDENCE ({evidence.length})
          </span>
          <span style={{ fontSize: 10, color: '#64748B' }}>SOURCE ROLE & PROVENANCE</span>
        </div>

        {evidence.length === 0 ? (
          <div style={{ padding: '16px 20px', background: '#04060a', border: BORDER, color: '#94A3B8', fontSize: 12, ...MONO }}>
            No live external evidence items retrieved for this query. Analysis is limited to internal pattern heuristics.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {evidence.map(item => {
              const badge = sourceTypeBadge(item.source_type)
              const assessment = item.source_assessment
              return (
                <div
                  key={item.id}
                  style={{
                    background: '#04060a',
                    border: BORDER,
                    borderLeft: `3px solid ${badge.color}`,
                    padding: '12px 16px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span
                        style={{
                          ...MONO,
                          fontSize: 9,
                          fontWeight: 700,
                          color: badge.color,
                          background: badge.bg,
                          border: `1px solid ${badge.border}`,
                          padding: '2px 6px',
                          borderRadius: '2px',
                        }}
                      >
                        {badge.label}
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 650, color: '#F4F7FB' }}>{item.title}</span>
                    </div>

                    <span style={{ ...MONO, fontSize: 10, color: '#00D4AA', whiteSpace: 'nowrap' }}>
                      {Math.round(item.confidence * 100)}%
                    </span>
                  </div>

                  {assessment && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                      <span style={{ ...MONO, fontSize: 9, fontWeight: 750, color: '#E2E8F0' }}>{assessment.label}</span>
                      <span style={{ fontSize: 11, color: '#64748B' }}>·</span>
                      <span style={{ fontSize: 11, color: '#94A3B8' }}>{assessment.explanation}</span>
                    </div>
                  )}

                  <p style={{ margin: '4px 0 8px', fontSize: 12, lineHeight: 1.55, color: '#CBD5E1' }}>{item.text}</p>

                  <div style={{ ...MONO, display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 10, color: '#64748B' }}>
                    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                      <span>Source: <b style={{ color: '#94A3B8' }}>{item.source_name}</b></span>
                      {item.author && <span>Author: <b style={{ color: '#94A3B8' }}>{item.author}</b></span>}
                      {item.published_at && <span>Published: <b style={{ color: '#94A3B8' }}>{item.published_at.slice(0, 16).replace('T', ' ')}</b></span>}
                    </div>

                    {item.source_url && item.source_url.startsWith('http') && (
                      <a href={item.source_url} target="_blank" rel="noreferrer" style={{ color: '#60A5FA', textDecoration: 'underline', fontSize: 10 }}>
                        View Original Source ↗
                      </a>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
