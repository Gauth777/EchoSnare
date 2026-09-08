'use client'

import { usePathname } from 'next/navigation'

const VIEW_NAMES: Record<string, string> = {
  '/dashboard':                 'OVERVIEW',
  '/dashboard/whatsapp':        'WHATSAPP INTEL',
  '/dashboard/image-forensics': 'IMAGE FORENSICS',
  '/dashboard/account-intel':   'ACCOUNT INTEL',
  '/dashboard/network':         'NETWORK GRAPH',
  '/dashboard/alerts':          'ALERT FEED',
  '/dashboard/agents':          'AGENTS',
  '/dashboard/reports':         'REPORTS',
}

const MONO: React.CSSProperties = {
  fontFamily: 'var(--font-jetbrains-mono, "Fira Code", monospace)',
}

export default function Topbar() {
  const pathname = usePathname()
  const viewName = VIEW_NAMES[pathname] ?? 'OVERVIEW'

  return (
    <header
      style={{
        height: '40px',
        flexShrink: 0,
        backgroundColor: '#080E1A',
        borderBottom: '1px solid #1E2D4A',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
      }}
    >
      {/* Breadcrumb */}
      <div
        style={{
          ...MONO,
          fontSize: '11px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <span style={{ color: '#4A5568', letterSpacing: '0.12em' }}>SHADOWTRACE</span>
        <span style={{ color: '#1E2D4A' }}>/</span>
        <span style={{ color: '#E2E8F0', letterSpacing: '0.06em' }}>{viewName}</span>
      </div>

      {/* Status chips */}
      <div
        style={{
          ...MONO,
          fontSize: '10px',
          display: 'flex',
          alignItems: 'center',
          gap: '20px',
        }}
      >
        <span style={{ color: '#22C55E' }}>● LIVE</span>
        <span style={{ color: '#4A5568' }}>3 CAMPAIGNS</span>
        <span style={{ color: '#4A5568' }}>SYS: NOMINAL</span>
      </div>
    </header>
  )
}
