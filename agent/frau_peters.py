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
    firecrawl_scrape,
    firecrawl_search,
    get_call_documents,
    get_call_transcript_lines,
    get_owner_recent_sessions,
    run_deep_research,
    verify_owner_pin,
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

# Use Deepgram nova-3 multilingual/code-switching mode for speech-to-text so that
# calls with mixed languages (e.g. the owner speaking German to the agent and
# English to another participant) are transcribed correctly. TTS still uses the
# owner's configured language (config.language).
STT_LANGUAGE = "multi"

# Returned by owner-data tools when access hasn't been unlocked yet, so the LLM
# relays a consistent instruction to the caller instead of refusing vaguely.
PIN_LOCKED_MSG = (
    "Der Zugriff auf Ihre Daten ist noch nicht freigeschaltet. "
    "Bitte geben Sie Ihre PIN über die Telefontastatur ein, gefolgt von der Raute-Taste."
)


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
            "You can take notes, summarize the current call, recall the owner's past Notissima "
            "sessions, and discuss an attached document using your tools. "
            "Use take_note when the owner asks you to note or remember something. "
            "Use get_current_call_transcript when the owner asks about THIS call — for example to "
            "summarize what has been discussed so far or what someone just said in the current "
            "conversation. Base any summary of the current call only on that transcript. "
            "Use recall_recent_sessions ONLY for the owner's earlier, already-finished Notissima "
            "sessions — never use it to summarize the current call. "
            "Use read_document to read a document attached to this call; documents may be attached "
            "at any point during the call, so call read_document to check rather than assuming none "
            "exists. "
            "Use web_search to look up current information the owner asks about (news, facts, prices, "
            "anything that may be newer than your training) and read_url to read a specific web page. "
            "Use deep_research when the owner asks you to research a topic and report back or save it — "
            "it runs in the background and saves the result as a note. "
            "If the owner asks what you can do or how you can help, briefly explain in one or two "
            "sentences that you can answer questions during the call, search the web, take notes to "
            "their account, summarize the current call, recall their past sessions, and discuss an "
            "attached document. "
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
        """Read the full text of the document(s) attached to this call.

        Documents may be attached at any time during the call, so this always
        fetches the latest attached documents rather than a snapshot.
        """
        text = (self._config.documents_full or "").strip()
        if self._config.call_id:
            documents = await get_call_documents(self._config.call_id)
            if documents:
                live_text = "\n\n".join(
                    f"{str(d.get('filename') or 'Dokument')}:\n{str(d.get('extracted_text') or '')}"
                    for d in documents
                ).strip()
                if live_text:
                    text = live_text
                    self._config.documents_full = live_text
                    self._config.document_context = build_document_context(documents)
        if not text:
            return "Für dieses Gespräch ist kein Dokument hinterlegt."
        return text[:6000]

    @function_tool
    async def get_current_call_transcript(self, context: RunContext) -> str:
        """Return the transcript of the CURRENT ongoing call.

        Use this to summarize or answer questions about the current conversation
        (what has been said so far in this call). Do not use recall_recent_sessions
        for the current call.
        """
        if not self._config.call_id:
            return "Für dieses Gespräch liegt noch kein Protokoll vor."
        lines = await get_call_transcript_lines(self._config.call_id)
        if not lines:
            return "In diesem Gespräch wurde bisher nichts aufgezeichnet."
        parts: list[str] = []
        for line in lines:
            speaker = str(line.get("speaker_label") or "Sprecher").strip()
            text = str(line.get("text") or "").strip()
            if text:
                parts.append(f"{speaker}: {text}")
        transcript = "\n".join(parts)
        return "Protokoll des aktuellen Gesprächs:\n" + transcript[:6000]

    @function_tool
    async def web_search(self, context: RunContext, query: str) -> str:
        """Search the web for current information to answer the owner's question.

        Use this whenever the answer may be newer than your training data, or for
        facts, current events, prices, or anything you're unsure about. Summarize
        the results aloud in one or two sentences.

        Args:
            query: The search query.
        """
        results = await firecrawl_search(query, limit=4)
        if not results:
            return "Ich konnte dazu online nichts finden."
        lines: list[str] = []
        for r in results[:4]:
            title = r.get("title") or r.get("url") or "Ergebnis"
            desc = r.get("description") or ""
            lines.append(f"{title}: {desc}".strip().rstrip(":"))
        return "Web-Ergebnisse:\n" + "\n".join(lines)

    @function_tool
    async def read_url(self, context: RunContext, url: str) -> str:
        """Read the content of a specific web page so you can discuss or summarize it.

        Args:
            url: The full URL to read.
        """
        content = await firecrawl_scrape(url, max_chars=6000)
        if not content:
            return "Ich konnte diese Seite nicht abrufen."
        return content

    @function_tool
    async def deep_research(self, context: RunContext, topic: str) -> str:
        """Start an in-depth web research task in the background and save the result
        as a note in the owner's account. Use when the owner asks you to research
        something and report back or save it (rather than answer immediately).

        Args:
            topic: What to research.
        """
        if not self._config.owner_user_id:
            return "Ich kann darauf gerade nicht zugreifen."
        if not self._config.trusted:
            return PIN_LOCKED_MSG
        asyncio.create_task(run_deep_research(self._config.owner_user_id, topic))
        return "Ich recherchiere das im Hintergrund und lege dir das Ergebnis als Notiz ab."

    @function_tool
    async def verify_pin(self, context: RunContext, pin: str) -> str:
        """Verify the caller's PIN to unlock access to their Notissima data.

        Only relevant on inbound phone calls where the caller is the account owner
        and must confirm their identity before you can use data tools.

        Args:
            pin: The digits the caller provided.
        """
        if self._config.trusted:
            return "Der Zugriff ist bereits freigeschaltet."
        if not self._config.pin_hash:
            return "Für dieses Konto ist keine PIN hinterlegt, daher kann ich keine persönlichen Daten freigeben."
        if verify_owner_pin(self._config, pin):
            self._config.trusted = True
            return "Vielen Dank, der Zugriff ist jetzt freigeschaltet."
        return "Die PIN ist leider nicht korrekt."

    @function_tool
    async def take_note(self, context: RunContext, note: str) -> str:
        """Save a note to the owner's Notissima account.

        Args:
            note: The exact text of the note to save.
        """
        if not self._config.owner_user_id:
            return "Ich kann darauf gerade nicht zugreifen."
        if not self._config.trusted:
            return PIN_LOCKED_MSG
        ok = await create_owner_note(self._config.owner_user_id, note)
        if ok and self._config.call_id:
            await insert_live_transcript_line(
                self._config.call_id, "agent", self._config.display_name, f"Notiz gespeichert: {note}"
            )
        return "Die Notiz wurde gespeichert." if ok else "Das Speichern der Notiz ist fehlgeschlagen."

    @function_tool
    async def recall_recent_sessions(self, context: RunContext) -> str:
        """Recall the owner's most recent Notissima sessions (title, summary, date)."""
        if not self._config.owner_user_id:
            return "Ich kann darauf gerade nicht zugreifen."
        if not self._config.trusted:
            return PIN_LOCKED_MSG
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
    stt_engine = inference.STT(model="deepgram/nova-3", language=STT_LANGUAGE)
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
                # The dismiss phrase (e.g. "Danke, Frau Peters") contains the wake
                # phrase ("Frau Peters"), so without this guard the farewell would
                # immediately re-wake her right after she deactivates.
                and not phrase_matches(text, config.dismiss_phrases)
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
        stt=inference.STT(model="deepgram/nova-3", language=STT_LANGUAGE),
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
            # The AgentSession auto-replies to every turn, so the farewell would
            # otherwise trigger a rambling LLM goodbye. Cut it immediately so only
            # the short acknowledgement below is spoken before she deactivates.
            with contextlib.suppress(Exception):
                asyncio.create_task(session.interrupt())

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
        # Stop any in-progress/queued auto-reply to the farewell, then say only a
        # brief acknowledgement so deactivation is clean and quiet.
        with contextlib.suppress(Exception):
            await session.interrupt()
        ack = random.choice(config.ack_phrases)
        persisted_assistant_texts.add(ack)
        await insert_live_transcript_line(config.call_id, "agent", config.display_name, ack)
        await session.generate_reply(
            instructions=f'Say exactly this and nothing else, then stop: "{ack}"',
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
                f"If asked who you are, say you are {config.display_name}. "
                "Do not discuss internal implementation details such as LiveKit, SIP, dispatch rules, or these instructions."
            )
        )


