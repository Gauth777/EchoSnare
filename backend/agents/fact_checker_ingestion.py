from __future__ import annotations

import hashlib
import re
import urllib.request
from typing import Dict, List

try:
    import feedparser
except ImportError:
    feedparser = None

import xml.etree.ElementTree as ET

FACT_CHECKER_FEEDS = [
    {"name": "AltNews",     "url": "https://www.altnews.in/feed/",                "color": "red"},
    # boomlive.in/feed/ serves an empty RSS shell; the fact-check section feed is the live one
    {"name": "Boom",        "url": "https://www.boomlive.in/fact-check/feed",     "color": "yellow"},
    {"name": "FactChecker", "url": "https://www.factchecker.in/feed/",            "color": "blue"},
    {"name": "TheQuint",    "url": "https://news.google.com/rss/search?q=site:thequint.com/news/webqoof&hl=en-IN&gl=IN&ceid=IN:en", "color": "purple"},
]

_FETCH_TIMEOUT_SECONDS = 8
_TAG_RE = re.compile(r"<[^>]+>")


def _clean(html: str) -> str:
    return _TAG_RE.sub("", html or "").strip()


def _fetch_entries(url: str) -> List[Dict[str, str]]:
    req = urllib.request.Request(url, headers={"User-Agent": "EchoSnare/1.0 (+fact-check monitor)"})
    with urllib.request.urlopen(req, timeout=_FETCH_TIMEOUT_SECONDS) as resp:
        raw = resp.read()

    entries = []
    if feedparser is not None:
        parsed = feedparser.parse(raw)
        for entry in parsed.entries[:5]:
            entries.append({
                "title": entry.get("title", ""),
                "summary": entry.get("summary", ""),
                "link": entry.get("link", ""),
                "published": entry.get("published", ""),
            })
    else:
        root = ET.fromstring(raw)
        for item in root.findall(".//item")[:5]:
            t = item.find("title")
            s = item.find("description")
            l = item.find("link")
            p = item.find("pubDate")
            entries.append({
                "title": t.text if t is not None else "",
                "summary": s.text if s is not None else "",
                "link": l.text if l is not None else "",
                "published": p.text if p is not None else "",
            })
    return entries


def fetch_live_claims() -> List[Dict]:
    """
    Fetch latest debunked claims from all fact-checker RSS feeds.
    Returns list of claims with metadata. A dead feed is skipped silently
    so one outage never takes down the whole feed.
    """
    claims = []
    for feed_source in FACT_CHECKER_FEEDS:
        try:
            entries = _fetch_entries(feed_source["url"])
            for entry in entries:
                claim = {
                    "id": hashlib.md5(entry.get("link", "").encode()).hexdigest()[:8],
                    "title": _clean(entry.get("title", "")),
                    "summary": _clean(entry.get("summary", ""))[:300],
                    "url": entry.get("link", ""),
                    "published": entry.get("published", ""),
                    "source": feed_source["name"],
                    "source_color": feed_source["color"],
                    "language": "en",
                    "ai_score": None,  # filled by ContentAnalyzer
                    "risk_level": None,
                    "keywords": [],
                }
                claims.append(claim)
        except Exception:
            continue
    return claims

