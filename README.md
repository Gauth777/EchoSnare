# ECHOSNARE

**Autonomous Multi-Agent Graph Intelligence & Threat Snare for Coordinated Online Disinformation**

EchoSnare is an analyst-facing threat-intelligence workstation for investigating coordinated online influence activity and fake claims. Unlike generic text classifiers, EchoSnare uses a **transparent, source-aware multi-stage investigation pipeline** that retrieves live web, news, fact-checking RSS, and social evidence, extracts entities, constructs interaction graphs, and synthesizes evidence-backed dossiers.

---

## 🔍 Capability Audit & Honest Architecture

EchoSnare includes a full forensic capability audit in [docs/ECHOSNARE_CAPABILITY_AUDIT.md](file:///d:/EchoSnare/docs/ECHOSNARE_CAPABILITY_AUDIT.md).

### Verified Live Capabilities:
- **Live Web & News Retrieval:** Queries live news RSS feeds for trending topics and claims.
- **Indian Fact-Checker Network:** Aggregates real debunked claim streams from AltNews, Boom Live, FactChecker.in, and TheQuint WebQoof.
- **Bluesky Social Search & Ingestion:** Queries public Bluesky REST APIs (`public.api.bsky.app`) to ingest recent posts and construct interaction graphs.
- **Image Forensics:** Performs PIL-based Error Level Analysis (ELA) compression diffing and EXIF metadata extraction on image URLs.
- **Neo4j Graph Store:** Queries account nodes, post relationships, and interaction edges when Neo4j AuraDB is connected (falls back gracefully to local fixtures).
- **Groq LLM Synthesis:** Produces structured threat classifications and evidence-backed dossiers using Llama 3.3 70B (bounded strictly to retrieved evidence).
- **Explicit Provenance & Availability Badges:** Reports true channel statuses (`COMPLETED`, `LIMITED`, `UNAVAILABLE`) so analysts always know which sources were checked.

---

## 🔄 7-Stage Investigation Pipeline

```text
USER QUERY (Topic / Event / Handle / Text)
   ↓
1. DISCOVERING           → Intent classification & mode detection (Topic vs Text vs Handle vs URL)
2. RETRIEVING SOURCES   → Querying Google News RSS, Indian Fact-Checkers RSS, Bluesky API
3. EXTRACTING ENTITIES   → Extracting claims, accounts, hashtags, domain entities, red flags
4. BUILDING GRAPH        → Dynamic graph node and edge construction in Neo4j / memory
5. ANALYZING COORDINATION→ Temporal windowing, burstiness, linguistic similarity
6. SCORING THREAT        → Threat classification & confidence scoring
7. SYNTHESIZING DOSSIER  → Evidence-backed intelligence dossier generation via Groq LLM
```

---

## 🛠️ Stack

- **Frontend:** Next.js 15, React 19, TypeScript, Vanilla CSS, D3.js (Force Simulation Graph)
- **Backend:** Python, FastAPI, Pydantic, Feedparser, Pillow (ELA), Requests, Neo4j Python Driver
- **Graph Database:** Neo4j AuraDB (Cypher queries)
- **AI & Retrieval:** Groq (Llama 3.3 70B Versatile), Google News RSS, Bluesky XRPC API, Indian Fact-Checkers RSS

---

## 🚀 Local Development

### 1. Backend (FastAPI)

```bash
cd backend
pip install -r requirements.txt
python main.py
```
*Backend runs on `http://localhost:8000`.*

### 2. Frontend (Next.js)

```bash
npm install
npm run dev
```
*Frontend runs on `http://localhost:3000` (or `3003`).*

---

## 📁 Repository Structure

```text
app/          Next.js application, dashboard workstation, and API proxies
components/   Landing page UI, 3D Canvas visual identity, and reusable widgets
backend/      FastAPI routes, multi-source retrieval engine, agents, and graph logic
  ├── agents/
  │   ├── source_retriever.py      Live Google News, Fact-Check, & Bluesky retrieval
  │   ├── content_analyzer.py      Groq LLM & lexical text scoring
  │   ├── campaign_detector.py     Graph & embedding evaluation
  │   ├── bluesky_ingestion.py     Live Bluesky account fetcher & Neo4j ingestion
  │   ├── fact_checker_ingestion.py Live Indian fact-check RSS parser
  │   └── deepfake_detector.py     Image ELA & EXIF forensics engine
  ├── api/                         FastAPI routes and Pydantic schemas
  └── db/                          Neo4j driver client and database seeders
docs/         ECHOSNARE_CAPABILITY_AUDIT.md, Architecture diagrams, and technical docs
types/        TypeScript interface definitions
```
