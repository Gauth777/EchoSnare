from __future__ import annotations

import base64
import io
import logging
import os
from dataclasses import asdict, dataclass
from typing import Any

import requests
from PIL import Image, ImageChops, ImageEnhance, ExifTags

logger = logging.getLogger(__name__)

REQUEST_TIMEOUT = 15


@dataclass(slots=True)
class DeepfakeDetectionResult:
    manipulation_probability: float
    ela_image_base64: str
    metadata_summary: dict[str, Any]
    ai_generated_probability: float | None = None
    ai_model_used: str | None = None
    gemini_forensics: dict[str, Any] | None = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def _download_image(image_url: str) -> tuple[Image.Image, bytes]:
    # Wikimedia and most CDNs reject the default python-requests user agent
    headers = {"User-Agent": "EchoSnare/1.0 (image forensics; contact: admin@echosnare.app)"}
    response = requests.get(image_url, headers=headers, timeout=REQUEST_TIMEOUT)
    response.raise_for_status()
    return Image.open(io.BytesIO(response.content)).convert("RGB"), response.content


def _read_exif_metadata(image: Image.Image) -> dict[str, Any]:
    summary: dict[str, Any] = {}
    try:
        exif = image.getexif()
    except Exception:
        exif = None
    if not exif:
        return summary
    for key, value in exif.items():
        name = ExifTags.TAGS.get(key, str(key))
        if isinstance(value, bytes):
            try:
                value = value.decode("utf-8", errors="ignore")
            except Exception:
                value = value.hex()
        elif not isinstance(value, (str, int, float, bool)):
            # EXIF can hold IFDRational and other non-JSON types
            value = str(value)
        summary[name] = value
    return summary


def _compute_ela(image: Image.Image, quality: int = 90) -> tuple[Image.Image, float]:
    buffer = io.BytesIO()
    image.save(buffer, format="JPEG", quality=quality)
    buffer.seek(0)
    compressed = Image.open(buffer).convert("RGB")
    diff = ImageChops.difference(image, compressed)
    extrema = diff.getextrema()
    max_diff = max((pair[1] for pair in extrema), default=1) or 1
    scale = 255.0 / max_diff
    ela = ImageEnhance.Brightness(diff).enhance(scale)
    return ela, float(max_diff)


def _ela_to_base64(image: Image.Image) -> str:
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return base64.b64encode(buffer.getvalue()).decode("ascii")


def _manipulation_probability(exif_summary: dict[str, Any], ela_max_diff: float) -> float:
    score = 0.15
    if not exif_summary:
        score += 0.2
    if "Software" in exif_summary:
        score += 0.15
    if "DateTime" not in exif_summary:
        score += 0.05
    if ela_max_diff > 25:
        score += 0.25
    elif ela_max_diff > 10:
        score += 0.15
    return round(min(0.99, score), 4)


def _analyze_with_gemini_vision(raw_bytes: bytes) -> dict[str, Any] | None:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return None

    import json
    import urllib.request

    b64_str = base64.b64encode(raw_bytes).decode("ascii")
    prompt = (
        "You are an elite forensic intelligence examiner specialized in deepfake detection, "
        "synthetic media analysis, and image manipulation detection.\n"
        "Examine the attached image in microscopic detail for:\n"
        "1. AI GENERATION SIGNALS: Diffusion brush artifacts, synthetic skin texture/plastic sheen, asymmetric pupil/iris reflections, unnatural hair/ear blending, physically impossible lighting/shadows or geometries.\n"
        "2. FACE SWAP & DEEPFAKE SIGNALS: Blurring along the jawline or forehead seam, skin-tone mismatch between face and neck, warped facial perspective, synthetic smile/eye blending.\n"
        "3. DIGITAL MANIPULATION / SPLICING: Copy-move cloning, content-aware fill boundaries, noise level inconsistencies.\n"
        "4. AUTHENTICITY INDICATORS: Natural camera sensor grain, consistent optical depth-of-field, realistic lens distortion, authentic physical plausibility.\n\n"
        "Respond ONLY with valid JSON in this exact structure:\n"
        "{\n"
        '  "is_ai_generated": <true or false>,\n'
        '  "manipulation_score": <integer from 0 to 100 where 0 is 100% authentic camera photo, and 100 is definitely AI or manipulated>,\n'
        '  "category": <"AI_GENERATED" | "DEEPFAKE_FACE_SWAP" | "DIGITALLY_MANIPULATED" | "AUTHENTIC_PHOTO">,\n'
        '  "confidence": <float from 0.0 to 1.0>,\n'
        '  "detected_artifacts": [<array of 2 to 5 specific forensic observations>],\n'
        '  "forensic_summary": "<2-3 sentence technical forensic verdict explaining why this is authentic, AI-generated, or edited>"\n'
        "}"
    )

    models_to_try = ["gemini-flash-lite-latest", "gemini-3.5-flash-lite"]
    for m in models_to_try:
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{m}:generateContent?key={api_key}"
            body = {
                "contents": [
                    {
                        "parts": [
                            {"text": prompt},
                            {
                                "inlineData": {
                                    "mimeType": "image/jpeg",
                                    "data": b64_str,
                                }
                            }
                        ]
                    }
                ],
                "generationConfig": {
                    "responseMimeType": "application/json",
                    "temperature": 0.1,
                }
            }
            req = urllib.request.Request(
                url,
                data=json.dumps(body).encode("utf-8"),
                headers={"Content-Type": "application/json"},
            )
            with urllib.request.urlopen(req, timeout=18) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                text = data["candidates"][0]["content"]["parts"][0]["text"]
                parsed = json.loads(text)
                if isinstance(parsed, dict) and "manipulation_score" in parsed:
                    parsed["model_used"] = f"Google {m}"
                    return parsed
        except Exception as exc:
            logger.info("Gemini vision model %s failed: %s", m, exc)
            continue
    return None


