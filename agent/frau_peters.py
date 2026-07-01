import asyncio
import contextlib
import logging
import os
import random
import re
from dataclasses import dataclass

from dotenv import load_dotenv
from livekit import rtc
from livekit.agents import (
    Agent,
    AgentServer,
    AgentSession,
    AutoSubscribe,
    JobContext,
    RunContext,
    cli,
    function_tool,
    inference,
    room_io,
    stt,
)
from livekit.plugins import noise_cancellation

from config_loader import (
    VoiceAgentConfig,
    build_document_context,
    create_inbound_call,
    create_owner_note,
    get_call_documents,
    get_owner_recent_sessions,
    insert_live_transcript_line,
    load_inbound_voice_agent_config,
    load_voice_agent_config,
    normalize_phone,
    phrase_matches,
    resolve_call_id,
)

logger = logging.getLogger("voice-agent")
load_dotenv()

MAX_BUFFERED_PARTICIPANTS = 10


@dataclass
class TranscriptBufferTask:
    participant_identity: str
    track_sid: str
    task: asyncio.Task
    stop_event: asyncio.Event


class NotissimaVoiceAgent(Agent):
    """Active voice agent for the owner after wake."""

    def __init__(self, config: VoiceAgentConfig) -> None:
        tools_line = (
            "You can take notes and recall the owner's recent Notissima sessions using your tools. "
            "Use take_note when the owner asks you to note or remember something. "
            "Use recall_recent_sessions when the owner asks about their recent calls or sessions. "
            "You can also discuss a document the owner attaches to the call. "
            "If the owner asks what you can do or how you can help, briefly explain in one or two "
            "sentences that you can answer questions during the call, take notes to their account, "
            "recall their recent sessions, and discuss an attached document. "
            if config.trusted
            else (
                "If the caller asks what you can do, briefly explain that you can answer their "
                "questions and help during this call. "
            )
        )
        document_line = ""
        if config.document_context:
            document_line = (
                "A document has been attached to this call for discussion. "
                "Use read_document to look up exact passages when needed. "
                "Here is a summary of the attached document(s):\n"
                f"{config.document_context}\n"
            )
        super().__init__(
            instructions=(
                f"You are {config.display_name}, a concise in-call voice assistant. "
                f"Your user-facing name is {config.display_name}; this is the only name you should use for yourself. "
                f"You were activated by the wake phrase '{config.wake_word}'. "
                f"If asked who you are or what your name is, answer that you are {config.display_name}. "
                "Do not mention internal names such as Notissima, notissima-voice-agent, LiveKit, or dispatch rules unless explicitly asked about implementation. "
                "You are speaking in a live call and only the owner can command you. "
                "Answer the owner's questions helpfully and naturally. "
                f"{tools_line}"
                f"{document_line}"
                "Keep responses brief: one to three sentences unless asked for more. "
                "Plain text only; no markdown, lists, emojis, or JSON. "
                "Do not explain internal modes or implementation details."
            )
        )
        self._config = config

    @function_tool
    async def read_document(self, context: RunContext) -> str:
        """Read the full text of the document(s) attached to this call."""
        text = (self._config.documents_full or "").strip()
        if not text:
            return "Für dieses Gespräch ist kein Dokument hinterlegt."
        return text[:6000]

    @function_tool
    async def take_note(self, context: RunContext, note: str) -> str:
        """Save a note to the owner's Notissima account.

        Args:
            note: The exact text of the note to save.
        """
        if not self._config.trusted or not self._config.owner_user_id:
            return "Ich kann die Notiz gerade nicht speichern."
        ok = await create_owner_note(self._config.owner_user_id, note)
        if ok and self._config.call_id:
            await insert_live_transcript_line(
                self._config.call_id, "agent", self._config.display_name, f"Notiz gespeichert: {note}"
            )
        return "Die Notiz wurde gespeichert." if ok else "Das Speichern der Notiz ist fehlgeschlagen."

    @function_tool
    async def recall_recent_sessions(self, context: RunContext) -> str:
        """Recall the owner's most recent Notissima sessions (title, summary, date)."""
        if not self._config.trusted or not self._config.owner_user_id:
            return "Ich kann die letzten Sitzungen gerade nicht abrufen."
        sessions = await get_owner_recent_sessions(self._config.owner_user_id, limit=3)
        if not sessions:
            return "Ich habe keine kürzlichen Sitzungen gefunden."
        parts: list[str] = []
        for item in sessions:
            label = str(item.get("internal_case_id") or "Sitzung").strip()
            summary = str(item.get("speechmatics_summary") or item.get("purpose") or "").strip()
            parts.append(f"{label}: {summary}" if summary else label)
        return "Ihre letzten Sitzungen: " + " | ".join(parts)


