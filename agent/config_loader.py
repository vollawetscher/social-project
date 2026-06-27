"""Load voice-agent runtime config from Supabase (per owner profile)."""

from __future__ import annotations

import json
import logging
import os
from dataclasses import dataclass, field
from typing import Any

logger = logging.getLogger("voice-agent")

DEFAULT_ACK_PHRASES = ["Gerne!", "Bitte sehr.", "Gern geschehen."]


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
    call_id: str | None = None


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
    created_by = metadata.get("createdBy")
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


async def load_voice_agent_config(room_name: str, room_metadata_raw: str | None) -> VoiceAgentConfig:
    metadata = parse_room_metadata(room_metadata_raw)
    owner_user_id = await resolve_owner_user_id(room_name, metadata)
    config = VoiceAgentConfig(owner_user_id=owner_user_id, owner_identity=owner_user_id)

    client = _supabase_client()
    if not client or not owner_user_id:
        logger.warning("No owner resolved for room %s — agent will idle", room_name)
        return config

    try:
        call_result = (
            client.table("calls")
            .select("id")
            .eq("room_name", room_name)
            .maybe_single()
            .execute()
        )
        if call_result.data and call_result.data.get("id"):
            config.call_id = str(call_result.data["id"])
    except Exception as exc:
        logger.warning("Could not load call id for room %s: %s", room_name, exc)

    try:
        result = (
            client.table("profiles")
            .select(
                "voice_agent_enabled, voice_agent_display_name, voice_agent_wake_word, "
                "voice_agent_wake_sounds_like, voice_agent_dismiss_phrase, voice_agent_ack_phrases, "
                "voice_agent_language, default_recording_language"
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
    config.greeting = "Was kann ich für Sie tun?"
    return config
