from __future__ import annotations

import json
import os
import re
import urllib.request
from dataclasses import dataclass, field
from typing import Any, Dict, List


@dataclass
class WhatsAppAnalysisResult:
    is_forward: bool
    forward_depth: int            # how many times forwarded
    misinformation_score: int     # 0-100 pattern score
    risk_level: str               # HIGH/MED/LOW
    language_detected: str        # en/hi/hinglish
    forward_signals: List[str]    # detected pattern names
    red_flags: List[str]          # human readable red flags
    claim_extracted: str          # the core claim being made
    verdict: str                  # one line verdict
    fact_check_matches: List[Dict] = field(default_factory=list)


class WhatsAppForwardAnalyzer:
    """Intelligent pattern & viral mechanics analyzer for WhatsApp forwards (English/Hindi/Hinglish).

    Combines deep heuristic pattern analysis (forward markers, urgency, fake authority citations,
    scam links, typography drama) with Google Gemini AI for zero-shot WhatsApp viral forensics.
    """

    # Forward chain indicators
    FORWARD_PATTERNS = [
        r"forwarded\s+many\s+times",
        r"\bforwarded\b",
        r"fwd\s*:",
        r"forward\s+karo",
        r"share\s+karo",
        r"sabko\s+bhejo",
        r"sabko\s+forward",
        r"🔁",
        r"📢",
        r"⚠️.*urgent",
        r"forwarded\s+as\s+received",
    ]

    # Misinformation signal patterns
    MISINFO_SIGNALS = {
        "urgency_language": [
            r"\burgent\b", r"\bbreaking\b", r"just\s+in", r"share\s+immediately",
            r"share\s+before\s+delet", r"spread\s+the\s+word",
            r"abhi\s+share\s+karo", r"\bturant\b", r"\btatkal\b", r"\bjaldi\s+karo\b",
            r"share\s+before\s+it'?s\s+banned", r"don'?t\s+delay",
        ],
        "unnamed_authority": [
            r"doctors\s+say", r"scientists\s+confirm", r"government\s+hiding",
            r"sources\s+say", r"insiders\s+reveal", r"\bleaked\b",
            r"doctors\s+ne\s+(bataya|confirm)", r"(sarkar|government)\s+chupa\s+rahi",
            r"who\s+(has\s+)?(declared|warns|says|confirms)",
            r"unesco\s+(has\s+)?(declared|named|confirmed)",
            r"nasa\s+(has\s+)?(confirmed|warned|released)",
            r"supreme\s+court\s+(order|notice|directive)",
            r"aiims\s+doctor", r"icmr\s+warning", r"bbc\s+(reports|alert)",
        ],
        "conspiracy_markers": [
            r"mainstream\s+media\s+won'?t", r"they\s+don'?t\s+want\s+you",
            r"wake\s+up", r"open\s+your\s+eyes", r"truth\s+about",
            r"sach\s+batata\s+hoon", r"asli\s+sach", r"microchip",
            r"5g\s+radiation", r"depopulation", r"bioweapon", r"deep\s+state",
            r"secret\s+agenda", r"poison\s+in", r"banned\s+chemical",
        ],
        "health_misinfo": [
            r"cure\s+for\s+cancer", r"doctors\s+hate", r"big\s+pharma",
            r"vaccine\s+cause", r"natural\s+cure", r"gharelu\s+nuskha",
            r"cancer.{0,30}(theek|thik|cure)", r"(cures?|theek)\s+(cancer|diabetes)",
            r"drinking\s+hot\s+water\s+(cures?|kills?)", r"100%\s+guaranteed\s+cure",
        ],
        "political_misinfo": [
            r"EVMs?\s+(were\s+|is\s+|are\s+)?(hack|rig)", r"election\s+rig", r"vote\s+kaat",
            r"fake\s+vote", r"ballot\s+stuff", r"voting\s+machine\s+hacked",
        ],
        "financial_phishing": [
            r"free\s+(\d+\s*gb|recharge|internet|laptop|mobile|smartphone)",
            r"pm\s+(digital\s+)?yojana", r"modi\s+scheme", r"lottery\s+winner",
            r"claim\s+(your\s+)?(prize|reward|cash|money)", r"account\s+(blocked|suspended)",
            r"electricity\s+bill\s+unpaid", r"light\s+bill\s+kat\s+diya",
            r"update\s+kyc", r"click\s+link\s+to\s+claim",
        ],
        "share_bait": [
            r"share\s+this\s+with\s+\d+", r"send\s+to\s+all",
            r"don'?t\s+ignore", r"must\s+read", r"please\s+share",
            r"please\s+forward", r"sabko\s+dikhao", r"share\s+karo\s+sabko",
            r"punya\s+milega", r"forward\s+to\s+\d+\s+groups",
            r"don'?t\s+break\s+the\s+chain",
        ],
    }

    SIGNAL_WEIGHTS = {
        "urgency_language": (15, "Uses urgency or panic language to pressure viral sharing"),
        "unnamed_authority": (20, "Cites unverified authorities, institutions, or leaked sources"),
        "conspiracy_markers": (20, "Contains conspiracy framing or censorship allegations"),
        "health_misinfo": (25, "Promotes unverified medical claims or miracle health remedies"),
        "political_misinfo": (20, "Contains partisan election fraud or institutional tampering claims"),
        "financial_phishing": (25, "Exhibits freebie reward bait, phishing scheme, or scam hooks"),
        "share_bait": (15, "Uses guilt or chain-letter mechanisms to maximize viral distribution"),
    }

    def analyze(self, text: str) -> WhatsAppAnalysisResult:
        # First compute heuristic baseline
        heuristic_res = self._heuristic_analyze(text)

        # Enhance with Gemini multimodal/linguistic analysis if available
        gemini_res = self._gemini_analyze(text)
        if gemini_res:
            return self._merge_results(heuristic_res, gemini_res)

        return heuristic_res

    def _heuristic_analyze(self, text: str) -> WhatsAppAnalysisResult:
        text_lower = text.lower()

        # Detect forward markers
        is_forward = any(
            re.search(p, text, re.IGNORECASE)
            for p in self.FORWARD_PATTERNS
        )

        forward_depth = 0
        if "forwarded many times" in text_lower:
            forward_depth = 5
        elif re.search(r"fwd.*fwd", text_lower):
            forward_depth = 3
        elif is_forward:
            forward_depth = 1

        # Language detection
        hindi_chars = len(re.findall(r"[ऀ-ॿ]", text))
        hinglish_words = len(re.findall(
            r"\b(karo|hai|hain|nahi|aur|yeh|woh|bhi|se|ko|ka|ki|ke|bhejo|dikhao)\b",
            text_lower,
        ))
        if hindi_chars > 10:
            language = "hi"
        elif hinglish_words > 2:
            language = "hinglish"
        else:
            language = "en"

        detected_signals = []
        red_flags = []
        score = 0  # Dynamic baseline starts at 0

        # Match keyword patterns
        for signal_name, patterns in self.MISINFO_SIGNALS.items():
            if any(re.search(p, text, re.IGNORECASE) for p in patterns):
                weight, description = self.SIGNAL_WEIGHTS[signal_name]
                score += weight
                detected_signals.append(signal_name)
                red_flags.append(description)

        # Check sensational formatting & typography
        words = text.split()
        caps_words = [w for w in words if len(w) >= 4 and w.isupper() and w.isalpha()]
        if len(caps_words) >= 3:
            score += 10
            detected_signals.append("typography_shouting")
            red_flags.append("Excessive capitalization / sensational headline shouting")

        # Check alarmist emojis
        alarm_emojis = len(re.findall(r"[🚨⚠️‼️🛑📢😱🔥⚡💥]", text))
        if alarm_emojis >= 2:
            score += min(alarm_emojis * 5, 15)
            detected_signals.append("alarmist_emojis")
            red_flags.append("High density of alarmist emojis designed to provoke panic")

        # Check excessive punctuation
        if re.search(r"[!?]{3,}", text):
            score += 10
            detected_signals.append("dramatic_punctuation")
            red_flags.append("Aggressive dramatic punctuation (multiple exclamation/question marks)")

        # Check suspicious link shorteners
        if re.search(r"\b(bit\.ly|tinyurl\.com|t\.me|wa\.me|is\.gd|cutt\.ly|gg\.gg)\b", text_lower):
            score += 15
            detected_signals.append("shortened_links")
            red_flags.append("Contains shortened redirect links commonly utilized in phishing/spam")

        # Forward depth contribution
        if forward_depth > 0:
            score += min(forward_depth * 5, 15)

        # Cap score at 97
        score = min(score, 97)

        # Extract clean claim
        sentences = [s.strip() for s in re.split(r"[.!?।\n]", text.strip()) if len(s.strip()) > 15]
        non_boilerplate = [
            s for s in sentences
            if not any(re.search(p, s, re.IGNORECASE) for p in self.FORWARD_PATTERNS)
        ]
        claim = non_boilerplate[0] if non_boilerplate else (sentences[0] if sentences else text[:100])

        risk_level = "HIGH" if score > 70 else "MED" if score > 40 else "LOW"
        flag_count = len(red_flags)
        if risk_level == "HIGH":
            verdict = f"High probability of viral misinformation. {flag_count} red flags detected."
        elif risk_level == "MED":
            verdict = f"Suspicious forward characteristics. {flag_count} warning signals identified."
        else:
            verdict = "Low viral manipulation markers. Content appears relatively standard."

        return WhatsAppAnalysisResult(
            is_forward=is_forward,
            forward_depth=forward_depth,
            misinformation_score=score,
            risk_level=risk_level,
            language_detected=language,
            forward_signals=detected_signals,
            red_flags=red_flags,
            claim_extracted=claim,
            verdict=verdict,
            fact_check_matches=[],
        )

    def _gemini_analyze(self, text: str) -> dict[str, Any] | None:
        """Call Gemini to extract zero-shot WhatsApp viral forward signals and semantics."""
        gemini_key = os.getenv("GEMINI_API_KEY")
        if not gemini_key:
            return None

        prompt = (
            "You are an expert social media and WhatsApp forward intelligence analyst.\n"
            "Analyze the provided text to evaluate WhatsApp forwarding characteristics:\n"
            "- Does it exhibit WhatsApp viral forward dynamics (urgency, emotional manipulation, fake authority citation, chain sharing, scam/phishing bait, conspiracy)?\n"
            "- Is it formatted or phrased like a forwarded viral message?\n\n"
            "Respond ONLY with strict JSON:\n"
            "{\n"
            '  "is_forward": <true or false>,\n'
            '  "forward_depth": <integer 0 to 5>,\n'
            '  "wa_pattern_score": <integer 0 to 100, where 0 is clean/benign or formal news, 100 is extreme viral forward manipulation>,\n'
            '  "red_flags": ["<short red flag 1>", "<short red flag 2>"],\n'
            '  "claim_extracted": "<1-sentence core claim>",\n'
            '  "language": "<en or hi or hinglish>"\n'
            "}\n\n"
            f"MESSAGE TO ANALYZE:\n{text[:2500]}"
        )

        for model in ("gemini-flash-lite-latest", "gemini-3.5-flash-lite"):
            try:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={gemini_key}"
                body = {
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": {
                        "responseMimeType": "application/json",
                        "temperature": 0.1,
                    },
                }
                req = urllib.request.Request(
                    url,
                    data=json.dumps(body).encode("utf-8"),
                    headers={"Content-Type": "application/json"},
                )
                with urllib.request.urlopen(req, timeout=6) as res:
                    data = json.loads(res.read().decode("utf-8"))
                    raw_text = data["candidates"][0]["content"]["parts"][0]["text"]
                    parsed = json.loads(raw_text)
                    if "wa_pattern_score" in parsed:
                        return parsed
            except Exception:
                continue

        return None

    def _merge_results(
        self,
        heuristic: WhatsAppAnalysisResult,
        gemini: dict[str, Any],
    ) -> WhatsAppAnalysisResult:
        g_score = int(gemini.get("wa_pattern_score", heuristic.misinformation_score))
        g_score = max(0, min(100, g_score))

        # Blend: If heuristic found tangible flags, merge; otherwise trust Gemini's contextual understanding
        if heuristic.misinformation_score > 0:
            final_score = int(g_score * 0.7 + heuristic.misinformation_score * 0.3)
        else:
            final_score = g_score

        final_score = min(final_score, 97)

        # Merge red flags
        merged_flags = list(heuristic.red_flags)
        for rf in gemini.get("red_flags", []):
            if rf and rf not in merged_flags:
                merged_flags.append(rf)

        is_forward = bool(gemini.get("is_forward") or heuristic.is_forward)
        forward_depth = max(int(gemini.get("forward_depth", 0)), heuristic.forward_depth)
        claim = str(gemini.get("claim_extracted") or heuristic.claim_extracted)
        lang = str(gemini.get("language") or heuristic.language_detected)

        risk_level = "HIGH" if final_score > 70 else "MED" if final_score > 40 else "LOW"
        flag_count = len(merged_flags)
        if risk_level == "HIGH":
            verdict = f"High probability of viral misinformation. {flag_count} red flags detected."
        elif risk_level == "MED":
            verdict = f"Suspicious forward characteristics. {flag_count} warning signals identified."
        else:
            verdict = "Low viral manipulation markers. Content appears relatively standard."

        return WhatsAppAnalysisResult(
            is_forward=is_forward,
            forward_depth=forward_depth,
            misinformation_score=final_score,
            risk_level=risk_level,
            language_detected=lang,
            forward_signals=heuristic.forward_signals,
            red_flags=merged_flags,
            claim_extracted=claim,
            verdict=verdict,
            fact_check_matches=[],
        )
