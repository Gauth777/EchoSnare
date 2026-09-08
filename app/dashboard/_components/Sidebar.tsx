'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_ITEMS = [
  { label: 'Overview', href: '/dashboard' },
  { label: 'WhatsApp Intel', href: '/dashboard/whatsapp' },
  { label: 'Image Forensics', href: '/dashboard/image-forensics' },
  { label: 'Account Intel', href: '/dashboard/account-intel' },
  { label: 'Network Graph', href: '/dashboard/network' },
  { label: 'Alert Feed', href: '/dashboard/alerts' },
  { label: 'Agents', href: '/dashboard/agents' },
  { label: 'Reports', href: '/dashboard/reports' },
]

const AGENTS = ['Source Retriever', 'Content Analyzer', 'Network Mapper', 'Threat Classifier', 'Deepfake Detector']

const MONO: React.CSSProperties = {
  fontFamily: 'var(--font-jetbrains-mono, "Fira Code", monospace)',
}

function Mark() {
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 5px)',
        gap: '3px',
      }}
    >
      <i style={{ width: 5, height: 5, background: '#00D4AA', display: 'block' }} />
      <i style={{ width: 5, height: 5, background: '#4D678C', display: 'block' }} />
      <i style={{ width: 5, height: 5, background: '#4D678C', display: 'block' }} />
      <i style={{ width: 5, height: 5, background: '#00D4AA', display: 'block' }} />
    </span>
  )
}

export function BottomTabBar() {
  const pathname = usePathname()
  return (
    <nav
      className="st-bottom-tabs"
      style={{
        display: 'none', position: 'fixed', bottom: 0, left: 0, right: 0, height: 58,
        background: '#0B1423', borderTop: '1px solid #263957', zIndex: 50,
      }}
    >
      {NAV_ITEMS.slice(0, 5).map(item => {
        const active = pathname === item.href
        return (
          <Link key={item.href} href={item.href} style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 5, color: active ? '#00D4AA' : '#8798B1', textDecoration: 'none',
          }}>
            <span style={{ ...MONO, fontSize: 10 }}>{item.label.slice(0, 4).toUpperCase()}</span>
          </Link>
        )
      })}
    </nav>
  )
}

export default function Sidebar() {
  const pathname = usePathname()
  return (
    <aside
      className="st-sidebar"
      style={{
        width: 236, flexShrink: 0, background: '#0B1423', borderRight: '1px solid #263957',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}
    >
      <div style={{ padding: '18px 18px 16px', borderBottom: '1px solid #263957' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Mark />
          <div>
            <div style={{ ...MONO, fontSize: 14, fontWeight: 700, letterSpacing: '0.14em', color: '#F4F7FB' }}>ECHOSNARE</div>
            <div style={{ ...MONO, marginTop: 4, fontSize: 8, letterSpacing: '0.1em', color: '#8294AE' }}>GRAPH THREAT INTELLIGENCE</div>
          </div>
        </div>
      </div>

      <nav style={{ padding: '18px 10px 10px' }}>
        <div style={{ ...MONO, fontSize: 9, letterSpacing: '0.18em', color: '#8294AE', padding: '0 10px 9px' }}>MISSION CONTROL</div>
        {NAV_ITEMS.map(item => {
          const active = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                ...MONO, display: 'flex', alignItems: 'center', minHeight: 36, padding: '0 10px', marginBottom: 3,
                fontSize: 12, letterSpacing: '0.02em', color: active ? '#F4F7FB' : '#A7B5C9',
                background: active ? '#122139' : 'transparent', border: active ? '1px solid #294463' : '1px solid transparent',
                borderLeft: active ? '3px solid #00D4AA' : '3px solid transparent', textDecoration: 'none',
              }}
            >
              <span>{item.label}</span>
              {item.href === '/dashboard/network' && <span style={{ marginLeft: 'auto', color: '#34D399', fontSize: 8 }}>● LIVE</span>}
            </Link>
          )
        })}
      </nav>

      <div style={{ marginTop: 'auto', borderTop: '1px solid #263957', padding: '14px 18px 16px' }}>
        <div style={{ ...MONO, fontSize: 9, letterSpacing: '0.18em', color: '#8294AE', marginBottom: 10 }}>ANALYSIS FABRIC</div>
        {AGENTS.map(agent => (
          <div key={agent} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', ...MONO, fontSize: 10, color: '#9EADC2' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#34D399', boxShadow: '0 0 0 3px rgba(52,211,153,0.08)' }} />
            <span>{agent}</span>
          </div>
        ))}
        <div style={{ ...MONO, marginTop: 10, paddingTop: 10, borderTop: '1px solid #1D2D45', fontSize: 9, color: '#8294AE' }}>
          <span style={{ color: '#34D399' }}>●</span> PIPELINE NOMINAL
        </div>
      </div>
    </aside>
  )
}
