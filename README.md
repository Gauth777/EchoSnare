# ECHOSNARE

**Autonomous Multi-Agent Graph Intelligence & Threat Snare for Coordinated Online Disinformation**

ECHOSNARE is an analyst-facing threat-intelligence console for investigating coordinated online influence activity. It combines graph relationships, behavioral signals, linguistic analysis, threat scoring, and automated synthesis into an evidence-oriented investigation workflow.

## What it does

- Models accounts, posts, narratives, and relationships as an investigation graph.
- Detects coordination signals such as synchronized bursts, network structure, and semantic similarity.
- Uses specialized analysis stages for triage, language, graph forensics, scoring, and synthesis.
- Produces an explainable campaign view rather than a single opaque classification.
- Provides mission-control views for campaigns, alerts, network intelligence, account intelligence, reports, and content analysis.

## Stack

**Frontend:** Next.js, React, TypeScript, Tailwind CSS, D3.js

**Backend:** Python, FastAPI, LangGraph, NetworkX

**Data:** Neo4j AuraDB, Supabase/Postgres, local demo fixtures

**AI/APIs:** Groq, Sarvam AI, Hugging Face, Bluesky and fact-checking feeds

## Local development

### Frontend

```bash
npm install
npm run dev
```

The frontend runs on the Next.js development server.

### Backend

```bash
cd backend
pip install -r requirements.txt
python main.py
```

Environment variables are required for connected services; use local/demo data when those services are unavailable.

## Project structure

```text
app/          Next.js application and dashboard routes
components/   Reusable UI and landing-page components
backend/      FastAPI services, agents, graph logic, and demo data
lib/          Frontend helpers and mock data
types/        Shared TypeScript types
docs/         Architecture and technical notes
```

## Attribution

ECHOSNARE is an independently modified and extended project built from the open-source ShadowTrace codebase. The original MIT license is retained in `LICENSE`.
