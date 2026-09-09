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

export interface SourceAssessment {
  label: string
  role: string
  explanation: string
}

export interface ClaimAssessment {
  status: 'SUPPORTED' | 'PARTIALLY_SUPPORTED' | 'CONTRADICTED' | 'UNVERIFIED'
  label: string
  explanation: string
  confidence: number
  corroborating_sources: number
  contradictory_sources: number
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
  source_assessment?: SourceAssessment
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
  evidence_confidence?: number
  score_basis?: string
  claim_assessment?: ClaimAssessment
  narrative_category: string
  key_findings: KeyFinding[]
  graph: {
    nodes: GraphNode[]
    edges: GraphEdge[]
  }
  synthesis_dossier: string
  accounts_detected?: string[]
  steps?: Array<{ agent: string; duration_ms: number; summary: string }>
  threat_alert?: { threat_type: string; severity: string; explanation: string; confidence_score?: number; campaign_detected?: boolean }
  fact_check_matches?: Array<{ title: string; source: string; url: string; matched_terms: string[] }>
}

