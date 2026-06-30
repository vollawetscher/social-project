# Notissima Voice Agent

Single deployable named LiveKit agent (`notissima-voice-agent`) — one worker serves all users. Per-user wake word, enable flag, and voice selection come from Supabase `profiles`.

## Architecture (MVP)

```
SLEEP
  │  Room transcript buffer transcribes up to 10 human participant tracks
  │  and writes final utterances to call_live_transcript_lines
  │
  │  Standalone Deepgram STT on owner mic only (no AgentSession)
  │  Fuzzy match wake phrase from owner profile
  │
  ├──► Owner says wake phrase
  │
ACTIVE
  │  AgentSession (LiveKit Inference STT → LLM → TTS) on owner mic only
  │  LiveKit: bundled VAD + BVC noise cancellation
  │  Greeting → concise assistant conversation
  │
  ├──► Owner says dismiss phrase → random ack → SLEEP
```

- **Explicit dispatch:** Notissima dispatches the named agent only when `voice_agent_enabled` is true for the room owner.
- **Owner binding:** `metadata.createdBy` or `calls.user_id` — never first participant in room.
- **Inbound SIP:** rooms with no Notissima owner (LiveKit SIP dispatch) are treated as inbound calls. The owner is resolved from the caller's number — Tier 1: a Notissima user (`profiles.phone_number`), Tier 2: the most recent outbound call to that number. The agent answers active-on-join with a transcription consent line, creates a `pstn_inbound` calls row, and the webhook finalizes the transcript.
- **Room buffer:** standard web participants and SIP/PSTN participants are transcribed continuously while the agent job is in the room (cap: 10 human participants).
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
