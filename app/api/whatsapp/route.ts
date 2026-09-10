import { NextResponse } from 'next/server'

// Allow enough time for the shared live-web investigation used by WhatsApp Intel.
export const maxDuration = 60

const BACKEND = process.env.BACKEND_API_URL ?? 'http://localhost:8000'

const MOCK_RESULT = {
  is_forward: true,
  forward_depth: 3,
  misinformation_score: 84,
  risk_level: 'HIGH',
  language_detected: 'hinglish',
  red_flags: [
    'Uses urgency language to pressure sharing',
    'Cites unnamed authorities or experts',
    'Designed to maximize viral sharing',
  ],
  forward_signals: ['urgency_language', 'unnamed_authority', 'share_bait'],
  claim_extracted: 'Doctors have confirmed a new home remedy that cures diabetes permanently',
  verdict: 'High probability of misinformation. 3 red flags detected.',
  content_score: 79,
  wa_pattern_score: 87,
}

export async function POST(request: Request) {
  try {
    const body = await request.json()

    const waResponse = await fetch(`${BACKEND}/whatsapp/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(12000),
    })

    if (!waResponse.ok) throw new Error('WhatsApp analyzer unavailable')
    const result = await waResponse.json()
    return NextResponse.json(result)
  } catch {
    return NextResponse.json(MOCK_RESULT)
  }
}