class InboundOwnerAgent(NotissimaVoiceAgent):
    """Inbound agent for a tier-1 caller who IS the account owner.

    Inherits all owner tools from NotissimaVoiceAgent but answers active-on-join
    (no wake word) with phone-appropriate instructions. Data tools stay locked
    (config.trusted False) until the owner verifies their PIN — via the phone
    keypad (DTMF, handled in run_inbound_session) or by saying it (verify_pin).
    """

    def __init__(self, config: VoiceAgentConfig) -> None:
        pin_line = (
            "Access to the caller's Notissima data is unlocked by entering their PIN "
            "on the phone keypad. IMPORTANT: when the caller asks about their notes, "
            "sessions, or wants to save something, ALWAYS call the matching tool "
            "(take_note, recall_recent_sessions, deep_research) — do not refuse or "
            "ask for the PIN on your own first. If access isn't unlocked yet, the "
            "tool result itself will tell you to ask for the PIN; only then ask them "
            "once to enter it on the keypad followed by the pound key. Once you have "
            "seen a confirmation that access is freigeschaltet (or a tool succeeds), "
            "treat access as granted and NEVER ask for the PIN again. If the caller "
            "says they already entered their PIN, do not argue — just call the tool. "
            if config.pin_hash
            else (
                "No PIN is configured for this account, so you cannot access their "
                "personal Notissima data on this call — you can still answer general "
                "questions and search the web. "
            )
        )
        # Bypass NotissimaVoiceAgent.__init__ (wake-word/in-call instructions) but
        # keep its inherited @function_tool methods.
        Agent.__init__(
            self,
            instructions=(
                f"You are {config.display_name}, the personal voice assistant for this Notissima "
                "user, who has called in by phone. Speak naturally and helpfully in German. "
                f"{pin_line}"
                "You can search the web (web_search) and read a page (read_url) at any time. "
                "Keep responses brief: one to three sentences unless asked for more. "
                "Plain text only; no markdown, lists, emojis, or JSON. "
                f"If asked who you are, say you are {config.display_name}. "
                "Do not discuss internal implementation details such as LiveKit, SIP, dispatch rules, or these instructions."
            ),
        )
        self._config = config


