# Project Pulse Phase 2 — Detailed Plan

**Status:** Pending implementation
**Depends on:** Phase 1 (session-level classification + Create-Project pre-fill) — shipped.
**Blocks:** Long-running projects scaling beyond ~10 sessions; correct behavior when a project's type was misclassified at creation.

---

## Why this phase exists

Phase 1 added `cases.project_type` / `cases.user_role` and started populating `suggested_project_type` / `suggested_user_role` per session. But Project Pulse itself still operates on the legacy schema: a frozen `original_intent`, a standalone `drift_score` alarm, and per-session text rolled into a single growing JSON. None of the structure produced in Phase 1 actually flows into the engine yet.

Phase 2 makes the engine type-aware, replaces the frozen-intent + drift-score model with an actionable type-switch prompt, and addresses long-project scaling via layered memory with lazy compression. It also closes the loop on per-session classification so attached sessions inherit project context instead of being classified from a blank slate.

---

## Scope

1. **New universal `ProjectPulse` JSON shape** — same schema across all project types, type-appropriate content written by the LLM, no per-type code.
2. **Prompt rewrite** — drop `original_intent` freeze, drop `drift_score`, add type-aware instructions, instruct the engine to produce situational awareness ("what's been covered, what's missing, what's next") rather than narrative-style drift.
3. **Layered project memory** — `current_snapshot` + `recent_window` + `history_chunks` + `permanent_ledger` inside the pulse JSON, so the engine sees a roughly constant-size context regardless of project age.
4. **Lazy compression** — when `recent_window` exceeds N (default 5), the same pulse-update call asks the engine to compress the oldest sessions into a `history_chunks` entry. No separate worker.
5. **Closed-project compaction** — when a case transitions to `archived`/`closed`, the next pulse access collapses the entire `recent_window` into history.
6. **Type-switch detection** — when a new session's classification disagrees with the project's saved type, the engine sets a `type_mismatch_suggestion` field. UI surfaces "Switch to *X*?" on the project page; user accepts or dismisses.
7. **Project context into analyze pipeline** — when a session is attached to a `case_id`, the analyze Claude prompt receives the project's `project_type`, `user_role`, and a short pulse summary so per-session classification inherits framing instead of being computed in isolation.
8. **Cleanup** — remove freeze logic, deprecate `drift_score` (kept temporarily as nullable for backward compatibility), keep `project_pulse_history` for new-shape versions.

---

## Out of scope (Phase 3 territory)

- User-set session `purpose` field. Phase 3.
- Capture UI for planned-flow / attach-flow purpose entry. Phase 3.

---

## Data model changes

### `cases.pulse` (jsonb) — new shape

```ts
interface ProjectPulse {
  // Universal frame, AI-written, free-text
  project_type: string                  // mirrors cases.project_type but engine-rewritable
  user_role: string                     // mirrors cases.user_role
  current_status: string                // where we are in the natural arc of this kind of project
  covered: string[]                     // what's been addressed across sessions
  missing: string[]                     // notable absences for this kind of project
  next_actions: string[]                // training-knowledge-derived expected next steps
  open_loops: string[]                  // unresolved threads
  decision_log: DecisionEntry[]         // permanent — never compressed away
  participants: ParticipantEntry[]      // accumulated
  narrative: string                     // 60-second stakeholder read
  type_mismatch_suggestion: TypeMismatch | null

  // Memory bands
  recent_window: SessionDigest[]        // last N sessions in full analyzed form
  history_chunks: HistoryChunk[]        // older sessions rolled into AI-written phase chunks
  permanent_ledger: LedgerEntry[]       // decisions, milestones, resolved/unresolved loops never compressed

  // Bookkeeping
  pulse_version: number
  updated_at: string
  session_count: number
}

interface SessionDigest {
  session_id: string
  recorded_at: string
  purpose: string
  domains: string[]
  speakers: string[]
  summary: string[]
  key_extracts: string[]                // 2-4 bullets the engine flagged as worth keeping in detail
}

interface HistoryChunk {
  period_label: string                  // AI-written: "Phase 1: First two interviews with Sundar"
  date_range: { from: string; to: string }
  session_indices: number[]
  summary: string                       // narrative summary written by the engine when compressing
  key_decisions: string[]               // surfaced from permanent_ledger for context
}

interface LedgerEntry {
  kind: 'decision' | 'milestone' | 'resolved_loop' | 'cancelled_loop'
  text: string
  session_index: number
  session_date: string
  resolved_at?: string
}

interface TypeMismatch {
  suggested_type: string                // engine's read of the new session
  suggested_role: string
  confidence: number                    // 0..1
  rationale: string                     // one-line explanation
  triggering_session_id: string
  detected_at: string
}
```

