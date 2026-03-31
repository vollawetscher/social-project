# Frau Peters — LiveKit Voice Agent

A LiveKit agent that silently listens to calls and activates on the wake word "Frau Peters".

## How It Works

```
PASSIVE MODE (default)
  │  Subscribes to human participants' audio (excludes other agents)
  │  Accumulates conversation context via STT
  │  Zero LLM/TTS cost — completely silent
  │
  ├──► User says "Frau Peters?"
  │
ACTIVE MODE
  │  Responds: "Ja, bitte?"
  │  Full STT → LLM → TTS conversation in German
  │  Has context of everything discussed before activation
  │
  ├──► User says "Danke, Frau Peters!"
  │    Responds: "Gerne!"
  │
  └──► Returns to PASSIVE MODE
```

## Architecture

- **STT**: Deepgram Nova-3 (German)
- **LLM**: OpenAI GPT-4.1-mini (via LiveKit Inference)
- **TTS**: Cartesia Sonic-3 (German female voice, configurable)
- **VAD**: Silero (prewarmed)
- **Turn detection**: Multilingual model

The agent auto-joins every room created on the LiveKit Cloud project. In production, it uses room metadata (`createdBy`) to link to the initiator. In test rooms without metadata, it links to the first human participant (`PARTICIPANT_KIND_STANDARD`), automatically excluding other agents.

## Setup

Requires Python 3.10+.

```bash
cd agent
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # fill in your keys
```

## Run Locally

```bash
# Interactive console mode (testing without LiveKit room)
python frau_peters.py console

# Development mode (connects to LiveKit Cloud, auto-joins rooms)
python frau_peters.py dev
```

## Deploy to LiveKit Cloud

```bash
lk cloud auth          # one-time login
lk agent deploy         # push agent to LiveKit Cloud
lk agent list           # verify deployment
```

View logs in the LiveKit Cloud dashboard or via CLI.

## Configuration

| Variable | Description |
|---|---|
| `LIVEKIT_URL` | LiveKit Cloud WebSocket URL |
| `LIVEKIT_API_KEY` | LiveKit API key |
| `LIVEKIT_API_SECRET` | LiveKit API secret |
| `OPENAI_API_KEY` | For GPT-4.1-mini (LLM) |
| `DEEPGRAM_API_KEY` | For Nova-3 (STT) |
| `CARTESIA_API_KEY` | For Sonic-3 (TTS) |
| `CARTESIA_VOICE_ID` | Optional. German female voice UUID from [Cartesia Voice Library](https://play.cartesia.ai/voices). Defaults to Jacqueline if not set. Recommended: search for "Alina" or "Sabine" in the library. |

## Room Integration

The agent auto-joins all rooms on the project — no explicit dispatch needed.

For production (Notissima), rooms are created with metadata:

```json
{ "createdBy": "user-identity" }
```

Frau Peters reads this to link exclusively to the initiator's audio. Without metadata (test rooms), she links to the first non-agent participant.
