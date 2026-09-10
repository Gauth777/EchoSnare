from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass
from typing import Any

try:
    from groq import Groq
except Exception:  # pragma: no cover - optional dependency fallback
    Groq = None


@dataclass(slots=True)
class ContentAnalysisResult:
    misinformation_score: int
    confidence: float
    signals: dict[str, float]


class ContentAnalyzer:
    """Score text for misinformation likelihood.

    Primary signal is a Groq LLM (Llama 3.3 70B) misinformation judgment; a
    deterministic lexical scorer is blended in and also acts as the offline
    fallback. Uses no local ML weights, so it runs in <100MB — fits Render's
    512MB free tier where torch/transformers would OOM.
    """

    def __init__(self, model: str = "qwen/qwen3.8-27b") -> None:
        self.model = os.getenv("GROQ_MODEL", model)
        self._client = self._build_client()

    @staticmethod
    def _build_client():
        api_key = os.getenv("GROQ_API_KEY")
        if not api_key or api_key == "your_key" or Groq is None:
            return None
        try:
            return Groq(api_key=api_key)
        except Exception:
            return None

    def analyze(self, text: str) -> ContentAnalysisResult:
        text = text.strip()
        if not text:
            return ContentAnalysisResult(0, 0.0, {"empty_text": 1.0})

        lexical = self._lexical_score(text)
        model_score = self._model_score(text)
        score = self._blend_scores(lexical, model_score)
        confidence = min(0.99, 0.4 + abs(score - 50) / 100)
        signals = {
            "lexical_score": lexical / 100,
            "model_score": model_score / 100,
            "score_blend": score / 100,
        }
        return ContentAnalysisResult(int(round(score)), round(confidence, 3), signals)

    def _model_score(self, text: str) -> float:
        """LLM misinformation score 0-100 via Gemini or Groq; lexical fallback on any error."""
        gemini_key = os.getenv("GEMINI_API_KEY")
        if gemini_key:
            for m in ("gemini-flash-lite-latest", "gemini-3.5-flash-lite"):
                try:
                    import urllib.request
                    g_url = f"https://generativelanguage.googleapis.com/v1beta/models/{m}:generateContent?key={gemini_key}"
                    g_body = {
                        "contents": [{"parts": [{"text": (
                            "You are a misinformation detection engine for Indian social media "
                            "(English, Hindi, and Hinglish). Judge how likely a piece of text is "
                            "coordinated misinformation, a manipulative viral forward, or a "
                            "fabricated claim. Reply ONLY with strict JSON: "
                            '{"misinformation_score": <integer 0-100>, "reason": "<short phrase>"}. '
                            "0 = clearly benign/factual, 100 = almost certainly misinformation.\n\n"
                            f"TEXT TO EVALUATE:\n{text[:2000]}"
                        )}]}],
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
                    with urllib.request.urlopen(g_req, timeout=6) as g_res:
                        g_data = json.loads(g_res.read().decode("utf-8"))
                        raw_t = g_data["candidates"][0]["content"]["parts"][0]["text"]
                        parsed = json.loads(raw_t)
                        score = float(parsed.get("misinformation_score", -1))
                        if 0 <= score <= 100:
                            return score
                except Exception:
                    continue

        if self._client is None:
            return self._lexical_score(text)

        models = [self.model, "qwen/qwen3.8-27b", "groq/compound", "groq/compound-mini"]
        seen_m = set()
        unique_models = [m for m in models if m and not (m in seen_m or seen_m.add(m))]
        for m in unique_models:
            try:
                response = self._client.chat.completions.create(
                    model=m,
                    temperature=0.1,
                    max_tokens=120,
                    response_format={"type": "json_object"} if m != "groq/compound" else None,
                    messages=[
                        {
                            "role": "system",
                            "content": (
                                "You are a misinformation detection engine for Indian social media "
                                "(English, Hindi, and Hinglish). Judge how likely a piece of text is "
                                "coordinated misinformation, a manipulative viral forward, or a "
                                "fabricated claim. Reply ONLY with strict JSON: "
                                '{"misinformation_score": <integer 0-100>, "reason": "<short phrase>"}. '
                                "0 = clearly benign/factual, 100 = almost certainly misinformation."
                            ),
                        },
                        {"role": "user", "content": text[:2000]},
                    ],
                )
                content = response.choices[0].message.content or "{}"
                parsed = json.loads(content)
                score = float(parsed.get("misinformation_score", self._lexical_score(text)))
                return max(0.0, min(100.0, score))
            except Exception:
                continue

        return self._lexical_score(text)

    @staticmethod
    def _lexical_score(text: str) -> float:
        lowered = text.lower()
        suspicious_terms = [
            "they don't want you to know",
            "wake up",
            "breaking",
            "secret",
            "censored",
            "proof",
            "exposed",
            "hoax",
            "false flag",
            "share before deleted",
        ]
        score = 10.0
        for term in suspicious_terms:
            if term in lowered:
                score += 3

        caps_ratio = sum(1 for c in text if c.isupper()) / max(1, len(text))
        exclamations = text.count("!")
        questions = text.count("?")
        urls = len(re.findall(r"https?://\S+", text))
        numbers = len(re.findall(r"\b\d{2,}\b", text))

        score += min(10, caps_ratio * 80)
        score += min(5, exclamations * 1.0)
        score += min(4, questions * 0.75)
        score += min(4, urls * 2)
        score += min(3, numbers * 0.7)

        if len(text) < 40:
            score += 2
        if any(token in lowered for token in ("breaking", "urgent", "alert")):
            score += 3

        return max(0.0, min(100.0, score))

    @staticmethod
    def _blend_scores(lexical: float, model_score: float) -> float:
        return max(0.0, min(100.0, 0.15 * lexical + 0.85 * model_score))