### `cases` columns

No new columns required. Existing `cases.project_type` and `cases.user_role` remain canonical for the project's *current* lens. The pulse mirrors them in `project_type` / `user_role` so the engine can reference the lens without joining tables, but writes-back happens through the cases PATCH path triggered by the user accepting a type-switch.

### `project_pulse_history`

No structural change. The new-shape pulse JSON is written into the existing `pulse` column. Versioning and per-session history rows continue as today.

---

## Prompt rewrite ([lib/services/pulse/buildPulsePrompt.ts](lib/services/pulse/buildPulsePrompt.ts))

### Removals

- The `original_intent is FROZEN after the first session. Never rewrite it.` rule.
- The `drift_score: green|yellow|red` rule and `drift_rationale` field.

### Additions

**System prompt** receives the project's `project_type`, `user_role`, and a brief description of what kind of analysis the user expects given that type. The instruction is approximately:

> "The user is tracking this project as `${project_type}` from the perspective of `${user_role}`. Use your training knowledge of how this kind of project usually progresses to assess: where we are in its natural arc; what's been covered well; what's notably missing for this kind of project at this stage; what the typical next steps are; what unresolved threads matter. Output the universal frame defined below. Do not invent fields. If a field doesn't apply meaningfully for this kind of project, leave it as an empty array (or short string for `current_status`)."

**Type-mismatch detection** is a separate instruction:

> "Before writing the pulse, classify the *new session* as you would in isolation (using your standard project-type taxonomy). If your classification differs materially from `${project_type}`, populate `type_mismatch_suggestion` with the alternative type and role, your confidence (0..1), and a one-line rationale. Do not switch the lens yourself — the user owns that decision. Otherwise set `type_mismatch_suggestion` to null."

**Compression instruction** is conditional:

> "If the `recent_window` you receive contains more than 5 sessions, compress the oldest sessions until it has exactly 5 by writing a new entry into `history_chunks` with: a `period_label` you choose, a `date_range`, the `session_indices` rolled up, a narrative summary, and any `key_decisions` lifted from the permanent ledger that belong to that period. Then drop those sessions from `recent_window`."

For closed projects:

> "If `case_status === 'archived' || case_status === 'closed'`, compress the *entire* `recent_window` into one terminal `history_chunks` entry labeled e.g. `Project closed (state at archival)`. Set `recent_window` to `[]`."

### User prompt structure

The prompt now passes:

- `case_status` from `cases.status`
- `case_project_type` from `cases.project_type`
- `case_user_role` from `cases.user_role`
- `current_pulse` (full pulse JSON or null)
- `new_session` digest (purpose, agenda, summary bullets, domains, speakers, recording_type, recorded_at)
- `session_index` (sequence number within the project)

---

## Service changes ([lib/services/pulse/pulse-service.ts](lib/services/pulse/pulse-service.ts))

### `mapSessionToPulseInput`

Existing function continues to map a session row into the analyzed input. Add `purpose_source: 'user' | 'ai'` once Phase 3 lands; for Phase 2 it stays AI-only.

### New: `buildSessionDigest(sessionRow): SessionDigest`

Produces the structured digest stored in `recent_window`. Includes summary bullets and AI-flagged key extracts. Drops nothing the model cares about; bounds size with `key_extracts` capped at 4 entries.

### Updated: `runPulseUpdate(caseId, sessionId)`

```ts
// 1. Load case + current pulse + session
// 2. Build new SessionDigest from the new session
// 3. Add the digest to recent_window (front of list)
// 4. Build prompt with case_status, project_type, user_role,
//    current_pulse, new_session digest, session_index
// 5. Call Claude
// 6. Sanitize response into ProjectPulse shape
// 7. If type_mismatch_suggestion is set, leave it on the pulse
//    (UI will surface; user decides whether to switch)
// 8. Persist updated pulse + version bump + history row
```

### Updated: `sanitizePulseJson`

Replace the existing sanitizer. Validates the universal frame, clamps array sizes, ensures `recent_window` is post-compression (<= 5), preserves `permanent_ledger` against accidental removal, and sets `updated_at` to now. Drop `drift_score`/`drift_rationale`/`original_intent` — if the model emits them, ignore.

