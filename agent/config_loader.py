"""Load voice-agent runtime config from Supabase (per owner profile)."""

from __future__ import annotations

import asyncio
import hashlib
import hmac
import json
import logging
import os
import re
import time
from dataclasses import dataclass, field
from typing import Any

import aiohttp

logger = logging.getLogger("voice-agent")

DEFAULT_ACK_PHRASES = ["Gerne!", "Bitte sehr.", "Gern geschehen."]
DEFAULT_VOICE_ID = "38aabb6a-f52b-4fb0-a3d1-988518f4dc06"
DEFAULT_SPEECH_SPEED = 1.0
# Neutral identity for inbound callers who are not identified, or whose resolved
# owner has not activated a personal agent. Identified callers with an activated
# agent hear that owner's configured agent name instead.
GENERIC_INBOUND_NAME = "Notissima Agent"


def normalize_speech_speed(value: Any) -> float:
    try:
        speed = float(value)
    except (TypeError, ValueError):
        return DEFAULT_SPEECH_SPEED
    return max(0.6, min(2.0, speed))


@dataclass
class VoiceAgentConfig:
    enabled: bool = False
    owner_user_id: str | None = None
    owner_identity: str | None = None
    display_name: str = "Frau Peters"
    wake_word: str = "Frau Peters"
    wake_phrases: list[str] = field(default_factory=lambda: ["frau peters", "peters"])
    dismiss_phrases: list[str] = field(default_factory=lambda: ["danke frau peters", "danke peters"])
    ack_phrases: list[str] = field(default_factory=lambda: list(DEFAULT_ACK_PHRASES))
    greeting: str = "Was kann ich für Sie tun?"
    language: str = "de"
    voice_id: str = DEFAULT_VOICE_ID
    speech_speed: float = 1.0
    call_id: str | None = None
    inbound: bool = False
    caller_number: str | None = None
    caller_name: str | None = None
    trusted: bool = False
    document_context: str = ""
    documents_full: str = ""
    # Inbound PIN gate: the resolved owner's hashed PIN (if set) and whether the
    # caller IS that owner (tier 1). Only a tier-1 caller can unlock data access.
    pin_hash: str | None = None
    caller_is_owner: bool = False


def _normalize_phrase(text: str) -> str:
    return (
        text.lower()
        .strip()
        .replace(",", "")
        .replace(".", "")
        .replace("?", "")
        .replace("!", "")
    )


def phrase_matches(text: str, phrases: list[str]) -> bool:
    normalized = _normalize_phrase(text)
    if not normalized:
        return False
    return any(_normalize_phrase(phrase) in normalized for phrase in phrases if phrase.strip())


def _build_wake_phrases(wake_word: str, sounds_like: list[str] | None) -> list[str]:
    candidates = [wake_word, *(sounds_like or [])]
    phrases: list[str] = []
    for candidate in candidates:
        cleaned = _normalize_phrase(candidate)
        if cleaned and cleaned not in phrases:
            phrases.append(cleaned)
    return phrases or ["frau peters", "peters"]


def _build_dismiss_phrases(dismiss_phrase: str) -> list[str]:
    base = _normalize_phrase(dismiss_phrase)
    phrases = [base] if base else []
    if base.startswith("danke "):
        short = base.replace("danke ", "", 1).strip()
        if short:
            phrases.append(f"danke {short}")
    return phrases or ["danke frau peters"]


