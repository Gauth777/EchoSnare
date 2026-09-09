from __future__ import annotations

import asyncio
import json
import os
import re
from pathlib import Path
from urllib.parse import urlparse

os.environ["TOKENIZERS_PARALLELISM"] = "false"

from dotenv import load_dotenv

# Load credentials from backend/.env, root/.env.local, or root/.env
load_dotenv(Path(__file__).parent / ".env")
load_dotenv(Path(__file__).parent.parent / ".env.local")
load_dotenv(Path(__file__).parent.parent / ".env")

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from agents.claim_verifier import assess_claim, enrich_evidence
from agents.web_researcher import WebResearcher
from api.routes import router
from db.seed import seed_database


_SIMULATED_HANDLES = {
    "@echo_forward_bot",
    "@viral_repeater_in",
    "@delhi_news_wire",
    "@social_pulse_hub",
}


def _source_type(url: str, publisher: str) -> str:
    host = urlparse(url).netloc.lower()
    name = publisher.lower()
    if any(token in host or token in name for token in ("altnews", "boomlive", "factchecker", "thequint", "webqoof")):
        return "fact_checker"
    return "web_news"


def _evidence_items_from_research(items: list[dict]) -> list[dict]:
    normalized = []
    for index, item in enumerate(items):
        publisher = str(item.get("publisher") or "Web Source").strip()
        direction = str(item.get("direction") or "CONTEXT").upper()
        score = max(0, min(100, int(item.get("evidence_score") or 0)))
        relevance = max(0, min(100, int(item.get("claim_relevance") or 0)))
        normalized.append({
            "id": f"research_{index + 1}",
            "source_type": _source_type(str(item.get("url") or ""), publisher),
            "source_name": publisher,
            "source_url": str(item.get("url") or ""),
            "retrieved_at": "",
            "published_at": item.get("published_at"),
            "author": publisher,
            "title": str(item.get("title") or "Web evidence"),
            "text": str(item.get("content") or item.get("reason") or ""),
            "confidence": score / 100.0,
            "evidence_type": "debunked_claim" if _source_type(str(item.get("url") or ""), publisher) == "fact_checker" else "news_article",
            "claim_relevance": relevance,
            "evidence_score": score,
            "direction": direction,
            "reason": str(item.get("reason") or ""),
        })
    return normalized


def _risk_from_claim_assessment(assessment: dict, fallback: int) -> int:
    status = str(assessment.get("status", "UNVERIFIED")).upper()
    confidence = max(0.0, min(1.0, float(assessment.get("confidence", 0.0) or 0.0)))
    if status == "CONTRADICTED":
        return max(70, min(98, round(confidence * 100)))
    if status == "SUPPORTED":
        return max(5, min(35, round((1.0 - confidence) * 50)))
    if status == "PARTIALLY_SUPPORTED":
        return 45
    return max(5, min(75, fallback))


def _rebuild_research_graph(query: str, evidence: list[dict]) -> dict:
    clean_q = re.sub(r"[^a-zA-Z0-9 ]", "", query).strip()
    root_label = " ".join(clean_q.split()[:4]).upper() or "CLAIM-ORIGIN"
    nodes = [{
        "id": "origin_hub",
        "type": "origin",
        "label": root_label,
        "accountId": query[:80],
        "posts": len(evidence),
        "followers": 0,
        "clusterId": 0,
    }]
    edges = []
    for index, item in enumerate(evidence):
        node_id = f"ev_research_{index + 1}"
        node_type = "legitimate" if item.get("source_type") == "fact_checker" else "amplifier"
        nodes.append({
            "id": node_id,
            "type": node_type,
            "label": str(item.get("source_name") or "WEB")[:18].upper(),
            "accountId": item.get("author") or item.get("source_name"),
            "posts": 1,
            "followers": 0,
            "clusterId": 1 if item.get("direction") == "CONTRADICTS" else 2,
        })
        edges.append({
            "source": "origin_hub",
            "target": node_id,
            "weight": round(float(item.get("confidence", 0.0)), 2),
        })
    return {"nodes": nodes, "edges": edges}


