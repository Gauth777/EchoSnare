from __future__ import annotations

import logging
import os
from typing import Any

import requests
from requests.auth import HTTPBasicAuth
from neo4j import GraphDatabase

logger = logging.getLogger(__name__)

_driver = None
_use_http_fallback = True


def _get_http_query_url() -> str | None:
    uri = os.getenv("NEO4J_URI", "")
    if "databases.neo4j.io" in uri:
        host = (
            uri.replace("neo4j+s://", "")
            .replace("bolt+s://", "")
            .replace("neo4j://", "")
            .replace("bolt://", "")
            .strip("/")
        )
        db_id = host.split(".")[0]
        return f"https://{host}/db/{db_id}/query/v2"
    return None


def get_driver():
    global _driver
    if _driver is None:
        try:
            import certifi

            os.environ.setdefault("SSL_CERT_FILE", certifi.where())
        except ImportError:
            pass

        uri = os.getenv("NEO4J_URI")
        user = os.getenv("NEO4J_USERNAME")
        password = os.getenv("NEO4J_PASSWORD")
        if not uri or not user or not password:
            return None
        _driver = GraphDatabase.driver(uri, auth=(user, password), connection_timeout=2.0)
    return _driver


def run_query(query: str, params: dict | None = None) -> list[dict[str, Any]]:
    global _use_http_fallback
    user = os.getenv("NEO4J_USERNAME")
    password = os.getenv("NEO4J_PASSWORD")
    http_url = _get_http_query_url()

    if not _use_http_fallback:
        try:
            driver = get_driver()
            if driver:
                with driver.session() as session:
                    result = session.run(query, params or {})
                    return [record.data() for record in result]
        except Exception as exc:
            if http_url and user and password:
                logger.info("Bolt connection unavailable (%s); using Aura HTTPS Query API.", exc)
                _use_http_fallback = True
            else:
                raise exc

    if _use_http_fallback and http_url and user and password:
        res = requests.post(
            http_url,
            auth=HTTPBasicAuth(user, password),
            json={"statement": query, "parameters": params or {}},
            timeout=30,
        )
        if res.status_code in (200, 202):
            data = res.json().get("data", {})
            fields = data.get("fields", [])
            return [dict(zip(fields, row)) for row in data.get("values", [])]
        raise RuntimeError(f"Neo4j HTTP Query Error {res.status_code}: {res.text}")

    return []


def close_driver():
    global _driver
    if _driver:
        _driver.close()
        _driver = None
