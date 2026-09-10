'use client'

import type { InvestigationStage } from '@/types'

const MONO: React.CSSProperties = { fontFamily: 'var(--font-jetbrains-mono, "Fira Code", monospace)' }

interface Props {
  stages: InvestigationStage[]
  activeStageId?: string
}

export default function InvestigationWorkflow({ stages }: Props) {
  if (!stages || stages.length === 0) return null

  return (
    <div style={{ padding: '16px 20px', background: '#05070c', borderBottom: '1px solid #162032' }}>
      <div style={{ ...MONO, fontSize: 10, fontWeight: 700, color: '#94A3B8', letterSpacing: '0.12em', marginBottom: 12 }}>
        AUTOMATED PIPELINE EXECUTION STAGES
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 8,
          width: '100%',
        }}
      >
        {stages.map((st, idx) => {
          const isDone = st.status === 'completed'
          const isLimited = st.status === 'limited'
          const badgeColor = isDone ? '#00D4AA' : isLimited ? '#F59E0B' : '#EF4444'

          return (
            <div
              key={st.stage_id}
              style={{
                background: '#04060a',
                border: `1px solid ${isDone ? 'rgba(0, 212, 170, 0.25)' : '#162032'}`,
                borderTop: `3px solid ${badgeColor}`,
                padding: '10px 12px',
                borderRadius: '2px',
              }}
            >
              <div style={{ ...MONO, display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 9, color: '#94A3B8', letterSpacing: '0.08em' }}>
                  STEP 0{idx + 1}
                </span>
                <span style={{ fontSize: 9, color: badgeColor, fontWeight: 700 }}>
                  {st.duration_ms}ms
                </span>
              </div>

              <div style={{ fontSize: 12, fontWeight: 650, color: '#F4F7FB', marginBottom: 6, lineHeight: 1.25 }}>
                {st.stage_name}
              </div>

              <div style={{ ...MONO, fontSize: 10, color: '#94A3B8', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {st.source_count > 0 && <span>Sources: <b style={{ color: '#E2E8F0' }}>{st.source_count}</b></span>}
                {st.evidence_count > 0 && <span>Items: <b style={{ color: '#00D4AA' }}>{st.evidence_count}</b></span>}
              </div>

              <div style={{ fontSize: 10, color: '#64748B', marginTop: 6, lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={st.detail}>
                {st.detail}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