async def wait_for_call_id(room_name: str, timeout_s: float = 10.0) -> str | None:
    deadline = asyncio.get_event_loop().time() + timeout_s
    while asyncio.get_event_loop().time() < deadline:
        call_id = await resolve_call_id(room_name)
        if call_id:
            return call_id
        await asyncio.sleep(0.5)
    return None


def is_standard_human_participant(participant: rtc.RemoteParticipant) -> bool:
    sip_kind = getattr(rtc.ParticipantKind, "PARTICIPANT_KIND_SIP", 3)
    return participant.kind in {
        rtc.ParticipantKind.PARTICIPANT_KIND_STANDARD,
        sip_kind,
    }


def get_participant_label(participant: rtc.RemoteParticipant, config: VoiceAgentConfig) -> str:
    if participant.identity == config.owner_identity:
        return "You"
    return participant.name or participant.identity or "Participant"


async def transcribe_participant_track(
    track: rtc.AudioTrack,
    participant: rtc.RemoteParticipant,
    config: VoiceAgentConfig,
    stop_event: asyncio.Event,
    is_owner: bool = False,
    wake_event: asyncio.Event | None = None,
    active_flag: asyncio.Event | None = None,
) -> None:
    """Continuously transcribe one participant audio track into the room buffer.

    For the owner track this is also the single source of wake-word detection,
    so the wake phrase is recorded in the transcript before the agent greets —
    keeping the stored conversation in the right order.
    """
    audio_stream = rtc.AudioStream(track)
    stt_engine = inference.STT(model="deepgram/nova-3", language=config.language)
    stt_stream = stt_engine.stream()
    source_key = f"participant:{participant.identity}"
    speaker_label = get_participant_label(participant, config)

    async def pump_audio() -> None:
        try:
            async for event in audio_stream:
                if stop_event.is_set():
                    break
                stt_stream.push_frame(event.frame)
        finally:
            with contextlib.suppress(Exception):
                stt_stream.end_input()

    pump_task = asyncio.create_task(pump_audio())
    logger.info(
        "[buffer] Started participant STT: identity=%s track=%s label=%s",
        participant.identity,
        getattr(track, "sid", "unknown"),
        speaker_label,
    )
    try:
        async for event in stt_stream:
            if stop_event.is_set():
                break
            if event.type != stt.SpeechEventType.FINAL_TRANSCRIPT:
                continue
            text = event.alternatives[0].text if event.alternatives else ""
            text = (text or "").strip()
            if not text:
                continue
            logger.info("[buffer] %s said: %s", speaker_label, text)
            await insert_live_transcript_line(
                config.call_id,
                source_key,
                speaker_label,
                text,
            )
            if (
                is_owner
                and wake_event is not None
                and (active_flag is None or not active_flag.is_set())
                and phrase_matches(text, config.wake_phrases)
            ):
                logger.info("Wake phrase detected (owner buffer stream)")
                wake_event.set()
    except asyncio.CancelledError:
        raise
    except Exception:
        logger.exception("[buffer] Participant STT failed: identity=%s", participant.identity)
    finally:
        stop_event.set()
        pump_task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await pump_task
        with contextlib.suppress(Exception):
            await stt_engine.aclose()
        logger.info("[buffer] Stopped participant STT: identity=%s", participant.identity)


