import asyncio
import contextlib
import logging
import os
import random

from dotenv import load_dotenv
from livekit import rtc
from livekit.agents import (
    Agent,
    AgentServer,
    AgentSession,
    AutoSubscribe,
    JobContext,
    cli,
    inference,
    room_io,
    stt,
)
from livekit.plugins import noise_cancellation

from config_loader import (
    VoiceAgentConfig,
    insert_live_transcript_line,
    load_voice_agent_config,
    phrase_matches,
    resolve_call_id,
)

logger = logging.getLogger("voice-agent")
load_dotenv()


class NotissimaVoiceAgent(Agent):
    """Active voice agent for the owner after wake."""

    def __init__(self, config: VoiceAgentConfig) -> None:
        super().__init__(
            instructions=(
                f"You are {config.display_name}, a concise in-call voice assistant. "
                f"Your user-facing name is {config.display_name}; this is the only name you should use for yourself. "
                f"You were activated by the wake phrase '{config.wake_word}'. "
                f"If asked who you are or what your name is, answer that you are {config.display_name}. "
                "Do not mention internal names such as Notissima, notissima-voice-agent, LiveKit, or dispatch rules unless explicitly asked about implementation. "
                "You are speaking in a live call and only the owner can command you. "
                "Answer the owner's questions helpfully and naturally. "
                "Keep responses brief: one to three sentences unless asked for more. "
                "Plain text only; no markdown, lists, emojis, or JSON. "
                "Do not explain internal modes or implementation details."
            )
        )


async def wait_for_call_id(room_name: str, timeout_s: float = 10.0) -> str | None:
    deadline = asyncio.get_event_loop().time() + timeout_s
    while asyncio.get_event_loop().time() < deadline:
        call_id = await resolve_call_id(room_name)
        if call_id:
            return call_id
        await asyncio.sleep(0.5)
    return None


async def wait_for_owner_audio_track(room: rtc.Room, owner_identity: str) -> rtc.AudioTrack:
    while room.connection_state == rtc.ConnectionState.CONN_CONNECTED:
        participant = room.remote_participants.get(owner_identity)
        if participant:
            for publication in participant.track_publications.values():
                if publication.kind != rtc.TrackKind.KIND_AUDIO:
                    continue
                if not publication.subscribed:
                    publication.set_subscribed(True)
                track = publication.track
                if track is not None:
                    return track
        await asyncio.sleep(0.25)
    raise RuntimeError("Room disconnected before owner audio was available")


async def run_wake_listener(
    room: rtc.Room,
    owner_identity: str,
    wake_phrases: list[str],
    language: str,
    wake_detected: asyncio.Event,
    stop_event: asyncio.Event,
) -> None:
    """Standalone STT on owner mic only — no AgentSession while sleeping."""
    track = await wait_for_owner_audio_track(room, owner_identity)
    audio_stream = rtc.AudioStream(track)
    stt_engine = inference.STT(model="deepgram/nova-3", language=language)
    stt_stream = stt_engine.stream()

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
            logger.info("[sleep] Owner said: %s", text)
            if phrase_matches(text, wake_phrases):
                logger.info("Wake phrase detected")
                wake_detected.set()
                return
    finally:
        stop_event.set()
        pump_task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await pump_task
        with contextlib.suppress(Exception):
            await stt_engine.aclose()


async def run_active_session(ctx: JobContext, config: VoiceAgentConfig) -> None:
    """Full AgentSession pipeline on owner mic only until dismiss."""
    owner_identity = config.owner_identity or config.owner_user_id
    if not owner_identity:
        return

    dismiss_event = asyncio.Event()
    persisted_assistant_texts: set[str] = set()
    session = AgentSession(
        stt=inference.STT(model="deepgram/nova-3", language=config.language),
        llm=inference.LLM(model="openai/gpt-4.1-mini"),
        tts=inference.TTS(
            model="cartesia/sonic-3",
            voice=os.environ.get("CARTESIA_VOICE_ID", config.voice_id),
            language=config.language,
        ),
    )

    @session.on("user_input_transcribed")
    def on_transcript(ev) -> None:
        text = (ev.transcript or "").strip()
        if not text or not ev.is_final:
            return
        logger.info("[active] Owner said: %s", text)
        asyncio.create_task(
            insert_live_transcript_line(
                config.call_id,
                "owner",
                "You",
                text,
            )
        )
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


server = AgentServer(shutdown_process_timeout=60.0)


@server.rtc_session(agent_name="notissima-voice-agent")
async def entrypoint(ctx: JobContext) -> None:
    await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)

    config = await load_voice_agent_config(
        ctx.room.name,
        ctx.room.metadata,
        getattr(ctx.job, "metadata", None),
    )
    if not config.enabled:
        logger.info(
            "Voice agent disabled for owner %s in room %s — disconnecting",
            config.owner_user_id,
            ctx.room.name,
        )
        await ctx.room.disconnect()
        ctx.shutdown("voice agent disabled")
        return
    if not config.owner_user_id:
        logger.warning("Could not resolve room owner — exiting")
        await ctx.room.disconnect()
        ctx.shutdown("owner unresolved")
        return

    config.owner_identity = config.owner_user_id
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

    while ctx.room.connection_state == rtc.ConnectionState.CONN_CONNECTED:
        wake_detected = asyncio.Event()
        stop_listener = asyncio.Event()
        wake_listener = asyncio.create_task(
            run_wake_listener(
                ctx.room,
                config.owner_identity,
                config.wake_phrases,
                config.language,
                wake_detected,
                stop_listener,
            )
        )
        wake_wait = asyncio.create_task(wake_detected.wait())

        try:
            finished, _pending = await asyncio.wait(
                {wake_wait, wake_listener},
                return_when=asyncio.FIRST_COMPLETED,
            )
            if wake_listener in finished and wake_listener.exception():
                raise wake_listener.exception()  # type: ignore[misc]
        except Exception:
            logger.exception("Wake listener failed")
            stop_listener.set()
            wake_listener.cancel()
            wake_wait.cancel()
            if ctx.room.connection_state != rtc.ConnectionState.CONN_CONNECTED:
                break
            await asyncio.sleep(1)
            continue
        finally:
            stop_listener.set()
            wake_listener.cancel()
            wake_wait.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await wake_listener
                await wake_wait

        if not wake_detected.is_set() or ctx.room.connection_state != rtc.ConnectionState.CONN_CONNECTED:
            break

        try:
            await run_active_session(ctx, config)
        except Exception:
            logger.exception("Active session failed")

        await asyncio.sleep(0.2)


if __name__ == "__main__":
    cli.run_app(server)
