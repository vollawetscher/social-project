"""Load voice-agent runtime config from Supabase (per owner profile)."""

from __future__ import annotations

import json
import logging
import os
import re
import time
from dataclasses import dataclass, field
from typing import Any

logger = logging.getLogger("voice-agent")

DEFAULT_ACK_PHRASES = ["Gerne!", "Bitte sehr.", "Gern geschehen."]
DEFAULT_VOICE_ID = "38aabb6a-f52b-4fb0-a3d1-988518f4dc06"
DEFAULT_SPEECH_SPEED = 1.0


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
            .maybe_single()
            .execute()
        )
        data = result.data or {}
        user_id = data.get("user_id")
        return str(user_id) if user_id else None
    except Exception as exc:
        logger.error("Failed to resolve call owner for room %s: %s", room_name, exc)
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
            .maybe_single()
            .execute()
        )
        if result.data and result.data.get("id"):
            return str(result.data["id"])
    except Exception as exc:
        logger.warning("Could not load call id for room %s: %s", room_name, exc)
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
            .maybe_single()
            .execute()
        )
        row = result.data or {}
    except Exception as exc:
        logger.error("Failed to load voice agent profile for %s: %s", owner_user_id, exc)
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
                "voice_agent_voice_id, voice_agent_speech_speed, default_recording_language"
            )
            .eq("id", owner_user_id)
            .maybe_single()
            .execute()
        )
        return result.data or {}
    except Exception as exc:
        logger.error("Failed to load profile for inbound owner %s: %s", owner_user_id, exc)
        return None


async def resolve_inbound_owner(caller_number: str) -> str | None:
    """Resolve the Notissima owner for an inbound caller.

    Tier 1: the caller is a Notissima user (profiles.phone_number match).
    Tier 2: the caller is someone a Notissima user dialed (most recent outbound call).
    """
    client = _supabase_client()
    if not client or not caller_number:
        return None

    try:
        tier1 = (
            client.table("profiles")
            .select("id")
            .eq("phone_number", caller_number)
            .maybe_single()
            .execute()
        )
        if tier1.data and tier1.data.get("id"):
            logger.info("Inbound caller matched Notissima user (tier 1): %s", caller_number)
            return str(tier1.data["id"])
    except Exception as exc:
        logger.warning("Tier 1 inbound owner lookup failed: %s", exc)

    try:
        tier2 = (
            client.table("calls")
            .select("user_id, created_at")
            .eq("phone_number", caller_number)
            .eq("call_type", "pstn_outbound")
            .order("created_at", desc=True)
            .limit(1)
            .maybe_single()
            .execute()
        )
        if tier2.data and tier2.data.get("user_id"):
            logger.info("Inbound caller matched prior outbound call (tier 2): %s", caller_number)
            return str(tier2.data["user_id"])
    except Exception as exc:
        logger.warning("Tier 2 inbound owner lookup failed: %s", exc)

    return None


async def load_inbound_voice_agent_config(caller_number: str | None) -> VoiceAgentConfig:
    config = VoiceAgentConfig(inbound=True, caller_number=caller_number)
    normalized = normalize_phone(caller_number)
    config.caller_number = normalized or caller_number

    if not normalized:
        logger.warning("Inbound call with unrecognized caller number: %r", caller_number)
        return config

    owner_user_id = await resolve_inbound_owner(normalized)
    if not owner_user_id:
        logger.info("Inbound caller is unknown (tier 3): %s", normalized)
        return config

    config.owner_user_id = owner_user_id
    config.owner_identity = owner_user_id

    row = await _load_profile_voice_config(owner_user_id) or {}
    language = str(row.get("voice_agent_language") or row.get("default_recording_language") or "de").strip()
    config.enabled = True
    config.display_name = str(row.get("voice_agent_display_name") or "Frau Peters").strip() or "Frau Peters"
    config.language = "de" if language in ("auto", "") else language
    config.voice_id = str(row.get("voice_agent_voice_id") or DEFAULT_VOICE_ID).strip() or DEFAULT_VOICE_ID
    config.speech_speed = normalize_speech_speed(row.get("voice_agent_speech_speed"))
    config.greeting = "Wie kann ich Ihnen helfen?"
    logger.info(
        "Loaded inbound config: owner=%s caller=%s display=%s language=%s voice=%s speed=%s",
        config.owner_user_id,
        config.caller_number,
        config.display_name,
        config.language,
        config.voice_id,
        config.speech_speed,
    )
    return config


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
            .select("id")
            .single()
            .execute()
        )
        if result.data and result.data.get("id"):
            return str(result.data["id"])
    except Exception as exc:
        logger.error("Failed to create inbound call row for room %s: %s", room_name, exc)
        return await resolve_call_id(room_name)
    return None