async def run_room_transcript_buffer(
    room: rtc.Room,
    config: VoiceAgentConfig,
    stop_event: asyncio.Event,
    wake_event: asyncio.Event | None = None,
    active_flag: asyncio.Event | None = None,
) -> None:
    """Run per-track STT for up to MAX_BUFFERED_PARTICIPANTS human participants."""
    tasks: dict[str, TranscriptBufferTask] = {}

    async def cleanup_finished_tasks() -> None:
        finished_keys = [key for key, item in tasks.items() if item.task.done()]
        for key in finished_keys:
            item = tasks.pop(key)
            item.stop_event.set()
            with contextlib.suppress(Exception):
                await item.task

    async def maybe_start_tasks() -> None:
        await cleanup_finished_tasks()
        active_identities = {item.participant_identity for item in tasks.values()}
        if len(active_identities) >= MAX_BUFFERED_PARTICIPANTS:
            return

        for participant in room.remote_participants.values():
            if stop_event.is_set():
                return
            if not is_standard_human_participant(participant):
                continue
            if participant.identity in active_identities:
                continue
            if len(active_identities) >= MAX_BUFFERED_PARTICIPANTS:
                logger.warning("[buffer] Participant transcript cap reached (%s)", MAX_BUFFERED_PARTICIPANTS)
                return

            for publication in participant.track_publications.values():
                if publication.kind != rtc.TrackKind.KIND_AUDIO:
                    continue
                if not publication.subscribed:
                    publication.set_subscribed(True)
                track = publication.track
                track_sid = (
                    getattr(publication, "sid", None)
                    or getattr(publication, "track_sid", None)
                    or getattr(track, "sid", "")
                    or f"{participant.identity}:audio"
                )
                if not track or track_sid in tasks:
                    continue

                participant_stop = asyncio.Event()
                is_owner = bool(
                    config.owner_identity and participant.identity == config.owner_identity
                )
                task = asyncio.create_task(
                    transcribe_participant_track(
                        track,
                        participant,
                        config,
                        participant_stop,
                        is_owner=is_owner,
                        wake_event=wake_event,
                        active_flag=active_flag,
                    )
                )
                tasks[track_sid] = TranscriptBufferTask(
                    participant_identity=participant.identity,
                    track_sid=track_sid,
                    task=task,
                    stop_event=participant_stop,
                )
                active_identities.add(participant.identity)
                break

    try:
        while room.connection_state == rtc.ConnectionState.CONN_CONNECTED and not stop_event.is_set():
            await maybe_start_tasks()
            await asyncio.sleep(0.5)
    finally:
        stop_event.set()
        for item in tasks.values():
            item.stop_event.set()
            item.task.cancel()
        for item in tasks.values():
            with contextlib.suppress(asyncio.CancelledError):
                await item.task
        logger.info("[buffer] Room transcript buffer stopped")


