'use client'

import { useState, useRef, useEffect } from 'react'
import type { DeepfakeResult, DeepfakeVerdict } from '@/app/api/deepfake/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const FONT: React.CSSProperties = {
  fontFamily: 'var(--font-jetbrains-mono, "Fira Code", monospace)',
}
const BORDER = '1px solid #162032'

const QUICK_TESTS = [
  {
    label: 'Test: Authentic Photo',
    url:   'https://upload.wikimedia.org/wikipedia/commons/2/24/Screenshot_of_the_N%27Ko_Wikipedia_main_page.jpg',
  },
  {
    label: 'Test: AI-Generated',
    url:   'https://upload.wikimedia.org/wikipedia/commons/b/bb/Stable_Diffusion_-_In_the_street_-_8.jpg',
  },
  {
    label: 'Test: Edited Composite',
    url:   'https://upload.wikimedia.org/wikipedia/commons/4/47/PNG_transparency_demonstration_1.png',
  },
]

const VERDICT_META: Record<DeepfakeVerdict, { label: string; color: string }> = {
  LIKELY_MANIPULATED:   { label: 'LIKELY MANIPULATED',   color: '#EF4444' },
  POSSIBLY_MANIPULATED: { label: 'POSSIBLY MANIPULATED', color: '#F59E0B' },
  LIKELY_AUTHENTIC:     { label: 'LIKELY AUTHENTIC',     color: '#22C55E' },
  ANALYSIS_FAILED:      { label: 'ANALYSIS FAILED',      color: '#64748B' },
}

const HIGH_SEVERITY_HINTS = ['High ELA', 'Edited with', 'likely AI-generated']

function scoreColor(score: number): string {
  if (score < 40) return '#22C55E'
  if (score <= 70) return '#F59E0B'
  return '#EF4444'
}

function signalSeverityColor(signal: string): string {
  return HIGH_SEVERITY_HINTS.some(hint => signal.includes(hint)) ? '#EF4444' : '#F59E0B'
}

// ─── Score arc (matches the dashboard threat-score gauges) ────────────────────

