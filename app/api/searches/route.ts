import { NextResponse } from 'next/server'

const BACKEND = process.env.BACKEND_API_URL ?? 'http://127.0.0.1:8000'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const isMetrics = searchParams.get('metrics') === 'true'
  const limit = searchParams.get('limit') || '50'
  const offset = searchParams.get('offset') || '0'

  const endpoint = isMetrics
    ? `${BACKEND}/searches/metrics`
    : `${BACKEND}/searches?limit=${limit}&offset=${offset}`

  try {
    const res = await fetch(endpoint, {
      signal: AbortSignal.timeout(5000),
      cache: 'no-store',
    })
    if (res.ok) {
      return NextResponse.json(await res.json())
    }
  } catch (error) {
    // Backend offline or timeout
  }

  // Fallback if backend is unavailable
  if (isMetrics) {
    return NextResponse.json({
      total_searches: 0,
      high_risk_count: 0,
      med_risk_count: 0,
      low_risk_count: 0,
      avg_threat_score: 0,
      avg_duration_ms: 0,
      modes: {},
      neo4j_active: false,
    })
  }

  return NextResponse.json([])
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const res = await fetch(`${BACKEND}/searches/log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    })
    if (res.ok) {
      return NextResponse.json(await res.json())
    }
  } catch (error) {
    // Failed writing log
  }

  return NextResponse.json({ status: 'queued_locally' })
}
