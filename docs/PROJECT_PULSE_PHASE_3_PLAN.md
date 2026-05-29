# Project Pulse Phase 3 — Detailed Plan

**Status:** Pending implementation
**Depends on:** Phase 1 (session classification + Create-Project pre-fill) — shipped. Phase 2 (universal pulse + project context in analyze) — should ship first to maximize value, but Phase 3 is structurally independent and can ship before Phase 2 if needed.

---

## Why this phase exists

Today's analyze pipeline infers session `purpose` entirely from transcript content. That works for clear-content sessions, but produces brittle results when surface activity disagrees with actual purpose — the canonical example is the Loerrach session, where the AI labeled a *first post-rollout follow-up call* as a "CRM training" because the call happened to include a feature demonstration.

The fix is to give the user a way to declare session purpose *before* (or at) the moment of capture, treating that declaration as canonical and demoting AI-extracted purpose to fallback inference. With user-set purpose flowing through:

- The analyze prompt has ground truth about what the conversation is *for*, not just what was discussed.
- The `suggested_project_type` / `suggested_user_role` classification (Phase 1) gets dramatically sharper because the model isn't reverse-engineering intent from content.
- The Pulse engine (Phase 2) can attribute decisions to declared intentions ("the offer call went sideways" is much more meaningful than "a call discussed terms").
- Quick-pick suggestions per project make repeated capture nearly free.

---

## Scope

1. **New `sessions.purpose` text column** + tracking of where the purpose came from (`purpose_source`).
2. **Capture UI on planned-flow entry points** — WebRTC room creation, PSTN outbound dial, scheduled session creation, text/transcript import.
3. **Capture UI on attach-flow entry points** — when a spontaneous recording is attached to a project after the fact, prompt for purpose with the project's recent purposes as quick-pick suggestions.
4. **Optional `cases.default_session_purpose`** — projects can set a default that auto-applies to unprompted attached sessions.
5. **Analyze prompt integration** — when `sessions.purpose` is set, treat it as canonical; AI-extracted purpose continues to populate as a separate field for cases where the user didn't provide one.
6. **Pulse prompt integration** — prefer user-set purpose when present.
7. **No drift detection between user-set purpose and actual content** — the gap between intent and outcome is normal and not a bug; explicitly do not flag it.

---

## Out of scope

- A purpose taxonomy. Free text only. Quick-pick suggestions are a UX affordance, not a constraint.
- Mandatory purpose. Always optional.
- Retroactive backfill of `sessions.purpose` for existing rows.

---

## Data model changes

### Migration

```sql
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS purpose TEXT,
  ADD COLUMN IF NOT EXISTS purpose_source TEXT;  -- 'user' | 'ai' | null

ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS default_session_purpose TEXT;

COMMENT ON COLUMN public.sessions.purpose IS
  'User-declared session purpose, when provided. Canonical when set; falls back to ai_extracted_context.purpose otherwise.';
COMMENT ON COLUMN public.sessions.purpose_source IS
  'Origin of sessions.purpose: ''user'' (typed by the owner), ''ai'' (back-filled from analyze when no user value), or null.';
COMMENT ON COLUMN public.cases.default_session_purpose IS
  'Optional default purpose applied to spontaneous sessions attached to this project, when the user does not provide one.';
```

Why a separate column instead of repurposing `context_note` or `instructions`? Those fields are semantically distinct:

- `context_note` is free-form prep text shown at recording time.
- `instructions` drives output generation, not session classification.
- `purpose` is a single short label answering "what is this conversation for."

Conflating them would muddy the analyze prompt and confuse the UI. New column.

---

## Capture UI

### Planned flows

**WebRTC room creation** — extend whatever form/dialog creates the room (find under `components/call/` or `app/api/calls/`, depending on entry point) to include a `purpose` text input. Required as recommended UX, never validation-blocked. Quick-pick suggestions populated from the linked project's recent session purposes when a project is selected at creation time.

**PSTN outbound dial** — extend the dial form similarly. Same input, same quick-pick behavior. The purpose is captured before the call connects, persisted on the linked session row.

**Scheduled session creation** — find the schedule UI (likely the meet-link / calendar entry point) and add the same input.

**Text / transcript import** — extend the import dialog (`app/[locale]/record/upload/page.tsx` or its variant) to include the purpose input. This is the surface that would have caught the Loerrach failure case at the source.

In all four flows, set `sessions.purpose_source = 'user'` when the user types something; leave it null when they don't.

### Attach flow

When a session is attached to a project after the fact (the existing assign dialog at `app/[locale]/(app)/sessions/page.tsx` or similar), if `sessions.purpose` is null, show a small additional input above the project selector: *"What was this conversation for? (optional)"* with a dropdown of the project's recent session purposes for quick-pick. Defaults the input to the project's `default_session_purpose` when set.

If the user selects a quick-pick or types a value, persist `sessions.purpose` and `purpose_source = 'user'` alongside the `case_id` update.

### Inline edit on session detail

