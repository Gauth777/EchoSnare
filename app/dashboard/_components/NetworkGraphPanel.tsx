'use client'

import { useState, useRef, useEffect } from 'react'
import NetworkGraph from './NetworkGraph'
import LiveFeedPanel from '@/components/LiveFeedPanel'
import { campaigns as mockCampaigns } from '@/lib/mockData'
import type { Campaign } from '@/types'

const FONT: React.CSSProperties = {
  fontFamily: 'var(--font-jetbrains-mono, "Fira Code", monospace)',
}

const THREAT_COLOR: Record<string, string> = {
  HIGH: '#EF4444',
  MED:  '#F59E0B',
  LOW:  '#3B82F6',
}

interface Props {
  activeInvestigation?: InvestigationResult | null
}

function buildPromptCampaign(inv: InvestigationResult): Campaign {
  const shortQ = inv.query.length > 20 ? inv.query.slice(0, 18) + '…' : inv.query
  return {
    id: 'active-prompt-graph',
    name: `● LIVE: ${shortQ}`,
    threat_level: inv.risk_level || 'HIGH',
    account_count: inv.graph?.nodes?.length || 0,
    start_time: inv.timestamp || new Date().toISOString(),
    narrative: inv.narrative_category || inv.query,
    confidence: inv.confidence || 0.85,
    nodes: inv.graph?.nodes || [],
    edges: inv.graph?.edges || [],
  }
}

