// Project Pulse — Phase 2 schema.
//
// The pulse is a universal AI-written frame that the engine fills with
// type-appropriate content. There is no per-type schema; the field shape is
// the same across all project types and the LLM writes content that fits the
// project being analyzed (a "New Hire" will produce hiring-shaped
// `next_actions`, a "Trade Show Visit" will produce follow-up commitments).
//
// Memory is layered:
//   - `recent_window`    — last N sessions (default 5) in full digest form
//   - `history_chunks`   — older sessions rolled into AI-written phase chunks
//   - `permanent_ledger` — decisions and milestones that never compress
//
// `type_mismatch_suggestion` is set by the engine when a new session's
// classification disagrees with the project's saved type. The user owns the
// switch decision; the engine never silently re-types.

export interface ProjectPulse {
  // Universal frame
  project_type: string
  user_role: string
  current_status: string
  covered: string[]
  missing: string[]
  next_actions: string[]
  open_loops: string[]
  decision_log: DecisionEntry[]
  participants: ParticipantEntry[]
  narrative: string
  type_mismatch_suggestion: TypeMismatchSuggestion | null

  // Memory bands
  recent_window: SessionDigest[]
  history_chunks: HistoryChunk[]
  permanent_ledger: LedgerEntry[]

  // Bookkeeping
  pulse_version: number
  updated_at: string
  session_count: number

  // --- Deprecated (Phase 1 / pre-Phase-2 shape) ---
  // Kept optional so stale rows still render gracefully until they are
  // re-written by the next pulse update. Phase 2 writers must not produce
  // these.
  original_intent?: string
  current_direction?: string
  drift_score?: 'green' | 'yellow' | 'red'
  drift_rationale?: string
  momentum?: 'accelerating' | 'stable' | 'stalling'
  momentum_rationale?: string
  participant_map?: ParticipantEntry[]
  manually_corrected_at?: string
}

export interface DecisionEntry {
  decision: string
  session_index: number
  session_date: string
}

export interface ParticipantEntry {
  name: string
  sessions: number[]
  last_seen: string
}

// Single session captured in `recent_window` at full fidelity.
export interface SessionDigest {
  session_id: string
  session_index: number
  recorded_at: string
  purpose: string
  domains: string[]
  speakers: string[]
  summary: string[]
  key_extracts: string[]
}

// AI-written rollup of older sessions that have aged out of `recent_window`.
export interface HistoryChunk {
  period_label: string
  date_range: { from: string; to: string }
  session_indices: number[]
  summary: string
  key_decisions: string[]
}

export interface LedgerEntry {
  kind: 'decision' | 'milestone' | 'resolved_loop' | 'cancelled_loop'
  text: string
  session_index: number
  session_date: string
  resolved_at?: string
}

// Engine-detected mismatch between the project's saved type and the new
// session's likely type. Surfaced to the user as a "switch lens?" prompt;
// never silently applied.
export interface TypeMismatchSuggestion {
  suggested_type: string
  suggested_role: string
  confidence: number // 0..1
  rationale: string
  triggering_session_id: string
  detected_at: string
}

export interface PulseSessionInput {
  session_id: string
  summary: string[]
  purpose: string
  purpose_source: 'user' | 'ai' | null
  agenda: string[]
  domains: string[]
  speakers: string[]
  recording_type: 'meeting' | 'call' | 'interview' | 'lecture' | 'other'
  recorded_at: string
}
