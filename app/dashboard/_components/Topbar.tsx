'use client'

import { usePathname } from 'next/navigation'

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
      minHeight: 54, flexShrink: 0, background: '#0B1423', borderBottom: '1px solid #263957',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 22px', gap: 16,
    }}>
      <div style={{ ...MONO, minWidth: 0, display: 'flex', alignItems: 'center', gap: 10, fontSize: 11 }}>
        <span style={{ color: '#6F829E', letterSpacing: '0.14em' }}>ECHOSNARE</span>
        <span style={{ color: '#344A68' }}>/</span>
        <span style={{ color: '#F4F7FB', letterSpacing: '0.08em', fontWeight: 600 }}>{viewName}</span>
      </div>
      <div style={{ ...MONO, display: 'flex', alignItems: 'center', gap: 16, fontSize: 9, letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>
        <span style={{ color: '#34D399' }}>● SYSTEM LIVE</span>
        <span style={{ color: '#9AAAC0' }}>3 ACTIVE CAMPAIGNS</span>
        <span style={{ color: '#6F829E' }}>FABRIC NOMINAL</span>
      </div>
    </header>
  )
}
