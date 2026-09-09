'use client'

import React, { useState, useEffect, useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import Corners from './Corners'

const PIPELINE_STEPS = [
  {
    agent: 'WhatsAppAnalyzer',
    out: 'Forward chain detected · 4 red flags',
    color: '#22C55E',
    time: '+120ms',
  },
  {
    agent: 'ContentAnalyzer',
    out: 'Groq LLM misinformation score: 86/100',
    color: '#00D4AA',
    time: '+380ms',
  },
  {
    agent: 'SarvamLanguageDetector',
    out: 'Language: Hinglish · 100% confidence',
    color: '#FB923C',
    time: '+540ms',
  },
  {
    agent: 'FactCheckCrossRef',
    out: 'Cross-referenced live fact-checker feeds',
    color: '#3B82F6',
    time: '+810ms',
  },
  {
    agent: 'ThreatClassifier',
    out: 'health_misinformation · severity HIGH',
    color: '#EF4444',
    time: '+1140ms',
  },
]

export default function InvestigationDemo() {
  const containerRef = useRef<HTMLDivElement>(null)
  const isInView = useInView(containerRef, { once: true, amount: 0.35 })

  const [activeStep, setActiveStep] = useState(-1)
  const [isPlaying, setIsPlaying] = useState(false)

  const runSimulation = () => {
    setActiveStep(0)
    setIsPlaying(true)
    let step = 0
    const interval = setInterval(() => {
      step++
      if (step <= PIPELINE_STEPS.length) {
        setActiveStep(step)
      } else {
        clearInterval(interval)
        setIsPlaying(false)
      }
    }, 460)
  }

  useEffect(() => {
    if (isInView && activeStep === -1) {
      runSimulation()
    }
  }, [isInView])

  return (
    <section id="pipeline" className="max-w-7xl mx-auto px-6 md:px-10 py-28 relative">
      {/* Section Heading */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="mb-14"
      >
        <div
          className="text-xs font-bold tracking-[0.2em] text-[#8B6CFF] mb-3 uppercase flex items-center gap-2"
          style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)' }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[#8B6CFF]" />
          03 · THE INVESTIGATION
        </div>
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white leading-tight max-w-3xl mb-5">
          One click. Five agents. A verdict you can audit.
        </h2>
        <p className="text-base sm:text-lg leading-relaxed text-slate-400 max-w-2xl">
          Paste a WhatsApp forward and watch the chain execute — each agent reporting its own
          finding, with real latency, ending in an LLM-written threat assessment.
        </p>
      </motion.div>

      {/* Terminal Investigation Pipeline Container */}
      <div
        ref={containerRef}
        className="relative border border-[#161a22] bg-[#0a0a0c]/85 backdrop-blur-xl overflow-hidden shadow-[0_12px_40px_rgba(0,0,0,0.6)]"
      >
        <Corners color="#00D4AA70" size={14} />

        {/* Dynamic scan line effect */}
        <div
          className="absolute left-0 right-0 h-16 pointer-events-none z-10"
          style={{
            background: 'linear-gradient(180deg, transparent, rgba(0, 212, 170, 0.06), transparent)',
            animation: 'lp-scan 5s linear infinite',
          }}
        />

        {/* Pipeline Header / Input claim */}
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 border-b border-[#161a22] bg-[#060608]/90">
          <div
            className="flex items-center gap-2 text-[11px] md:text-xs text-slate-400 font-medium overflow-hidden"
            style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)' }}
          >
            <span className="text-[#00D4AA] font-bold">INPUT ▸</span>
            <span className="text-slate-200 italic truncate">
              &ldquo;Doctors at AIIMS confirmed hot lemon water kills corona virus. Share before deleted!!&rdquo;
            </span>
          </div>

          <button
            type="button"
            onClick={runSimulation}
            disabled={isPlaying}
            className="text-[10px] tracking-wider uppercase px-3 py-1 font-bold text-[#00D4AA] bg-[#00D4AA]/08 hover:bg-[#00D4AA]/15 border border-[#00D4AA]/35 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ml-auto"
            style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)' }}
          >
            {isPlaying ? 'EXECUTING PIPELINE...' : '↻ REPLAY EXECUTION'}
          </button>
        </div>

        {/* Steps sequence */}
        <div className="divide-y divide-[#12141a] py-2">
          {PIPELINE_STEPS.map((step, i) => {
            const isFinished = activeStep > i
            const isCurrent = activeStep === i
            const isWaiting = activeStep < i

            return (
              <div
                key={step.agent}
                className={`flex flex-col md:flex-row md:items-center justify-between gap-3 px-6 py-4 transition-all duration-300 ${
                  isCurrent
                    ? 'bg-[#00D4AA]/[0.04]'
                    : isFinished
                    ? 'bg-transparent'
                    : 'opacity-40'
                }`}
              >
                <div className="flex items-center gap-4">
                  {/* Step index */}
                  <span
                    className="text-[11px] font-bold text-slate-500 w-5 shrink-0"
                    style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)' }}
                  >
                    {String(i + 1).padStart(2, '0')}
                  </span>

                  {/* Status beacon dot */}
                  <span className="relative flex h-2.5 w-2.5 shrink-0">
                    {isCurrent && (
                      <span
                        className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                        style={{ backgroundColor: step.color }}
                      />
                    )}
                    <span
                      className="relative inline-flex rounded-full h-2.5 w-2.5 transition-all duration-300"
                      style={{
                        backgroundColor: isWaiting ? '#1a1f29' : step.color,
                        boxShadow: isFinished || isCurrent ? `0 0 12px ${step.color}` : 'none',
                      }}
                    />
                  </span>

                  {/* Agent name */}
                  <span
                    className="text-xs md:text-sm font-bold w-48 shrink-0 tracking-wider transition-colors"
                    style={{
                      fontFamily: 'var(--font-jetbrains-mono, monospace)',
                      color: isWaiting ? '#475569' : step.color,
                    }}
                  >
                    {step.agent}
                  </span>

                  {/* Output message */}
                  <span
                    className={`text-xs md:text-sm transition-all duration-300 ${
                      isFinished
                        ? 'text-slate-200 font-medium'
                        : isCurrent
                        ? 'text-[#00D4AA] animate-pulse font-semibold'
                        : 'text-slate-600'
                    }`}
                    style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)' }}
                  >
                    {isWaiting ? 'Pending pipeline dispatch...' : step.out}
                  </span>
                </div>

                {/* Timing latency tag */}
                <span
                  className="text-[10px] text-slate-500 tracking-wider shrink-0 ml-9 md:ml-0"
                  style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)' }}
                >
                  {isWaiting ? '—' : step.time}
                </span>
              </div>
            )
          })}
        </div>

        {/* Concluding Threat Alert Card */}
        <div className="p-4 sm:p-6 bg-[#060608]/95 border-t border-[#161a22]">
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{
              opacity: activeStep >= PIPELINE_STEPS.length ? 1 : 0.25,
              scale: activeStep >= PIPELINE_STEPS.length ? 1 : 0.99,
            }}
            transition={{ duration: 0.5 }}
            className={`p-5 md:p-6 border transition-all duration-500 ${
              activeStep >= PIPELINE_STEPS.length
                ? 'border-[#EF4444] bg-[#EF4444]/10 shadow-[0_0_35px_rgba(239,68,68,0.25)]'
                : 'border-[#161a22] bg-[#09090b]/40'
            }`}
          >
            <div
              className="flex flex-wrap items-baseline gap-3 mb-2.5"
              style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)' }}
            >
              <span className="text-[10px] font-black tracking-[0.2em] text-[#EF4444] uppercase px-2 py-0.5 bg-[#EF4444]/20 border border-[#EF4444]/40">
                THREAT ALERT
              </span>
              <span className="text-sm md:text-base font-bold text-white">
                Health Misinformation
              </span>
              <span className="text-[11px] font-semibold tracking-wider text-[#EF4444]">
                SEVERITY: HIGH · SCORE 89/100
              </span>
            </div>

            <p
              className="text-xs md:text-sm leading-relaxed text-slate-300"
              style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)' }}
            >
              The claim asserts a home remedy cures a viral infection — false, and dangerous if it
              displaces medical treatment. Written by the model at inference time.
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