export default function NetworkGraphPanel({ activeInvestigation: propInvestigation }: Props = {}) {
  const [baseCampaigns, setBaseCampaigns] = useState<Campaign[]>(mockCampaigns)
  const [activeInv, setActiveInv] = useState<InvestigationResult | null>(propInvestigation ?? null)
  const [campaigns, setCampaigns] = useState<Campaign[]>(mockCampaigns)
  const [selected, setSelected] = useState(0) // which campaign button is active
  const [visible, setVisible] = useState(0) // which campaign data the graph shows
  const [opacity, setOpacity] = useState(1) // graph fade opacity
  const [graphReady, setGraphReady] = useState(false) // skeleton until D3 entrance anim ends
  const [showLive, setShowLive] = useState(false) // LIVE FEED tab replaces the graph

  // Clear any in-flight timeouts on rapid switching
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  // Keep a ref so event handlers always see the latest campaigns array
  const campaignsRef = useRef<Campaign[]>(mockCampaigns)

  // Sync prop changes
  useEffect(() => {
    if (propInvestigation) {
      setActiveInv(propInvestigation)
    }
  }, [propInvestigation])

  // On mount: check sessionStorage for active investigation
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem('echosnare_active_investigation')
      if (saved) {
        const parsed = JSON.parse(saved) as InvestigationResult
        if (parsed?.graph?.nodes?.length) {
          setActiveInv(parsed)
        }
      }
    } catch {}
  }, [])

  // Listen for investigation completion events
  useEffect(() => {
    function onInvComplete(e: Event) {
      const data = (e as CustomEvent<InvestigationResult>).detail
      if (data?.graph?.nodes?.length) {
        setActiveInv(data)
        // Automatically switch to the new live prompt graph
        setSelected(0)
        setVisible(0)
      }
    }
    window.addEventListener('echosnare:investigation-complete', onInvComplete)
    return () => window.removeEventListener('echosnare:investigation-complete', onInvComplete)
  }, [])

  // Fetch real campaign data from backend (via /api/campaigns Next.js proxy)
  useEffect(() => {
    fetch('/api/campaigns')
      .then(r => (r.ok ? r.json() : null))
      .then((data: Campaign[] | null) => {
        if (Array.isArray(data) && data.length > 0) {
          setBaseCampaigns(data)
        }
      })
      .catch(() => {
        /* silent — keeps mockCampaigns */
      })
  }, [])

  // Recompute campaigns whenever baseCampaigns or activeInv changes
  useEffect(() => {
    if (activeInv && activeInv.graph?.nodes?.length) {
      const promptCamp = buildPromptCampaign(activeInv)
      const combined = [promptCamp, ...baseCampaigns]
      setCampaigns(combined)
      campaignsRef.current = combined
    } else {
      setCampaigns(baseCampaigns)
      campaignsRef.current = baseCampaigns
    }
  }, [baseCampaigns, activeInv])

  // On mount: check if a campaign was pre-selected via sessionStorage (e.g. from Reports page)
  useEffect(() => {
    const saved = sessionStorage.getItem('st-campaign')
    if (saved) {
      sessionStorage.removeItem('st-campaign')
      const idx = campaignsRef.current.findIndex(c => c.name === saved)
      if (idx !== -1) {
        setSelected(idx)
        setVisible(idx)
      }
    }
  }, [])

  // Listen for campaign-select events dispatched by AnalyzePanel's "View Network →"
  useEffect(() => {
    function onSelect(e: Event) {
      const { campaignName } = (e as CustomEvent<{ campaignName: string }>).detail
      const idx = campaignsRef.current.findIndex(c => c.name === campaignName)
      if (idx === -1) return
      timers.current.forEach(clearTimeout)
      setSelected(idx)
      setOpacity(0)
      const t1 = setTimeout(() => setVisible(idx), 300)
      const t2 = setTimeout(() => setOpacity(1), 400)
      timers.current = [t1, t2]
    }
    window.addEventListener('echosnare:campaign-select', onSelect)
    window.addEventListener('shadowtrace:campaign-select', onSelect)
    return () => {
      window.removeEventListener('echosnare:campaign-select', onSelect)
      window.removeEventListener('shadowtrace:campaign-select', onSelect)
    }
  }, [])

  function switchTo(idx: number) {
    if (idx === selected && !showLive) return
    setShowLive(false)
    if (idx === selected) return
    timers.current.forEach(clearTimeout)

    setSelected(idx) // button highlights immediately
    setOpacity(0) // graph fades out
    setGraphReady(false) // re-show skeleton during campaign switch

    const t1 = setTimeout(() => setVisible(idx), 300) // swap data mid-fade
    const t2 = setTimeout(() => setOpacity(1), 400) // fade back in
    timers.current = [t1, t2]
  }

  const campaign = campaigns[visible] || campaigns[0]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* ── Campaign selector bar ──────────────────────────────────────────── */}
      <div
        style={{
          ...FONT,
          display:        'flex',
          alignItems:     'center',
          height:         '36px',
          flexShrink:     0,
          padding:        '0 16px',
          borderBottom:   '1px solid #162032',
          background:     '#05070c',
          gap:            '6px',
        }}
      >
        <span style={{ fontSize: '10px', color: '#94A3B8', letterSpacing: '0.1em', marginRight: '10px' }}>
          CAMPAIGN
        </span>

        {campaigns.map((c, i) => {
          const isLivePrompt = c.id === 'active-prompt-graph'
          const isActive = selected === i
          return (
            <button
              key={c.id}
              onClick={() => switchTo(i)}
              style={{
                ...FONT,
                fontSize: '11px',
                padding: '3px 12px',
                border: isActive ? '1px solid #00D4AA' : isLivePrompt ? '1px solid #00D4AA' : '1px solid #162032',
                cursor: 'pointer',
                backgroundColor: isActive ? '#00D4AA' : isLivePrompt ? '#04221d' : '#04060a',
                color: isActive ? '#000000' : isLivePrompt ? '#00D4AA' : '#94A3B8',
                fontWeight: isActive || isLivePrompt ? 700 : 400,
                letterSpacing: '0.04em',
              }}
            >
              {c.name}
            </button>
          )
        })}

        {/* LIVE FEED tab — green pulsing dot, green left border */}
        <button
          onClick={() => setShowLive(true)}
          style={{
            ...FONT,
            display:         'inline-flex',
            alignItems:      'center',
            gap:             '6px',
            fontSize:        '11px',
            padding:         '3px 12px',
            border:          '1px solid #162032',
            borderLeft:      '2px solid #22C55E',
            cursor:          'pointer',
            backgroundColor: showLive ? '#22C55E' : '#04060a',
            color:           showLive ? '#000000' : '#94A3B8',
            fontWeight:      showLive ? 700 : 400,
            letterSpacing:   '0.04em',
          }}
        >
          <span
            className="st-pulse-dot"
            style={{
              display:         'inline-block',
              width:           '5px',
              height:          '5px',
              borderRadius:    '50%',
              backgroundColor: showLive ? '#000000' : '#22C55E',
              flexShrink:      0,
            }}
          />
          LIVE FEED
        </button>

        {/* Right side: threat level + node count */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '16px' }}>
          {showLive ? (
            <span style={{ fontSize: '10px', color: '#22C55E', letterSpacing: '0.06em', fontWeight: 600 }}>
              REAL-TIME · FACT-CHECKER RSS
            </span>
          ) : (
            <>
              <span style={{ fontSize: '10px', color: THREAT_COLOR[campaign.threat_level], fontWeight: 700 }}>
                {campaign.threat_level}
              </span>
              <span style={{ fontSize: '10px', color: '#94A3B8', letterSpacing: '0.06em' }}>
                {`${campaign.nodes.length} NODES · ${campaign.edges.length} EDGES`}
              </span>
            </>
          )}
        </div>
      </div>

      {/* ── Live feed view (replaces graph when LIVE FEED tab active) ──────── */}
      {showLive && (
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <LiveFeedPanel />
        </div>
      )}

      {/* ── Graph area ────────────────────────────────────────────────────── */}
      {!showLive && (
      <div
        style={{
          flex:       1,
          opacity,
          transition: 'opacity 0.3s ease',
          overflow:   'hidden',
          position:   'relative',
          backgroundColor: '#000000',
        }}
      >
        {/* Skeleton — shown until D3 entrance animation completes */}
        {!graphReady && (
          <div
            style={{
              position:        'absolute',
              inset:           0,
              backgroundColor: '#000000',
              display:         'flex',
              alignItems:      'center',
              justifyContent:  'center',
              zIndex:          10,
            }}
          >
            <svg width="70%" height="70%" viewBox="0 0 400 260">
              {/* Skeleton edges */}
              {[[200,130,80,60],[200,130,200,130],[200,130,320,60],[200,130,100,200],[200,130,300,200]].map(([x1,y1,x2,y2],i) => (
                <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
                  stroke="#162032" strokeWidth="1.5" className="st-skeleton" style={{ animationDelay: `${i*0.15}s` }} />
              ))}
              {/* Skeleton nodes */}
              {[[200,130,18],[80,60,12],[200,60,12],[320,60,12],[100,200,8],[300,200,8],[140,90,6],[260,90,6],[150,170,6],[250,170,6]].map(([cx,cy,r],i) => (
                <circle key={i} cx={cx} cy={cy} r={r}
                  className="st-skeleton" fill="#162032" style={{ animationDelay: `${i*0.1}s` }} />
              ))}
            </svg>
          </div>
        )}

        <NetworkGraph
          nodes={campaign.nodes}
          edges={campaign.edges}
          campaignName={campaign.name}
          onReady={() => setGraphReady(true)}
        />
      </div>
      )}

    </div>
  )
}
