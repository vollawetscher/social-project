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

### More agent tools
- **Status:** Idea
- **Context:** The function-calling framework exists (`take_note`,
  `recall_recent_sessions`, `read_document`, `get_current_call_transcript`).
- **Ideas:** search across the owner's sessions/notes, create an output/report
  from the current call, set reminders, look up/create contacts.
- **Affected areas:** `agent/frau_peters.py`, `agent/config_loader.py`, plus any
  new supporting API/DB helpers.

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

## Calls & transcription

### PSTN outbound speaker mislabeling ("Caller" + wrong name)
- **Status:** Needs investigation
- **Symptom (reported):** On a PSTN outbound call, the initiating Notissima user
  was labeled "Caller" (not their name) and the callee was shown with the
  initiator's name in the transcript.
- **Leading hypotheses (from code review, unconfirmed against real rows):**
  - `buildSpeakerResolution` falls back to `pstn_turn_order`
    (`app/api/sessions/[id]/analyze/route.ts:445-457`) when intro/address hints
    fail, assuming the callee speaks first; if the owner speaks first this can
    swap labels.
  - `initiatorLabel` falls back to the literal `'Caller'`
    (`analyze/route.ts:471-472`) when the owner's `display_name` is empty at
    analysis time.
  - `contact_name` stored at dial time could carry the wrong name.
- **Next step:** Confirm against the actual `sessions.transcript_corrections`,
  `calls.contact_name`, and the transcript speaker labels for a real affected
  (owned) PSTN session before changing logic.

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

### Ringtone (Freizeichen) may not stop if SIP never joins the client room
- **Status:** Idea
- **Context:** The client ringtone stops when a remote participant appears
  (`remoteEverConnected`), but the "connected" UI needs remote audio. If the PSTN
  leg connects at the carrier but the SIP participant never surfaces as a LiveKit
  participant on the initiator's client, the ring can keep looping until the call
  row flips to an ended state.
- **Affected areas:** `components/call/CallRoom.tsx` (`useRingtone`,
  `shouldPlayPstnRing`, `callStatus` derivation).
- **Next step:** Reproduce and confirm whether this is an independent bug or a
  symptom of a failed SIP/webhook path.
