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


_STOPWORDS = {
    "this", "that", "with", "have", "will", "from", "your", "before", "after",
    "been", "were", "they", "them", "their", "there", "about", "would", "could",
    "should", "into", "over", "than", "then", "what", "when", "where", "which",
    "while", "because", "also", "just", "very", "more", "some", "such", "only",
    "does", "done", "said", "says", "news", "post", "posts", "claim", "claims",
    "fact", "check", "checking", "report", "reports", "reported", "india", "indian",
}


def _tokens(text: str) -> set[str]:
    return {
        token
        for token in re.findall(r"[a-zA-Z0-9]+", (text or "").lower())
        if len(token) > 2 and token not in _STOPWORDS
    }


def _is_relevant(query: str, item_text: str) -> tuple[bool, float]:
    """Keep only evidence with a meaningful topical/entity overlap."""
    clean_q = clean_for_search(query)
    query_tokens = _tokens(clean_q) if clean_q else _tokens(query)
    item_tokens = _tokens(item_text)
    if not query_tokens or not item_tokens:
        return False, 0.0

    overlap = query_tokens & item_tokens
    if not overlap:
        return False, 0.0

    # Handles are strong entity anchors.
    query_handles = {h.lower() for h in re.findall(r"@[A-Za-z0-9_.]+", query)}
    item_handles = {h.lower() for h in re.findall(r"@[A-Za-z0-9_.]+", item_text)}
    if query_handles & item_handles:
        return True, 1.0

    # Prevent generic one-word matches from becoming evidence.
    strong_overlap = {t for t in overlap if len(t) >= 3 or t.isdigit()}
    overlap_count = len(overlap)
    coverage = overlap_count / max(1, len(query_tokens))

    if len(query_tokens) <= 3:
        keep = len(strong_overlap) >= 1
    else:
        keep = len(strong_overlap) >= 2 or coverage >= 0.25

    if not keep:
        return False, 0.0

    score = min(1.0, (coverage * 0.7) + (min(1.0, len(strong_overlap) / 3) * 0.3))
    return True, round(score, 3)


def extract_handle_and_claim(query: str) -> tuple[Optional[str], str]:
    """
    Extract handle if query is in '@handle: claim' or '@handle claim' format,
    and return (handle, claim_text).
    """
    q = query.strip()
    m = re.match(r"^@([A-Za-z0-9_.]+)(?::\s*|\s+)(.+)$", q, re.DOTALL)
    if m:
        return m.group(1).strip(), m.group(2).strip()
    if q.startswith("@") and len(q.split()) == 1:
        return q.lstrip("@").strip(), ""
    return None, q


_CONVERSATIONAL_WORDS = {
    "kuch", "seen", "scene", "hai", "kya", "like", "they", "are", "aur", "ka", "ki", "ke",
    "ko", "se", "me", "par", "bhi", "tha", "thi", "the", "batao", "sach", "jhooth",
    "bhai", "bro", "chal", "raha", "rahi", "bolo", "tell", "show", "check", "verify",
    "anyone", "know", "rumor", "rumors", "about", "this", "that", "kisi", "pata",
    "karan", "vajah", "wajah", "daam", "daamo", "badh", "badha", "badhe", "rha", "rahe",
}

_SPELLING_FIXES = {
    "gatgari": "gadkari",
    "petrolum": "petrol",
    "modiji": "modi",
    "godi": "media",
}


def clean_for_search(text: str) -> str:
    """Strip handles, hashtags, conversational filler, and punctuation to produce high-precision search keywords."""
    cleaned = re.sub(r"@[A-Za-z0-9_.]+", " ", text)
    cleaned = re.sub(r"#[A-Za-z0-9_]+", " ", cleaned)
    cleaned = re.sub(r"[?!:\"\'\(\)\[\]\{\}/\\.,;]", " ", cleaned)
    tokens = []
    for w in cleaned.split():
        fixed = _SPELLING_FIXES.get(w.lower(), w.lower())
        if fixed not in _CONVERSATIONAL_WORDS and len(fixed) > 1:
            tokens.append(fixed)
    if not tokens:
        tokens = cleaned.split()
    return " ".join(tokens)


