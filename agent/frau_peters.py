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
    JobProcess,
    TurnHandlingOptions,
    cli,
    inference,
    room_io,
    stt,
)
from livekit.plugins import deepgram, noise_cancellation, silero
from livekit.plugins.turn_detector.multilingual import MultilingualModel

from config_loader import VoiceAgentConfig, load_voice_agent_config, phrase_matches

logger = logging.getLogger("voice-agent")
load_dotenv()


class EchoAgent(Agent):
    """MVP active agent: echoes the owner's speech after wake."""

    def __init__(self, config: VoiceAgentConfig) -> None:
        super().__init__(
            instructions=(
                f"You are {config.display_name}, a concise voice assistant. "
                f"Repeat the user's last request back verbatim, prefixed with 'Echo:'. "
                "Use one short sentence. Plain text only."
            )
        )


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
    stt_engine = deepgram.STT(model="nova-3", language=language)
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
    session = AgentSession(
        stt=inference.STT(model="deepgram/nova-3", language=config.language),
        llm=inference.LLM(model="openai/gpt-4.1-mini"),
        tts=inference.TTS(
            model="cartesia/sonic-3",
            voice=os.environ.get("CARTESIA_VOICE_ID", "9626c31c-bec5-4cca-baa8-f8ba9e84c8bc"),
            language=config.language,
        ),
        turn_handling=TurnHandlingOptions(turn_detection=MultilingualModel()),
        vad=ctx.proc.userdata["vad"],
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

    room_options = room_io.RoomOptions(
        audio_input=room_io.AudioInputOptions(
            noise_cancellation=noise_cancellation.BVC(),
        ),
        participant_kinds=[rtc.ParticipantKind.PARTICIPANT_KIND_STANDARD],
        participant_identity=owner_identity,
    )

    await session.start(
        agent=EchoAgent(config),
        room=ctx.room,
        room_options=room_options,
    )

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
        await session.generate_reply(
            instructions=f'Respond with exactly: "{ack}"',
            allow_interruptions=False,
        )

    await session.aclose()


async def _wait_for_room_disconnect(room: rtc.Room) -> None:
    while room.connection_state == rtc.ConnectionState.CONN_CONNECTED:
        await asyncio.sleep(0.5)


server = AgentServer(shutdown_process_timeout=60.0)


def prewarm(proc: JobProcess) -> None:
    proc.userdata["vad"] = silero.VAD.load()


server.setup_fnc = prewarm


@server.rtc_session()
async def entrypoint(ctx: JobContext) -> None:
    await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)

    config = await load_voice_agent_config(ctx.room.name, ctx.room.metadata)
    if not config.enabled:
        logger.info("Voice agent disabled for room owner — exiting")
        return
    if not config.owner_user_id:
        logger.warning("Could not resolve room owner — exiting")
        return

    config.owner_identity = config.owner_user_id
    logger.info(
        "Voice agent ready in room %s for owner %s (%s)",
        ctx.room.name,
        config.owner_user_id,
        config.display_name,
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
