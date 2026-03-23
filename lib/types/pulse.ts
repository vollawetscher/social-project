export interface ProjectPulse {
  original_intent: string
  current_direction: string
  drift_score: 'green' | 'yellow' | 'red'
  drift_rationale: string
  open_loops: string[]
  decision_log: DecisionEntry[]
  momentum: 'accelerating' | 'stable' | 'stalling'
  momentum_rationale: string
  participant_map: ParticipantEntry[]
  session_count: number
  narrative: string
  updated_at: string
  pulse_version: number
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

export interface PulseSessionInput {
  summary: string[]
  purpose: string
  agenda: string[]
  domains: string[]
  speakers: string[]
  recording_type: 'meeting' | 'call' | 'interview' | 'lecture' | 'other'
  recorded_at: string
}

