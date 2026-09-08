# ECHOSNARE Capability Audit & Request Flow Analysis

**Document Version:** 1.0.0  
**Date:** September 8, 2026  
**Auditor:** Antigravity AI Engine (Google DeepMind Team)  
**Target Repository:** Gauth777/EchoSnare  

---

## Executive Summary

EchoSnare was designed as a hybrid Next.js + FastAPI + Neo4j application for detecting coordinated online misinformation campaigns. While the codebase contains solid foundation modules (Neo4j graph schemas, D3 force-directed visualizers, WhatsApp pattern heuristics, PIL-based image Error Level Analysis, and Groq LLM integrations), **the prior UI presented several critical misrepresentations regarding its live analytical capabilities.**

This audit presents an unvarnished forensic analysis of what the system can genuinely perform versus what was simulated, static, or LLM-hallucinated.

---

## 1. End-to-End Request & Data Flow Audit

### 1. Landing Page (`app/page.tsx`)
* **State:** Fully functional UI presentation layer.
* **Reality:** Contains an interactive Three.js / Canvas 3D particle sphere representing visual network identity. The landing page claims "Real-Time Coordinated Misinformation Campaign Detection", "Live Telemetry", and "Automated Graph Reconstruction". The 3D visual identity is strong, but metric numbers on the landing page were static display values.

### 2. Dashboard Entry Point (`app/dashboard/page.tsx`)
* **State:** Partially connected telemetry dashboard.
* **Reality:**
  * Displays 4 metric counters (*Active Campaigns: 3*, *Accounts Flagged: 1,247*, *Alerts Today: 18*, *Avg Confidence: 91.3%*). All 4 values were hardcoded static numbers.
  * Displays a 24-hour activity grid (`TIMELINE_DATA`). This grid was static hardcoded data for 3 fixture campaigns.
  * Embeds `AnalyzePanel`, `NetworkGraphPanel`, `AlertFeed`, and `LiveClaimsCell`.

### 3. Dashboard "Analyze Content" (`app/dashboard/_components/AnalyzePanel.tsx`)
* **State:** Isolated single-string text evaluator.
* **Reality:** The text area accepts arbitrary user input or 4 quick-test preset strings. Clicking **"RUN INVESTIGATION"** sends `{ content: string }` to Next.js API `/api/analyze`. It does **not** trigger web searches, account discovery, or graph building.

### 4. Next.js API Route (`app/api/analyze/route.ts`)
* **State:** API proxy with fallback.
* **Reality:** Attempts `POST` to FastAPI backend `${BACKEND}/analyze-text`. If the backend is offline, it falls back to a direct Groq API call (`llama-3.3-70b-versatile`). If `GROQ_API_KEY` is missing, it returns a hardcoded mock JSON payload.

### 5. FastAPI Endpoint (`backend/api/routes.py` -> `/analyze-text`)
* **State:** Live LLM + Lexical text scoring.
* **Reality:** Instantiates `ContentAnalyzer()` and returns a score from 0 to 100, confidence level, and signal breakdowns.

### 6. ContentAnalyzer Agent (`backend/agents/content_analyzer.py`)
* **State:** Strictly closed-loop string analyzer.
* **Reality:** Runs `_lexical_score()` (regex pattern matching for keywords like `"they don't want you to know"`, ALL CAPS ratio, exclamation counts, URL counts) and `_model_score()` (Groq `llama-3.3-70b-versatile` zero-shot judgment prompt). **No web search, no news API call, no social media scraping, and no database query occurs.**

### 7. Campaign Detector (`backend/agents/campaign_detector.py`)
* **State:** Offline graph & embedding evaluator.
* **Reality:** Requires a pre-packaged JSON campaign object or file path (e.g. `campaign_1.json`). Uses `SentenceTransformer("all-MiniLM-L6-v2")` (or lexical fallback) to compute semantic similarity between pre-packaged posts and pre-packaged narrative descriptions. **It cannot run dynamically on arbitrary user queries.**

### 8. Network Mapper & Graph Engine (`backend/agents/network_mapper.py` & `backend/graph/`)
* **State:** Functional graph algorithm layer.
* **Reality:** Calculates network density, degree centrality, clustering coefficients, and bot score heuristics (`_node_type()`). Reads from Neo4j AuraDB if configured and seeded; falls back to static JSON files (`campaign_1.json`, `campaign_2.json`, `campaign_3.json`) if Neo4j is unreachable.

### 9. Account Intel (`backend/agents/account_intel.py` & `backend/api/routes.py`)
* **State:** Genuine handle-specific social analysis.
* **Reality:** Requires an explicit handle list (e.g. `@jay.bsky.social`). Calls `ensure_account_data(handle)`.