def cologne_phonetic(word: str) -> str:
    """Kölner Phonetik (Cologne phonetics) code for a German word.

    German-tuned phonetic algorithm: notably G and K both map to 4, and F/V/W and
    P-before-H all map to 3 — so STT mishearings like Kruppa/Grupper and
    Innovaphone/Innova-Fonds encode to the same (or prefix-sharing) codes.
    """
    if not word:
        return ""
    w = word.lower().replace("ä", "a").replace("ö", "o").replace("ü", "u").replace("ß", "ss")
    w = re.sub(r"[^a-z]", "", w)
    if not w:
        return ""
    n = len(w)
    codes: list[str] = []
    for i, ch in enumerate(w):
        prev = w[i - 1] if i > 0 else ""
        nxt = w[i + 1] if i < n - 1 else ""
        code: str | None = None
        if ch in "aeijouy":
            code = "0"
        elif ch == "h":
            code = None
        elif ch == "b":
            code = "1"
        elif ch == "p":
            code = "3" if nxt == "h" else "1"
        elif ch in "dt":
            code = "8" if nxt in "csz" else "2"
        elif ch in "fvw":
            code = "3"
        elif ch in "gkq":
            code = "4"
        elif ch == "c":
            if i == 0:
                code = "4" if nxt in "ahkloqrux" else "8"
            elif prev in "sz":
                code = "8"
            else:
                code = "4" if nxt in "ahkoqux" else "8"
        elif ch == "x":
            code = "8" if prev in "ckq" else "48"
        elif ch == "l":
            code = "5"
        elif ch in "mn":
            code = "6"
        elif ch == "r":
            code = "7"
        elif ch in "sz":
            code = "8"
        if code is not None:
            codes.append(code)
    s = "".join(codes)
    # Collapse consecutive duplicate digits.
    dedup: list[str] = []
    for c in s:
        if not dedup or dedup[-1] != c:
            dedup.append(c)
    result = "".join(dedup)
    # Drop all '0' except a leading one.
    if result:
        result = result[0] + result[1:].replace("0", "")
    return result


def _cologne_match(a: str, b: str, min_len: int = 3) -> bool:
    """True if two Cologne codes are equal or one is a prefix of the other."""
    if not a or not b:
        return False
    if a == b:
        return True
    shorter, longer = (a, b) if len(a) <= len(b) else (b, a)
    return len(shorter) >= min_len and longer.startswith(shorter)


def _supabase_client():
    url = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        return None
    try:
        from supabase import create_client

        return create_client(url, key)
    except Exception as exc:
        logger.error("Supabase client unavailable: %s", exc)
        return None


def parse_room_metadata(raw: str | None) -> dict[str, Any]:
    if not raw:
        return {}
    try:
        parsed = json.loads(raw)
        return parsed if isinstance(parsed, dict) else {}
    except (json.JSONDecodeError, TypeError):
        return {}


async def resolve_owner_user_id(room_name: str, metadata: dict[str, Any]) -> str | None:
    created_by = metadata.get("ownerUserId") or metadata.get("createdBy")
    if isinstance(created_by, str) and created_by.strip():
        return created_by.strip()

    client = _supabase_client()
    if not client or not room_name:
        return None

    try:
        result = (
            client.table("calls")
            .select("user_id")
            .eq("room_name", room_name)
            .limit(1)
            .execute()
        )
        rows = result.data or []
        data = rows[0] if rows else {}
        user_id = data.get("user_id")
        return str(user_id) if user_id else None
    except Exception as exc:
        logger.error("Failed to resolve call owner for room %s: %r", room_name, exc)
        return None


async def resolve_call_id(room_name: str) -> str | None:
    client = _supabase_client()
    if not client or not room_name:
        return None

    try:
        result = (
            client.table("calls")
            .select("id")
            .eq("room_name", room_name)
            .limit(1)
            .execute()
        )
        rows = result.data or []
        if rows and rows[0].get("id"):
            return str(rows[0]["id"])
    except Exception as exc:
        logger.warning("Could not load call id for room %s: %r", room_name, exc)
    return None


