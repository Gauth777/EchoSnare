from __future__ import annotations

import json
import os
import re
from pathlib import Path

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

from api.routes import router
from db.seed import seed_database


_SIMULATED_HANDLES = {
    "@echo_forward_bot",
    "@viral_repeater_in",
    "@delhi_news_wire",
    "@social_pulse_hub",
}


def _sanitize_investigation_payload(data: dict) -> dict:
    """Normalize investigation output before it reaches the analyst UI.

    The legacy investigation route still contains two demo-era behaviors:
    a hard 82-point floor when any fact-check is present, and synthetic
    propagation accounts when fewer than two real accounts are found.
    This boundary keeps the public response evidence-backed without changing
    the legacy route implementation in place.
    """
    stages = data.get("stages") or []

    # Recover the actual content-risk value produced during stage 5.
    content_score = None
    for stage in stages:
        detail = str(stage.get("detail", ""))
        match = re.search(r"Computed content risk index\s*\((\d+)\/100\)", detail)
        if match:
            content_score = max(0, min(98, int(match.group(1))))
            break

    if content_score is not None:
        final_score = content_score
        risk_level = "HIGH" if final_score >= 70 else "MED" if final_score >= 40 else "LOW"

        # The old threat stage was computed before this response normalization.
        for stage in stages:
            if stage.get("stage_id") == "SCORING_THREAT":
                detail = str(stage.get("detail", ""))
                stage["detail"] = re.sub(
                    r"Severity:\s*(HIGH|MED|LOW)",
                    f"Severity: {risk_level}",
                    detail,
                )

        data["threat_score"] = final_score
        data["misinformation_score"] = final_score
        data["risk_level"] = risk_level
        data["confidence"] = round(min(0.99, 0.4 + final_score / 150), 2)
        data["score_basis"] = "Content risk index from retrieved evidence"

        threat_alert = data.get("threat_alert")
        if isinstance(threat_alert, dict):
            threat_alert["severity"] = risk_level
            threat_alert["confidence_score"] = final_score
            threat_alert["campaign_detected"] = final_score >= 70

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

            is_simulated = (
                node_id.startswith("node_")
                or account_id in _SIMULATED_HANDLES
                or label in _SIMULATED_HANDLES
            )
            if is_simulated:
                removed_ids.add(node_id)
            else:
                real_nodes.append(node)

        graph["nodes"] = real_nodes
        graph["edges"] = [
            edge
            for edge in (graph.get("edges") or [])
            if str(edge.get("source", "")) not in removed_ids
            and str(edge.get("target", "")) not in removed_ids
        ]

        if removed_ids:
            data["graph_data_note"] = (
                f"Removed {len(removed_ids)} synthetic demo node(s) from the analyst view."
            )

    accounts_detected = data.get("accounts_detected")
    if isinstance(accounts_detected, list):
        data["accounts_detected"] = [
            account
            for account in accounts_detected
            if str(account).strip().lower() not in _SIMULATED_HANDLES
        ]

    return data


class InvestigationSanitizerMiddleware(BaseHTTPMiddleware):
    """Correct legacy investigation output at the HTTP boundary."""

    async def dispatch(self, request, call_next):
        response = await call_next(request)

        if request.url.path != "/investigate" or response.status_code != 200:
            return response

        body = b"".join([chunk async for chunk in response.body_iterator])
        try:
            payload = json.loads(body)
        except (UnicodeDecodeError, json.JSONDecodeError):
            return JSONResponse(
                content={"error": "Invalid investigation response from backend"},
                status_code=502,
            )

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