### 10. Bluesky Ingestion (`backend/agents/bluesky_ingestion.py`)
* **State:** **GENUINELY LIVE.**
* **Reality:** Queries the public Bluesky API (`https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor=<handle>`). Fetches the 20 most recent original posts and ingests them into Neo4j graph under `(:Account)-[:SHARED]->(:Post)`.

### 11. Live Feed / Fact-Checker Ingestion (`backend/agents/fact_checker_ingestion.py`)
* **State:** **GENUINELY LIVE.**
* **Reality:** Fetches live RSS feeds from 4 Indian fact-checking platforms (*AltNews*, *Boom Live*, *FactChecker.in*, *TheQuint WebQoof*). Parses entry titles, summaries, and links, then evaluates each claim through `ContentAnalyzer`.

### 12. Agent Endpoints & Orchestration (`backend/api/routes.py` -> `/investigate`)
* **State:** Partial multi-agent pipeline.
* **Reality:** The existing `/investigate` endpoint chains `WhatsAppForwardAnalyzer` + `ContentAnalyzer` + `SarvamLanguageDetector` + token overlap against cached RSS fact-checks + `ThreatClassifier`. However, it only accepts a single text snippet and does not execute external topic retrieval.

### 13. Neo4j Graph Interaction (`backend/db/neo4j_client.py` & `seed.py`)
* **State:** **GENUINELY LIVE** (when AuraDB credentials are provided).
* **Reality:** Seeds 3 initial benchmark campaigns into Neo4j. If Neo4j is disconnected, the system degrades silently to JSON fixtures.

### 14. Groq LLM Usage (`backend/agents/content_analyzer.py` & `threat_classifier.py`)
* **State:** **GENUINELY LIVE** (when `GROQ_API_KEY` is provided).
* **Reality:** Uses Llama-3.3-70B for zero-shot text classification and structured threat alert generation.

### 15. External News / Web / Social Retrieval
* **Web Search (Google / Bing / DuckDuckGo):** NONE prior to audit.
* **News Retrieval:** NONE prior to audit (only static RSS feed polling for fact-checkers).
* **X/Twitter Retrieval:** Nitter RSS fallback attempt in `temporal_coordinator.py`, but Nitter public instances are largely offline/rate-limited.
* **Reddit Retrieval:** NONE.
* **Bluesky Retrieval:** LIVE for specified account handles.
* **Fact-Check Retrieval:** LIVE for 4 Indian fact-checking RSS feeds.

---

## 2. Capability Summary Matrix

| Capability / Feature | Status | Mechanism | Limitations / Notes |
| :--- | :--- | :--- | :--- |
| **Typed Text Misinformation Scoring** | **LIVE (LLM + Lexical)** | Groq Llama-3.3-70B + regex pattern weights | Evaluates text in isolation; no live web verification. |
| **WhatsApp Forward Analysis** | **LIVE (Heuristic + LLM)** | RegEx forward depth + language ID + Groq score | Identifies forward signals, urgency language, health/political misinfo markers. |
| **Bluesky Account Ingestion** | **LIVE (API)** | `public.api.bsky.app` REST endpoint | Handles single user timeline fetches (up to 20 posts). |
| **Fact-Checker Feed Aggregation** | **LIVE (RSS)** | `feedparser` on AltNews, Boom, FactChecker, Quint | Live RSS stream updated every 5 minutes. |
| **Image EXIF & ELA Forensics** | **LIVE (Pillow)** | EXIF tag extraction + Error Level Analysis PNG diff | Analyzes JPEG compression artifacts and EXIF software tags. |
| **Neo4j Graph Store** | **LIVE (Cypher)** | `neo4j` Python driver | Queries accounts, posts, interaction edges, and campaign clusters. |
| **Topic Web/News Search** | **NOT SUPPORTED (Prior)** | None | Typed topics did not trigger web searches. |
| **Arbitrary Account Graph Discovery** | **NOT SUPPORTED (Prior)** | None | Network graphs only showed seeded campaigns 1, 2, 3. |
| **Live Telemetry Counters** | **MOCK / STATIC** | Hardcoded React state | 1,247 accounts, 18 alerts, 91.3% confidence were static strings. |

---

## 3. Explicit Query Testing Behavior

### Question A: What can the current system genuinely analyze from arbitrary typed text?
**Answer:** The system analyzes **only the internal linguistic & semantic characteristics of the submitted text string itself.** It measures caps ratio, punctuation density, suspicious phrase occurrences (e.g. *"share before deleted"*), and prompts Groq Llama-3.3-70b to rate the likelihood of misinformation. **It does not perform external verification, search engines lookups, or live social media monitoring.**