async def load_voice_agent_config(
    room_name: str,
    room_metadata_raw: str | None,
    dispatch_metadata_raw: str | None = None,
) -> VoiceAgentConfig:
    room_metadata = parse_room_metadata(room_metadata_raw)
    dispatch_metadata = parse_room_metadata(dispatch_metadata_raw)
    metadata = {**room_metadata, **dispatch_metadata}
    owner_user_id = await resolve_owner_user_id(room_name, metadata)
    config = VoiceAgentConfig(owner_user_id=owner_user_id, owner_identity=owner_user_id)

    client = _supabase_client()
    if not client or not owner_user_id:
        logger.warning("No owner resolved for room %s — agent will idle", room_name)
        return config

    if isinstance(metadata.get("callId"), str) and str(metadata.get("callId")).strip():
        config.call_id = str(metadata["callId"]).strip()
    else:
        config.call_id = await resolve_call_id(room_name)

    try:
        result = (
            client.table("profiles")
            .select(
                "voice_agent_enabled, voice_agent_display_name, voice_agent_wake_word, "
                "voice_agent_wake_sounds_like, voice_agent_dismiss_phrase, voice_agent_ack_phrases, "
                "voice_agent_language, voice_agent_voice_id, voice_agent_speech_speed, default_recording_language"
            )
            .eq("id", owner_user_id)
            .limit(1)
            .execute()
        )
        rows = result.data or []
        row = rows[0] if rows else {}
    except Exception as exc:
        logger.error("Failed to load voice agent profile for %s: %r", owner_user_id, exc)
        return config

    wake_word = str(row.get("voice_agent_wake_word") or "Frau Peters").strip() or "Frau Peters"
    dismiss_phrase = str(row.get("voice_agent_dismiss_phrase") or "Danke, Frau Peters").strip()
    language = str(row.get("voice_agent_language") or row.get("default_recording_language") or "de").strip()
    ack_values = row.get("voice_agent_ack_phrases") or DEFAULT_ACK_PHRASES
    sounds_like = row.get("voice_agent_wake_sounds_like") or []

    config.enabled = bool(row.get("voice_agent_enabled"))
    config.display_name = str(row.get("voice_agent_display_name") or "Frau Peters").strip() or "Frau Peters"
    config.wake_word = wake_word
    config.wake_phrases = _build_wake_phrases(wake_word, sounds_like if isinstance(sounds_like, list) else [])
    config.dismiss_phrases = _build_dismiss_phrases(dismiss_phrase)
    config.ack_phrases = [str(v).strip() for v in ack_values if str(v).strip()] or list(DEFAULT_ACK_PHRASES)
    config.language = "de" if language == "auto" else language
    config.voice_id = str(row.get("voice_agent_voice_id") or DEFAULT_VOICE_ID).strip() or DEFAULT_VOICE_ID
    config.speech_speed = normalize_speech_speed(row.get("voice_agent_speech_speed"))
    config.greeting = "Was kann ich für Sie tun?"
    logger.info(
        "Loaded voice agent config: owner=%s call=%s enabled=%s wake_word=%r language=%s voice=%s speed=%s",
        config.owner_user_id,
        config.call_id,
        config.enabled,
        config.wake_word,
        config.language,
        config.voice_id,
        config.speech_speed,
    )
    return config


async def insert_live_transcript_line(
    call_id: str | None,
    source_key: str,
    speaker_label: str,
    text: str,
) -> None:
    value = text.strip()
    if not call_id or not value:
        return

    client = _supabase_client()
    if not client:
        logger.warning("Cannot store live transcript line — Supabase unavailable")
        return

    try:
        result = (
            client.table("call_live_transcript_lines")
            .insert(
                {
                    "call_id": call_id,
                    "source_key": source_key,
                    "speaker_label": speaker_label,
                    "text": value,
                    "is_final": True,
                    "timestamp_ms": int(time.time() * 1000),
                }
            )
            .execute()
        )
        if getattr(result, "error", None):
            logger.error("Failed to store live transcript line: %s", result.error)
    except Exception as exc:
        logger.error("Failed to store live transcript line: %s", exc)


# ---------------------------------------------------------------------------
# Inbound SIP support
# ---------------------------------------------------------------------------


def normalize_phone(raw: str | None) -> str | None:
    if not raw:
        return None
    cleaned = re.sub(r"[^\d+]", "", str(raw))
    if cleaned.startswith("00"):
        cleaned = "+" + cleaned[2:]
    if not cleaned.startswith("+"):
        cleaned = "+" + cleaned
    return cleaned if re.match(r"^\+\d{6,15}$", cleaned) else None


async def _load_profile_voice_config(owner_user_id: str) -> dict[str, Any] | None:
    client = _supabase_client()
    if not client:
        return None
    try:
        result = (
            client.table("profiles")
            .select(
                "voice_agent_enabled, voice_agent_display_name, voice_agent_language, "
                "voice_agent_voice_id, voice_agent_speech_speed, default_recording_language, "
                "voice_agent_pin_hash"
            )
            .eq("id", owner_user_id)
            .limit(1)
            .execute()
        )
        rows = result.data or []
        return rows[0] if rows else {}
    except Exception as exc:
        logger.error("Failed to load profile for inbound owner %s: %r", owner_user_id, exc)
        return None


