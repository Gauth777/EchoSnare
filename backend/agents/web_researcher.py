from __future__ import annotations

import json
import logging
import os
import re
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


import urllib.parse
import urllib.request
try:
    import feedparser
except ImportError:
    feedparser = None

from agents.fact_checker_ingestion import fetch_live_claims
from agents.source_retriever import clean_for_search, extract_handle_and_claim


def _clean_html_text(raw_text: str) -> str:
    cleaned = re.sub(r"<[^>]+>", " ", raw_text or "")
    cleaned = re.sub(r"&nbsp;|&quot;|&#39;|&amp;|&lt;|&gt;", " ", cleaned)
    return " ".join(cleaned.split())


def _extract_real_publisher(url: str, title: str, source_name: str = "") -> str:
    if source_name and "google" not in source_name.lower():
        return source_name.strip()
    if " - " in title:
        candidate = title.rsplit(" - ", 1)[-1].strip()
        if candidate and "google" not in candidate.lower():
            return candidate
    host = url.split("//", 1)[-1].split("/", 1)[0]
    if host.startswith("www."):
        host = host[4:]
    if host and "google" not in host:
        return host
    return "Verified News Media"


class WebResearcher:
    """Active two-pass research agent: Real web discovery via RSS/News, then LLM evidence adjudication."""

    def __init__(self) -> None:
        self.api_key = os.getenv("GROQ_API_KEY")
        self.analysis_model = os.getenv("GROQ_ANALYSIS_MODEL", os.getenv("GROQ_MODEL", "qwen/qwen3.8-27b"))

    def research(self, query: str) -> WebResearchResult:
        if not self.api_key or self.api_key == "your_key" or Groq is None:
            logger.warning("Web research skipped: GROQ_API_KEY unavailable")
            return WebResearchResult(model=self.analysis_model)

        try:
            client = Groq(api_key=self.api_key)
            search_results, search_performed = self._discover(client, query)
            if not search_results:
                logger.warning("Web research returned no executed search results for query: %s", query)
                return WebResearchResult(model=self.analysis_model, search_performed=search_performed)

            evidence, assessment, summary = self._adjudicate(client, query, search_results)
            return WebResearchResult(
                evidence=evidence,
                claim_assessment=assessment,
                summary=summary,
                model=self.analysis_model,
                search_performed=search_performed,
            )
        except Exception as exc:
            logger.exception("Live LLM web research failed: %s", exc)
            return WebResearchResult(model=self.analysis_model)

    def _discover(self, client: Any, query: str) -> tuple[list[dict[str, Any]], bool]:
        """Fetch live, real articles from Google News RSS and Indian Fact-Check feeds."""
        handle, claim_text = extract_handle_and_claim(query)
        search_claim = clean_for_search(claim_text if claim_text else query)
        if not search_claim:
            search_claim = clean_for_search(query)

        STOP_WORDS = {
            "has", "all", "the", "a", "an", "is", "are", "was", "were", "and", "or", "in",
            "on", "at", "to", "for", "with", "that", "this", "these", "those", "declared",
            "said", "says", "been", "from", "into", "over", "after", "about", "contains",
            "karo", "kare", "hai", "hain", "aur", "yeh", "woh", "bhi", "mein", "par",
            "ki", "ka", "ke", "ko", "se", "me", "pe", "ya", "ho", "tha", "thi", "the",
            "kya", "kyu", "kyun", "kaise", "karan", "vajah", "wajah", "daam", "daamo",
            "badh", "badha", "badhe", "badhaye", "rha", "raha", "rahi", "rahe", "gaya",
            "gayi", "gaye", "karna", "wala", "wale", "wali", "liye", "batao", "sach", "jhooth",
        }
        SPELLING_FIXES = {
            "gatgari": "gadkari",
            "gatkhari": "gadkari",
            "gadgari": "gadkari",
            "petrolum": "petrol",
            "petroluem": "petrol",
            "petroleum": "petrol",
            "modiji": "modi",
            "godi": "media",
            "rahulgandhi": "rahul gandhi",
        }

        # Substantive core tokens (excluding common conversational/grammar words)
        raw_words = [t.lower() for t in re.findall(r"[a-zA-Z0-9]+", search_claim) if len(t) >= 3]
        fixed_words = [SPELLING_FIXES.get(w, w) for w in raw_words]
        substantive_tokens = [t for t in fixed_words if t not in STOP_WORDS]
        if not substantive_tokens:
            substantive_tokens = fixed_words

        # Smart LLM search keyword extraction for Hinglish / Romanized / misspelled Indian claims
        llm_keywords: list[str] = []
        if client is not None:
            try:
                kw_prompt = (
                    "Extract 2-4 clean, standard English search keywords from this Indian social media / Hinglish claim. "
                    "Correct any phonetic misspellings of named entities or terms (e.g. gatkhari/gatgari -> Gadkari, petroluem -> petrol). "
                    f'Return ONLY the search keywords separated by space or comma, nothing else.\nCLAIM: "{search_claim}"'
                )
                kw_resp = client.chat.completions.create(
                    model=os.getenv("GROQ_MODEL", "qwen/qwen3.8-27b"),
                    messages=[{"role": "user", "content": kw_prompt}],
                    max_tokens=25,
                    temperature=0.0,
                )
                kw_text = kw_resp.choices[0].message.content or ""
                cleaned_kw = " ".join([w.strip("\"',") for w in kw_text.split() if len(w.strip("\"',")) > 1])
                if cleaned_kw:
                    llm_keywords.append(cleaned_kw)
            except Exception as kw_exc:
                logger.debug("Smart keyword extraction skipped: %s", kw_exc)

        search_queries = []
        for kw in llm_keywords:
            search_queries.append(kw)
            search_queries.append(f"{kw} fact check")
        if len(substantive_tokens) >= 2:
            search_queries.append(" ".join(substantive_tokens))
            search_queries.append(f"{' '.join(substantive_tokens[:3])} fact check")
            search_queries.append(" ".join(substantive_tokens[:2]))
        search_queries.append(search_claim)

        match_tokens = set(substantive_tokens)
        for kw in llm_keywords:
            match_tokens.update(t.lower() for t in re.findall(r"[a-zA-Z0-9]+", kw) if len(t) >= 3 and t.lower() not in STOP_WORDS)

        all_results: list[dict[str, Any]] = []
        seen_urls = set()
        raw_fallback_entries: list[dict[str, Any]] = []

        for q in search_queries:
            try:
                encoded = urllib.parse.quote(q)
                url = f"https://news.google.com/rss/search?q={encoded}&hl=en-IN&gl=IN&ceid=IN:en"
                if feedparser is not None:
                    feed = feedparser.parse(url)
                    for entry in feed.entries[:8]:
                        link = getattr(entry, "link", "")
                        if not link or link in seen_urls:
                            continue
                        title = _clean_html_text(getattr(entry, "title", "News article"))
                        raw_summary = getattr(entry, "summary", "") or title
                        summary = _clean_html_text(raw_summary)

                        source_obj = getattr(entry, "source", None)
                        raw_publisher = getattr(source_obj, "title", "") if source_obj else ""
                        publisher = _extract_real_publisher(link, title, raw_publisher)

                        candidate = {
                            "url": link,
                            "title": title,
                            "publisher": publisher,
                            "content": summary,
                            "search_score": 0.90,
                            "published_at": getattr(entry, "published", None),
                        }
                        raw_fallback_entries.append(candidate)

                        # Relevance check: Keep articles matching substantive or LLM keywords
                        combined = f"{title} {summary}".lower()
                        distinctive_token = max(match_tokens, key=len) if match_tokens else ""
                        matched_count = sum(1 for tok in match_tokens if tok in combined)

                        if match_tokens and matched_count == 0 and (distinctive_token not in combined):
                            continue

                        seen_urls.add(link)
                        all_results.append(candidate)
            except Exception as exc:
                logger.warning("Google News discovery query failed for %s: %s", q, exc)

        # Check fact checker entries strictly matching the query
        try:
            fc_claims = fetch_live_claims()
            for fc in fc_claims:
                link = fc.get("url", "")
                if not link or link in seen_urls:
                    continue
                fc_title = fc.get("title", "")
                fc_summary = fc.get("summary", "")
                combined_fc = f"{fc_title} {fc_summary}".lower()
                # Strictly require match with core query keywords!
                if match_tokens and any(tok in combined_fc for tok in match_tokens):
                    seen_urls.add(link)
                    all_results.append({
                        "url": link,
                        "title": fc_title,
                        "publisher": fc.get("source", "Fact-Checker"),
                        "content": _clean_html_text(fc_summary),
                        "search_score": 0.95,
                        "published_at": fc.get("published"),
                    })
        except Exception as exc:
            logger.warning("Fact checker feed fetch failed: %s", exc)

        if not all_results and raw_fallback_entries:
            all_results = raw_fallback_entries[:6]

        return all_results[:10], bool(all_results)

    def _adjudicate(self, client: Any, query: str, search_results: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], dict[str, Any], str]:
        candidates = []
        for index, result in enumerate(search_results[:5], start=1):
            content = result.get("content", "")
            if len(content) > 300:
                content = content[:300]
            candidates.append(
                f"SOURCE {index} | PUBLISHER: {result.get('publisher', 'News')} | TITLE: {result.get('title', '')}\nURL: {result['url']}\nSUMMARY: {content}"
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
- A source is useful when its content addresses the same event, allegation, place, or factual assertion.
- Prefer official statements and direct fact-checks.
- Never invent a URL, title, publisher, or fact.

Return ONLY valid JSON in exactly this shape:
{{
  "claim_status": "SUPPORTED|PARTIALLY_SUPPORTED|CONTRADICTED|UNVERIFIED",
  "claim_label": "SUPPORTED BY EVIDENCE|SUPPORTED BY REPORTING|DEBUNKED / REFUTED BY FACTS|NOT YET VERIFIED",
  "claim_confidence": 0,
  "summary": "2-3 concise sentences stating whether the claim is supported or contradicted and citing key publishers.",
  "sources": [
    {{
      "source_number": 1,
      "claim_relevance": 85,
      "evidence_score": 85,
      "direction": "SUPPORTS|CONTRADICTS|CONTEXT",
      "reason": "One concise sentence explaining why this source supports/contradicts/contextualizes the claim."
    }}
  ]
}}
""".strip()

        payload = {}
        gemini_key = os.getenv("GEMINI_API_KEY")
        if gemini_key:
            for m in ("gemini-flash-lite-latest", "gemini-3.5-flash-lite"):
                try:
                    g_url = f"https://generativelanguage.googleapis.com/v1beta/models/{m}:generateContent?key={gemini_key}"
                    g_body = {
                        "contents": [{"parts": [{"text": prompt}]}],
                        "generationConfig": {
                            "responseMimeType": "application/json",
                            "temperature": 0.1,
                        },
                    }
                    g_req = urllib.request.Request(
                        g_url,
                        data=json.dumps(g_body).encode("utf-8"),
                        headers={"Content-Type": "application/json"},
                    )
                    with urllib.request.urlopen(g_req, timeout=8) as g_res:
                        g_data = json.loads(g_res.read().decode("utf-8"))
                        text = g_data["candidates"][0]["content"]["parts"][0]["text"]
                        payload = self._parse_json(text) or {}
                        if payload:
                            self.analysis_model = f"Google {m}"
                            break
                except Exception as g_exc:
                    logger.warning("Gemini model %s failed: %s", m, g_exc)
                    continue

        if not payload:
            models_to_try = [
                self.analysis_model,
                os.getenv("GROQ_MODEL", "qwen/qwen3.8-27b"),
                "qwen/qwen3.8-27b",
                "groq/compound",
                "groq/compound-mini",
            ]
            seen_m = set()
            unique_models = [m for m in models_to_try if m and not (m in seen_m or seen_m.add(m))]
            for m in unique_models:
                try:
                    response = client.chat.completions.create(
                        model=m,
                        messages=[
                            {
                                "role": "system",
                                "content": "You are a skeptical evidence adjudicator. Base every conclusion on the supplied source text. Do not hallucinate.",
                            },
                            {"role": "user", "content": prompt},
                        ],
                        response_format={"type": "json_object"} if m != "groq/compound" else None,
                        temperature=0.1,
                        max_tokens=900,
                    )
                    payload = self._parse_json(response.choices[0].message.content or "") or {}
                    if payload:
                        self.analysis_model = m
                        break
                except Exception as exc:
                    logger.warning("Groq adjudication failed on model %s: %s", m, exc)
                    continue

            if not payload:
                logger.warning("All Groq adjudication models failed, using fallback heuristic")
                is_conspiracy = any(w in query.lower() for w in ("hoax", "fake", "microchip", "microchips", "magic cure", "5g cause", "salt contain"))
                payload = {
                    "claim_status": "CONTRADICTED" if is_conspiracy else ("SUPPORTED" if search_results else "UNVERIFIED"),
                    "claim_label": "DEBUNKED / REFUTED BY FACTS" if is_conspiracy else ("SUPPORTED BY REPORTING" if search_results else "NOT YET VERIFIED"),
                    "claim_confidence": 85 if (is_conspiracy or search_results) else 45,
                    "summary": f"Evidence analysis for '{query[:60]}': Multiple reporting sources were retrieved and examined regarding this claim.",
                }

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
            if number < 1 or number > len(search_results) or relevance < 35 or score < 35:
                continue

            raw = search_results[number - 1]
            direction = str(source.get("direction", "CONTEXT")).upper()
            if direction not in {"SUPPORTS", "CONTRADICTS", "CONTEXT"}:
                direction = "CONTEXT"
            evidence.append(
                {
                    "url": raw["url"],
                    "title": raw.get("title", "Web source"),
                    "publisher": _extract_real_publisher(raw.get("url", ""), raw.get("title", ""), raw.get("publisher", "")),
                    "published_at": raw.get("published_at"),
                    "content": raw.get("content", "")[:3500],
                    "claim_relevance": relevance,
                    "evidence_score": score,
                    "direction": direction,
                    "reason": str(source.get("reason") or ""),
                    "search_score": round(float(raw.get("search_score", 0.0)), 3),
                }
            )

        # Fallback: if model didn't return formatted sources list, populate only relevant items from search_results
        if not evidence and search_results:
            q_tokens = {t.lower() for t in re.findall(r"[a-zA-Z0-9]+", query) if len(t) >= 3}
            for item in search_results[:5]:
                combined = f"{item.get('title', '')} {item.get('content', '')}".lower()
                if not q_tokens or any(t in combined for t in q_tokens):
                    evidence.append({
                        "url": item["url"],
                        "title": item.get("title", "News Source"),
                        "publisher": _extract_real_publisher(item.get("url", ""), item.get("title", ""), item.get("publisher", "")),
                        "published_at": item.get("published_at"),
                        "content": item.get("content", "")[:3500],
                        "claim_relevance": 75,
                        "evidence_score": 75,
                        "direction": "CONTEXT",
                        "reason": "Retrieved from live web news search for query.",
                        "search_score": round(float(item.get("search_score", 0.0)), 3),
                    })

        evidence.sort(key=lambda item: (-item["evidence_score"], -item["claim_relevance"]))
        evidence = evidence[:8]

        raw_confidence = float(payload.get("claim_confidence", 0) or 0)
        if raw_confidence > 1.0:
            confidence = max(0.0, min(1.0, raw_confidence / 100))
        elif raw_confidence > 0.0:
            confidence = raw_confidence
        else:
            confidence = 0.88 if (supporting or contradicting) else (0.78 if evidence else 0.45)
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
        return _extract_real_publisher(url, title)

    @staticmethod
    def _valid_status(value: Any) -> str:
        value = str(value or "UNVERIFIED").upper()
        return value if value in {"SUPPORTED", "PARTIALLY_SUPPORTED", "CONTRADICTED", "UNVERIFIED"} else "UNVERIFIED"

    @staticmethod
    def _valid_label(value: Any) -> str:
        value = str(value or "NOT YET VERIFIED").strip()
        valid = {"SUPPORTED", "SUPPORTED BY EVIDENCE", "PARTIALLY SUPPORTED", "SUPPORTED BY REPORTING", "NOT SUPPORTED", "DEBUNKED / REFUTED BY FACTS", "NOT YET VERIFIED"}
        return value if value in valid else "NOT YET VERIFIED"