class DeepfakeDetector:
    def analyze(self, image_url: str | None = None, image_base64: str | None = None) -> DeepfakeDetectionResult:
        try:
            if image_base64:
                b64_clean = image_base64
                if "," in b64_clean:
                    b64_clean = b64_clean.split(",", 1)[1]
                raw_bytes = base64.b64decode(b64_clean)
                image = Image.open(io.BytesIO(raw_bytes)).convert("RGB")
            elif image_url:
                image, raw_bytes = _download_image(image_url)
            else:
                raise ValueError("Neither image_url nor image_base64 was provided")

            metadata_summary = _read_exif_metadata(image)
            ela_image, ela_max_diff = _compute_ela(image)
            heuristic_probability = _manipulation_probability(metadata_summary, ela_max_diff)

            # Gemini Multimodal Vision Forensics (Google Gemini Flash Lite)
            gemini_forensics = _analyze_with_gemini_vision(raw_bytes)

            # Trained AI-generation classifier (Hugging Face ensemble if HF_API_KEY present)
            ai_generated_probability: float | None = None
            ai_model_used: str | None = None
            try:
                from agents.ai_image_detector import detect_ai_image

                model_result = detect_ai_image(raw_bytes)
                if model_result is not None:
                    ai_generated_probability = model_result["ai_probability"]
                    ai_model_used = model_result["model"]
            except Exception as exc:
                logger.info("AI-image model unavailable: %s", exc)

            # Multi-layer score synthesis:
            # When Gemini Vision is available, its high-resolution multimodal attention provides the strongest signal.
            if gemini_forensics and "manipulation_score" in gemini_forensics:
                gemini_score = float(gemini_forensics["manipulation_score"]) / 100.0
                if ai_generated_probability is not None:
                    manipulation_probability = round(
                        min(0.99, 0.55 * gemini_score + 0.25 * ai_generated_probability + 0.20 * heuristic_probability), 4
                    )
                else:
                    manipulation_probability = round(
                        min(0.99, 0.70 * gemini_score + 0.30 * heuristic_probability), 4
                    )
            elif ai_generated_probability is not None and ai_generated_probability >= 0.5:
                manipulation_probability = round(
                    min(0.99, 0.6 * ai_generated_probability + 0.4 * heuristic_probability), 4
                )
            else:
                manipulation_probability = heuristic_probability

            return DeepfakeDetectionResult(
                manipulation_probability=manipulation_probability,
                ela_image_base64=_ela_to_base64(ela_image),
                metadata_summary=metadata_summary,
                ai_generated_probability=ai_generated_probability,
                ai_model_used=ai_model_used,
                gemini_forensics=gemini_forensics,
            )
        except Exception as exc:
            target_desc = "uploaded image" if image_base64 else (image_url or "unknown")
            logger.exception("Deepfake analysis failed for %s: %s", target_desc, exc)
            return DeepfakeDetectionResult(
                manipulation_probability=0.0,
                ela_image_base64="",
                metadata_summary={"error": str(exc), "analysis_failed": True},
            )