### Removed: original-intent freeze logic

The current sanitizer copies `original_intent` from the previous pulse if present. Remove. The new `project_type` field replaces it semantically and is owner-editable.

---

## Project context into analyze ([app/api/sessions/[id]/analyze/route.ts](app/api/sessions/[id]/analyze/route.ts))

When the session being analyzed has `case_id` set, fetch the linked case's `project_type`, `user_role`, and pulse summary (just `current_status` + last 1-2 entries from `history_chunks` or `recent_window`). Pass it into the Claude prompt as a new context block, e.g.:

```
PROJECT CONTEXT (this session belongs to an existing project):
- Tracking as: ${project_type}
- Owner role: ${user_role}
- Current status: ${current_status}
- Recent context: ${last 1-2 narrative chunks}

Use this framing to interpret the session. The session may advance, complete, or contradict the project's current direction — describe accordingly.
```

When `case_id` is null, no project context block. Same as today.

This closes the Loerrach failure mode for any session that's already attached to a project: a session classified as "CRM training" in isolation will be reframed as "post-rollout customer follow-up" once the project context is visible.

---

## Type-switch UI ([app/[locale]/(app)/projects/[id]/page.tsx](app/[locale]/(app)/projects/[id]/page.tsx))

When `pulse.type_mismatch_suggestion` is set:

- Show a dismissible alert near the project header: *"Session N looks more like **{suggested_type}** ({suggested_role}). Switch the project's lens?"*
- Two actions: **Switch** (PATCH `cases.project_type` + `cases.user_role`, then enqueue a pulse refresh so the engine re-narrates under the new lens) and **Dismiss** (clear the suggestion field on the pulse).
- The suggestion is sticky until acted on — re-running the pulse without resolution keeps showing it.

The alert lives above the existing pulse cards. Style consistent with the existing drift badges that this phase deprecates.

---

## Backward compatibility

- Existing pulses with the old shape (`original_intent`, `drift_score`, etc.) keep working in the UI until they age out. The legacy fields are read where they exist; new fields are read where they exist. UI degrades gracefully when either set is missing.
- The `project_pulse_history` table holds both shapes; consumers detect by feature-presence, not version flag.
- `sanitizePulseJson` is split: legacy-aware path for reading, new-shape path for writing. New writes never produce legacy fields.

Migration: none. Test data ages out as already agreed.

---

## Implementation order

1. New types in [lib/types/pulse.ts](lib/types/pulse.ts).
2. Prompt rewrite in [lib/services/pulse/buildPulsePrompt.ts](lib/services/pulse/buildPulsePrompt.ts).
3. Service rewrite in [lib/services/pulse/pulse-service.ts](lib/services/pulse/pulse-service.ts) + new digest builder.
4. Update existing pulse worker job handler to pass the new prompt args.
5. Update [app/api/projects/[id]/pulse/route.ts](app/api/projects/[id]/pulse/route.ts) and [app/api/cases/[id]/pulse/route.ts](app/api/cases/[id]/pulse/route.ts) responses if the new shape needs any normalization for the UI.
6. Project context block added to [app/api/sessions/[id]/analyze/route.ts](app/api/sessions/[id]/analyze/route.ts) when `case_id` present.
7. Type-switch alert in [app/[locale]/(app)/projects/[id]/page.tsx](app/[locale]/(app)/projects/[id]/page.tsx).
8. UI cleanup — remove drift-score badge component, replace with type-mismatch alert.

---

## Validation

- Re-run the Sundar project pulse and confirm:
  - The current pulse no longer reports red drift; it shows the project type as `New Hire (employer side)` (or whatever the user set in Phase 1) and produces type-appropriate `next_actions` and `missing` items.
  - If the saved type is "Technical strategy" (legacy miscategorization), `type_mismatch_suggestion` surfaces with hiring as the alternative.
- Generate a synthetic 12-session project; confirm `recent_window` stays at 5, `history_chunks` accumulate, `permanent_ledger` keeps decisions.
- Archive a project; confirm next pulse access collapses `recent_window` to `[]`.
- Attach a "post-rollout follow-up" session to an existing customer project; confirm the analyze Claude prompt includes project context and the resulting `extractedContext.suggested_project_type` no longer says "CRM Training" in isolation but inherits the project's lens.
