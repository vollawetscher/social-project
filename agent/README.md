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
  │  AgentSession (LiveKit Inference STT → LLM → TTS) on owner mic only
  │  LiveKit: bundled VAD + BVC noise cancellation
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
| `LIVEKIT_URL` | Local development only. LiveKit Cloud injects this for hosted agents. |
| `LIVEKIT_API_KEY` | Local development only. LiveKit Cloud injects this for hosted agents. |
| `LIVEKIT_API_SECRET` | Local development only. LiveKit Cloud injects this for hosted agents. |
| `SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Read owner profile settings |
| `CARTESIA_VOICE_ID` | Optional LiveKit Inference voice override |

STT, LLM, and TTS are requested through LiveKit Inference. Do not add direct
Deepgram, OpenAI, or Cartesia provider keys for the hosted LiveKit Cloud agent.

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
