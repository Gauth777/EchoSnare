'use client'

import React from 'react'
import { motion, useScroll, useSpring } from 'framer-motion'
import RadarConcentricBackground from '@/components/landing/RadarConcentricBackground'
import OutbreakCanvas from '@/components/landing/OutbreakCanvas'
import Navbar from '@/components/landing/Navbar'
import Hero from '@/components/landing/Hero'
import LiveFeedTicker from '@/components/landing/LiveFeedTicker'
import ThreatStats from '@/components/landing/ThreatStats'
import AgentGrid from '@/components/landing/AgentGrid'
import InvestigationDemo from '@/components/landing/InvestigationDemo'
import TechMarquee from '@/components/landing/TechMarquee'
import CTASection from '@/components/landing/CTASection'
import Footer from '@/components/landing/Footer'
import CursorScanner from '@/components/landing/CursorScanner'

export default function LandingPage() {
  const { scrollYProgress } = useScroll()
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  })

  return (
    <div className="relative min-h-screen bg-[#000000] text-[#F4F7FB] selection:bg-[#00D4AA]/30 selection:text-white overflow-x-hidden">
      {/* 1. Full-Page Fixed Concentric Radar Sweep Background */}
      <RadarConcentricBackground />

      {/* 2. Traveling 3D Outbreak Sphere Companion that journeys through the page as you scroll */}
      <OutbreakCanvas />

      {/* 3. Interactive cursor scanner lens */}
      <CursorScanner />

      {/* 3. Cyber tactile film grain overlay (subtle 3% texture) */}
      <div
        aria-hidden="true"
        className="fixed inset-0 pointer-events-none z-40 opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)' opacity='0.6'/%3E%3C/svg%3E")`,
        }}
      />

      {/* 4. Reading Progress Indicator */}
      <motion.div
        className="fixed top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#00D4AA] via-[#3B82F6] to-[#EF4444] z-50 origin-left"
        style={{ scaleX }}
      />

      {/* 5. Sticky Top Navigation */}
      <Navbar />

      {/* 6. Main Content Sections floating over the continuous concentric background */}
      <main className="relative z-10 flex flex-col">
        {/* Hero Section */}
        <Hero />

        {/* Live Fact-checker Feed Ingestion Ticker */}
        <LiveFeedTicker />

        {/* The Threat Statistics */}
        <ThreatStats />

        {/* The System: 10 Specialized Agents with 3D Tilt Cards & 3D Neo4j Graph Preview */}
        <AgentGrid />

        {/* The Investigation: Sequential 5-Agent Pipeline & Threat Alert */}
        <InvestigationDemo />

        {/* Tech Stack Marquee */}
        <TechMarquee />

        {/* Mission Control Launch Call To Action */}
        <CTASection />
      </main>

      {/* Tactical Footer */}
      <Footer />
    </div>
  )
}
