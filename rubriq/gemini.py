"""Minimal Gemini REST client (stdlib only — no SDK, no extra dependency).

Used by the judge-mode scorer. The API key is passed per request and never
stored or logged. Errors are normalised to GeminiError with a short, safe
message the UI can surface (the key is never echoed back).
"""

from __future__ import annotations

import json
import urllib.error
import urllib.request

_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"


class GeminiError(RuntimeError):
    """A judge call failed; message is safe to show (never contains the key)."""


def call_gemini(
    api_key: str,
    model: str,
    system: str,
    user: str,
    *,
    json_mode: bool = False,
    timeout: float = 40.0,
) -> str:
    """One generateContent call. Returns the model's text. Raises GeminiError."""
    if not api_key:
        raise GeminiError("no API key provided")

    body: dict = {
        "contents": [{"role": "user", "parts": [{"text": user}]}],
        "systemInstruction": {"parts": [{"text": system}]},
        "generationConfig": {"temperature": 0.2, "maxOutputTokens": 2048},
    }
    if json_mode:
        body["generationConfig"]["responseMimeType"] = "application/json"

    # Key travels in a header, never the URL — URLs get logged by proxies/servers.
    url = _ENDPOINT.format(model=model)
    data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json", "x-goog-api-key": api_key},
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        # Surface Google's own message, but strip anything key-shaped.
        detail = ""
        try:
            err = json.loads(e.read().decode("utf-8"))
            detail = err.get("error", {}).get("message", "")
        except Exception:
            detail = ""
        if e.code in (400, 403):
            raise GeminiError(f"Gemini rejected the key or request ({e.code}): {detail or 'check the API key.'}")
        if e.code == 404:
            raise GeminiError(f"Model '{model}' not found — try another Gemini model id.")
        if e.code == 429:
            raise GeminiError("Gemini rate limit hit (free tier). Wait a moment and retry.")
        raise GeminiError(f"Gemini error {e.code}: {detail or 'request failed.'}")
    except urllib.error.URLError as e:
        raise GeminiError(f"Could not reach Gemini: {e.reason}")
    except TimeoutError:
        raise GeminiError("Gemini timed out.")

    candidates = payload.get("candidates") or []
    if not candidates:
        block = payload.get("promptFeedback", {}).get("blockReason")
        raise GeminiError(f"Gemini returned no answer{f' (blocked: {block})' if block else ''}.")
    parts = candidates[0].get("content", {}).get("parts", [])
    text = "".join(p.get("text", "") for p in parts).strip()
    if not text:
        raise GeminiError("Gemini returned an empty answer.")
    return text


def call_gemini_json(api_key: str, model: str, system: str, user: str, *, timeout: float = 40.0) -> dict:
    """Same, but parse the reply as JSON (json_mode). Raises GeminiError on bad JSON."""
    raw = call_gemini(api_key, model, system, user, json_mode=True, timeout=timeout)
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        # Occasionally a model wraps JSON in prose or a code fence; salvage the object.
        start, end = raw.find("{"), raw.rfind("}")
        if 0 <= start < end:
            try:
                return json.loads(raw[start : end + 1])
            except json.JSONDecodeError:
                pass
        raise GeminiError("Gemini did not return valid JSON.")
