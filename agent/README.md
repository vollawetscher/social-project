# Notissima Voice Agent

Single deployable LiveKit agent (`frau_peters.py`) — one worker serves all users. Per-user wake word and enable flag come from Supabase `profiles`.

## Architecture (MVP)

```
SLEEP
  │  Standalone Deepgram STT on owner mic only (no AgentSession)
  │  Fuzzy match wake phrase from owner profile
  │
  ├──► Owner says wake phrase
  │
ACTIVE
  │  AgentSession (Deepgram STT → GPT → Cartesia TTS) on owner mic only
  │  LiveKit: Silero VAD, multilingual turn detector, BVC noise cancellation
  │  Greeting → echo MVP conversation
  │
  ├──► Owner says dismiss phrase → random ack → SLEEP
```

- **Auto-join:** worker joins LiveKit rooms on the project; exits immediately if `voice_agent_enabled` is false for the room owner.
- **Owner binding:** `metadata.createdBy` or `calls.user_id` — never first participant in room.
- **No batch recording:** when voice agent is enabled, Notissima skips composite egress (see webhook).

## Setup

Requires Python 3.10+.

```bash
cd agent
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

## Environment

| Variable | Description |
|---|---|
| `LIVEKIT_URL` | LiveKit Cloud WebSocket URL |
| `LIVEKIT_API_KEY` | LiveKit API key |
| `LIVEKIT_API_SECRET` | LiveKit API secret |
| `SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Read owner profile settings |
| `OPENAI_API_KEY` | LiveKit Inference LLM |
| `DEEPGRAM_API_KEY` | Wake listener + active STT |
| `CARTESIA_API_KEY` | TTS |
| `CARTESIA_VOICE_ID` | Optional voice UUID |

## Run / Deploy

```bash
python frau_peters.py dev      # local dev
python frau_peters.py start    # production entrypoint (Docker)
lk agent deploy                # LiveKit Cloud
```

## Room metadata

Instant calls set:

```json
{ "callType": "web", "mode": "audio", "createdBy": "<user-uuid>" }
```

Personal meeting links also include `createdBy` (profile owner id).
