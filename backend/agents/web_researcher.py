from __future__ import annotations

import json
import logging
import os
from dataclasses import dataclass, field
from typing import Any

try:
    from groq import Groq
except ImportError:
    Groq = None  # type: ignore[assignment,misc]

logger = logging.getLogger(__name__)


@dataclass(slots=True)
class WebResearchResult:
    evidence: list[dict[str, Any]] = field(default_factory=list)
    claim_assessment: dict[str, Any] | None = None
    summary: str = ""
    model: str = ""
    search_performed: bool = False


class WebResearcher:
    """Active claim-research agent using Groq Compound's live web tools."""

    def __init__(self) -> None:
        self.api_key = os.getenv("GROQ_API_KEY")
        self.model = os.getenv("GROQ_RESEARCH_MODEL", "groq/compound")

    def research(self, query: str) -> WebResearchResult:
        if not self.api_key or self.api_key == "your_key" or Groq is None:
            return WebResearchResult(model=self.model)

        client = Groq(api_key=self.api_key, default_headers={"Groq-Model-Version": "latest"})
        prompt = f"""
You are ECHOSNARE's live web research and claim verification agent.

INVESTIGATED CLAIM:
{query}

Actively research this claim on the live web. Search multiple formulations and investigate current reporting, primary/official sources, and reputable fact-checks. For important sources, inspect the actual webpage when possible.

Select only sources that materially help evaluate the exact claim. For each selected source, determine whether its factual content SUPPORTS, CONTRADICTS, or provides important CONTEXT. Score claim relevance and evidentiary usefulness independently.

Return ONLY valid JSON:
{{
  "claim_status": "SUPPORTED|PARTIALLY_SUPPORTED|CONTRADICTED|UNVERIFIED",
  "claim_label": "SUPPORTED|PARTIALLY SUPPORTED|NOT SUPPORTED|NOT YET VERIFIED",
  "claim_confidence": 0,
  "summary": "2-4 sentence evidence-based conclusion",
  "sources": [
    {{
      "url": "https://...",
      "title": "...",
      "publisher": "...",
      "published_at": "...",
      "claim_relevance": 0,
      "evidence_score": 0,
      "direction": "SUPPORTS|CONTRADICTS|CONTEXT",
      "reason": "One concise sentence explaining what this source contributes."
    }}
  ]
}}

Scoring rules:
- claim_relevance: 0-100 for how directly the source addresses the exact people/entities/event/date/place/assertions in the claim.
- evidence_score: 0-100 for how strongly the source content can be used to evaluate the claim.
- Never use source reputation alone as evidence of truth.
- Never call a claim false solely because evidence was not found.
- Never call a claim true solely because outlets repeat it.
- A fact-check counts only when it actually evaluates the investigated claim.
- Prefer 4-8 strong sources. Do not include weak or unrelated search results.
- Do not invent URLs, publishers, dates, or facts.
""".strip()

        try:
            response = client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are a rigorous OSINT research agent. Search the live web, inspect relevant sources, and return structured evidence. Never fabricate sources."},
                    {"role": "user", "content": prompt},
                ],
                citation_options="enabled",
                search_settings={"country": "india"},
                response_format={"type": "json_object"},
                max_tokens=3000,
            )
            message = response.choices[0].message
            payload = self._parse_json(message.content or "")
            search_results = self._executed_search_results(message)
            if not payload:
                return WebResearchResult(model=self.model, search_performed=bool(search_results))

            evidence = self._build_evidence(payload, search_results)
            assessment = {
                "status": self._valid_status(payload.get("claim_status")),
                "label": self._valid_label(payload.get("claim_label")),
                "explanation": str(payload.get("summary", "")),
                "confidence": max(0.0, min(1.0, float(payload.get("claim_confidence", 0) or 0) / 100)),
                "corroborating_sources": sum(1 for e in evidence if e.get("direction") == "SUPPORTS"),
                "contradictory_sources": sum(1 for e in evidence if e.get("direction") == "CONTRADICTS"),
            }
            return WebResearchResult(evidence=evidence, claim_assessment=assessment, summary=str(payload.get("summary", "")), model=self.model, search_performed=bool(search_results))
        except Exception as exc:
            logger.exception("Live LLM web research failed: %s", exc)
            return WebResearchResult(model=self.model)

    @staticmethod
    def _parse_json(content: str) -> dict[str, Any] | None:
        try:
            return json.loads(content)
        except json.JSONDecodeError:
            start = content.find("{")
            end = content.rfind("}")
            if start >= 0 and end > start:
                try:
                    return json.loads(content[start:end + 1])
                except json.JSONDecodeError:
                    pass
        return None

    @staticmethod
    def _read(value: Any, key: str, default: Any = None) -> Any:
        if isinstance(value, dict):
            return value.get(key, default)
        return getattr(value, key, default)

    @staticmethod
    def _valid_status(value: Any) -> str:
        value = str(value or "UNVERIFIED").upper()
        return value if value in {"SUPPORTED", "PARTIALLY_SUPPORTED", "CONTRADICTED", "UNVERIFIED"} else "UNVERIFIED"

    @staticmethod
    def _valid_label(value: Any) -> str:
        value = str(value or "NOT YET VERIFIED").upper()
        return value if value in {"SUPPORTED", "PARTIALLY SUPPORTED", "NOT SUPPORTED", "NOT YET VERIFIED"} else "NOT YET VERIFIED"

    def _executed_search_results(self, message: Any) -> list[dict[str, Any]]:
        results: list[dict[str, Any]] = []
        for tool in self._read(message, "executed_tools", []) or []:
            tool_results = self._read(tool, "search_results", None)
            if isinstance(tool_results, dict):
                tool_results = tool_results.get("results", [])
            if not isinstance(tool_results, list):
                continue
            for result in tool_results:
                url = self._read(result, "url", "")
                if not url:
                    continue
                results.append({
                    "url": str(url),
                    "title": str(self._read(result, "title", "")),
                    "content": str(self._read(result, "content", "")),
                    "search_score": float(self._read(result, "score", 0.0) or 0.0),
                })
        return list({r["url"]: r for r in results}.values())

    def _build_evidence(self, payload: dict[str, Any], search_results: list[dict[str, Any]]) -> list[dict[str, Any]]:
        sources = payload.get("sources") if isinstance(payload.get("sources"), list) else []
        by_url = {r["url"]: r for r in search_results}
        evidence: list[dict[str, Any]] = []
        for source in sources:
            if not isinstance(source, dict):
                continue
            url = str(source.get("url", "")).strip()
            raw = by_url.get(url)
            if not url or raw is None:
                continue
            direction = str(source.get("direction", "CONTEXT")).upper()
            if direction not in {"SUPPORTS", "CONTRADICTS", "CONTEXT"}:
                direction = "CONTEXT"
            try:
                relevance = max(0, min(100, int(float(source.get("claim_relevance", 0) or 0))))
                score = max(0, min(100, int(float(source.get("evidence_score", 0) or 0))))
            except (TypeError, ValueError):
                continue
            if relevance < 55 or score < 55:
                continue
            evidence.append({
                "url": url,
                "title": str(source.get("title") or raw.get("title") or "Web source"),
                "publisher": str(source.get("publisher") or ""),
                "published_at": str(source.get("published_at") or "") or None,
                "content": str(raw.get("content") or ""),
                "claim_relevance": relevance,
                "evidence_score": score,
                "direction": direction,
                "reason": str(source.get("reason") or ""),
                "search_score": round(float(raw.get("search_score", 0.0)), 3),
            })
        evidence.sort(key=lambda e: (-e["evidence_score"], -e["claim_relevance"]))
        return evidence[:8]
