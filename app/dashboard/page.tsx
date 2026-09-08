import NetworkGraphPanel from './_components/NetworkGraphPanel'
import AnalyzePanel      from './_components/AnalyzePanel'
import AlertFeed         from './_components/AlertFeed'
import LiveClaimsCell    from './_components/LiveClaimsCell'

// ─── Shared style constants ───────────────────────────────────────────────────

const MONO: React.CSSProperties = {
  fontFamily: 'var(--font-jetbrains-mono, "Fira Code", monospace)',
}
const BORDER = '1px solid #1E2D4A'

// 24h activity for timeline — [hour, intensity 0-4]
const TIMELINE_DATA = [
  {
    name:     'Operation Pulse',
    threat:   'HIGH',
    color:    '#EF4444',
    activity: [2,3,4,9,10,13,14,15,20,21,22,23],
  },
  {
    name:     'MedFear',
    threat:   'HIGH',
    color:    '#F59E0B',
    activity: [8,9,10,11,14,15,16,17,19],
  },
  {
    name:     'ReviewStorm',
    threat:   'MED',
    color:    '#3B82F6',
    activity: [0,1,6,7,8,12,13,18,20,21],
  },
] as const

// ─── Threat scores ────────────────────────────────────────────────────────────

const THREAT_SCORES = [
  { name: 'OPERATION PULSE', score: 91, color: '#EF4444' },
  { name: 'MEDFEAR',         score: 74, color: '#F59E0B' },
  { name: 'REVIEWSTORM',     score: 43, color: '#00D4AA' },
] as const

// ─── Sub-components (all server, no state needed) ─────────────────────────────

function PanelLabel({ left, right }: { left: string; right?: string }) {
  return (
    <div
      style={{
        ...MONO,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: '36px',
        padding: '0 16px',
        borderBottom: BORDER,
        fontSize: '10px',
        letterSpacing: '0.08em',
        color: '#4A5568',
        flexShrink: 0,
      }}
    >
      <span>{left}</span>
      {right && <span>{right}</span>}
    </div>
  )
}

function MetricCell({
  label,
  value,
  valueColor,
  borderRight,
}: {
  label: string
  value: string
  valueColor?: string
  borderRight?: boolean
}) {
  return (
    <div
      style={{
        padding: '16px 24px',
        borderRight: borderRight ? BORDER : 'none',
      }}
    >
      <div
        style={{
          ...MONO,
          fontSize: '10px',
          letterSpacing: '0.1em',
          color: '#4A5568',
          marginBottom: '10px',
        }}
      >
        {label}
      </div>
      <div
        style={{
          ...MONO,
          fontSize: '32px',
          fontWeight: 700,
          color: valueColor ?? '#E2E8F0',
          lineHeight: 1,
          letterSpacing: '-0.01em',
        }}
      >
        {value}
      </div>
    </div>
  )
}

function ScoreArc({ score, color, name }: { score: number; color: string; name: string }) {
  const R = 32
  const C = 2 * Math.PI * R
  const filled = (score / 100) * C

  return (
    <div
      style={{
        display:       'flex',
        flexDirection: 'column',
        alignItems:    'center',
        flex:          1,
        padding:       '16px 8px 14px',
      }}
    >
      <svg width="80" height="80" viewBox="0 0 80 80">
        {/* Track */}
        <circle cx="40" cy="40" r={R} fill="none" stroke="#1E2D4A" strokeWidth="4" />
        {/* Arc */}
        <circle cx="40" cy="40" r={R}
          fill="none" stroke={color} strokeWidth="4"
          strokeDasharray={`${filled} ${C - filled}`}
          strokeLinecap="butt"
          transform="rotate(-90 40 40)"
        />
        {/* Score number */}
        <text x="40" y="38" textAnchor="middle"
          fill="#E2E8F0" fontSize="16" fontWeight="700"
          fontFamily='var(--font-jetbrains-mono,"Fira Code",monospace)'>
          {score}
        </text>
        {/* /100 */}
        <text x="40" y="52" textAnchor="middle"
          fill="#4A5568" fontSize="8"
          fontFamily='var(--font-jetbrains-mono,"Fira Code",monospace)'>
          /100
        </text>
      </svg>

      <div style={{ ...MONO, fontSize: '9px', letterSpacing: '0.1em', color: '#4A5568', textAlign: 'center', marginTop: '8px' }}>
        {name}
      </div>
      <div style={{ ...MONO, fontSize: '10px', fontWeight: 700, color, marginTop: '3px', letterSpacing: '0.08em' }}>
        {score >= 70 ? 'HIGH' : score >= 40 ? 'MED' : 'LOW'}
      </div>
    </div>
  )
}