The session detail page should expose `purpose` as an editable field, alongside the existing context/instructions blocks. Typing into it sets `purpose_source = 'user'`. Clearing it (back to empty) sets `purpose` to null and `purpose_source` to null; analyze pipeline backfill will repopulate the AI-extracted value on next run.

---

## Analyze prompt integration ([app/api/sessions/[id]/analyze/route.ts](app/api/sessions/[id]/analyze/route.ts))

When the session has `purpose` set with `purpose_source = 'user'`:

```
USER-DECLARED PURPOSE (canonical — do not contradict, do not flag as drift):
"${session.purpose}"

This is what the session owner says the conversation was for. Treat it as ground
truth for intent. Your AI-extracted purpose, classification, and project_type
suggestions should be consistent with this declared purpose. Do not flag
divergence between this declared purpose and what was actually discussed —
conversations frequently take unexpected turns, that is not a bug.
```

When the session has no user-set purpose (or `purpose_source = 'ai'`), no special block — analyze runs as today.

After analyze completes, if `sessions.purpose` was null, write the AI-extracted purpose into `sessions.purpose` and set `purpose_source = 'ai'`. This unifies the column so downstream consumers can read one place.

---

## Pulse prompt integration ([lib/services/pulse/buildPulsePrompt.ts](lib/services/pulse/buildPulsePrompt.ts))

`PulseSessionInput.purpose` is sourced from `sessions.purpose` rather than `ai_extracted_context.purpose`. Add a new field `purpose_source` so the engine can weight user-declared purposes more heavily when summarizing or detecting status changes.

In the system prompt, append:

> "Purposes marked `purpose_source: user` are the owner's declared intent and are canonical for that session. Purposes marked `purpose_source: ai` are inferred from content and may be wrong. When the two would conflict, trust user-declared."

---

## Default purpose per project

When a session is attached to a project and no user purpose is set, check `cases.default_session_purpose`. If present, copy it to `sessions.purpose` with `purpose_source = 'user'` (the project owner's intent transitively becomes the session's intent).

Edit point on the project detail page: a small textbox in the existing edit dialog labeled *"Default purpose for new sessions (optional)"*. Persists via the existing PATCH allowlist (extend the allowlist in [app/api/cases/[id]/route.ts](app/api/cases/[id]/route.ts) to include `default_session_purpose`).

---

## Quick-pick suggestion ranking

When the user opens a capture form with a project selected, show 3-5 quick-pick chips with the project's most useful prior purposes. Ranking heuristic:

1. Most recent unique purpose first.
2. De-duplicate near-identical entries (case-insensitive substring overlap).
3. Cap at 5 chips.

This is a UI helper, not a classifier. Implement as a small client-side function over the project's session list. No server endpoint required.

---

## Backward compatibility

- Existing sessions have `purpose = null, purpose_source = null`. Nothing reads these in a breaking way today; they're additive.
- Existing rows where `ai_extracted_context.purpose` is populated continue to be read by analyze and pulse callers until those code paths are migrated to read `sessions.purpose`. The migration is gradual: the new column gets populated by the next analyze run for any session that's re-analyzed.

No backfill migration. The column populates organically.

---

## Implementation order

1. Migration: `sessions.purpose`, `sessions.purpose_source`, `cases.default_session_purpose`.
2. Backend: extend session POST/PATCH endpoints to accept `purpose`. Extend cases PATCH allowlist for `default_session_purpose`.
3. Capture UI on the *highest-leverage* planned flow first — pick whichever is most-used (likely WebRTC room creation or text import based on the Loerrach failure being an import). Ship it, validate.
4. Iterate to the remaining planned flows.
5. Attach-flow capture in the assign dialog.
6. Inline edit on session detail.
7. Analyze prompt integration + AI backfill into `sessions.purpose`.
8. Pulse prompt integration (depends on Phase 2 prompt being current).
9. Default-purpose-per-project plumbing.

---

## Validation

- Walk through the Loerrach failure case: import a transcript with the same content as the original Loerrach session, type *"First Week 1 follow-up with Loerrach after voice agent go-live"* in the purpose field, run analyze. Confirm:
  - `extractedContext.suggested_project_type` lands on a customer-rollout / post-rollout follow-up framing, not "CRM Training."
  - The session-level analysis is consistent with the declared purpose; no spurious "training session" labeling.
- Attach a follow-up session to an existing project that has `default_session_purpose = "Weekly customer check-in"`. Confirm the session row gets that purpose and `purpose_source = 'user'`.
- Open a capture form with a project that has past purposes; confirm quick-pick chips appear and clicking one fills the field.
- Set a session's purpose via inline edit on session detail, re-run analyze; confirm the AI's analysis defers to the declared purpose and does not flag divergence with content.

---

## Notes for future phases (not in scope here)

- Once user-set purpose is widespread, the Pulse engine's `next_actions` quality should improve noticeably because intent → outcome chains become readable. Worth a UX review pass after Phase 3 settles.
- A "purpose history" view on a project (showing the cadence of declared purposes over time) might be useful as a secondary surface but isn't a phase deliverable.