def _sanitize_investigation_payload(data: dict) -> dict:
    """Make the analyst response reflect the live LLM research result."""
    stages = data.get("stages") or []

    content_score = None
    for stage in stages:
        detail = str(stage.get("detail", ""))
        match = re.search(r"Computed content risk index\s*\((\d+)\/100\)", detail)
        if match:
            content_score = max(0, min(98, int(match.group(1))))
            break

    query = str(data.get("query", ""))
    research = None
    try:
        research = asyncio.run(asyncio.to_thread(WebResearcher().research, query))
    except Exception as exc:
        print(f"[investigation] live research unavailable: {exc}")

    if research and research.evidence and research.claim_assessment:
        evidence = _evidence_items_from_research(research.evidence)
        claim_assessment = research.claim_assessment
        final_score = _risk_from_claim_assessment(claim_assessment, content_score or 40)
        risk_level = "HIGH" if final_score >= 70 else "MED" if final_score >= 40 else "LOW"

        data["evidence"] = evidence
        data["claim_assessment"] = claim_assessment
        data["evidence_confidence"] = float(claim_assessment.get("confidence", 0.0) or 0.0)
        data["confidence"] = data["evidence_confidence"]
        data["threat_score"] = final_score
        data["misinformation_score"] = final_score
        data["risk_level"] = risk_level
        data["score_basis"] = "LLM assessment of live web evidence"
        data["research_model"] = research.model
        data["research_summary"] = research.summary
        data["graph"] = _rebuild_research_graph(query, evidence)

        data["source_statuses"] = [
            status for status in (data.get("source_statuses") or [])
            if status.get("source_type") not in {"web_news", "fact_checker"}
        ]
        data["source_statuses"].append({
            "source_type": "ai_web_research",
            "source_name": "ECHOSNARE AI Web Research",
            "status": "completed",
            "count": len(evidence),
            "duration_ms": 0,
            "warning_or_error": None,
        })

        contradictory = sum(1 for item in evidence if item.get("direction") == "CONTRADICTS")
        supporting = sum(1 for item in evidence if item.get("direction") == "SUPPORTS")
        if contradictory:
            finding_title = "Contradicting Evidence Retrieved"
            finding_text = f"LLM research identified {contradictory} source(s) that contradict the investigated claim."
        elif supporting:
            finding_title = "Supporting Evidence Retrieved"
            finding_text = f"LLM research identified {supporting} source(s) that support material parts of the investigated claim."
        else:
            finding_title = "Relevant Context Retrieved"
            finding_text = f"LLM research identified {len(evidence)} source(s) that materially contextualize the investigated claim."
        data["key_findings"] = [{
            "title": finding_title,
            "explanation": finding_text,
            "source": "ECHOSNARE AI Web Research",
            "confidence": data["evidence_confidence"],
        }]

        data["fact_check_matches"] = [
            {
                "title": item.get("title", ""),
                "source": item.get("source_name", ""),
                "url": item.get("source_url", ""),
                "matched_terms": [],
            }
            for item in evidence if item.get("source_type") == "fact_checker"
        ]

        for stage in stages:
            if stage.get("stage_id") == "RETRIEVING_SOURCES":
                stage["source_count"] = 1
                stage["evidence_count"] = len(evidence)
                stage["detail"] = f"AI web research searched live sources and selected {len(evidence)} relevant evidence items."
            elif stage.get("stage_id") == "SCORING_THREAT":
                stage["detail"] = f"LLM evidence assessment: {claim_assessment.get('label', 'NOT YET VERIFIED')} (Severity: {risk_level})."
            elif stage.get("stage_id") == "SYNTHESIZING_DOSSIER":
                stage["detail"] = "Synthesized the final assessment from live, claim-relevant web evidence."

        data["threat_alert"] = {
            **(data.get("threat_alert") or {}),
            "severity": risk_level,
            "confidence_score": final_score,
            "campaign_detected": final_score >= 70,
            "explanation": research.summary or claim_assessment.get("explanation", ""),
        }
        if research.summary:
            data["synthesis_dossier"] = research.summary

    else:
        # Safe fallback when the research provider is unavailable.
        raw_evidence = data.get("evidence") or []
        claim_assessment = assess_claim(query, raw_evidence)
        data["claim_assessment"] = claim_assessment.to_dict()
        data["evidence"] = enrich_evidence(raw_evidence)
        data["evidence_confidence"] = claim_assessment.confidence
        data["confidence"] = claim_assessment.confidence
        data["score_basis"] = "Fallback analysis: retrieved evidence heuristics"

    # Never expose synthetic propagation accounts as discovered OSINT.
    graph = data.get("graph")
    if isinstance(graph, dict):
        nodes = graph.get("nodes") or []
        real_nodes = []
        removed_ids = set()
        for node in nodes:
            node_id = str(node.get("id", ""))
            account_id = str(node.get("accountId", "")).lower()
            label = str(node.get("label", "")).lower()
            is_simulated = node_id.startswith("node_") or account_id in _SIMULATED_HANDLES or label in _SIMULATED_HANDLES
            if is_simulated:
                removed_ids.add(node_id)
            else:
                real_nodes.append(node)
        graph["nodes"] = real_nodes
        graph["edges"] = [
            edge for edge in (graph.get("edges") or [])
            if str(edge.get("source", "")) not in removed_ids and str(edge.get("target", "")) not in removed_ids
        ]

    accounts_detected = data.get("accounts_detected")
    if isinstance(accounts_detected, list):
        data["accounts_detected"] = [
            account for account in accounts_detected
            if str(account).strip().lower() not in _SIMULATED_HANDLES
        ]

    return data


class InvestigationSanitizerMiddleware(BaseHTTPMiddleware):
    """Apply final live-research verification at the HTTP boundary."""

    async def dispatch(self, request, call_next):
        response = await call_next(request)
        if request.url.path != "/investigate" or response.status_code != 200:
            return response

        body = b"".join([chunk async for chunk in response.body_iterator])
        try:
            payload = json.loads(body)
        except (UnicodeDecodeError, json.JSONDecodeError):
            return JSONResponse(content={"error": "Invalid investigation response from backend"}, status_code=502)

        if isinstance(payload, dict):
            payload = _sanitize_investigation_payload(payload)
        return JSONResponse(content=payload, status_code=response.status_code)


def create_app() -> FastAPI:
    app = FastAPI(
        title="Real-Time Coordinated Misinformation Campaign Detection System",
        version="1.0.0",
        description="Backend AI services for content, network, campaign, and threat analysis.",
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3000", "http://localhost:3003", "https://*.vercel.app"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_middleware(InvestigationSanitizerMiddleware)
    app.include_router(router)
    return app


app = create_app()


import threading


def _safe_seed() -> None:
    try:
        seed_database()
    except Exception as exc:
        print(f"[startup] Neo4j seeding skipped: {exc}")


@app.on_event("startup")
async def startup() -> None:
    threading.Thread(target=_safe_seed, daemon=True).start()