function ActivityTimeline() {
  const HOURS = Array.from({ length: 24 }, (_, i) => i)

  return (
    <div style={{ padding: '14px 16px 16px' }}>
      {/* Hour header row */}
      <div style={{ display: 'flex', marginLeft: '156px', marginBottom: '5px' }}>
        {HOURS.map((h) =>
          h % 4 === 0 ? (
            <div
              key={h}
              style={{
                ...MONO,
                width: `${(4 / 24) * 100}%`,
                fontSize: '9px',
                color: '#4A5568',
                letterSpacing: '0.04em',
              }}
            >
              {`${String(h).padStart(2, '0')}:00`}
            </div>
          ) : (
            <div key={h} style={{ width: `${(1 / 24) * 100}%` }} />
          ),
        )}
      </div>

      {/* Campaign rows */}
      {TIMELINE_DATA.map((c) => (
        <div
          key={c.name}
          style={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: '5px',
          }}
        >
          <div
            style={{
              ...MONO,
              width: '156px',
              flexShrink: 0,
              fontSize: '11px',
              color: '#4A5568',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span
              style={{
                display: 'inline-block',
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: c.color,
                opacity: 0.8,
              }}
            />
            {c.name}
          </div>
          <div style={{ flex: 1, display: 'flex', gap: '1px' }}>
            {HOURS.map((h) => {
              const active = c.activity.includes(h as never)
              return (
                <div
                  key={h}
                  style={{
                    flex: 1,
                    height: '14px',
                    backgroundColor: active ? c.color : '#0D1526',
                    opacity: active ? 0.75 : 0.4,
                    border: active ? 'none' : '1px solid #1A2840',
                  }}
                />
              )
            })}
          </div>
        </div>
      ))}

      {/* NOW marker at hour 14 */}
      <div style={{ display: 'flex', marginLeft: '156px' }}>
        <div
          style={{
            width: `${(14 / 24) * 100}%`,
            ...MONO,
            fontSize: '9px',
            color: '#00D4AA',
            textAlign: 'right',
            letterSpacing: '0.06em',
          }}
        >
          NOW ▲
        </div>
      </div>
    </div>
  )
}

// ─── Overview page ────────────────────────────────────────────────────────────

export default function OverviewPage() {
  return (
    <div style={{ borderTop: BORDER }}>

      {/* ── Row 1: Metric strips ───────────────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          borderBottom: BORDER,
        }}
      >
        <MetricCell label="ACTIVE CAMPAIGNS" value="3"      valueColor="#EF4444" borderRight />
        <MetricCell label="BOTS DETECTED"    value="1,247"  valueColor="#F59E0B" borderRight />
        <MetricCell label="ALERTS TODAY"     value="18"                          borderRight />
        <MetricCell label="AVG CONFIDENCE"   value="91.3%"                       borderRight />
        <LiveClaimsCell />
      </div>

      {/* ── Row 2: Threat Score ───────────────────────────────────────── */}
      <div style={{ borderBottom: BORDER }}>
        <PanelLabel left="THREAT SCORE" right="LIVE · 3 ACTIVE CAMPAIGNS" />
        <div style={{ display: 'flex' }}>
          {THREAT_SCORES.map((s, i) => (
            <div key={s.name} style={{ flex: 1, borderRight: i < THREAT_SCORES.length - 1 ? BORDER : 'none' }}>
              <ScoreArc score={s.score} color={s.color} name={s.name} />
            </div>
          ))}
        </div>
      </div>

      {/* ── Row 3: Analyze content ────────────────────────────────────── */}
      <AnalyzePanel />

      {/* ── Row 3: Network graph + Live alerts ────────────────────────── */}
      <div
        id="st-graph-section"
        style={{
          display: 'flex',
          height: '420px',
          borderBottom: BORDER,
        }}
      >
        {/* Network graph — 65% */}
        <div
          style={{
            flex:     '0 0 65%',
            borderRight: BORDER,
            overflow: 'hidden',
          }}
        >
          <NetworkGraphPanel />
        </div>

        {/* Live alerts — 35% */}
        <div
          style={{
            flex:     '0 0 35%',
            overflow: 'hidden',
          }}
        >
          <AlertFeed />
        </div>
      </div>

      {/* ── Row 4: Campaign activity timeline ─────────────────────────── */}
      <div>
        <PanelLabel left="CAMPAIGN ACTIVITY — LAST 24H" right="UTC" />
        <ActivityTimeline />
      </div>

    </div>
  )
}
