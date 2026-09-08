import NetworkGraphPanel from './_components/NetworkGraphPanel'
import AnalyzePanel from './_components/AnalyzePanel'
import AlertFeed from './_components/AlertFeed'
import LiveClaimsCell from './_components/LiveClaimsCell'

const MONO: React.CSSProperties = { fontFamily: 'var(--font-jetbrains-mono, "Fira Code", monospace)' }
const BORDER = '1px solid #263957'

const TIMELINE_DATA = [
  { name: 'Operation Pulse', threat: 'HIGH', color: '#FF5A67', activity: [2,3,4,9,10,13,14,15,20,21,22,23] },
  { name: 'MedFear', threat: 'HIGH', color: '#FFC14D', activity: [8,9,10,11,14,15,16,17,19] },
  { name: 'ReviewStorm', threat: 'MED', color: '#65A9FF', activity: [0,1,6,7,8,12,13,18,20,21] },
] as const

const THREAT_SCORES = [
  { name: 'OPERATION PULSE', score: 91, color: '#FF5A67', status: 'HIGH' },
  { name: 'MEDFEAR', score: 74, color: '#FFC14D', status: 'HIGH' },
  { name: 'REVIEWSTORM', score: 43, color: '#00D4AA', status: 'MEDIUM' },
] as const

function SectionHeader({ title, detail }: { title: string; detail?: string }) {
  return (
    <div style={{
      ...MONO, display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 46,
      padding: '0 18px', borderBottom: BORDER, color: '#C2CCDA', fontSize: 10, letterSpacing: '0.12em',
    }}>
      <span>{title}</span>
      {detail && <span style={{ color: '#7F90A9', letterSpacing: '0.08em' }}>{detail}</span>}
    </div>
  )
}

function MetricCell({ label, value, valueColor, borderRight = true }: { label: string; value: string; valueColor?: string; borderRight?: boolean }) {
  return (
    <div style={{ padding: '18px 20px', borderRight: borderRight ? BORDER : 'none' }}>
      <div style={{ ...MONO, fontSize: 9, fontWeight: 600, color: '#8798B1', letterSpacing: '0.12em', marginBottom: 9 }}>{label}</div>
      <div style={{ ...MONO, fontSize: 28, fontWeight: 700, lineHeight: 1.05, color: valueColor ?? '#F4F7FB' }}>{value}</div>
    </div>
  )
}

function ScoreCard({ name, score, color, status }: typeof THREAT_SCORES[number]) {
  return (
    <div style={{ flex: 1, minWidth: 0, padding: '18px 20px', borderRight: BORDER }}>
      <div style={{ ...MONO, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 9, color: '#AAB7CA', letterSpacing: '0.1em' }}>{name}</span>
        <span style={{ fontSize: 9, fontWeight: 700, color }}>{status}</span>
      </div>
      <div style={{ ...MONO, display: 'flex', alignItems: 'baseline', gap: 7, marginBottom: 10 }}>
        <span style={{ fontSize: 30, fontWeight: 700, color: '#F4F7FB' }}>{score}</span>
        <span style={{ fontSize: 10, color: '#72839C' }}>/ 100</span>
      </div>
      <div style={{ height: 7, border: '1px solid #334A6C', background: '#0C1525' }}>
        <div style={{ height: '100%', width: `${score}%`, background: color }} />
      </div>
    </div>
  )
}

function ActivityTimeline() {
  const HOURS = Array.from({ length: 24 }, (_, i) => i)
  return (
    <div style={{ padding: '18px 18px 20px' }}>
      <div style={{ display: 'flex', marginLeft: 166, marginBottom: 7 }}>
        {HOURS.map(h => <div key={h} style={{ width: `${100 / 24}%`, ...MONO, fontSize: 8, color: h % 4 === 0 ? '#7F90A9' : 'transparent' }}>{`${String(h).padStart(2,'0')}:00`}</div>)}
      </div>
      {TIMELINE_DATA.map(row => (
        <div key={row.name} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <div style={{ width: 156, flexShrink: 0, ...MONO, display: 'flex', alignItems: 'center', gap: 8, fontSize: 10, color: '#AAB7CA' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: row.color }} />{row.name}
          </div>
          <div style={{ flex: 1, display: 'flex', gap: 2 }}>
            {HOURS.map(h => {
              const active = row.activity.includes(h as never)
              return <div key={h} style={{ flex: 1, height: 16, border: `1px solid ${active ? row.color : '#20324D'}`, background: active ? row.color : '#0C1525', opacity: active ? 0.7 : 1 }} />
            })}
          </div>
        </div>
      ))}
      <div style={{ marginLeft: `${166 + (14 / 24) * 100}%`, ...MONO, fontSize: 8, color: '#00D4AA', letterSpacing: '0.06em' }}>NOW</div>
    </div>
  )
}

export default function OverviewPage() {
  return (
    <div>
      <div style={{ padding: '22px 22px 0' }}>
        <div style={{ ...MONO, fontSize: 10, color: '#00D4AA', letterSpacing: '0.16em', marginBottom: 8 }}>ANALYST MISSION CONTROL</div>
        <h1 style={{ margin: 0, fontSize: 24, lineHeight: 1.2, fontWeight: 650, color: '#F4F7FB' }}>Coordination overview</h1>
        <p style={{ margin: '8px 0 20px', maxWidth: 760, fontSize: 13, lineHeight: 1.6, color: '#AAB7CA' }}>
          Monitor active campaigns, inspect network evidence, and run an automated multi-signal investigation from one workspace.
        </p>
      </div>

      <section style={{ margin: '0 22px', border: BORDER, background: '#101A2C' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr) 1.3fr', borderBottom: BORDER }}>
          <MetricCell label="ACTIVE CAMPAIGNS" value="3" valueColor="#FF5A67" />
          <MetricCell label="ACCOUNTS FLAGGED" value="1,247" valueColor="#FFC14D" />
          <MetricCell label="ALERTS TODAY" value="18" />
          <MetricCell label="AVG CONFIDENCE" value="91.3%" valueColor="#00D4AA" />
          <LiveClaimsCell />
        </div>

        <div>
          <SectionHeader title="THREAT EXPOSURE" detail="3 ACTIVE CAMPAIGNS" />
          <div style={{ display: 'flex' }}>
            {THREAT_SCORES.map(s => <ScoreCard key={s.name} {...s} />)}
            <div style={{ flex: 1, padding: '18px 20px', background: '#0C1525' }}>
              <div style={{ ...MONO, fontSize: 9, color: '#8798B1', letterSpacing: '0.1em', marginBottom: 9 }}>READING THE SCORE</div>
              <div style={{ fontSize: 12, lineHeight: 1.55, color: '#B8C4D6' }}>Higher scores indicate stronger combined coordination evidence across behavioral, linguistic, and graph signals.</div>
            </div>
          </div>
        </div>

        <AnalyzePanel />

        <div id="st-graph-section" style={{ display: 'flex', minHeight: 460, borderBottom: BORDER }}>
          <div style={{ flex: '0 0 65%', minWidth: 0, borderRight: BORDER, overflow: 'hidden' }}><NetworkGraphPanel /></div>
          <div style={{ flex: '0 0 35%', minWidth: 0, overflow: 'hidden' }}><AlertFeed /></div>
        </div>

        <div>
          <SectionHeader title="CAMPAIGN ACTIVITY — LAST 24H" detail="TIMES SHOWN IN UTC" />
          <ActivityTimeline />
        </div>
      </section>
      <div style={{ height: 32 }} />
    </div>
  )
}