### Question B: Can arbitrary current/trending topics be investigated automatically?
**Answer:** **NO.** Submitting a trending topic name (e.g., *"Delhi strike today"*) yields an LLM response based solely on the model's static training data or lexical rules. No live search or real-time news retrieval was triggered.

### Question C: Submitting typed text trigger check:
* **Web search?** ❌ NO
* **News retrieval?** ❌ NO
* **X/Twitter retrieval?** ❌ NO
* **Reddit retrieval?** ❌ NO
* **Bluesky retrieval?** ❌ NO (only explicit handle inputs trigger Bluesky fetches)
* **Fact-check retrieval?** ⚠️ PARTIAL (checks word token overlap against cached RSS items from 4 Indian fact-checkers)
* **Graph reconstruction?** ❌ NO
* **Neo4j queries?** ❌ NO
* **Account discovery?** ❌ NO
* **Source verification?** ❌ NO

### Question D: Which features are genuinely live?
1. Bluesky account feed ingestion for specified handles (`@handle.bsky.social`).
2. Indian Fact-Checker RSS feed parsing (`/live-feed`).
3. Image EXIF metadata reading and Error Level Analysis (`/deepfake/analyze`).
4. Groq Llama-3.3-70B LLM content scoring and threat classification.
5. Neo4j Cypher queries for campaign nodes and account relationship edges when connected.

### Question E: Which features are mock / static / demo-only?
1. Main Overview metric numbers (*"1,247 ACCOUNTS FLAGGED"*, *"18 ALERTS TODAY"*).
2. 24-Hour Campaign Activity Timeline grid.
3. Network Graph fallback datasets (`campaign_1.json`, `campaign_2.json`, `campaign_3.json`).
4. Regex mapping in `AnalyzePanel` that mapped category string `"Election Manipulation"` to static `"Operation Pulse"`.
5. Next.js mock fallback object returned when `GROQ_API_KEY` is missing and backend is unreachable.

### Question F: Which features require specific inputs?
* **Account Intel:** Requires an explicit social handle (e.g. `jay.bsky.social`).
* **Image Forensics:** Requires a valid image HTTP/HTTPS URL (`image_url`).
* **WhatsApp Analyzer:** Requires text containing conversational or forward markers.

---

## 4. Behavior Scenarios for Specific Test Queries

### Scenario 1: User types `"Samay Raina controversy"`
* **What Happens:** The text is passed to `ContentAnalyzer`. Lexical analysis finds low keyword suspiciousness. Groq Llama-3.3-70B generates a plausible-sounding judgment based on parametric knowledge.
* **Result:** Misinformation score is calculated (~35-50/100). Category defaults to `"Coordinated Inauthentic Behavior"`. **Zero web articles or news items are retrieved.**

### Scenario 2: User types `"cockroach janta party"`
* **What Happens:** Text is passed to Groq Llama-3.3-70B. The LLM identifies satire or political spoofing, assigns a score, and returns a synthetic summary.
* **Result:** Misinformation score assigned (~40-60/100). No external source validation occurs.

### Scenario 3: User types `"Delhi strike today"`
* **What Happens:** Text is sent to Groq Llama-3.3-70B. Because the LLM lacks real-time awareness of today's news without web search, it outputs generic text about strikes.
* **Result:** Evaluated in isolation without verifying whether a strike is actively occurring in Delhi today.

---

## 5. Architectural Mandate for ECHOSNARE

To fulfill the project goal, EchoSnare must transition from an **"Isolated Text Scorer"** to a **"Source-Aware Investigation Workstation"**.

### Required Pipeline Architecture:
1. **Query Interpretation:** Parse query into intent (Topic vs Text vs Handle vs URL).
2. **Multi-Source Discovery:** Execute live web/news search (via DuckDuckGo/news RSS), fact-check database match, and Bluesky social search.
3. **Evidence Normalization:** Format all retrieved items with explicit provenance (`source_type`, `source_name`, `source_url`, `retrieved_at`, `confidence`).
4. **Entity & Claim Extraction:** Extract named entities, key claims, accounts, hashtags, and timestamps.
5. **Graph Construction / Update:** Map relationships between accounts, claims, and media.
6. **Coordination & Threat Scoring:** Run temporal windowing, linguistic clustering, and bot pressure heuristics on real evidence.
7. **Synthesis & Dossier:** Produce an evidence-backed intelligence summary that **never claims external verification unless actual retrieved evidence exists.**
8. **Honest UX:** Visually display status for each source (e.g. *"Web Retrieval: 4 sources found"*, *"Bluesky Evidence: Unavailable"*).
