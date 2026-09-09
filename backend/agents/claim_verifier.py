from __future__ import annotations

import re
from dataclasses import dataclass, asdict
from typing import Any, Iterable


_STOPWORDS = {
    "this", "that", "with", "have", "will", "from", "your", "before", "after",
    "been", "were", "they", "them", "their", "there", "about", "would", "could",
    "should", "into", "over", "than", "then", "what", "when", "where", "which",
    "while", "because", "also", "just", "very", "more", "some", "such", "only",
    "does", "done", "were", "said", "says", "news", "post", "posts", "claim",
}


@dataclass(slots=True)
class SourceAssessment:
    label: str
    role: str
    explanation: str

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(slots=True)
class ClaimAssessment:
    status: str
    label: str
    explanation: str
    confidence: float
    corroborating_sources: int
    contradictory_sources: int

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def _get(item: Any, key: str, default: Any = "") -> Any:
    if isinstance(item, dict):
        return item.get(key, default)
    return getattr(item, key, default)


def _tokens(text: str) -> set[str]:
    words = re.findall(r"[a-zA-Z0-9]+", (text or "").lower())
    return {word for word in words if len(word) > 3 and word not in _STOPWORDS}


def _overlap(query: str, item_text: str) -> int:
    return len(_tokens(query) & _tokens(item_text))


def assess_source(item: Any) -> SourceAssessment:
    source_type = str(_get(item, "source_type", "") or "")
    source_name = str(_get(item, "source_name", "") or "")

    if source_type == "fact_checker":
        return SourceAssessment(
            label="VERIFIED FACT-CHECK",
            role="verification",
            explanation=f"Fact-check evidence from {source_name or 'a fact-checking source'} directly addresses disputed claims.",
        )
    if source_type == "web_news":
        return SourceAssessment(
            label="REPORTING SOURCE",
            role="reporting",
            explanation=f"This is a news report from {source_name or 'a news outlet'}; it is evidence about the event, not by itself proof that the claim is true.",
        )
    if source_type == "bluesky":
        return SourceAssessment(
            label="SOCIAL LEAD",
            role="social",
            explanation="A Bluesky post is treated as a lead or observation, not as independent verification.",
        )
    if source_type == "user_text":
        return SourceAssessment(
            label="SUBMITTED INPUT",
            role="input",
            explanation="This is the statement supplied for investigation and is not an independent source.",
        )
    return SourceAssessment(
        label="REFERENCE MATERIAL",
        role="reference",
        explanation="Retrieved reference material; source authority is not independently established by ECHOSNARE.",
    )


def assess_claim(query: str, evidence: Iterable[Any]) -> ClaimAssessment:
    items = list(evidence)
    fact_checks = []
    news_matches = []

    for item in items:
        text = " ".join(str(_get(item, attr, "") or "") for attr in ("title", "text"))
        overlap = _overlap(query, text)
        source_type = str(_get(item, "source_type", "") or "")
        if source_type == "fact_checker" and overlap >= 2:
            fact_checks.append(item)
        elif source_type == "web_news" and overlap >= 2:
            news_matches.append(item)

    if fact_checks:
        confidence = min(0.97, 0.78 + 0.06 * min(len(fact_checks), 3))
        return ClaimAssessment(
            status="CONTRADICTED",
            label="NOT SUPPORTED",
            explanation=f"Retrieved fact-check evidence directly contradicts or debunks the investigated statement ({len(fact_checks)} matching fact-check source{'s' if len(fact_checks) != 1 else ''}).",
            confidence=round(confidence, 2),
            corroborating_sources=0,
            contradictory_sources=len(fact_checks),
        )

    distinct_news_sources = {str(_get(item, "source_name", "")) for item in news_matches if _get(item, "source_name", None)}
    if len(distinct_news_sources) >= 2:
        confidence = min(0.86, 0.62 + 0.06 * min(len(distinct_news_sources), 4))
        return ClaimAssessment(
            status="PARTIALLY_SUPPORTED",
            label="SUPPORTED BY REPORTING",
            explanation=f"Multiple independent news sources report material consistent with the statement ({len(distinct_news_sources)} reporting sources), but reporting alone does not establish every detail as true.",
            confidence=round(confidence, 2),
            corroborating_sources=len(distinct_news_sources),
            contradictory_sources=0,
        )

    return ClaimAssessment(
        status="UNVERIFIED",
        label="NOT YET VERIFIED",
        explanation="No sufficiently direct, independent verification or contradiction was found in the retrieved evidence.",
        confidence=0.45 if items else 0.30,
        corroborating_sources=0,
        contradictory_sources=0,
    )


def enrich_evidence(items: Iterable[Any]) -> list[dict[str, Any]]:
    enriched: list[dict[str, Any]] = []
    for item in items:
        payload = item.to_dict() if hasattr(item, "to_dict") else dict(item)
        payload["source_assessment"] = assess_source(item).to_dict()
        enriched.append(payload)
    return enriched
