from __future__ import annotations

import json
import logging
import os
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from db.neo4j_client import run_query

logger = logging.getLogger(__name__)

LOGS_FILE = Path(__file__).parent.parent / "data" / "search_logs.jsonl"
_file_lock = threading.Lock()


def _ensure_data_dir() -> None:
    LOGS_FILE.parent.mkdir(parents=True, exist_ok=True)


def _write_to_neo4j_async(
    search_id: str,
    query: str,
    mode: str,
    threat_score: int,
    risk_level: str,
    narrative_category: str,
    evidence_count: int,
    duration_ms: int,
    now_iso: str,
    status: str,
    accounts: list[str] | None,
    campaign_id: str | None,
    synthesis_dossier: str = "",
    evidence: list[dict[str, Any]] | None = None,
    claim_verdict: str = "",
    confidence: float = 0.0,
) -> None:
    """Non-blocking background sync to Neo4j AuraDB with Evidence nodes."""
    try:
        cypher = """
        MERGE (s:UserSearch {id: $id})
        SET s.query = $query,
            s.query_mode = $query_mode,
            s.threat_score = $threat_score,
            s.risk_level = $risk_level,
            s.narrative_category = $narrative_category,
            s.evidence_count = $evidence_count,
            s.duration_ms = $duration_ms,
            s.timestamp = $timestamp,
            s.status = $status,
            s.synthesis_dossier = $synthesis_dossier,
            s.claim_verdict = $claim_verdict,
            s.confidence = $confidence
        """
        run_query(cypher, {
            "id": search_id,
            "query": query,
            "query_mode": mode,
            "threat_score": threat_score,
            "risk_level": risk_level,
            "narrative_category": narrative_category,
            "evidence_count": evidence_count,
            "duration_ms": duration_ms,
            "timestamp": now_iso,
            "status": status,
            "synthesis_dossier": synthesis_dossier or "",
            "claim_verdict": claim_verdict or "",
            "confidence": float(confidence or 0.0),
        })

        if evidence:
            clean_ev = []
            for ev in evidence[:10]:
                clean_ev.append({
                    "id": f"ev_{uuid.uuid4().hex[:8]}",
                    "title": str(ev.get("title") or "Web evidence")[:250],
                    "source_name": str(ev.get("source_name") or ev.get("publisher") or "Web")[:100],
                    "source_url": str(ev.get("source_url") or ev.get("url") or "")[:500],
                    "direction": str(ev.get("direction") or "NEUTRAL")[:20],
                    "confidence": float(ev.get("confidence") or 0.8),
                    "evidence_type": str(ev.get("evidence_type") or "news_article")[:50],
                    "reason": str(ev.get("reason") or "")[:500],
                })
            if clean_ev:
                ev_cypher = """
                MATCH (s:UserSearch {id: $id})
                UNWIND $evidence AS ev
                CREATE (e:Evidence {
                    id: ev.id,
                    title: ev.title,
                    source_name: ev.source_name,
                    source_url: ev.source_url,
                    direction: ev.direction,
                    confidence: ev.confidence,
                    evidence_type: ev.evidence_type,
                    reason: ev.reason
                })
                CREATE (s)-[:HAS_EVIDENCE]->(e)
                """
                run_query(ev_cypher, {"id": search_id, "evidence": clean_ev})

        if accounts:
            clean_accounts = [a for a in accounts if str(a).strip()]
            if clean_accounts:
                acc_cypher = """
                MATCH (s:UserSearch {id: $id})
                UNWIND $accounts AS acc
                MERGE (a:Account {key: acc})
                ON CREATE SET a.label = acc, a.accountId = acc
                MERGE (s)-[:INVESTIGATED_ACCOUNT]->(a)
                """
                run_query(acc_cypher, {"id": search_id, "accounts": clean_accounts[:10]})

        if campaign_id:
            camp_cypher = """
            MATCH (s:UserSearch {id: $id})
            MATCH (c:Campaign {id: $campaign_id})
            MERGE (s)-[:DETECTED_CAMPAIGN]->(c)
            """
            run_query(camp_cypher, {"id": search_id, "campaign_id": campaign_id})

    except Exception as exc:
        logger.warning("Neo4j async write error: %s", exc)