async def run_active_session(ctx: JobContext, config: VoiceAgentConfig) -> None:
    """Full AgentSession pipeline on owner mic only until dismiss."""
    owner_identity = config.owner_identity or config.owner_user_id
    if not owner_identity:
        return

    # Load any documents attached to this call so the agent can discuss them.
    if config.trusted and config.call_id:
        documents = await get_call_documents(config.call_id)
        if documents:
            config.document_context = build_document_context(documents)
            config.documents_full = "\n\n".join(
                f"{str(d.get('filename') or 'Dokument')}:\n{str(d.get('extracted_text') or '')}"
                for d in documents
            ).strip()
            logger.info("[active] Loaded %d attached document(s) for call %s", len(documents), config.call_id)

    dismiss_event = asyncio.Event()
    persisted_assistant_texts: set[str] = set()
    session = AgentSession(
        stt=inference.STT(model="deepgram/nova-3", language=config.language),
        llm=inference.LLM(model="openai/gpt-4.1-mini"),
        tts=inference.TTS(
            model="cartesia/sonic-3",
            voice=os.environ.get("CARTESIA_VOICE_ID", config.voice_id),
            language=config.language,
            extra_kwargs={"speed": config.speech_speed},
        ),
    )

    @session.on("user_input_transcribed")
    def on_transcript(ev) -> None:
        text = (ev.transcript or "").strip()
        if not text or not ev.is_final:
            return
        logger.info("[active] Owner said: %s", text)
        if phrase_matches(text, config.dismiss_phrases):
            logger.info("Dismiss phrase detected")
            dismiss_event.set()

    @session.on("conversation_item_added")
    def on_conversation_item(ev) -> None:
        item = getattr(ev, "item", None)
        role = getattr(item, "role", "")
        if role != "assistant":
            return
        content = getattr(item, "content", "")
        if isinstance(content, list):
            text = " ".join(str(part) for part in content if str(part).strip()).strip()
        else:
            text = str(content or "").strip()
        if not text:
            return
        logger.info("[active] Assistant said: %s", text)
        if text in persisted_assistant_texts:
            return
        persisted_assistant_texts.add(text)
        asyncio.create_task(
            insert_live_transcript_line(
                config.call_id,
                "agent",
                config.display_name,
                text,
            )
        )

    room_options = room_io.RoomOptions(
        audio_input=room_io.AudioInputOptions(
            noise_cancellation=noise_cancellation.BVC(),
        ),
        participant_kinds=[rtc.ParticipantKind.PARTICIPANT_KIND_STANDARD],
        participant_identity=owner_identity,
    )

    await session.start(
        agent=NotissimaVoiceAgent(config),
        room=ctx.room,
        room_options=room_options,
    )

    await insert_live_transcript_line(
        config.call_id,
        "agent",
        config.display_name,
        config.greeting,
    )
    persisted_assistant_texts.add(config.greeting)
    await session.generate_reply(
        instructions=f"Respond with exactly: {config.greeting}",
        allow_interruptions=False,
    )

    dismiss_wait = asyncio.create_task(dismiss_event.wait())
    disconnect_wait = asyncio.create_task(_wait_for_room_disconnect(ctx.room))
    await asyncio.wait(
        {dismiss_wait, disconnect_wait},
        return_when=asyncio.FIRST_COMPLETED,
    )
    dismiss_wait.cancel()
    disconnect_wait.cancel()

    if dismiss_event.is_set() and ctx.room.connection_state == rtc.ConnectionState.CONN_CONNECTED:
        ack = random.choice(config.ack_phrases)
        persisted_assistant_texts.add(ack)
        await insert_live_transcript_line(config.call_id, "agent", config.display_name, ack)
        await session.generate_reply(
            instructions=f'Respond with exactly: "{ack}"',
            allow_interruptions=False,
        )

    await session.aclose()


async def _wait_for_room_disconnect(room: rtc.Room) -> None:
    while room.connection_state == rtc.ConnectionState.CONN_CONNECTED:
        await asyncio.sleep(0.5)


# ---------------------------------------------------------------------------
# Inbound SIP (caller-as-owner / callback) support
# ---------------------------------------------------------------------------


class InboundReceptionistAgent(Agent):
    """Active-on-join agent that answers inbound phone calls."""

    def __init__(self, config: VoiceAgentConfig) -> None:
        caller_line = (
            f"The caller's name is {config.caller_name}; address them politely by name when natural. "
            if config.caller_name
            else ""
        )
        super().__init__(
            instructions=(
                f"You are {config.display_name}, a professional German-speaking phone assistant for Notissima. "
                f"Your user-facing name is {config.display_name}. "
                "You answered an inbound phone call. Speak naturally and helpfully in German. "
                f"{caller_line}"
                "If the caller asks what you can do or how you can help, briefly explain that you can "
                "answer their questions and help with their request during this call. "
                "Keep responses brief: one to three sentences unless asked for more. "
                "Plain text only; no markdown, lists, emojis, or JSON. "
                "Do not mention internal names such as Notissima internals, LiveKit, SIP, or dispatch rules."
            )
        )


def _extract_sip_number(participant: rtc.RemoteParticipant) -> str | None:
    attributes = getattr(participant, "attributes", None) or {}
    for key in (
        "sip.phoneNumber",
        "sip.phone_number",
        "sip.from_number",
        "sip.fromUser",
        "sip.from",
    ):
        value = attributes.get(key)
        if value:
            normalized = normalize_phone(value)
            if normalized:
                return normalized
    identity = getattr(participant, "identity", "") or ""
    match = re.search(r"\+?\d{6,15}", identity)
    if match:
        return normalize_phone(match.group(0))
    return None


