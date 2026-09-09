import { NextResponse } from 'next/server'

export const maxDuration = 60

const BACKEND = process.env.BACKEND_API_URL ?? 'http://localhost:8000'

function normalizeInvestigation(data: any, query: string) {
  const stages = Array.isArray(data?.stages) ? data.stages : []
  const stageById = new Map(stages.map((stage: any) => [stage.stage_id, stage]))
  const stageOr = (id: string) => stageById.get(id) ?? {}

  const steps = [
    { agent: 'WhatsAppAnalyzer', duration_ms: Number(stageOr('EXTRACTING_ENTITIES').duration_ms ?? 0), summary: String(stageOr('EXTRACTING_ENTITIES').detail ?? 'Processed supplied message and extracted claims.') },
    { agent: 'ContentAnalyzer', duration_ms: Number(stageOr('ANALYZING_COORDINATION').duration_ms ?? 0), summary: String(stageOr('ANALYZING_COORDINATION').detail ?? 'Computed content risk across retrieved evidence.') },
    { agent: 'SarvamLanguageDetector', duration_ms: Number(stageOr('DISCOVERING').duration_ms ?? 0), summary: String(stageOr('DISCOVERING').detail ?? 'Parsed query and investigation mode.') },
    { agent: 'FactCheckCrossRef', duration_ms: Number(stageOr('RETRIEVING_SOURCES').duration_ms ?? 0), summary: String(stageOr('RETRIEVING_SOURCES').detail ?? 'Retrieved and cross-referenced available evidence.') },
    { agent: 'ThreatClassifier', duration_ms: Number(stageOr('SCORING_THREAT').duration_ms ?? 0), summary: String(stageOr('SCORING_THREAT').detail ?? 'Classified investigation threat level.') },
  ]

  const evidence = Array.isArray(data?.evidence) ? data.evidence : []
  const fact_check_matches = evidence
    .filter((item: any) => item?.source_type === 'fact_checker')
    .map((item: any) => ({
      title: String(item?.title ?? 'Fact-check match'),
      source: String(item?.source_name ?? 'Fact-checker'),
      url: String(item?.source_url ?? ''),
      matched_terms: Array.isArray(item?.matched_terms) ? item.matched_terms.map(String) : [],
    }))

  const finding = Array.isArray(data?.key_findings) ? data.key_findings[0] : null
  const riskLevel = String(data?.risk_level ?? 'MED').toUpperCase()

  return {
    ...data,
    query: String(data?.query ?? query),
    steps,
    fact_check_matches,
    threat_alert: {
      threat_type: String(data?.narrative_category ?? 'Investigation Threat Assessment'),
      severity: riskLevel,
      explanation: String(finding?.explanation ?? data?.synthesis_dossier ?? `Investigation classified at ${riskLevel} severity with a threat score of ${data?.threat_score ?? 'N/A'}/100.`),
    },
  }
}

export async function POST(request: Request) {
  const body = await request.json()
  const query = String(body.query || body.text || '').trim()

  try {
    const response = await fetch(`${BACKEND}/investigate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(55000),
    })

    if (response.ok) {
      const data = await response.json()
      return NextResponse.json(normalizeInvestigation(data, query))
    }
  } catch {
    // Backend offline — explicit limited fallback below.
  }

  const now = new Date().toISOString()
  const isTopic = query.length < 100
  const fallback = {
    query: query || 'Unspecified Query',
    query_mode: isTopic ? 'topic' : 'text',
    timestamp: now,
    stages: [
      { stage_id: 'DISCOVERING', duration_ms: 12, detail: 'Parsed user query' },
      { stage_id: 'RETRIEVING_SOURCES', duration_ms: 450, detail: 'Backend service offline — external source retrieval unavailable.' },
      { stage_id: 'EXTRACTING_ENTITIES', duration_ms: 80, detail: 'Extracted query parameters from supplied input.' },
      { stage_id: 'ANALYZING_COORDINATION', duration_ms: 110, detail: 'Limited to supplied-text heuristics.' },
      { stage_id: 'SCORING_THREAT', duration_ms: 60, detail: 'Limited threat assessment because the backend service is offline.' },
    ],
    source_statuses: [
      { source_type: 'web_news', source_name: 'Google News Search', status: 'unavailable', count: 0 },
      { source_type: 'fact_checker', source_name: 'Indian Fact-Checker Network', status: 'unavailable', count: 0 },
      { source_type: 'bluesky', source_name: 'Bluesky Public Network', status: 'unavailable', count: 0 },
    ],
    evidence: [{
      id: 'fallback_01', source_type: 'user_text', source_name: 'Analyst Direct Input', source_url: 'user://input',
      retrieved_at: now, published_at: now, author: 'Analyst', title: `Query: ${query.slice(0, 50)}`,
      text: query, confidence: 0.85, evidence_type: 'user_text',
    }],
    threat_score: 55,
    risk_level: 'MED',
    confidence: 0.70,
    narrative_category: 'Limited / Unverified',
    key_findings: [{
      title: 'Backend API Service Offline',
      explanation: 'Primary Python FastAPI service was unreachable. Live multi-source retrieval, graph construction, and full threat analysis are unavailable until the backend is started on port 8000.',
      source: 'System Status Warning', confidence: 0.50,
    }],
    graph: { nodes: [{ id: 'query_root', type: 'origin', label: 'QUERY ROOT', accountId: query.slice(0, 15), posts: 1, followers: 0, clusterId: 0 }], edges: [] },
    synthesis_dossier: `INVESTIGATION DOSSIER FOR QUERY: '${query}'\n\nFastAPI backend service is currently offline. Analysis is limited to direct-input heuristics. Start the Python backend (uvicorn main:app) for live multi-source retrieval and graph analysis.`,
  }

  return NextResponse.json(normalizeInvestigation(fallback, query))
}