class SourceRetriever:
    """Multi-source evidence retrieval engine with explicit provenance."""

    def retrieve(self, query: str) -> RetrievalResult:
        query_str = query.strip()
        now_iso = datetime.now(timezone.utc).isoformat()
        handle, claim_text = extract_handle_and_claim(query_str)
        search_query = clean_for_search(claim_text if claim_text else query_str)
        mode = self.detect_query_mode(query_str)

        evidence: List[EvidenceItem] = []
        statuses: List[SourceStatus] = []

        if mode == "image_url":
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
            statuses.append(SourceStatus("image", "Direct Image URL", "completed", 1, 50))
            return RetrievalResult(query_str, mode, evidence, statuses, 1, 1)

        if mode == "handle" and not claim_text:
            target_handle = handle or query_str.lstrip("@").rstrip(":,;")
            bs_evidence, bs_status = self._fetch_bluesky_handle_posts(target_handle, now_iso)
            evidence.extend(bs_evidence)
            statuses.append(bs_status)

            fc_evidence, fc_status = self._fetch_fact_check_matches(query_str, now_iso)
            evidence.extend(fc_evidence)
            statuses.append(fc_status)

            return RetrievalResult(query_str, mode, evidence, statuses, len(statuses), len(evidence))

        # Always include the user query as supplied text input
        evidence.append(
            EvidenceItem(
                id=hashlib.md5(query_str.encode()).hexdigest()[:8],
                source_type="user_text",
                source_name="Supplied Text Input",
                source_url="user://input",
                retrieved_at=now_iso,
                published_at=now_iso,
                author=f"@{handle}" if handle else "Analyst Input",
                title="Supplied Text Claim",
                text=query_str,
                confidence=1.0,
                evidence_type="user_text",
            )
        )
        statuses.append(SourceStatus("user_text", "Supplied Query Input", "completed", 1, 5))

        # Query Google News with cleaned claim text
        news_query = search_query[:120] if search_query else query_str[:120]
        news_evidence, news_status = self._fetch_google_news(news_query, now_iso)
        evidence.extend(news_evidence)
        statuses.append(news_status)

        # Query Fact Checkers with cleaned claim text
        fc_evidence, fc_status = self._fetch_fact_check_matches(news_query, now_iso)
        evidence.extend(fc_evidence)
        statuses.append(fc_status)

        # Query Public Social Chatter (Reddit / X / Bluesky) for real accounts
        social_evidence, social_status = self._fetch_social_leads(news_query, now_iso)
        evidence.extend(social_evidence)
        statuses.append(social_status)

        # If explicit handle was supplied, also check Bluesky API for it
        if handle:
            bs_evidence, bs_status = self._fetch_bluesky_handle_posts(handle, now_iso)
            evidence.extend(bs_evidence)
            statuses.append(bs_status)

        return RetrievalResult(query_str, mode, evidence, statuses, len(statuses), len(evidence))

    @staticmethod
    def detect_query_mode(query: str) -> str:
        q = query.strip()
        if re.match(r"^https?://\S+\.(png|jpe?g|webp|gif)$", q, re.IGNORECASE):
            return "image_url"
        if re.match(r"^https?://", q, re.IGNORECASE):
            return "url"
        handle, claim = extract_handle_and_claim(q)
        if handle and not claim:
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
            req = urllib.request.Request(url, headers={"User-Agent": "EchoSnare/1.0 (+https://echosnare.app)"})
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

                is_match, relevance = _is_relevant(query, f"{title} {summary}")
                if not is_match:
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
                        confidence=max(0.65, min(0.95, 0.65 + relevance * 0.30)),
                        evidence_type="news_article",
                    )
                )

            duration = int((datetime.now() - start).total_seconds() * 1000)
            status_code = "completed" if evidence else "limited"
            warn = None if evidence else "No relevant live news articles found for this query"
            return evidence, SourceStatus("web_news", "Google News Web Search", status_code, len(evidence), duration, warn)

        except Exception as exc:
            duration = int((datetime.now() - start).total_seconds() * 1000)
            logger.warning("Google news fetch failed: %s", exc)
            return [], SourceStatus("web_news", "Google News Web Search", "failed", 0, duration, str(exc))

    def _fetch_social_leads(self, query: str, now_iso: str) -> tuple[List[EvidenceItem], SourceStatus]:
        """Fetch real social media chatter and threads from Reddit & X/Twitter."""
        start = datetime.now()
        evidence: List[EvidenceItem] = []
        try:
            clean_q = clean_for_search(query)
            encoded = urllib.parse.quote(f"site:reddit.com OR site:x.com {clean_q}")
            url = GOOGLE_NEWS_RSS.format(query=encoded)
            req = urllib.request.Request(url, headers={"User-Agent": "EchoSnare/1.0 (+https://echosnare.app)"})
            with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT) as resp:
                raw_data = resp.read()
            if feedparser is not None:
                feed = feedparser.parse(raw_data)
                for entry in feed.entries[:5]:
                    title = _clean_html(getattr(entry, "title", ""))
                    link = getattr(entry, "link", "")
                    summary = _clean_html(getattr(entry, "summary", "")) or title
                    if not title or not link:
                        continue
                    platform = "Reddit" if "reddit" in link.lower() or "reddit" in title.lower() else "X"
                    author_match = re.search(r"(@[A-Za-z0-9_]+|u/[A-Za-z0-9_]+|r/[A-Za-z0-9_]+)", title)
                    author = author_match.group(1) if author_match else f"{platform} Community"
                    evidence.append(
                        EvidenceItem(
                            id=hashlib.md5(link.encode()).hexdigest()[:8],
                            source_type="bluesky",
                            source_name=f"{platform} Public Chatter",
                            source_url=link,
                            retrieved_at=now_iso,
                            published_at=getattr(entry, "published", now_iso),
                            author=author,
                            title=title,
                            text=summary[:350],
                            confidence=0.82,
                            evidence_type="social_post",
                        )
                    )
            duration = int((datetime.now() - start).total_seconds() * 1000)
            status_code = "completed" if evidence else "limited"
            return evidence, SourceStatus("bluesky", "Public Social Chatter (Reddit / X)", status_code, len(evidence), duration)
        except Exception as exc:
            duration = int((datetime.now() - start).total_seconds() * 1000)
            return [], SourceStatus("bluesky", "Public Social Chatter (Reddit / X)", "limited", 0, duration, str(exc))

    def _fetch_fact_check_matches(self, query: str, now_iso: str) -> tuple[List[EvidenceItem], SourceStatus]:
        start = datetime.now()
        evidence: List[EvidenceItem] = []

        try:
            claims = fetch_live_claims()
            scored: list[tuple[float, dict[str, Any]]] = []

            for item in claims:
                title = item.get("title", "")
                summary = item.get("summary", "")
                is_match, relevance = _is_relevant(query, f"{title} {summary}")
                if not is_match:
                    continue
                scored.append((relevance, item))

            scored.sort(key=lambda row: row[0], reverse=True)
            for relevance, item in scored[:5]:
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
                        confidence=max(0.75, min(0.97, 0.75 + relevance * 0.22)),
                        evidence_type="debunked_claim",
                    )
                )

            duration = int((datetime.now() - start).total_seconds() * 1000)
            status_code = "completed" if evidence else "limited"
            warn = None if evidence else "No relevant fact-check claims found in live feeds"
            return evidence, SourceStatus("fact_checker", "Indian Fact-Checker Network", status_code, len(evidence), duration, warn)

        except Exception as exc:
            duration = int((datetime.now() - start).total_seconds() * 1000)
            logger.warning("Fact checker fetch failed: %s", exc)
            return [], SourceStatus("fact_checker", "Indian Fact-Checker Network", "failed", 0, duration, str(exc))

    def _search_bluesky_posts(self, query: str, now_iso: str) -> tuple[List[EvidenceItem], SourceStatus]:
        start = datetime.now()
        evidence: List[EvidenceItem] = []

        try:
            resp = requests.get(BLUESKY_SEARCH_URL, params={"q": query, "limit": 10}, timeout=REQUEST_TIMEOUT)
            if resp.status_code == 200:
                posts = resp.json().get("posts", [])
                for p in posts:
                    text = p.get("record", {}).get("text", "")
                    author = p.get("author", {}).get("handle", "bluesky_user")
                    uri = p.get("uri", "")
                    created = p.get("record", {}).get("createdAt", now_iso)
                    if not text:
                        continue
                    is_match, relevance = _is_relevant(query, text)
                    if not is_match:
                        continue
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
                            confidence=max(0.60, min(0.90, 0.60 + relevance * 0.30)),
                            evidence_type="social_post",
                        )
                    )

            duration = int((datetime.now() - start).total_seconds() * 1000)
            status_code = "completed" if evidence else "limited"
            warn = None if evidence else "No relevant social posts on Bluesky public feed"
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