async def wait_for_sip_caller(
    room: rtc.Room,
    timeout_s: float = 10.0,
) -> tuple[rtc.RemoteParticipant, str] | None:
    sip_kind = getattr(rtc.ParticipantKind, "PARTICIPANT_KIND_SIP", 3)
    deadline = asyncio.get_event_loop().time() + timeout_s
    while asyncio.get_event_loop().time() < deadline:
        if room.connection_state != rtc.ConnectionState.CONN_CONNECTED:
            return None
        for participant in room.remote_participants.values():
            if participant.kind != sip_kind:
                continue
            number = _extract_sip_number(participant)
            if number:
                return participant, number
        await asyncio.sleep(0.3)
    return None


async def run_inbound_session(
    ctx: JobContext,
    config: VoiceAgentConfig,
    sip_identity: str,
    caller_label: str,
) -> None:
    """Answer an inbound phone call and converse until the caller hangs up."""
    persisted_assistant_texts: set[str] = set()
    session = AgentSession(
        stt=inference.STT(model="deepgram/nova-3", language=config.language),
        llm=inference.LLM(model="openai/gpt-4.1-mini"),
        tts=inference.TTS(
            model="cartesia/sonic-3",
            voice=os.environ.get("CARTESIA_VOICE_ID", config.voice_id),
            language=config.language,
            extra_kwargs={"speed": config.speech_speed},
        ),
    )

    @session.on("user_input_transcribed")
    def on_transcript(ev) -> None:
        text = (ev.transcript or "").strip()
        if not text or not ev.is_final:
            return
        logger.info("[inbound] Caller said: %s", text)
        asyncio.create_task(
            insert_live_transcript_line(config.call_id, f"participant:{sip_identity}", caller_label, text)
        )

    @session.on("conversation_item_added")
    def on_conversation_item(ev) -> None:
        item = getattr(ev, "item", None)
        role = getattr(item, "role", "")
        if role != "assistant":
            return
        content = getattr(item, "content", "")
        if isinstance(content, list):
            text = " ".join(str(part) for part in content if str(part).strip()).strip()
        else:
            text = str(content or "").strip()
        if not text or text in persisted_assistant_texts:
            return
        persisted_assistant_texts.add(text)
        logger.info("[inbound] Assistant said: %s", text)
        asyncio.create_task(
            insert_live_transcript_line(config.call_id, "agent", config.display_name, text)
        )

    room_options = room_io.RoomOptions(
        audio_input=room_io.AudioInputOptions(
            noise_cancellation=noise_cancellation.BVC(),
        ),
        participant_kinds=[getattr(rtc.ParticipantKind, "PARTICIPANT_KIND_SIP", 3)],
        participant_identity=sip_identity,
    )

    await session.start(
        agent=InboundReceptionistAgent(config),
        room=ctx.room,
        room_options=room_options,
    )

    salutation = f"Guten Tag {config.caller_name}" if config.caller_name else "Guten Tag"
    consent_greeting = (
        f"{salutation}, hier ist {config.display_name}. "
        "Dieses Gespräch wird zu Dokumentationszwecken transkribiert. "
        f"{config.greeting}"
    )
    persisted_assistant_texts.add(consent_greeting)
    await insert_live_transcript_line(config.call_id, "agent", config.display_name, consent_greeting)
    await session.generate_reply(
        instructions=f"Respond with exactly: {consent_greeting}",
        allow_interruptions=False,
    )

    await _wait_for_room_disconnect(ctx.room)
    with contextlib.suppress(Exception):
        await session.aclose()