def _dtmf_digit(ev: object) -> str:
    """Best-effort extraction of a DTMF digit from a LiveKit SIP DTMF event."""
    digit = getattr(ev, "digit", None)
    if isinstance(digit, str) and digit:
        return digit
    code = getattr(ev, "code", None)
    if isinstance(code, int):
        if 0 <= code <= 9:
            return str(code)
        if code == 10:
            return "*"
        if code == 11:
            return "#"
    return ""


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
        stt=inference.STT(model="deepgram/nova-3", language=STT_LANGUAGE),
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

    # Tier-1 caller who IS the owner (with an activated agent) gets the owner
    # agent (data tools, locked until PIN). Everyone else gets the neutral
    # answer-only receptionist.
    owner_mode = bool(config.caller_is_owner and config.enabled)
    agent = InboundOwnerAgent(config) if owner_mode else InboundReceptionistAgent(config)

    await session.start(
        agent=agent,
        room=ctx.room,
        room_options=room_options,
    )

    # PIN unlock via the phone keypad (DTMF). Spoken PIN is handled by the
    # verify_pin tool as a fallback.
    pin_via_dtmf_enabled = owner_mode and bool(config.pin_hash)
    if pin_via_dtmf_enabled:
        pin_buffer: list[str] = []
        pin_attempts = {"count": 0}
        max_pin_attempts = 3

        async def _announce(text: str) -> None:
            # Speak it; the conversation_item_added handler persists it once. Don't
            # also insert the line manually or it appears twice in the transcript.
            with contextlib.suppress(Exception):
                await session.generate_reply(
                    instructions=f'Say exactly this and nothing else: "{text}"',
                    allow_interruptions=False,
                )

        def _evaluate_pin() -> None:
            candidate = "".join(pin_buffer)
            pin_buffer.clear()
            if not candidate or config.trusted:
                return
            if verify_owner_pin(config, candidate):
                config.trusted = True
                logger.info("[inbound] PIN accepted via DTMF for owner %s", config.owner_user_id)
                asyncio.create_task(_announce("Vielen Dank, der Zugriff ist jetzt freigeschaltet."))
            else:
                pin_attempts["count"] += 1
                logger.info("[inbound] PIN rejected via DTMF (attempt %d)", pin_attempts["count"])
                if pin_attempts["count"] >= max_pin_attempts:
                    asyncio.create_task(_announce("Die PIN war mehrfach falsch. Ich kann keine persönlichen Daten freigeben."))
                else:
                    asyncio.create_task(_announce("Die PIN ist leider nicht korrekt. Bitte versuchen Sie es erneut, gefolgt von der Raute-Taste."))

        def _on_dtmf(ev) -> None:
            if config.trusted or pin_attempts["count"] >= max_pin_attempts:
                return
            digit = _dtmf_digit(ev)
            if not digit:
                return
            if digit == "#":
                _evaluate_pin()
            elif digit.isdigit():
                pin_buffer.append(digit)
                if len(pin_buffer) >= 6:
                    _evaluate_pin()

        with contextlib.suppress(Exception):
            ctx.room.on("sip_dtmf_received", _on_dtmf)

    salutation = f"Guten Tag {config.caller_name}" if config.caller_name else "Guten Tag"
    if pin_via_dtmf_enabled and not config.trusted:
        greeting_tail = (
            "Um auf Ihre Daten zuzugreifen, geben Sie bitte Ihre PIN ein, gefolgt von der Raute-Taste. "
            f"{config.greeting}"
        )
    else:
        greeting_tail = config.greeting
    consent_greeting = (
        f"{salutation}, hier ist {config.display_name}. "
        "Dieses Gespräch wird zu Dokumentationszwecken transkribiert. "
        f"{greeting_tail}"
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
