export type ThreatLevel = 'HIGH' | 'MED' | 'LOW'
export type NodeType = 'origin' | 'bot' | 'amplifier' | 'legitimate'

export interface GraphNode {
  id: string
  type: NodeType
  label: string
  accountId?: string
  posts?: number
  followers?: number
  clusterId?: number
  x?: number
  y?: number
  vx?: number
  vy?: number
  fx?: number | null
  fy?: number | null
}

export interface GraphEdge {
  source: string | GraphNode
  target: string | GraphNode
  weight: number
}

export interface Campaign {
  id: string
  name: string
  threat_level: ThreatLevel
  account_count: number
  start_time: string
  narrative: string
  confidence: number
  nodes: GraphNode[]
  edges: GraphEdge[]
}

export interface Alert {
  id: string
  campaign_id: string
  severity: ThreatLevel
  message: string
  timestamp: string
  recommendation: string
}

export interface AnalysisResult {
  is_misinformation: boolean
  confidence: number
  threat_level: ThreatLevel
  narrative_category: string
  summary: string
  indicators: string[]
}
