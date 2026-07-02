# Future Upgrades / Backlog

A running list of improvements, refactors, and deferred fixes that are worth doing
but are out of scope for the change that surfaced them. This is a planning
document, not a changelog. When something here ships, move a user-facing summary
into `lib/constants/changelog.ts` and delete or mark the entry as Done.

## How to use this file

- Add an entry when you consciously defer work (a follow-up refactor, a known
  edge case, an efficiency win, a nice-to-have).
- Keep each entry self-contained: what/why, the proposed approach, affected
  areas, and rough scope/risk. Avoid calendar estimates — describe technical
  effort instead.
- Prefer linking to concrete files/functions so the next person can start fast.
- Status values: `Idea`, `Planned`, `In progress`, `Blocked`, `Done`.

---

## Voice agent

### Shared call-level analysis for multi-party calls
- **Status:** Idea
- **Context:** Every participant of a call gets their own session (host session +
  each claiming user's forked session). Analysis (`session_analyze`) currently
  runs once per session, so an N-Notissima-user call runs N full analyses.
- **Problem:**
  - N× LLM cost for the same recording.
  - Non-determinism means each participant can get a slightly different summary
    of the *same* call (consistency bug).
- **Insight — analysis has two layers:**
  - **Objective / call-level (identical for everyone):** transcript, detected
    language, neutral summary, topics/action items, content-derived domains, PII
    redaction. Should be computed once.
  - **Perspective / owner-level (per participant):** speaker resolution
    ("who is *You*"), `owner_context` (private, must not leak between users),
    owner-tailored suggested outputs, per-owner report defaults. Must stay per
    participant.
- **Proposed approach:**
  - Compute the objective layer once, keyed to the **call/room** (not a specific
    user's session), and **copy** (not reference) it into each participant
    session as they claim — mirroring the existing transcript copy-on-claim /
    `is_callee_pending` plumbing.
  - Run only the cheap per-owner layer per participant.
  - Copy (not reference) keeps each session self-contained for RLS / data
    sovereignty and robust to the initiator deleting their session.
- **Affected areas:** `app/api/sessions/[id]/analyze/route.ts` (split A vs B —
  they're entangled today), `app/api/calls/[id]/claim/route.ts` (copy objective
  layer on claim), `app/api/calls/webhook/route.ts` (`finalizeVoiceAgentTranscript`
  / `finalizeVoiceAgentCalleeSession`).
- **Scope/risk:** Moderately invasive — main work is decomposing the single
  analyze pass and adding a call-keyed objective-analysis cache + copy-on-claim.
- **Note:** The current per-session analysis (shipped) is correct but not
  optimal; it's a fine baseline until group calls become common.

### Inbound verification gate for sensitive tools
- **Status:** Planned
- **Context:** Inbound SIP callers are matched to an owner by phone number
  (`resolve_inbound_owner`, tiers 1–3). Tools that read/write owner data
  (`take_note`, `recall_recent_sessions`, etc.) are gated by `config.trusted`.
- **Problem:** Phone-number matching alone is weak authentication for unlocking
  access to a user's private notes/sessions.
- **Proposed approach:** Add a verification step (e.g. spoken PIN / one-time code)
  before enabling data-access tools for inbound callers; keep answering-only
  capabilities available pre-verification.
- **Affected areas:** `agent/frau_peters.py` (inbound session gating),
  `agent/config_loader.py` (owner resolution / trust flag).

### Agentic skills (web + delegation) — design
- **Status:** In progress (slice 1 shipped)
- **Model:** one voice agent (LiveKit-native, lowest latency) with a tool belt in
  two tiers, to stay agentic without wrecking voice latency:
  - **Tier 1 — inline** (answer within the turn, ~1–5s): `web_search`,
    `read_url`, plus existing `take_note`, `recall_recent_sessions`,
    `get_current_call_transcript`, `read_document`.
  - **Tier 2 — delegated/async** (kick off → confirm by voice → deliver into the
    account): `deep_research`, and future report generation.
- **Provider:** Firecrawl (REST API from the Python agent via `aiohttp`), keyed by
  `FIRECRAWL_API_KEY` in the **agent deployment env**. `country=de` geo-targets
  results. EU boundary: web queries/content transit Firecrawl (accepted);
  owner/meeting data stays in Supabase/EU.
- **Shipped (slice 1):**
  - `web_search(query)` — Firecrawl `/v1/search` (limit 4, country de).
  - `read_url(url)` — Firecrawl `/v1/scrape` → markdown.
  - `deep_research(topic)` — background task: search + scrape top results, saved
    as a "Recherche: …" note via `create_owner_note` (owner-gated by `trusted`).
- **Next:**
  - `news_search` (`--sources news --tbs qdr:w`), `extract_structured`
    (Firecrawl agent + JSON schema), `crawl_and_summarize`, "enrich this call"
    (web lookup attached to the session).
  - `generate_report` delegated to the existing Notissima async output queue.
  - Voice latency filler ("einen Moment…") around slow tool calls.
  - Per-user / per-call Firecrawl credit cap.
  - Make the LLM model configurable (env/per-user); evaluate a stronger model for
    tool-heavy turns (the knowledge cutoff itself is now handled by `web_search`).
- **Affected areas:** `agent/frau_peters.py`, `agent/config_loader.py`.

### Configurable STT language (auto/multi vs locked)
- **Status:** Idea
- **Context:** STT was switched to Deepgram `nova-3` multilingual (`multi`) so
  mixed-language calls transcribe correctly.
- **Trade-off:** `multi` can be marginally less accurate than a single locked
  language for wake/dismiss phrase matching.
- **Proposed approach:** Make STT language a per-user setting (e.g. "auto/multi"
  vs a fixed locale), defaulting to `multi`.
- **Affected areas:** `agent/frau_peters.py` (`STT_LANGUAGE`), profile settings +
  settings UI.

---

## Assistant

### "Ask Frau Peters" text chat mode (assistant copilot)
- **Status:** Planned (design)
- **Two motivations:**
  1. **Testing harness** — iterate on the assistant's brain (prompt, tool
     selection, data access, answer quality) without spinning up a LiveKit room,
     mic, STT and TTS. Note it tests the *brain*, not the voice pipeline
     (wake/dismiss, STT, TTS, turn-taking, latency remain voice-only tests).
  2. **Product feature** — a persistent, anytime text copilot for every user,
     since Notissima already has both the data (sessions, transcripts, notes,
     outputs, contacts) and the skills (recall, web search/research via
     Firecrawl, document reading, note-taking, report generation).
- **Architecture decision:** build chat in **TypeScript/Next**, not through the
  Python LiveKit worker. The data access, the Anthropic SDK (already used for
  summaries/outputs), and API routes are all in TS. Proposed:
  - `POST /api/assistant/chat` (streaming) using **Claude with function-calling**.
  - A chat UI: global slide-over panel or a dedicated `/assistant` page.
  - Same persona ("Frau Peters") so voice and chat feel like one assistant.
- **Skills = shared contract, implemented per runtime.** Voice tools live in
  Python (`agent/`); chat tools wrap existing Notissima TS services/routes
  (sessions query, `outputs/generate` queue, Firecrawl). Keep the tool
  definitions conceptually shared so voice and chat don't drift; a later phase
  can extract a single source of truth.
- **Phasing:**
  1. MVP: panel + streaming endpoint + Claude with `recall_recent_sessions`,
     `search_my_data`, `web_search`, `take_note` (doubles as the test harness).
  2. `discuss_session/document`, `generate_output` (delegate to the async queue),
     `deep_research`.
  3. Unify skill definitions across voice + chat.
- **EU/data:** chat over the user's own data stays in Supabase/EU; web via
  Firecrawl (accepted). Claude is also stronger at multi-tool orchestration than
  the current `gpt-4.1-mini`, and `web_search` removes the knowledge-cutoff issue.
- **Tradeoff:** some tool logic will exist in both Python (voice) and TS (chat)
  until unified — manageable since the data layer is already TS.

## Calls & transcription

### Persistent, minimizable in-call widget (multitask during a call)
- **Status:** Idea (backburner)
- **Problem:** A call takes over the whole tab — launchers `router.push('/call/...')`
  and navigating away unmounts `<LiveKitRoom>`, dropping the media connection. So
  you can't use the Notissima GUI (sessions, notes, outputs) while in a live call.
  `ActiveCallBanner` (`components/call/ActiveCallBanner.tsx`) only offers
  Rejoin/End after the connection has already dropped — it's a workaround, not
  true multitasking.
- **Proposed approach (Option B):** Hoist `<LiveKitRoom>` into a top-level
  provider **above the Next router** (app layout) with a floating, minimizable
  UI. Route changes no longer unmount the room, so the call stays live in the
  same tab and can be shrunk to a corner tile. This is the Zoom-web /
  Meet-embedded pattern.
- **Why this over a second window (Option A):** `window.open('/call/...')` is a
  quick desktop win but feels detached, needs beforeunload/heartbeat cleanup, and
  **doesn't work on mobile** (no multi-window). Option B is the only approach that
  also helps mobile (minimize to a floating tile) and keeps shared state in one
  tab.
- **Building blocks that already exist:** `lib/utils/call-session-storage.ts`
  (persisted call session), `ActiveCallBanner` (becomes "expand minimized call"),
  `/api/calls/active`, `/api/calls/[id]/heartbeat`.
- **Scope/risk:** Medium-invasive — move the room/connection lifecycle out of
  `app/[locale]/call/[roomId]/page.tsx` into a global provider; add
  minimize/restore UI; ensure the setup/consent/join flows still fire correctly
  when the room is provider-owned; define mobile behavior (floating tile).
- **Affected areas:** app layout / a new call provider, `components/call/CallRoom.tsx`,
  `app/[locale]/call/[roomId]/page.tsx`, `components/call/ActiveCallBanner.tsx`.

### AI analysis auto-applies cleanup without approval (decision needed)
- **Status:** Needs product decision
- **Context:** The `analyze` step writes `name_corrections`, `word_corrections`,
  and `speaker_merges` directly into `sessions.transcript_corrections`
  (`app/api/sessions/[id]/analyze/route.ts:1386-1398`), so AI speaker labels,
  word fixes, and speaker merges are applied to the transcript automatically.
  The manual cleanup panel, by contrast, only persists on the explicit
  "Apply Cleanup" button.
- **Symptom (reported):** transcript speaker was renamed with no user approval
  (compounded by the PSTN mislabel bug producing the wrong name).
- **Options:**
  - **Option 1 (recommended):** keep auto speaker-name labeling (so transcripts
    show names, not `S1`/`S2`), but route AI `word_corrections` and
    `speaker_merges` into the cleanup suggestions list for user approval instead
    of auto-applying them.
  - **Option 2:** nothing auto-applied — AI proposes everything (including names)
    as suggestions; transcript shows raw speaker ids until approved.
- **Affected areas:** `app/api/sessions/[id]/analyze/route.ts` (stop merging
  those keys into `transcript_corrections`; return them as suggestions),
  `app/api/sessions/[id]/cleanup-suggestions/route.ts` (surface AI-proposed
  merges/word fixes), session page cleanup UI.
- **Minor related bug:** `handleSaveCleanup` derives `accepted_suggestions` from
  all `cleanupSuggestions` whose draft map happens to match, not only the ones the
  user actually toggled (`sessions/[id]/page.tsx` ~434-439) — can over-record
  acceptances.

### Cross-user name leak in transcript speaker labels
- **Status:** Done (fixed)
- **Symptom (reported):** On other users' PSTN outbound calls, the callee's phone
  number was replaced in the transcript with the **admin/developer's** name
  ("Christian Kruppa") — someone who was not in the call at all.
- **Root cause:** `app/api/sessions/[id]/analyze/route.ts` resolved participant
  names relative to the user who *triggered* analysis, not the call's actual
  participants. `linkedOtherName` fell back to `userName` (the analyzer's own
  display name) whenever the analyzer wasn't the call owner. So when an admin
  (or anyone not the owner) viewed/analyzed a session — which admins can do via
  the service-role/admin fetch path — the "other participant" (the phone callee)
  was stamped with the analyzer's name. It was deterministic and repeated across
  every such session the admin opened.
- **Fix:** Derive both sides from real participant data (call owner profile;
  callee profile / `contact_name` / `phone_number` / consent-log name), only
  using the analyzer's name when the analyzer genuinely is that participant
  (`callee_user_id === userId`). Also pass the session owner (not the analyzer)
  as `sessionUserId` to `buildSpeakerResolution`, and exclude the session/call
  owner (not the analyzer) from the consent-log "other name" fallback.
- **Affected areas:** `app/api/sessions/[id]/analyze/route.ts`.
- **Note:** The earlier "speaker turn-order swap" hypotheses were wrong; the
  fragile `pstn_turn_order` heuristic still exists but was not the cause here.
  Making PSTN labeling identity-based (from per-participant egress) remains a
  worthwhile hardening follow-up.

### Transcript-cleanup network loop on the session page
- **Status:** Done (fixed)
- **Symptom:** While a session is processing, DevTools shows `cleanup-suggestions`
  being called repeatedly ("endless loop"), and in-progress cleanup edits get
  reset.
- **Cause:** In `app/[locale]/(app)/sessions/[id]/page.tsx`, a poll effect
  refreshes `session` every 3–5s while processing, and a second effect re-fired
  on every `session` change, calling `GET /cleanup-suggestions` again and
  resetting `speakerNameMap` / `speakerMergeMap` / `wordCorrectionsDraft` each
  tick. The voice assistant exposed it: a callee's forked session could get stuck
  in `transcribing` forever (voice-agent calls don't run the batch pipeline that
  resolves callee-pending), so `isProcessing` stayed true and the poll — and thus
  the cleanup effect — ran forever.
- **Fix:** (1) Webhook now resolves the callee's pending session on voice-agent
  finalization (root cause of the *permanent* loop). (2) The cleanup effect now
  only re-initializes when its real inputs change (session id, saved corrections,
  transcript length) via a signature guard, instead of on every `session`
  reference change — stopping the per-tick `cleanup-suggestions` storm and no
  longer wiping unsaved draft edits.
- **Affected areas:** `app/[locale]/(app)/sessions/[id]/page.tsx`,
  `app/api/calls/webhook/route.ts`.

### Ringback tone kept playing for the whole call
- **Status:** Done (fixed)
- **Symptom:** The caller's ringback ("tut, tut") kept playing in the background
  throughout an outbound call instead of stopping once it was answered.
- **Cause:** The ring-stop latch (`remoteEverConnected`) only counted non-agent
  remotes, and the voice agent is filtered out of `remoteParticipants`. So an
  agent-answered call never registered as "answered" and the ring never stopped.
- **Fix:** Added a `pstnAnswered` latch that trips when a human remote **or** the
  voice agent joins, and gate `shouldPlayPstnRing` on it.
- **Affected areas:** `components/call/CallRoom.tsx`.

### Mobile: orientation re-prompts permissions / screen-share drops
- **Status:** Mitigated in code; needs on-device verification
- **Symptom:** Rotating a phone during a video call re-triggered the mic/camera
  permission prompt (#4) and briefly dropped a shared screen (#5).
- **Root cause (code contributor):** `videoCaptureOptions` was a fresh object on
  every render, so `<LiveKitRoom video={...}>` re-ran local-media setup
  (re-`getUserMedia` → new permission prompt; track churn → screen-share blip).
- **Fix:** Memoized `videoCaptureOptions` (stable reference) in
  `components/call/CallRoom.tsx`.
- **Caveat:** Mobile rotation behavior is browser-specific; confirm on a real
  device. If it persists, capture device logs (which getUserMedia call fires on
  rotation) — the remaining cause would be browser/LiveKit reconnection, not the
  capture-options churn.

### Mid-call document upload failed
- **Status:** Done (fixed)
- **Symptom:** "Dokument konnte nicht angehängt werden" when attaching a document
  during an active call.
- **Root cause:** The route used the user-scoped client for storage + DB writes.
  The `call_documents` table has no UPDATE RLS policy (only SELECT/INSERT/DELETE),
  so the final `status: 'ready'` update was blocked, and the `documents/` storage
  path likely wasn't permitted by the bucket's RLS for the user client (the
  working audio upload uses a `sessions/` path).
- **Fix:** Verify call ownership with the user client, then do storage upload +
  all `call_documents` writes with the service-role client; surface the real
  error to the client instead of a generic message.
- **Affected areas:** `app/api/calls/[id]/documents/route.ts`,
  `components/call/CallRoom.tsx`.

### Notes feature unusable on mobile
- **Status:** Done (disabled on mobile per product decision)
- **Symptom:** On mobile, tapping Notes opened an overlay with no input field /
  no keyboard; only cluttered the small screen.
- **Fix:** Hide the Notes control on mobile in both `CallControls` layout
  variants (so the panel can't be opened there).
- **Affected areas:** `components/call/CallControls.tsx`.
