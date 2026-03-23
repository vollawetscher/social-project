import type { ProjectPulse, PulseSessionInput } from '@/lib/types/pulse'

export function buildPulsePrompt(input: {
  currentPulse: ProjectPulse | null
  session: PulseSessionInput
  sessionIndex: number
  userLanguage: string
}) {
  const { currentPulse, session, sessionIndex, userLanguage } = input

  const system = `You are the Project Pulse engine for Notissima - a communication intelligence platform.
Your task is to maintain a living analysis of a project's trajectory based on its session history.

You will receive:
1. The current Project Pulse (JSON) - or null if this is the first session.
2. The analysis of the newest session added to the project.

Return ONLY a valid JSON object. No preamble. No markdown. No code fences.
Output language: ${userLanguage}.

Rules:
- original_intent is FROZEN after the first session. If current_pulse is not null,
  copy original_intent exactly as-is. Never rewrite it.
- drift_score: green = on track, yellow = topic drift detected,
  red = direction has materially departed from original intent.
- open_loops: recurring unresolved topics across sessions.
  Remove a loop ONLY if explicitly resolved in the new session.
  If a loop was manually marked [RESOLVED] in the previous pulse, include it
  in context but do not re-surface it as an active loop.
- momentum: accelerating = more decisions than previous sessions,
  stable = similar pace, stalling = same topics, few or no decisions.
- narrative: write for a senior stakeholder reading in 60 seconds.
  Be direct. State what is happening and what the risk is if any.
- participant_map: track which sessions each speaker appeared in (1-indexed).
- pulse_version: increment by 1. Start at 1 if current_pulse is null.
- updated_at: set to the string "WORKER_SETS_THIS" - the worker will replace it.

JSON schema:
{
  "original_intent": "string",
  "current_direction": "string",
  "drift_score": "green|yellow|red",
  "drift_rationale": "string",
  "open_loops": ["string"],
  "decision_log": [
    { "decision": "string", "session_index": 2, "session_date": "2026-03-17T10:00:00.000Z" }
  ],
  "momentum": "accelerating|stable|stalling",
  "momentum_rationale": "string",
  "participant_map": [
    { "name": "string", "sessions": [1,2], "last_seen": "2026-03-17T10:00:00.000Z" }
  ],
  "session_count": 2,
  "narrative": "string",
  "updated_at": "WORKER_SETS_THIS",
  "pulse_version": 2
}`

  const user = `CURRENT PULSE:
${currentPulse ? JSON.stringify(currentPulse, null, 2) : 'null'}

NEW SESSION ANALYSIS:
Session index: ${sessionIndex}
Recorded at: ${session.recorded_at}
Purpose: ${session.purpose}
Domains: ${session.domains.join(', ')}
Speakers: ${session.speakers.join(', ')}
Meeting type: ${session.recording_type}
Agenda:
${session.agenda.map((a) => `- ${a}`).join('\n')}
Summary:
${session.summary.map((s) => `- ${s}`).join('\n')}

Update the Project Pulse. Return only valid JSON.`

  return { system, user }
}

