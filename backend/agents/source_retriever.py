from __future__ import annotations

import hashlib
import logging
import re
import urllib.parse
import urllib.request
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any, List, Optional

try:
    import feedparser
except ImportError:
    feedparser = None

import xml.etree.ElementTree as ET
import requests

from agents.bluesky_ingestion import fetch_bluesky_posts
from agents.fact_checker_ingestion import fetch_live_claims

logger = logging.getLogger(__name__)

REQUEST_TIMEOUT = 10
GOOGLE_NEWS_RSS = "https://news.google.com/rss/search?q={query}&hl=en-IN&gl=IN&ceid=IN:en"
BLUESKY_SEARCH_URL = "https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts"


@dataclass(slots=True)
class EvidenceItem:
    id: str
    source_type: str        # 'web_news' | 'fact_checker' | 'bluesky' | 'user_text' | 'image'
    source_name: str        # e.g., 'Google News', 'AltNews', 'Bluesky', 'User Input'
    source_url: str
    retrieved_at: str
    published_at: Optional[str]
    author: Optional[str]
    title: str
    text: str
    confidence: float
    evidence_type: str      # 'news_article' | 'debunked_claim' | 'social_post' | 'user_text'

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(slots=True)
class SourceStatus:
    source_type: str
    source_name: str
    status: str             # 'completed' | 'limited' | 'unavailable' | 'failed'
    count: int
    duration_ms: int
    warning_or_error: Optional[str] = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(slots=True)
class RetrievalResult:
    query: str
    query_mode: str         # 'topic' | 'text' | 'handle' | 'url' | 'image_url'
    evidence: List[EvidenceItem] = field(default_factory=list)
    source_statuses: List[SourceStatus] = field(default_factory=list)
    total_sources_checked: int = 0
    total_evidence_count: int = 0

    def to_dict(self) -> dict[str, Any]:
        return {
            "query": self.query,
            "query_mode": self.query_mode,
            "evidence": [item.to_dict() for item in self.evidence],
            "source_statuses": [status.to_dict() for status in self.source_statuses],
            "total_sources_checked": self.total_sources_checked,
            "total_evidence_count": self.total_evidence_count,
        }


def _clean_html(raw_html: str) -> str:
    cleaned = re.sub(r"<[^>]+>", "", raw_html or "").strip()
    return " ".join(cleaned.split())


