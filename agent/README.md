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
- **Inbound SIP:** rooms with no Notissima owner (LiveKit SIP dispatch) are treated as inbound calls. The owner is resolved from the caller's number — Tier 1: a Notissima user (`profiles.phone_number`, the caller IS the owner), Tier 2: the most recent outbound call to that number (the caller is a contact). The agent answers active-on-join with a transcription consent line, creates a `pstn_inbound` calls row, and the webhook finalizes the transcript.
- **Inbound identity:** only the **owner themselves** (tier 1, with an activated agent) hears their personal agent. Tier-2 contacts and unknown callers are answered as the neutral **Notissima Agent** — a returning contact can't be assumed to know the owner's agent name, and it would leak the owner's setup.
- **Inbound PIN gate:** a tier-1 owner unlocks data tools (`take_note`, `recall_recent_sessions`, `deep_research`) only after entering their PIN on the keypad (DTMF) — or saying it (`verify_pin`). Web search stays available; sensitive data tools stay locked (`config.trusted`) until verified. PIN is a SHA-256 hash of `<VOICE_AGENT_PIN_PEPPER>:<user_id>:<pin>` (must match the web app).
- **Room buffer:** standard web participants and SIP/PSTN participants are transcribed continuously while the agent job is in the room (cap: 10 human participants).
- **No batch recording:** when voice agent is enabled, Notissima skips composite egress (see webhook).
- **Owner tools (active mode):** `take_note`, `recall_recent_sessions`, `search_my_data` (keyword + date-range search over past sessions/transcripts), `get_current_call_transcript`, `read_document`, plus web access via Firecrawl — `web_search` and `read_url` (inline) and `deep_research` (background; saves a "Recherche: …" note). Web tools require `FIRECRAWL_API_KEY`.

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
| `FIRECRAWL_API_KEY` | Web search/scrape/research for the agent (Firecrawl). Without it, web tools return "nothing found". |
| `FIRECRAWL_API_BASE` / `FIRECRAWL_TIMEOUT_S` | Optional Firecrawl overrides |
| `VOICE_AGENT_STT_KEYTERMS` | Opt-in (`1`/`true`) to boost STT with the owner's contact/name keyterms. Off by default; falls back safely if unsupported. |

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