function ScoreArc({ score }: { score: number }) {
  const R = 44
  const C = 2 * Math.PI * R
  const filled = (score / 100) * C
  const color = scoreColor(score)

  return (
    <div style={{ position: 'relative', width: '120px', height: '120px' }}>
      <svg width="120" height="120" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={R} fill="none" stroke="#162032" strokeWidth="8" />
        <circle
          cx="60"
          cy="60"
          r={R}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeDasharray={`${filled} ${C - filled}`}
          strokeDashoffset={C / 4}
          strokeLinecap="butt"
        />
      </svg>
      <div
        style={{
          position:       'absolute',
          inset:          0,
          display:        'flex',
          flexDirection:  'column',
          alignItems:     'center',
          justifyContent: 'center',
        }}
      >
        <span style={{ ...FONT, fontSize: '28px', fontWeight: 700, color }}>{score}</span>
        <span style={{ ...FONT, fontSize: '8px', letterSpacing: '0.14em', color: '#4A5568' }}>
          MANIPULATION
        </span>
      </div>
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

// ─── Component ────────────────────────────────────────────────────────────────

export default function DeepfakeAnalyzer() {
  const [inputMode,   setInputMode]   = useState<'upload' | 'url'>('upload')
  const [url,         setUrl]         = useState('')
  const [fileBase64,  setFileBase64]  = useState<string | null>(null)
  const [fileMeta,    setFileMeta]    = useState<{ name: string; size: string } | null>(null)
  const [analyzing,   setAnalyzing]   = useState(false)
  const [result,      setResult]      = useState<DeepfakeResult | null>(null)
  const [error,       setError]       = useState<string | null>(null)
  const [dragOver,    setDragOver]    = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Global clipboard paste listener (press Ctrl+V anywhere with an image)
  useEffect(() => {
    function handlePaste(e: ClipboardEvent) {
      const items = e.clipboardData?.items
      if (!items) return
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile()
          if (file) {
            handleFileSelect(file)
            setInputMode('upload')
            break
          }
        }
      }
    }
    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [])

  function handleFileSelect(file: File) {
    if (!file.type.startsWith('image/')) {
      setError('Please upload a valid image file (JPG, PNG, WEBP).')
      return
    }
    setError(null)
    const reader = new FileReader()
    reader.onload = () => {
      const b64 = reader.result as string
      setFileBase64(b64)
      const sizeKb = Math.round(file.size / 1024)
      setFileMeta({
        name: file.name,
        size: sizeKb > 1024 ? `${(sizeKb / 1024).toFixed(1)} MB` : `${sizeKb} KB`,
      })
    }
    reader.readAsDataURL(file)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const files = e.dataTransfer.files
    if (files && files[0]) {
      handleFileSelect(files[0])
    }
  }

  function clearImage() {
    setFileBase64(null)
    setFileMeta(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function runAnalysis(targetUrl?: string) {
    const imageUrl = (targetUrl ?? url).trim()
    const isUsingUpload = inputMode === 'upload' && fileBase64
    const isUsingUrl = inputMode === 'url' && imageUrl

    if ((!isUsingUpload && !isUsingUrl) || analyzing) return
    setAnalyzing(true)
    setError(null)
    setResult(null)

    try {
      const payload: { image_url?: string; image_base64?: string } = {}
      if (isUsingUpload && fileBase64) {
        payload.image_base64 = fileBase64
      } else {
        payload.image_url = imageUrl
      }

      const res = await fetch('/api/deepfake', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      })
      if (!res.ok) throw new Error('request failed')
      const data = (await res.json()) as DeepfakeResult
      setResult(data)
      if (data.verdict === 'ANALYSIS_FAILED') {
        setError(data.analysis_summary || 'Analysis failed for this image.')
      }
    } catch {
      setError('Analysis failed. Check backend service and API configuration.')
    } finally {
      setAnalyzing(false)
    }
  }

  const verdictMeta = result ? VERDICT_META[result.verdict] : null
  const showResults = result !== null && result.verdict !== 'ANALYSIS_FAILED'

  const canAnalyze = inputMode === 'upload' ? !!fileBase64 : !!url.trim()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <style>{'@keyframes df-spin { to { transform: rotate(360deg); } }'}</style>

      {/* ── Input panel ─────────────────────────────────────────────────────── */}
      <div style={{ border: BORDER, backgroundColor: '#07090e', padding: '20px' }}>
        <div
          style={{
            display:        'flex',
            justifyContent: 'space-between',
            alignItems:     'baseline',
            flexWrap:       'wrap',
            gap:            '8px',
            marginBottom:   '4px',
          }}
        >
          <span
            style={{
              ...FONT,
              fontSize:      '13px',
              fontWeight:    700,
              letterSpacing: '0.18em',
              color:         '#00D4AA',
            }}
          >
            DEEPFAKE &amp; IMAGE MANIPULATION DETECTOR
          </span>
          <span style={{ ...FONT, fontSize: '10px', color: '#94A3B8' }}>
            Multimodal Gemini Vision + ELA Forensics + EXIF
          </span>
        </div>
        <div style={{ ...FONT, fontSize: '11px', color: '#94A3B8', marginBottom: '16px' }}>
          Upload your own image file or analyze any public image URL with Google Gemini Vision &amp; Error Level Analysis
        </div>

        {/* Mode Switcher Tabs */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          <button
            onClick={() => setInputMode('upload')}
            style={{
              ...FONT,
              fontSize:        '11px',
              fontWeight:      700,
              letterSpacing:   '0.08em',
              padding:         '6px 14px',
              backgroundColor: inputMode === 'upload' ? '#00D4AA' : '#04060a',
              color:           inputMode === 'upload' ? '#000000' : '#94A3B8',
              border:          inputMode === 'upload' ? '1px solid #00D4AA' : BORDER,
              cursor:          'pointer',
              display:         'flex',
              alignItems:      'center',
              gap:             '6px',
            }}
          >
            <span>📁</span> UPLOAD LOCAL IMAGE
          </button>
          <button
            onClick={() => setInputMode('url')}
            style={{
              ...FONT,
              fontSize:        '11px',
              fontWeight:      700,
              letterSpacing:   '0.08em',
              padding:         '6px 14px',
              backgroundColor: inputMode === 'url' ? '#00D4AA' : '#04060a',
              color:           inputMode === 'url' ? '#000000' : '#94A3B8',
              border:          inputMode === 'url' ? '1px solid #00D4AA' : BORDER,
              cursor:          'pointer',
              display:         'flex',
              alignItems:      'center',
              gap:             '6px',
            }}
          >
            <span>🔗</span> IMAGE URL / SAMPLES
          </button>
        </div>

        {/* Mode 1: Local Upload / Drag & Drop */}
        {inputMode === 'upload' ? (
          <div style={{ marginBottom: '16px' }}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/jpg"
              style={{ display: 'none' }}
              onChange={e => {
                if (e.target.files && e.target.files[0]) {
                  handleFileSelect(e.target.files[0])
                }
              }}
            />

            {!fileBase64 ? (
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  ...FONT,
                  border:          dragOver ? '2px dashed #00D4AA' : '1px dashed #2A3B53',
                  backgroundColor: dragOver ? 'rgba(0, 212, 170, 0.05)' : '#04060a',
                  padding:         '36px 20px',
                  textAlign:       'center',
                  cursor:          'pointer',
                  transition:      'all 0.2s ease',
                  display:         'flex',
                  flexDirection:   'column',
                  alignItems:      'center',
                  gap:             '8px',
                }}
              >
                <div style={{ fontSize: '26px' }}>📤</div>
                <div style={{ fontSize: '13px', fontWeight: 650, color: '#F4F7FB' }}>
                  Click to select or drag &amp; drop your image here
                </div>
                <div style={{ fontSize: '11px', color: '#64748B' }}>
                  Supports PNG, JPG, JPEG, WEBP • Or press Ctrl+V to paste from clipboard
                </div>
              </div>
            ) : (
              <div
                style={{
                  display:         'flex',
                  alignItems:      'center',
                  justifyContent:  'space-between',
                  padding:         '12px 16px',
                  backgroundColor: '#04060a',
                  border:          '1px solid rgba(0, 212, 170, 0.3)',
                  gap:             '14px',
                  flexWrap:        'wrap',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={fileBase64}
                    alt="Preview"
                    style={{ width: '48px', height: '48px', objectFit: 'cover', border: BORDER, borderRadius: '2px' }}
                  />
                  <div>
                    <div style={{ ...FONT, fontSize: '12px', fontWeight: 700, color: '#E2E8F0' }}>
                      {fileMeta?.name || 'Uploaded Image'}
                    </div>
                    <div style={{ ...FONT, fontSize: '10px', color: '#00D4AA', marginTop: '2px' }}>
                      Ready for forensic analysis • {fileMeta?.size}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      ...FONT,
                      fontSize:        '10px',
                      color:           '#94A3B8',
                      background:      '#0e1626',
                      border:          BORDER,
                      padding:         '6px 12px',
                      cursor:          'pointer',
                    }}
                  >
                    Change Image
                  </button>
                  <button
                    onClick={clearImage}
                    style={{
                      ...FONT,
                      fontSize:        '10px',
                      color:           '#EF4444',
                      background:      'transparent',
                      border:          '1px solid #EF4444',
                      padding:         '6px 12px',
                      cursor:          'pointer',
                    }}
                  >
                    Remove
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Mode 2: URL Input + Quick Tests */
          <>
            <input
              value={url}
              onChange={e => setUrl(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') runAnalysis() }}
              placeholder="Paste image URL to analyze (jpg, png, webp)..."
              style={{
                ...FONT,
                width:           '100%',
                boxSizing:       'border-box',
                fontSize:        '12px',
                color:           '#E2E8F0',
                backgroundColor: '#04060a',
                border:          BORDER,
                outline:         'none',
                padding:         '10px 12px',
                marginBottom:    '12px',
              }}
            />

            {/* Quick-test buttons */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
              {QUICK_TESTS.map(test => (
                <button
                  key={test.label}
                  onClick={() => { setUrl(test.url); runAnalysis(test.url) }}
                  disabled={analyzing}
                  style={{
                    ...FONT,
                    fontSize:        '10px',
                    letterSpacing:   '0.06em',
                    color:           '#94A3B8',
                    backgroundColor: '#04060a',
                    border:          BORDER,
                    padding:         '6px 12px',
                    cursor:          analyzing ? 'not-allowed' : 'pointer',
                  }}
                >
                  {test.label}
                </button>
              ))}
            </div>
          </>
        )}

        <button
          onClick={() => runAnalysis()}
          disabled={!canAnalyze || analyzing}
          style={{
            ...FONT,
            display:         'flex',
            alignItems:      'center',
            justifyContent:  'center',
            gap:             '8px',
            width:           '100%',
            fontSize:        '12px',
            fontWeight:      700,
            letterSpacing:   '0.12em',
            color:           canAnalyze && !analyzing ? '#000000' : '#64748B',
            backgroundColor: canAnalyze && !analyzing ? '#00D4AA' : '#121a28',
            border:          'none',
            padding:         '12px',
            cursor:          canAnalyze && !analyzing ? 'pointer' : 'not-allowed',
            boxShadow:       canAnalyze && !analyzing ? '0 0 15px rgba(0, 212, 170, 0.3)' : 'none',
          }}
        >
          {analyzing ? (
            <>
              RUNNING GEMINI VISION &amp; ELA FORENSICS...
              <span
                style={{
                  display:        'inline-block',
                  width:          '12px',
                  height:         '12px',
                  border:         '2px solid #000000',
                  borderTopColor: 'transparent',
                  borderRadius:   '50%',
                  animation:      'df-spin 0.7s linear infinite',
                }}
              />
            </>
          ) : (
            'RUN FORENSIC ANALYSIS →'
          )}
        </button>

        {error && (
          <div style={{ ...FONT, fontSize: '11px', color: '#EF4444', marginTop: '10px' }}>
            {error}
          </div>
        )}
      </div>

      {/* ── Results ─────────────────────────────────────────────────────────── */}
      {showResults && result && verdictMeta && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Gemini Multimodal Vision Intelligence Dossier Card */}
          {result.gemini_forensics && (
            <div
              style={{
                border:          '1px solid #00D4AA',
                backgroundColor: 'rgba(0, 212, 170, 0.04)',
                padding:         '18px 20px',
                borderRadius:    '2px',
                boxShadow:       '0 0 20px rgba(0, 212, 170, 0.08)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '12px' }}>
                <div style={{ ...FONT, fontSize: '11px', fontWeight: 700, letterSpacing: '0.14em', color: '#00D4AA', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#00D4AA', boxShadow: '0 0 8px #00D4AA' }} />
                  GOOGLE GEMINI MULTIMODAL FORENSIC INTELLIGENCE
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    style={{
                      ...FONT,
                      fontSize:        '10px',
                      fontWeight:      700,
                      padding:         '3px 8px',
                      borderRadius:    '2px',
                      backgroundColor: result.gemini_forensics.is_ai_generated ? '#EF4444' : '#22C55E',
                      color:           '#000000',
                      letterSpacing:   '0.08em',
                    }}
                  >
                    {result.gemini_forensics.category?.replace(/_/g, ' ') || (result.gemini_forensics.is_ai_generated ? 'AI GENERATED' : 'AUTHENTIC PHOTO')}
                  </span>
                  <span style={{ ...FONT, fontSize: '10px', color: '#94A3B8' }}>
                    {result.gemini_forensics.model_used || 'Google Gemini Vision'}
                  </span>
                </div>
              </div>

              {/* Detected Artifacts Tags */}
              {result.gemini_forensics.detected_artifacts && result.gemini_forensics.detected_artifacts.length > 0 && (
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ ...FONT, fontSize: '10px', color: '#94A3B8', letterSpacing: '0.1em', marginBottom: '6px' }}>
                    VISUAL ANOMALIES &amp; ARTIFACTS IDENTIFIED:
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {result.gemini_forensics.detected_artifacts.map((artifact, i) => (
                      <span
                        key={i}
                        style={{
                          ...FONT,
                          fontSize:        '10px',
                          color:           '#F4F7FB',
                          backgroundColor: '#07090e',
                          border:          '1px solid #1e293b',
                          padding:         '4px 8px',
                          borderRadius:    '2px',
                        }}
                      >
                        ⚠️ {artifact}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Forensic Summary */}
              <div style={{ ...FONT, fontSize: '12px', color: '#E2E8F0', lineHeight: 1.65 }}>
                {result.gemini_forensics.forensic_summary || result.analysis_summary}
              </div>
            </div>
          )}

          {/* Grid with Visual Inspection + Signals */}
          <div className="df-results" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <style>{`
              @media (max-width: 900px) {
                .df-results { grid-template-columns: 1fr !important; }
              }
            `}</style>

            {/* Left — Visual Comparison (Source Image & ELA Heatmap) */}
            <div style={{ border: BORDER, backgroundColor: '#07090e', padding: '20px' }}>
              <div
                style={{
                  ...FONT,
                  fontSize:      '11px',
                  letterSpacing: '0.18em',
                  color:         '#94A3B8',
                  marginBottom:  '12px',
                }}
              >
                IMAGE &amp; ELA COMPARISON
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: (fileBase64 || url) ? '1fr 1fr' : '1fr', gap: '12px', marginBottom: '12px' }}>
                {(fileBase64 || url) && (
                  <div>
                    <div style={{ ...FONT, fontSize: '10px', letterSpacing: '0.1em', color: '#64748B', marginBottom: '6px' }}>
                      SOURCE INPUT
                    </div>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={fileBase64 || url}
                      alt="Source input"
                      style={{ width: '100%', height: '220px', objectFit: 'contain', border: BORDER, backgroundColor: '#04060a' }}
                    />
                  </div>
                )}
                <div>
                  <div style={{ ...FONT, fontSize: '10px', letterSpacing: '0.1em', color: '#64748B', marginBottom: '6px' }}>
                    ELA HEATMAP
                  </div>
                  {result.ela_image_base64 ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`data:image/png;base64,${result.ela_image_base64}`}
                      alt="Error Level Analysis heatmap"
                      style={{ width: '100%', height: '220px', objectFit: 'contain', border: BORDER, backgroundColor: '#04060a' }}
                    />
                  ) : (
                    <div
                      style={{
                        ...FONT,
                        display:         'flex',
                        alignItems:      'center',
                        justifyContent:  'center',
                        height:          '220px',
                        border:          BORDER,
                        backgroundColor: '#04060a',
                        fontSize:        '11px',
                        color:           '#94A3B8',
                      }}
                    >
                      ELA visualization unavailable
                    </div>
                  )}
                </div>
              </div>

              <div style={{ ...FONT, fontSize: '10px', color: '#94A3B8', marginTop: '10px', lineHeight: 1.6 }}>
                Bright areas indicate potential editing. Uniform compression = authentic. High variance = manipulated.
              </div>
            </div>

            {/* Right — score, verdict, signals */}
            <div style={{ border: BORDER, backgroundColor: '#07090e', padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '16px', flexWrap: 'wrap' }}>
                <ScoreArc score={result.manipulation_score} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <span
                    style={{
                      ...FONT,
                      fontSize:        '11px',
                      fontWeight:      700,
                      letterSpacing:   '0.12em',
                      color:           '#000000',
                      backgroundColor: verdictMeta.color,
                      padding:         '4px 10px',
                      alignSelf:       'flex-start',
                    }}
                  >
                    {verdictMeta.label}
                  </span>
                  <span style={{ ...FONT, fontSize: '11px', color: '#CBD5E1' }}>
                    CONFIDENCE: {Math.round(result.confidence * 100)}%
                  </span>
                  {result.source === 'mock' && (
                    <span style={{ ...FONT, fontSize: '9px', color: '#F59E0B' }}>
                      MOCK DATA — BACKEND UNREACHABLE
                    </span>
                  )}
                </div>
              </div>

              {result.signals.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <div
                    style={{
                      ...FONT,
                      fontSize:      '11px',
                      letterSpacing: '0.18em',
                      color:         '#94A3B8',
                      marginBottom:  '8px',
                    }}
                  >
                    FORENSIC SIGNALS
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {result.signals.map(signal => (
                      <div
                        key={signal}
                        style={{
                          ...FONT,
                          fontSize:        '11px',
                          color:           '#E2E8F0',
                          backgroundColor: '#04060a',
                          border:          BORDER,
                          borderLeft:      `2px solid ${signalSeverityColor(signal)}`,
                          padding:         '8px 10px',
                          lineHeight:      1.5,
                        }}
                      >
                        {signal}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {result.metadata_flags.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <div
                    style={{
                      ...FONT,
                      fontSize:      '11px',
                      letterSpacing: '0.18em',
                      color:         '#94A3B8',
                      marginBottom:  '8px',
                    }}
                  >
                    METADATA FLAGS
                  </div>
                  {result.metadata_flags.map(flag => (
                    <div key={flag} style={{ ...FONT, fontSize: '11px', color: '#CBD5E1', padding: '2px 0' }}>
                      • {flag}
                    </div>
                  ))}
                </div>
              )}

              <div style={{ ...FONT, fontSize: '11px', color: '#CBD5E1', lineHeight: 1.7 }}>
                {result.analysis_summary}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
