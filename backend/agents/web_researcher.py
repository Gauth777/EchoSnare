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
    """Active two-pass research agent: Compound web discovery, then LLM evidence adjudication."""

    def __init__(self) -> None:
        self.api_key = os.getenv("GROQ_API_KEY")
        self.search_model = os.getenv("GROQ_RESEARCH_MODEL", "groq/compound")
        self.analysis_model = os.getenv("GROQ_ANALYSIS_MODEL", os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile"))

    def research(self, query: str) -> WebResearchResult:
        if not self.api_key or self.api_key == "your_key" or Groq is None:
            logger.warning("Web research skipped: GROQ_API_KEY unavailable")
            return WebResearchResult(model=self.search_model)

        try:
            client = Groq(api_key=self.api_key, default_headers={"Groq-Model-Version": "latest"})
            search_results, search_performed = self._discover(client, query)
            if not search_results:
                logger.warning("Web research returned no executed search results for query: %s", query)
                return WebResearchResult(model=self.search_model, search_performed=search_performed)

            evidence, assessment, summary = self._adjudicate(client, query, search_results)
            return WebResearchResult(
                evidence=evidence,
                claim_assessment=assessment,
                summary=summary,
                model=f"{self.search_model} + {self.analysis_model}",
                search_performed=search_performed,
            )
        except Exception as exc:
            logger.exception("Live LLM web research failed: %s", exc)
            return WebResearchResult(model=self.search_model)

    def _discover(self, client: Any, query: str) -> tuple[list[dict[str, Any]], bool]:
        prompt = f"""
You are ECHOSNARE's live OSINT research agent.

Investigated claim/topic:
{query}

Research this claim on the live web. This is a fact-checking investigation, not a generic topic search.

Search several distinct formulations covering:
1. The exact claim and important quoted phrases.
2. The main people, organizations, place, event and date in the claim.
3. Official or primary sources that could confirm or deny it.
4. Reputable news reporting covering the underlying event.
5. Fact-checking articles that explicitly evaluate the allegation.

Use the web search tool and visit important result pages when useful. Favor recent and India-relevant sources when the claim concerns India.

Do not merely search for the generic topic. The goal is to assemble enough material for another model to decide whether the exact claim is supported or contradicted.

In your final answer, briefly state what you found, but do not fabricate sources.
""".strip()

        response = client.chat.completions.create(
            model=self.search_model,
            messages=[
                {
                    "role": "system",
                    "content": "You are a rigorous OSINT web researcher. Actually search the live web. Prefer primary, official, reputable news and direct fact-check sources. Never invent sources.",
                },
                {"role": "user", "content": prompt},
            ],
            citation_options="enabled",
            search_settings={"country": "india"},
            max_tokens=1800,
        )
        message = response.choices[0].message
        results = self._executed_search_results(message)
        return results, bool(results)

    def _adjudicate(self, client: Any, query: str, search_results: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], dict[str, Any], str]:
        candidates = []
        for index, result in enumerate(search_results[:12], start=1):
            content = result.get("content", "")
            if len(content) > 1400:
                content = content[:1400]
            candidates.append(
                f"SOURCE {index}\nURL: {result['url']}\nTITLE: {result.get('title', '')}\nCONTENT: {content}\nSEARCH SCORE: {result.get('search_score', 0):.3f}"
            )
        evidence_block = "\n\n".join(candidates)

        prompt = f"""
You are ECHOSNARE's claim verification analyst.

CLAIM UNDER INVESTIGATION:
{query}

Below are REAL web results returned by the live research engine. Evaluate them against the exact claim.

{evidence_block}

For each source that materially helps answer the claim, determine:
- claim_relevance: 0-100
- evidence_score: 0-100
- direction: SUPPORTS, CONTRADICTS, or CONTEXT

Important rules:
- Ignore sources that only share generic words or a broad topic.
- A source is useful only when its actual content addresses the same event, entities, allegation, date, place, or factual assertion.
- Prefer independent sources over duplicated syndication.
- Treat official statements and direct primary records as especially useful when they directly address the allegation.
- A fact-check is evidence only when it fact-checks this specific claim or the same factual assertion.
- Repeated reporting is corroboration, not independent proof if it all traces to one source.
- Do not infer that a claim is true or false merely because the search corpus is incomplete.
- Never invent a URL, title, publisher, quotation, date, or fact.

Return ONLY valid JSON in exactly this shape:
{{
  "claim_status": "SUPPORTED|PARTIALLY_SUPPORTED|CONTRADICTED|UNVERIFIED",
  "claim_label": "SUPPORTED|PARTIALLY SUPPORTED|NOT SUPPORTED|NOT YET VERIFIED",
  "claim_confidence": 0,
  "summary": "2-4 concise sentences stating the best-supported conclusion and the strongest evidence.",
  "sources": [
    {{
      "source_number": 1,
      "claim_relevance": 0,
      "evidence_score": 0,
      "direction": "SUPPORTS|CONTRADICTS|CONTEXT",
      "reason": "One concise sentence describing the actual evidence contributed by this source."
    }}
  ]
}}
""".strip()

        response = client.chat.completions.create(
            model=self.analysis_model,
            messages=[
                {
                    "role": "system",
                    "content": "You are a skeptical evidence adjudicator. Base every conclusion on the supplied source text. Do not hallucinate sources or facts.",
                },
                {"role": "user", "content": prompt},
            ],
            response_format={"type": "json_object"},
            temperature=0.1,
            max_tokens=2500,
        )
        payload = self._parse_json(response.choices[0].message.content or "") or {}

        raw_sources = payload.get("sources") if isinstance(payload.get("sources"), list) else []
        evidence: list[dict[str, Any]] = []
        for source in raw_sources:
            if not isinstance(source, dict):
                continue
            try:
                number = int(source.get("source_number", 0))
                relevance = max(0, min(100, int(float(source.get("claim_relevance", 0) or 0))))
                score = max(0, min(100, int(float(source.get("evidence_score", 0) or 0))))
            except (TypeError, ValueError):
                continue
            if number < 1 or number > len(search_results) or relevance < 60 or score < 55:
                continue

            raw = search_results[number - 1]
            direction = str(source.get("direction", "CONTEXT")).upper()
            if direction not in {"SUPPORTS", "CONTRADICTS", "CONTEXT"}:
                direction = "CONTEXT"
            evidence.append(
                {
                    "url": raw["url"],
                    "title": raw.get("title", "Web source"),
                    "publisher": self._publisher(raw.get("url", ""), raw.get("title", "")),
                    "published_at": None,
                    "content": raw.get("content", "")[:3500],
                    "claim_relevance": relevance,
                    "evidence_score": score,
                    "direction": direction,
                    "reason": str(source.get("reason") or ""),
                    "search_score": round(float(raw.get("search_score", 0.0)), 3),
                }
            )

        evidence.sort(key=lambda item: (-item["evidence_score"], -item["claim_relevance"]))
        evidence = evidence[:8]

        confidence = max(0.0, min(1.0, float(payload.get("claim_confidence", 0) or 0) / 100))
        status = self._valid_status(payload.get("claim_status"))
        label = self._valid_label(payload.get("claim_label"))
        summary = str(payload.get("summary") or "").strip()

        supporting = sum(1 for item in evidence if item["direction"] == "SUPPORTS")
        contradicting = sum(1 for item in evidence if item["direction"] == "CONTRADICTS")

        assessment = {
            "status": status,
            "label": label,
            "explanation": summary,
            "confidence": confidence,
            "corroborating_sources": supporting,
            "contradictory_sources": contradicting,
        }

        if evidence:
            evidence_lines = "\n".join(
                f"• {item['publisher']} — {item['title']}"
                for item in evidence[:5]
            )
            combined_summary = f"{summary}\n\nKEY EVIDENCE:\n{evidence_lines}" if summary else f"KEY EVIDENCE:\n{evidence_lines}"
        else:
            combined_summary = summary

        return evidence, assessment, combined_summary

    @staticmethod
    def _parse_json(content: str) -> dict[str, Any] | None:
        try:
            return json.loads(content)
        except json.JSONDecodeError:
            start = content.find("{")
            end = content.rfind("}")
            if start >= 0 and end > start:
                try:
                    return json.loads(content[start : end + 1])
                except json.JSONDecodeError:
                    pass
        return None

    @staticmethod
    def _read(value: Any, key: str, default: Any = None) -> Any:
        if isinstance(value, dict):
            return value.get(key, default)
        return getattr(value, key, default)

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
                results.append(
                    {
                        "url": str(url),
                        "title": str(self._read(result, "title", "")),
                        "content": str(self._read(result, "content", "")),
                        "search_score": float(self._read(result, "score", 0.0) or 0.0),
                    }
                )
        unique: dict[str, dict[str, Any]] = {}
        for result in results:
            unique[result["url"]] = result
        return list(unique.values())

    @staticmethod
    def _publisher(url: str, title: str) -> str:
        host = url.split("//", 1)[-1].split("/", 1)[0]
        if host.startswith("www."):
            host = host[4:]
        if host:
            return host
        return title[:80] or "Web Source"

    @staticmethod
    def _valid_status(value: Any) -> str:
        value = str(value or "UNVERIFIED").upper()
        return value if value in {"SUPPORTED", "PARTIALLY_SUPPORTED", "CONTRADICTED", "UNVERIFIED"} else "UNVERIFIED"

    @staticmethod
    def _valid_label(value: Any) -> str:
        value = str(value or "NOT YET VERIFIED").upper()
        return value if value in {"SUPPORTED", "PARTIALLY SUPPORTED", "NOT SUPPORTED", "NOT YET VERIFIED"} else "NOT YET VERIFIED"
