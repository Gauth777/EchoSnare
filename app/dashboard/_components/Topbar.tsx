'use client'

import { usePathname } from 'next/navigation'

import Link from 'next/link'

const VIEW_NAMES: Record<string, string> = {
  '/dashboard': 'OVERVIEW',
  '/dashboard/whatsapp': 'WHATSAPP INTEL',
  '/dashboard/image-forensics': 'IMAGE FORENSICS',
  '/dashboard/account-intel': 'ACCOUNT INTEL',
  '/dashboard/network': 'NETWORK GRAPH',
  '/dashboard/alerts': 'ALERT FEED',
  '/dashboard/agents': 'AGENTS',
  '/dashboard/reports': 'REPORTS',
}

const MONO: React.CSSProperties = {
  fontFamily: 'var(--font-jetbrains-mono, "Fira Code", monospace)',
}

export default function Topbar() {
  const pathname = usePathname()
  const viewName = VIEW_NAMES[pathname] ?? 'OVERVIEW'

  return (
    <header style={{
      minHeight: 54, flexShrink: 0, background: '#05070c', borderBottom: '1px solid #162032',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 22px', gap: 16,
    }}>
      <div style={{ ...MONO, minWidth: 0, display: 'flex', alignItems: 'center', gap: 10, fontSize: 11 }}>
        <Link
          href="/"
          style={{
            color: '#00D4AA',
            textDecoration: 'none',
            letterSpacing: '0.12em',
            padding: '3px 8px',
            borderRadius: '2px',
            background: 'rgba(0, 212, 170, 0.08)',
            border: '1px solid rgba(0, 212, 170, 0.25)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            fontSize: 10,
            fontWeight: 650,
          }}
        >
          <span>←</span> LANDING PAGE
        </Link>
        <span style={{ color: '#263957' }}>/</span>
        <span style={{ color: '#94A3B8', letterSpacing: '0.14em' }}>ECHOSNARE</span>
        <span style={{ color: '#263957' }}>/</span>
        <span style={{ color: '#F4F7FB', letterSpacing: '0.08em', fontWeight: 600 }}>{viewName}</span>
      </div>
      <div style={{ ...MONO, display: 'flex', alignItems: 'center', gap: 16, fontSize: 10, letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>
        <span style={{ color: '#00D4AA', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#00D4AA', boxShadow: '0 0 8px #00D4AA' }} />
          PIPELINE OPERATIONAL
        </span>
        <span style={{ color: '#CBD5E1' }}>BENCHMARK CAMPAIGNS: 3</span>
        <span style={{ color: '#94A3B8' }}>SOURCE FABRIC: NOMINAL</span>
      </div>
    </header>
  )
}