class SourceRetriever:
    """Multi-source evidence retrieval engine with explicit provenance."""

    def retrieve(self, query: str) -> RetrievalResult:
        query_str = query.strip()
        now_iso = datetime.now(timezone.utc).isoformat()
        mode = self.detect_query_mode(query_str)

        evidence: List[EvidenceItem] = []
        statuses: List[SourceStatus] = []

        if mode == "image_url":
            # Image URL processing
            evidence.append(
                EvidenceItem(
                    id=hashlib.md5(query_str.encode()).hexdigest()[:8],
                    source_type="image",
                    source_name="Submitted Image URL",
                    source_url=query_str,
                    retrieved_at=now_iso,
                    published_at=None,
                    author=None,
                    title="Submitted Image Forensic Analysis Target",
                    text=f"Image URL: {query_str}",
                    confidence=1.0,
                    evidence_type="media_file",
                )
            )
            statuses.append(
                SourceStatus(
                    source_type="image",
                    source_name="Direct Image URL",
                    status="completed",
                    count=1,
                    duration_ms=50,
                )
            )
            return RetrievalResult(
                query=query_str,
                query_mode=mode,
                evidence=evidence,
                source_statuses=statuses,
                total_sources_checked=1,
                total_evidence_count=1,
            )

        if mode == "handle":
            # Handle-specific search (Bluesky / Social graph)
            handle = query_str.lstrip("@")
            bs_evidence, bs_status = self._fetch_bluesky_handle_posts(handle, now_iso)
            evidence.extend(bs_evidence)
            statuses.append(bs_status)

            # Fact-check RSS check for handle
            fc_evidence, fc_status = self._fetch_fact_check_matches(handle, now_iso)
            evidence.extend(fc_evidence)
            statuses.append(fc_status)

            return RetrievalResult(
                query=query_str,
                query_mode=mode,
                evidence=evidence,
                source_statuses=statuses,
                total_sources_checked=len(statuses),
                total_evidence_count=len(evidence),
            )

        if mode == "text":
            # User supplied full text block
            evidence.append(
                EvidenceItem(
                    id=hashlib.md5(query_str.encode()).hexdigest()[:8],
                    source_type="user_text",
                    source_name="Supplied Text Input",
                    source_url="user://input",
                    retrieved_at=now_iso,
                    published_at=now_iso,
                    author="Analyst Input",
                    title="Supplied Text Claim",
                    text=query_str,
                    confidence=1.0,
                    evidence_type="user_text",
                )
            )
            statuses.append(
                SourceStatus(
                    source_type="user_text",
                    source_name="Supplied Text Input",
                    status="completed",
                    count=1,
                    duration_ms=5,
                )
            )

            # Cross reference supplied text against fact-check feed
            fc_evidence, fc_status = self._fetch_fact_check_matches(query_str[:150], now_iso)
            evidence.extend(fc_evidence)
            statuses.append(fc_status)

            # Retrieve news if keywords exist
            news_evidence, news_status = self._fetch_google_news(query_str[:100], now_iso)
            evidence.extend(news_evidence)
            statuses.append(news_status)

            return RetrievalResult(
                query=query_str,
                query_mode=mode,
                evidence=evidence,
                source_statuses=statuses,
                total_sources_checked=len(statuses),
                total_evidence_count=len(evidence),
            )

        # Mode == 'topic' or general query
        # 1. Fetch Google News RSS for live topic evidence
        news_evidence, news_status = self._fetch_google_news(query_str, now_iso)
        evidence.extend(news_evidence)
        statuses.append(news_status)

        # 2. Fetch live fact-checker RSS feed matches
        fc_evidence, fc_status = self._fetch_fact_check_matches(query_str, now_iso)
        evidence.extend(fc_evidence)
        statuses.append(fc_status)

        # 3. Search Bluesky social posts
        bs_evidence, bs_status = self._search_bluesky_posts(query_str, now_iso)
        evidence.extend(bs_evidence)
        statuses.append(bs_status)

        # Add explicit unavailable statuses for unsupported platforms so UI is honest
        statuses.append(
            SourceStatus(
                source_type="x_twitter",
                source_name="X / Twitter API",
                status="unavailable",
                count=0,
                duration_ms=0,
                warning_or_error="X API credentials unconfigured / rate-limited",
            )
        )
        statuses.append(
            SourceStatus(
                source_type="reddit",
                source_name="Reddit API",
                status="unavailable",
                count=0,
                duration_ms=0,
                warning_or_error="Reddit API integration unconfigured",
            )
        )

        return RetrievalResult(
            query=query_str,
            query_mode=mode,
            evidence=evidence,
            source_statuses=statuses,
            total_sources_checked=len(statuses),
            total_evidence_count=len(evidence),
        )

    @staticmethod
    def detect_query_mode(query: str) -> str:
        q = query.strip()
        if re.match(r"^https?://\S+\.(png|jpe?g|webp|gif)$", q, re.IGNORECASE):
            return "image_url"
        if re.match(r"^https?://", q, re.IGNORECASE):
            return "url"
        if q.startswith("@") or (len(q.split()) == 1 and "." in q and "bsky" in q):
            return "handle"
        if len(q.split()) > 20 or len(q) > 150:
            return "text"
        return "topic"

    def _fetch_google_news(self, query: str, now_iso: str) -> tuple[List[EvidenceItem], SourceStatus]:
        start = datetime.now()
        encoded = urllib.parse.quote(query)
        url = GOOGLE_NEWS_RSS.format(query=encoded)
        evidence: List[EvidenceItem] = []

        try:
            req = urllib.request.Request(
                url,
                headers={"User-Agent": "EchoSnare/1.0 (+https://echosnare.app)"},
            )
            with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT) as resp:
                raw_data = resp.read()

            items = []
            if feedparser is not None:
                parsed = feedparser.parse(raw_data)
                for entry in parsed.entries[:6]:
                    items.append({
                        "title": _clean_html(entry.get("title", "")),
                        "link": entry.get("link", ""),
                        "pub": entry.get("published", ""),
                        "summary": _clean_html(entry.get("summary", "")),
                        "source": entry.get("source", {}).get("title", "Google News") if isinstance(entry.get("source"), dict) else "Google News",
                    })
            else:
                root = ET.fromstring(raw_data)
                for item in root.findall(".//item")[:6]:
                    title_elem = item.find("title")
                    link_elem = item.find("link")
                    pub_elem = item.find("pubDate")
                    desc_elem = item.find("description")
                    source_elem = item.find("source")
                    items.append({
                        "title": _clean_html(title_elem.text if title_elem is not None else ""),
                        "link": link_elem.text if link_elem is not None else "",
                        "pub": pub_elem.text if pub_elem is not None else "",
                        "summary": _clean_html(desc_elem.text if desc_elem is not None else ""),
                        "source": source_elem.text if source_elem is not None else "Google News",
                    })

            for entry in items:
                title = entry["title"]
                link = entry["link"]
                pub = entry["pub"]
                summary = entry["summary"] or title
                source_name = entry["source"]

                if not title or not link:
                    continue

                evidence.append(
                    EvidenceItem(
                        id=hashlib.md5(link.encode()).hexdigest()[:8],
                        source_type="web_news",
                        source_name=source_name,
                        source_url=link,
                        retrieved_at=now_iso,
                        published_at=pub or now_iso,
                        author=source_name,
                        title=title,
                        text=summary[:350],
                        confidence=0.85,
                        evidence_type="news_article",
                    )
                )

            duration = int((datetime.now() - start).total_seconds() * 1000)
            status_code = "completed" if evidence else "limited"
            warn = None if evidence else "No live news articles found for this query"
            return evidence, SourceStatus("web_news", "Google News Web Search", status_code, len(evidence), duration, warn)

        except Exception as exc:
            duration = int((datetime.now() - start).total_seconds() * 1000)
            logger.warning("Google news fetch failed: %s", exc)
            return [], SourceStatus("web_news", "Google News Web Search", "failed", 0, duration, str(exc))

    def _fetch_fact_check_matches(self, query: str, now_iso: str) -> tuple[List[EvidenceItem], SourceStatus]:
        start = datetime.now()
        evidence: List[EvidenceItem] = []

        try:
            claims = fetch_live_claims()
            query_tokens = {w.lower() for w in query.split() if len(w) > 3 and w.isalpha()}

            for item in claims:
                text_to_match = f"{item.get('title', '')} {item.get('summary', '')}".lower()
                matched_tokens = [t for t in query_tokens if t in text_to_match]

                # Match if 1 major key term or multiple tokens overlap
                if len(matched_tokens) >= 1 or not query_tokens:
                    evidence.append(
                        EvidenceItem(
                            id=item.get("id", hashlib.md5(item.get("url", "").encode()).hexdigest()[:8]),
                            source_type="fact_checker",
                            source_name=item.get("source", "Indian Fact-Checkers"),
                            source_url=item.get("url", ""),
                            retrieved_at=now_iso,
                            published_at=item.get("published") or now_iso,
                            author=item.get("source", "Fact-Checker"),
                            title=item.get("title", ""),
                            text=item.get("summary", ""),
                            confidence=0.92,
                            evidence_type="debunked_claim",
                        )
                    )
                if len(evidence) >= 5:
                    break

            duration = int((datetime.now() - start).total_seconds() * 1000)
            status_code = "completed" if evidence else "limited"
            warn = None if evidence else "No matching debunked claims in live fact-checker RSS feed"
            return evidence, SourceStatus("fact_checker", "Indian Fact-Checker Network", status_code, len(evidence), duration, warn)

        except Exception as exc:
            duration = int((datetime.now() - start).total_seconds() * 1000)
            logger.warning("Fact checker fetch failed: %s", exc)
            return [], SourceStatus("fact_checker", "Indian Fact-Checker Network", "failed", 0, duration, str(exc))

    def _search_bluesky_posts(self, query: str, now_iso: str) -> tuple[List[EvidenceItem], SourceStatus]:
        start = datetime.now()
        evidence: List[EvidenceItem] = []

        try:
            resp = requests.get(
                BLUESKY_SEARCH_URL,
                params={"q": query, "limit": 10},
                timeout=REQUEST_TIMEOUT,
            )
            if resp.status_code == 200:
                posts = resp.json().get("posts", [])
                for p in posts:
                    text = p.get("record", {}).get("text", "")
                    author = p.get("author", {}).get("handle", "bluesky_user")
                    uri = p.get("uri", "")
                    created = p.get("record", {}).get("createdAt", now_iso)
                    if text:
                        evidence.append(
                            EvidenceItem(
                                id=hashlib.md5(uri.encode()).hexdigest()[:8],
                                source_type="bluesky",
                                source_name="Bluesky Social",
                                source_url=f"https://bsky.app/profile/{author}",
                                retrieved_at=now_iso,
                                published_at=created,
                                author=f"@{author}",
                                title=f"Post by @{author}",
                                text=text[:300],
                                confidence=0.75,
                                evidence_type="social_post",
                            )
                        )

            duration = int((datetime.now() - start).total_seconds() * 1000)
            status_code = "completed" if evidence else "limited"
            warn = None if evidence else "No matching social posts on Bluesky public feed"
            return evidence, SourceStatus("bluesky", "Bluesky Public Network", status_code, len(evidence), duration, warn)

        except Exception as exc:
            duration = int((datetime.now() - start).total_seconds() * 1000)
            logger.warning("Bluesky search failed: %s", exc)
            return [], SourceStatus("bluesky", "Bluesky Public Network", "failed", 0, duration, str(exc))

    def _fetch_bluesky_handle_posts(self, handle: str, now_iso: str) -> tuple[List[EvidenceItem], SourceStatus]:
        start = datetime.now()
        evidence: List[EvidenceItem] = []

        try:
            posts = fetch_bluesky_posts(handle)
            for p in posts:
                evidence.append(
                    EvidenceItem(
                        id=p.get("id", hashlib.md5(p.get("text", "").encode()).hexdigest()[:8]),
                        source_type="bluesky",
                        source_name="Bluesky Account Posts",
                        source_url=f"https://bsky.app/profile/{handle}",
                        retrieved_at=now_iso,
                        published_at=now_iso,
                        author=f"@{handle}",
                        title=f"Original post by @{handle}",
                        text=p.get("text", ""),
                        confidence=0.90,
                        evidence_type="social_post",
                    )
                )

            duration = int((datetime.now() - start).total_seconds() * 1000)
            status_code = "completed" if evidence else "limited"
            warn = None if evidence else f"No recent original posts retrieved for @{handle}"
            return evidence, SourceStatus("bluesky", f"Bluesky Handle (@{handle})", status_code, len(evidence), duration, warn)

        except Exception as exc:
            duration = int((datetime.now() - start).total_seconds() * 1000)
            logger.warning("Bluesky handle fetch failed: %s", exc)
            return [], SourceStatus("bluesky", f"Bluesky Handle (@{handle})", "failed", 0, duration, str(exc))