async def run_inbound_call(ctx: JobContext) -> bool:
    """Handle an inbound SIP call. Returns True if handled as inbound."""
    caller = await wait_for_sip_caller(ctx.room)
    if not caller:
        logger.info("Inbound: no SIP caller detected in room %s", ctx.room.name)
        return False

    participant, caller_number = caller
    sip_identity = participant.identity
    logger.info("Inbound call from %s (identity=%s)", caller_number, sip_identity)

    config = await load_inbound_voice_agent_config(caller_number)
    caller_label = config.caller_number or caller_number or "Anrufer"

    if not config.owner_user_id:
        # Tier 3: unknown caller. Politely answer and end without persistence.
        logger.info("Inbound caller unknown — ending politely: %s", caller_number)
        config.call_id = None
        await run_inbound_session(ctx, config, sip_identity, caller_label)
        return True

    config.call_id = await create_inbound_call(
        ctx.room.name,
        config.owner_user_id,
        config.caller_number,
        sip_identity,
    )
    if not config.call_id:
        logger.warning("Inbound: could not create call row; transcript will not persist")

    logger.info(
        "Inbound session ready: owner=%s caller=%s call=%s",
        config.owner_user_id,
        config.caller_number,
        config.call_id,
    )
    await run_inbound_session(ctx, config, sip_identity, caller_label)
    return True


server = AgentServer(shutdown_process_timeout=60.0)


@server.rtc_session(agent_name="notissima-voice-agent")
async def entrypoint(ctx: JobContext) -> None:
    await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)

    config = await load_voice_agent_config(
        ctx.room.name,
        ctx.room.metadata,
        getattr(ctx.job, "metadata", None),
    )

    # Inbound rooms (LiveKit SIP dispatch) have no Notissima owner in the room
    # metadata and no pre-existing calls row, so the owner cannot be resolved.
    # Treat these as inbound phone calls and resolve the owner from caller ID.
    if not config.owner_user_id:
        handled = await run_inbound_call(ctx)
        if handled:
            with contextlib.suppress(Exception):
                await ctx.room.disconnect()
            ctx.shutdown("inbound call complete")
            return
        logger.warning("Could not resolve room owner and no inbound caller — exiting")
        await ctx.room.disconnect()
        ctx.shutdown("owner unresolved")
        return

    if not config.enabled:
        logger.info(
            "Voice agent disabled for owner %s in room %s — disconnecting",
            config.owner_user_id,
            ctx.room.name,
        )
        await ctx.room.disconnect()
        ctx.shutdown("voice agent disabled")
        return

    config.owner_identity = config.owner_user_id
    # Outbound / web calls: the owner is the authenticated Notissima user in the
    # room, so data tools are trusted. Inbound (caller-ID only) stays untrusted
    # until phone verification is added.
    config.trusted = True
    if not config.call_id:
        config.call_id = await wait_for_call_id(ctx.room.name)
        if not config.call_id:
            logger.warning("Voice agent proceeding without call id; transcript lines will not be stored")
    logger.info(
        "Voice agent ready in room %s for owner %s (%s), call=%s",
        ctx.room.name,
        config.owner_user_id,
        config.display_name,
        config.call_id,
    )

    # The room transcript buffer is the single owner STT stream and also drives
    # wake-word detection, so the wake phrase is persisted before the agent
    # greets. `active_flag` suppresses wake detection while a session is active.
    buffer_stop = asyncio.Event()
    wake_event = asyncio.Event()
    active_flag = asyncio.Event()
    buffer_task = asyncio.create_task(
        run_room_transcript_buffer(ctx.room, config, buffer_stop, wake_event, active_flag)
    )
    try:
        while ctx.room.connection_state == rtc.ConnectionState.CONN_CONNECTED:
            wake_event.clear()
            wake_wait = asyncio.create_task(wake_event.wait())
            disconnect_wait = asyncio.create_task(_wait_for_room_disconnect(ctx.room))
            await asyncio.wait(
                {wake_wait, disconnect_wait},
                return_when=asyncio.FIRST_COMPLETED,
            )
            wake_wait.cancel()
            disconnect_wait.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await wake_wait
                await disconnect_wait

            if not wake_event.is_set() or ctx.room.connection_state != rtc.ConnectionState.CONN_CONNECTED:
                break

            active_flag.set()
            try:
                await run_active_session(ctx, config)
            except Exception:
                logger.exception("Active session failed")
            finally:
                active_flag.clear()

            await asyncio.sleep(0.2)
    finally:
        buffer_stop.set()
        buffer_task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await buffer_task


if __name__ == "__main__":
    cli.run_app(server)
