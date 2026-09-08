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

export interface EvidenceItem {
  id: string
  source_type: string
  source_name: string
  source_url: string
  retrieved_at: string
  published_at?: string | null
  author?: string | null
  title: string
  text: string
  confidence: number
  evidence_type: string
}

export interface SourceStatus {
  source_type: string
  source_name: string
  status: 'completed' | 'limited' | 'unavailable' | 'failed'
  count: number
  duration_ms: number
  warning_or_error?: string | null
}

export interface InvestigationStage {
  stage_id: string
  stage_name: string
  status: string
  duration_ms: number
  source_count: number
  evidence_count: number
  detail: string
}

export interface KeyFinding {
  title: string
  explanation: string
  source: string
  confidence: number
}

export interface InvestigationResult {
  query: string
  query_mode: string
  timestamp: string
  stages: InvestigationStage[]
  source_statuses: SourceStatus[]
  evidence: EvidenceItem[]
  threat_score: number
  risk_level: ThreatLevel
  confidence: number
  narrative_category: string
  key_findings: KeyFinding[]
  graph: {
    nodes: GraphNode[]
    edges: GraphEdge[]
  }
  synthesis_dossier: string
}