def _clean_caller_name(raw: Any) -> str | None:
    """Return a usable first/display name, ignoring blank or number-only labels."""
    value = str(raw or "").strip()
    if not value:
        return None
    # Ignore labels that are just a phone number / digits.
    if not re.search(r"[A-Za-zÀ-ÿ]", value):
        return None
    return value


async def resolve_inbound_owner(caller_number: str) -> tuple[str | None, str | None, bool]:
    """Resolve the Notissima owner and the caller's name for an inbound caller.

    Tier 1: the caller IS a Notissima user (profiles.phone_number match) — name is
            their profile display name, and caller_is_owner is True (they may
            unlock data access with their PIN).
    Tier 2: the caller is someone a Notissima user dialed (most recent outbound
            call) — name is the stored contact name; caller_is_owner is False.
    Returns (owner_user_id, caller_name, caller_is_owner).
    """
    client = _supabase_client()
    if not client or not caller_number:
        return None, None, False

    try:
        tier1 = (
            client.table("profiles")
            .select("id, display_name")
            .eq("phone_number", caller_number)
            .limit(1)
            .execute()
        )
        rows = tier1.data or []
        if rows and rows[0].get("id"):
            logger.info("Inbound caller matched Notissima user (tier 1): %s", caller_number)
            return str(rows[0]["id"]), _clean_caller_name(rows[0].get("display_name")), True
    except Exception as exc:
        logger.warning("Tier 1 inbound owner lookup failed: %r", exc)

    try:
        tier2 = (
            client.table("calls")
            .select("user_id, contact_name, created_at")
            .eq("phone_number", caller_number)
            .eq("call_type", "pstn_outbound")
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        rows = tier2.data or []
        if rows and rows[0].get("user_id"):
            logger.info("Inbound caller matched prior outbound call (tier 2): %s", caller_number)
            return str(rows[0]["user_id"]), _clean_caller_name(rows[0].get("contact_name")), False
    except Exception as exc:
        logger.warning("Tier 2 inbound owner lookup failed: %r", exc)

    return None, None, False


async def load_inbound_voice_agent_config(caller_number: str | None) -> VoiceAgentConfig:
    config = VoiceAgentConfig(inbound=True, caller_number=caller_number)
    # Default to the neutral identity; only an identified caller whose owner has an
    # activated agent gets that owner's personal agent name/voice.
    config.display_name = GENERIC_INBOUND_NAME
    config.greeting = "Wie kann ich Ihnen helfen?"
    normalized = normalize_phone(caller_number)
    config.caller_number = normalized or caller_number

    if not normalized:
        logger.warning("Inbound call with unrecognized caller number: %r", caller_number)
        return config

    owner_user_id, caller_name, caller_is_owner = await resolve_inbound_owner(normalized)
    if not owner_user_id:
        logger.info("Inbound caller is unknown (tier 3): %s — using %s", normalized, GENERIC_INBOUND_NAME)
        return config

    config.owner_user_id = owner_user_id
    config.owner_identity = owner_user_id
    config.caller_name = caller_name
    config.caller_is_owner = caller_is_owner

    row = await _load_profile_voice_config(owner_user_id) or {}
    agent_enabled = bool(row.get("voice_agent_enabled"))
    language = str(row.get("voice_agent_language") or row.get("default_recording_language") or "de").strip()
    config.language = "de" if language in ("auto", "") else language
    # PIN only matters when the caller IS the owner (tier 1) — a contact (tier 2)
    # must never be able to unlock the owner's data.
    if caller_is_owner:
        config.pin_hash = str(row.get("voice_agent_pin_hash") or "").strip() or None

    if agent_enabled and caller_is_owner:
        # Only the owner themselves (tier 1) hears their personal agent — a tier-2
        # contact can't be assumed to know "Frau Peters"/"Herr X", and it would
        # leak the owner's setup. Everyone else stays neutral.
        config.enabled = True
        config.display_name = str(row.get("voice_agent_display_name") or "Frau Peters").strip() or "Frau Peters"
        config.voice_id = str(row.get("voice_agent_voice_id") or DEFAULT_VOICE_ID).strip() or DEFAULT_VOICE_ID
        config.speech_speed = normalize_speech_speed(row.get("voice_agent_speech_speed"))
    else:
        # Tier-2 contact, or owner without an activated agent → neutral Notissima Agent.
        config.enabled = False
        config.display_name = GENERIC_INBOUND_NAME

    logger.info(
        "Loaded inbound config: owner=%s caller=%s caller_name=%s display=%s agent_enabled=%s "
        "caller_is_owner=%s pin_set=%s language=%s voice=%s speed=%s",
        config.owner_user_id,
        config.caller_number,
        config.caller_name,
        config.display_name,
        agent_enabled,
        config.caller_is_owner,
        bool(config.pin_hash),
        config.language,
        config.voice_id,
        config.speech_speed,
    )
    return config


def _hash_pin(user_id: str, pin: str) -> str:
    """Hash an inbound PIN. Must match the web app (voice-agent-pin route)."""
    pepper = os.environ.get("VOICE_AGENT_PIN_PEPPER", "")
    return hashlib.sha256(f"{pepper}:{user_id}:{pin}".encode("utf-8")).hexdigest()


def verify_owner_pin(config: VoiceAgentConfig, pin: str) -> bool:
    """Constant-time check of a candidate PIN against the owner's stored hash."""
    candidate_pin = (pin or "").strip()
    if not config.pin_hash or not config.owner_user_id or not candidate_pin:
        return False
    return hmac.compare_digest(_hash_pin(config.owner_user_id, candidate_pin), config.pin_hash)


async def create_inbound_call(
    room_name: str,
    owner_user_id: str,
    caller_number: str | None,
    sip_identity: str | None,
) -> str | None:
    """Create a pstn_inbound calls row so the webhook can finalize the transcript."""
    client = _supabase_client()
    if not client:
        return None

    existing = await resolve_call_id(room_name)
    if existing:
        return existing

    try:
        result = (
            client.table("calls")
            .insert(
                {
                    "room_name": room_name,
                    "user_id": owner_user_id,
                    "call_type": "pstn_inbound",
                    "call_mode": "audio",
                    "status": "active",
                    "phone_number": caller_number,
                    "participant_b_identity": sip_identity,
                    "started_at": "now()",
                    "room_created_at_ms": int(time.time() * 1000),
                }
            )
            .execute()
        )
        rows = result.data or []
        if rows and rows[0].get("id"):
            return str(rows[0]["id"])
    except Exception as exc:
        logger.error("Failed to create inbound call row for room %s: %r", room_name, exc)
        return await resolve_call_id(room_name)
    return None


# ---------------------------------------------------------------------------
# Owner-scoped data tools (function calling)
# ---------------------------------------------------------------------------


async def create_owner_note(owner_user_id: str, text: str, title: str = "Sprachnotiz") -> bool:
    """Create a voice note session owned by the given user.

    `title` becomes the session's internal_case_id (e.g. "Sprachnotiz" for a
    dictated note, or "Recherche: …" for a delegated web-research result).
    """
    value = (text or "").strip()
    client = _supabase_client()
    if not client or not owner_user_id or not value:
        return False

    try:
        session_result = (
            client.table("sessions")
            .insert(
                {
                    "user_id": owner_user_id,
                    "status": "done",
                    "context_note": value,
                    "internal_case_id": title or "Sprachnotiz",
                    "duration_sec": 0,
                    "last_error": "",
                    "input_hint": "dictation",
                    "language": "de",
                    "user_is_speaker": True,
                    "recording_type": "note",
                }
            )
            .execute()
        )
        rows = session_result.data or []
        session_id = rows[0]["id"] if rows else None
        if not session_id:
            logger.error("[tool] Note session insert returned no id for owner %s", owner_user_id)
            return False

        # Also store the note as a transcript so it appears as session content.
        # Best-effort: if this fails, the note still exists via context_note.
        try:
            segment = {"start_ms": 0, "end_ms": 1000, "speaker": "Notiz", "text": value, "confidence": 1}
            client.table("transcripts").insert(
                {
                    "session_id": session_id,
                    "file_id": None,
                    "raw_json": [segment],
                    "redacted_json": [segment],
                    "raw_text": value,
                    "redacted_text": value,
                    "language": "de",
                }
            ).execute()
        except Exception as transcript_exc:
            logger.warning("[tool] Note transcript insert failed (note still saved): %s", transcript_exc)

        logger.info("[tool] Created voice note for owner %s (session %s)", owner_user_id, session_id)
        return True
    except Exception as exc:
        logger.error("[tool] Failed to create note for owner %s: %r", owner_user_id, exc)
        return False


async def get_call_documents(call_id: str | None) -> list[dict[str, Any]]:
    """Return ready documents attached to a call (filename, summary, text)."""
    client = _supabase_client()
    if not client or not call_id:
        return []
    try:
        result = (
            client.table("call_documents")
            .select("filename, summary, extracted_text, status")
            .eq("call_id", call_id)
            .eq("status", "ready")
            .order("created_at", desc=False)
            .execute()
        )
        return list(result.data or [])
    except Exception as exc:
        logger.error("[tool] Failed to load documents for call %s: %s", call_id, exc)
        return []


def build_document_context(documents: list[dict[str, Any]], max_chars: int = 4000) -> str:
    """Build a compact context string from attached documents for the LLM."""
    parts: list[str] = []
    for doc in documents:
        name = str(doc.get("filename") or "Dokument").strip()
        body = str(doc.get("summary") or doc.get("extracted_text") or "").strip()
        if not body:
            continue
        parts.append(f"Dokument '{name}':\n{body[:max_chars]}")
    return "\n\n".join(parts)


async def get_call_transcript_lines(call_id: str | None, limit: int = 400) -> list[dict[str, Any]]:
    """Return the current call's live transcript lines in chronological order.

    Used so the agent can summarize or answer questions about THIS ongoing call
    rather than recalling past finished sessions.
    """
    client = _supabase_client()
    if not client or not call_id:
        return []
    try:
        result = (
            client.table("call_live_transcript_lines")
            .select("speaker_label, source_key, text, timestamp_ms")
            .eq("call_id", call_id)
            .order("timestamp_ms", desc=False)
            .limit(max(1, min(1000, limit)))
            .execute()
        )
        return list(result.data or [])
    except Exception as exc:
        logger.error("[tool] Failed to load current transcript for call %s: %r", call_id, exc)
        return []


async def get_owner_known_names(owner_user_id: str) -> list[str]:
    """The owner's known entity names (contacts + own display name) for phonetic
    query resolution."""
    client = _supabase_client()
    if not client or not owner_user_id:
        return []
    names: list[str] = []
    try:
        c = client.table("contacts").select("name").eq("user_id", owner_user_id).limit(1000).execute()
        for r in c.data or []:
            nm = str(r.get("name") or "").strip()
            if nm:
                names.append(nm)
    except Exception as exc:
        logger.warning("[tool] contacts load failed: %r", exc)
    try:
        p = client.table("profiles").select("display_name").eq("id", owner_user_id).limit(1).execute()
        rows = p.data or []
        if rows:
            nm = str(rows[0].get("display_name") or "").strip()
            if nm:
                names.append(nm)
    except Exception as exc:
        logger.warning("[tool] profile name load failed: %r", exc)
    return names


def resolve_known_names(query: str, known_names: list[str], max_matches: int = 3) -> list[str]:
    """Return known names that phonetically (Kölner Phonetik) match a query word.

    Bridges STT / spelling variants of proper nouns (e.g. a query 'Kruppa' resolves
    a contact stored as such even if spoken/typed as 'Grupper').
    """
    q_words = [w for w in re.split(r"\s+", (query or "").strip()) if len(w) >= 3]
    if not q_words or not known_names:
        return []
    q_codes = [cologne_phonetic(w) for w in q_words]
    q_codes = [c for c in q_codes if c]
    matched: list[str] = []
    for name in known_names:
        name_codes = [cologne_phonetic(w) for w in re.split(r"\s+", name) if len(w) >= 2]
        name_codes = [c for c in name_codes if c]
        if any(_cologne_match(qc, nc) for qc in q_codes for nc in name_codes):
            matched.append(name)
            if len(matched) >= max_matches:
                break
    return matched


async def search_owner_sessions(
    owner_user_id: str,
    query: str,
    from_date: str | None = None,
    to_date: str | None = None,
    limit: int = 8,
) -> list[dict[str, Any]]:
    """Keyword-search the owner's sessions by metadata and transcript text.

    Matches title/purpose/summary/context and (best-effort) transcript text,
    optionally bounded by a created_at date range (ISO 'YYYY-MM-DD'). Owner-scoped.
    """
    client = _supabase_client()
    if not client or not owner_user_id:
        return []
    limit = max(1, min(20, limit))

    def _sanitize(s: str) -> str:
        # PostgREST or()/ilike filters use ',' '(' ')' as syntax and '*' as the
        # wildcard, so strip those from user-supplied terms.
        return re.sub(r"[,()*%]", " ", s or "").strip()

    q = _sanitize(query)
    terms: list[str] = [q] if q else []
    # Expand with phonetically-resolved known names (Kölner Phonetik) so proper
    # nouns are found despite STT/spelling variants.
    try:
        known = await get_owner_known_names(owner_user_id)
        for name in resolve_known_names(query, known):
            sn = _sanitize(name)
            if sn and sn.lower() not in {t.lower() for t in terms}:
                terms.append(sn)
    except Exception as exc:
        logger.warning("[tool] known-name resolution failed: %r", exc)
    terms = [t for t in terms if t][:4]

    cols = "id, internal_case_id, speechmatics_summary, purpose, context_note, created_at"
    results: dict[str, dict[str, Any]] = {}

    try:
        meta = client.table("sessions").select(cols).eq("user_id", owner_user_id)
        if from_date:
            meta = meta.gte("created_at", from_date)
        if to_date:
            meta = meta.lte("created_at", to_date)
        if terms:
            conds: list[str] = []
            for t in terms:
                conds += [
                    f"internal_case_id.ilike.*{t}*",
                    f"speechmatics_summary.ilike.*{t}*",
                    f"purpose.ilike.*{t}*",
                    f"context_note.ilike.*{t}*",
                ]
            meta = meta.or_(",".join(conds))
        meta = meta.order("created_at", desc=True).limit(limit)
        for row in meta.execute().data or []:
            results[row["id"]] = row
    except Exception as exc:
        logger.error("[tool] session metadata search failed: %r", exc)

    # Best-effort transcript-text match per term → owner-scoped session lookup.
    for t in terms:
        if len(results) >= limit:
            break
        try:
            tr = (
                client.table("transcripts")
                .select("session_id")
                .ilike("redacted_text", f"%{t}%")
                .limit(50)
                .execute()
            )
            ids = [r["session_id"] for r in (tr.data or []) if r.get("session_id") and r["session_id"] not in results]
            if ids:
                sq = client.table("sessions").select(cols).eq("user_id", owner_user_id).in_("id", ids)
                if from_date:
                    sq = sq.gte("created_at", from_date)
                if to_date:
                    sq = sq.lte("created_at", to_date)
                for row in sq.execute().data or []:
                    results[row["id"]] = row
        except Exception as exc:
            logger.error("[tool] transcript search failed: %r", exc)

    rows = sorted(results.values(), key=lambda r: str(r.get("created_at") or ""), reverse=True)
    return rows[:limit]


async def get_owner_recent_sessions(owner_user_id: str, limit: int = 3) -> list[dict[str, Any]]:
    """Return the owner's most recent sessions (label, summary, date)."""
    client = _supabase_client()
    if not client or not owner_user_id:
        return []

    try:
        result = (
            client.table("sessions")
            .select("internal_case_id, speechmatics_summary, purpose, created_at")
            .eq("user_id", owner_user_id)
            .order("created_at", desc=True)
            .limit(max(1, min(10, limit)))
            .execute()
        )
        return list(result.data or [])
    except Exception as exc:
        logger.error("[tool] Failed to load recent sessions for owner %s: %s", owner_user_id, exc)
        return []


# ---------------------------------------------------------------------------
# Web access via Firecrawl (search / scrape / delegated research)
# ---------------------------------------------------------------------------

FIRECRAWL_API_BASE = os.environ.get("FIRECRAWL_API_BASE", "https://api.firecrawl.dev")
FIRECRAWL_TIMEOUT_S = float(os.environ.get("FIRECRAWL_TIMEOUT_S", "20"))


def _firecrawl_key() -> str | None:
    return os.environ.get("FIRECRAWL_API_KEY")


def _extract_search_results(data: Any) -> list[dict[str, Any]]:
    """Normalize Firecrawl search responses (list or {web:[...]}) to a flat list."""
    if not isinstance(data, dict):
        return []
    body = data.get("data")
    items: list[Any] = []
    if isinstance(body, list):
        items = body
    elif isinstance(body, dict):
        items = body.get("web") or body.get("results") or []
    results: list[dict[str, Any]] = []
    for item in items:
        if not isinstance(item, dict):
            continue
        results.append(
            {
                "title": str(item.get("title") or "").strip(),
                "description": str(item.get("description") or item.get("snippet") or "").strip(),
                "url": str(item.get("url") or "").strip(),
            }
        )
    return results


async def firecrawl_search(query: str, limit: int = 4, country: str = "de") -> list[dict[str, Any]]:
    """Web search via Firecrawl. Returns a list of {title, description, url}."""
    key = _firecrawl_key()
    q = (query or "").strip()
    if not key or not q:
        return []
    payload: dict[str, Any] = {"query": q, "limit": max(1, min(10, limit))}
    if country:
        payload["country"] = country
    try:
        timeout = aiohttp.ClientTimeout(total=FIRECRAWL_TIMEOUT_S)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.post(
                f"{FIRECRAWL_API_BASE}/v1/search",
                headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                json=payload,
            ) as resp:
                if resp.status != 200:
                    logger.warning("[web] Firecrawl search HTTP %s for %r", resp.status, q)
                    return []
                data = await resp.json()
    except Exception as exc:
        logger.error("[web] Firecrawl search failed: %r", exc)
        return []
    return _extract_search_results(data)


async def firecrawl_scrape(url: str, max_chars: int = 6000) -> str:
    """Scrape a single URL to clean markdown via Firecrawl."""
    key = _firecrawl_key()
    target = (url or "").strip()
    if not key or not target:
        return ""
    payload = {"url": target, "formats": ["markdown"], "onlyMainContent": True}
    try:
        timeout = aiohttp.ClientTimeout(total=FIRECRAWL_TIMEOUT_S)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.post(
                f"{FIRECRAWL_API_BASE}/v1/scrape",
                headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                json=payload,
            ) as resp:
                if resp.status != 200:
                    logger.warning("[web] Firecrawl scrape HTTP %s for %r", resp.status, target)
                    return ""
                data = await resp.json()
    except Exception as exc:
        logger.error("[web] Firecrawl scrape failed: %r", exc)
        return ""
    body = data.get("data") if isinstance(data, dict) else None
    markdown = str(body.get("markdown") or "") if isinstance(body, dict) else ""
    return markdown.strip()[:max_chars]


async def run_deep_research(owner_user_id: str, topic: str) -> None:
    """Delegated web research: search + scrape top results, store as an owner note.

    Designed to run as a background task so it never blocks the live call.
    """
    t = (topic or "").strip()
    if not owner_user_id or not t:
        return
    try:
        results = await firecrawl_search(t, limit=5)
        if not results:
            await create_owner_note(
                owner_user_id,
                f"Zu '{t}' konnten keine Web-Ergebnisse gefunden werden.",
                title=f"Recherche: {t}",
            )
            return
        top = [r for r in results if r.get("url")][:3]
        scrapes = await asyncio.gather(
            *[firecrawl_scrape(r["url"], max_chars=2000) for r in top],
            return_exceptions=True,
        )
        parts: list[str] = [f"Rechercheergebnis zu: {t}", ""]
        for idx, r in enumerate(results):
            title = r.get("title") or r.get("url") or "Ergebnis"
            desc = r.get("description") or ""
            url = r.get("url") or ""
            parts.append(f"- {title}" + (f" — {desc}" if desc else ""))
            if url:
                parts.append(f"  {url}")
            if idx < len(top):
                content = scrapes[idx] if not isinstance(scrapes[idx], Exception) else ""
                if content:
                    parts.append(f"  Auszug: {str(content)[:1500]}")
            parts.append("")
        await create_owner_note(owner_user_id, "\n".join(parts).strip(), title=f"Recherche: {t}")
        logger.info("[web] Deep research stored for owner %s (topic=%r)", owner_user_id, t)
    except Exception as exc:
        logger.error("[web] Deep research failed for owner %s: %r", owner_user_id, exc)