def log_search(
    query: str,
    mode: str = "topic",
    threat_score: int = 0,
    risk_level: str = "LOW",
    narrative_category: str = "General Investigation",
    evidence_count: int = 0,
    duration_ms: int = 0,
    status: str = "completed",
    details: dict[str, Any] | None = None,
    accounts: list[str] | None = None,
    campaign_id: str | None = None,
    synthesis_dossier: str = "",
    evidence: list[dict[str, Any]] | None = None,
    claim_assessment: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """
    Persist user search immediately to local log and dispatch non-blocking Neo4j write.
    """
    search_id = f"search_{uuid.uuid4().hex[:12]}"
    now_iso = datetime.now(timezone.utc).isoformat()
    norm_risk = str(risk_level).upper()

    # Extract claim verdict and confidence if available
    claim_verdict = ""
    confidence = 0.0
    if claim_assessment:
        claim_verdict = str(claim_assessment.get("status") or claim_assessment.get("label") or "")
        confidence = float(claim_assessment.get("confidence") or 0.0)

    record: dict[str, Any] = {
        "id": search_id,
        "query": query,
        "query_mode": mode,
        "threat_score": int(threat_score),
        "risk_level": norm_risk,
        "narrative_category": narrative_category,
        "evidence_count": int(evidence_count),
        "duration_ms": int(duration_ms),
        "timestamp": now_iso,
        "status": status,
        "accounts": accounts or [],
        "campaign_id": campaign_id,
        "synthesis_dossier": synthesis_dossier or "",
        "evidence": evidence or [],
        "claim_assessment": claim_assessment or {},
        "details": details or {},
    }

    # 1. Instant local write (0ms)
    try:
        _ensure_data_dir()
        with _file_lock:
            with open(LOGS_FILE, "a", encoding="utf-8") as f:
                f.write(json.dumps(record, ensure_ascii=False) + "\n")
    except Exception as exc:
        logger.warning("Failed writing to search_logs.jsonl: %s", exc)

    # 2. Asynchronous write to Neo4j AuraDB (non-blocking)
    threading.Thread(
        target=_write_to_neo4j_async,
        args=(
            search_id,
            query,
            mode,
            int(threat_score),
            norm_risk,
            narrative_category,
            int(evidence_count),
            int(duration_ms),
            now_iso,
            status,
            accounts,
            campaign_id,
            synthesis_dossier,
            evidence,
            claim_verdict,
            confidence,
        ),
        daemon=True,
    ).start()

    return record


def get_recent_searches(limit: int = 50, offset: int = 0) -> list[dict[str, Any]]:
    """
    Retrieve real-time searches: reads from local append-only log first (sub-millisecond),
    falling back to Neo4j if file does not exist.
    """
    if LOGS_FILE.exists():
        try:
            with _file_lock:
                with open(LOGS_FILE, "r", encoding="utf-8") as f:
                    lines = f.readlines()
            results = []
            for line in reversed(lines):
                line = line.strip()
                if not line:
                    continue
                try:
                    results.append(json.loads(line))
                except Exception:
                    continue
                if len(results) >= offset + limit:
                    break
            if results:
                return results[offset : offset + limit]
        except Exception as exc:
            logger.warning("Failed reading local logs: %s", exc)

    # Fallback to Neo4j if local log is empty
    try:
        query = """
        MATCH (s:UserSearch)
        OPTIONAL MATCH (s)-[:DETECTED_CAMPAIGN]->(c:Campaign)
        OPTIONAL MATCH (s)-[:HAS_EVIDENCE]->(e:Evidence)
        WITH s, c, collect({
            id: e.id,
            title: e.title,
            source_name: e.source_name,
            source_url: e.source_url,
            direction: e.direction,
            confidence: e.confidence,
            evidence_type: e.evidence_type,
            reason: e.reason
        }) AS raw_evidence
        RETURN s.id AS id,
               s.query AS query,
               s.query_mode AS query_mode,
               s.threat_score AS threat_score,
               s.risk_level AS risk_level,
               s.narrative_category AS narrative_category,
               s.evidence_count AS evidence_count,
               s.duration_ms AS duration_ms,
               s.timestamp AS timestamp,
               s.status AS status,
               s.synthesis_dossier AS synthesis_dossier,
               s.claim_verdict AS claim_verdict,
               [ev IN raw_evidence WHERE ev.title IS NOT NULL] AS evidence,
               c.name AS campaign_name
        ORDER BY s.timestamp DESC
        SKIP $offset LIMIT $limit
        """
        raw = run_query(query, {"offset": offset, "limit": limit})
        if raw:
            return raw
    except Exception as exc:
        logger.warning("Neo4j get_recent_searches fallback failed: %s", exc)

    return []


def get_search_metrics() -> dict[str, Any]:
    """
    Aggregate search statistics across the database.
    """
    searches = get_recent_searches(limit=500)
    total = len(searches)
    if total == 0:
        return {
            "total_searches": 0,
            "high_risk_count": 0,
            "med_risk_count": 0,
            "low_risk_count": 0,
            "avg_threat_score": 0,
            "avg_duration_ms": 0,
            "modes": {},
            "neo4j_active": True,
        }

    high = sum(1 for s in searches if str(s.get("risk_level", "")).upper() == "HIGH")
    med = sum(1 for s in searches if str(s.get("risk_level", "")).upper() == "MED")
    low = sum(1 for s in searches if str(s.get("risk_level", "")).upper() == "LOW")

    threat_scores = [int(s.get("threat_score") or 0) for s in searches]
    avg_threat = round(sum(threat_scores) / max(1, total), 1)

    durations = [int(s.get("duration_ms") or 0) for s in searches if s.get("duration_ms")]
    avg_duration = round(sum(durations) / max(1, len(durations)), 1) if durations else 0

    modes: dict[str, int] = {}
    for s in searches:
        m = str(s.get("query_mode") or "topic").lower()
        modes[m] = modes.get(m, 0) + 1

    return {
        "total_searches": total,
        "high_risk_count": high,
        "med_risk_count": med,
        "low_risk_count": low,
        "avg_threat_score": avg_threat,
        "avg_duration_ms": avg_duration,
        "modes": modes,
        "neo4j_active": True,
    }
