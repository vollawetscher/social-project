import type {
  HistoryChunk,
  LedgerEntry,
  ProjectPulse,
  PulseSessionInput,
  SessionDigest,
} from '@/lib/types/pulse'

// Recent-window cap. When the window exceeds this size, the engine compresses
// the oldest sessions into a `history_chunks` entry on the same update call
// (lazy compression).
export const RECENT_WINDOW_TARGET = 5

export function buildPulsePrompt(input: {
  currentPulse: ProjectPulse | null
  session: PulseSessionInput
  sessionIndex: number
  userLanguage: string
  resolvedMarkers?: string[]
  caseStatus: 'active' | 'closed' | 'archived'
  projectType: string
  userRole: string
  projectContext?: {
    title?: string | null
    description?: string | null
    clientIdentifier?: string | null
  }
}) {
  const {
    currentPulse,
    session,
    sessionIndex,
    userLanguage,
    resolvedMarkers = [],
    caseStatus,
    projectType,
    userRole,
    projectContext,
  } = input

  const recentWindow = Array.isArray(currentPulse?.recent_window) ? currentPulse!.recent_window : []
  const historyChunks = Array.isArray(currentPulse?.history_chunks) ? currentPulse!.history_chunks : []
  const permanentLedger = Array.isArray(currentPulse?.permanent_ledger) ? currentPulse!.permanent_ledger : []
  const isClosing = caseStatus === 'archived' || caseStatus === 'closed'

  const system = `You are the Project Pulse engine for Notissima — a communication intelligence platform.

The user tracks bounded projects (a hire, a sale, a customer rollout, a marketing campaign, a trade show visit, a fundraise, a job search, etc.). Your job is to maintain a living, type-aware analysis of the project's trajectory based on its session history.

The user is tracking THIS project as:
  project_type: "${projectType || 'unspecified'}"
  user_role:    "${userRole || 'unspecified'}"

Use your training knowledge of how this kind of project usually progresses to produce situational awareness — not narrative drift detection. Specifically assess:

  - current_status: where this project is in the natural arc of a "${projectType || 'project'}" (e.g. for a New Hire: "Screening" → "Interviews" → "Offer" → "Onboarding"; for a Trade Show Visit: "Pre-show prep" → "On the floor" → "Post-show follow-up")
  - covered: what has been addressed well across all sessions
  - missing: what is notably absent for this kind of project at this stage (a typical "New Hire" project at the offer stage usually has reference checks completed; if they aren't, flag that)
  - next_actions: the next steps that typically come next for "${projectType || 'this kind of project'}", grounded in what you can see has already happened
  - open_loops: unresolved threads that need closing (drop a loop only when explicitly resolved or marked [RESOLVED])
  - decision_log: durable decisions made in any session
  - participants: track which sessions each speaker appeared in (1-indexed)
  - narrative: 60-second stakeholder read — direct, what is happening and what the risk is if any

Also classify the NEW SESSION on its own (using your standard project-type taxonomy). If your reading of the new session disagrees materially from the project's saved type ("${projectType || 'unspecified'}"), populate \`type_mismatch_suggestion\` with the alternative. Do NOT switch the lens yourself — only the user can. Otherwise set \`type_mismatch_suggestion\` to null.

LAYERED MEMORY:
- \`recent_window\` holds the last sessions in full digest form. Target size: ${RECENT_WINDOW_TARGET}. The new session's digest will be added by the worker.
- \`history_chunks\` holds older sessions rolled into AI-written phase chunks.
- \`permanent_ledger\` holds decisions and milestones that never compress.

COMPRESSION RULE (LAZY):${isClosing ? `
- This project is being CLOSED (case_status="${caseStatus}"). Compress the ENTIRE recent_window into one terminal entry in history_chunks labeled e.g. "Project closed (state at close)". After compression, recent_window must be [].`
    : `
- If after the worker adds the new session the recent_window would exceed ${RECENT_WINDOW_TARGET} entries, you must compress the oldest sessions into history_chunks until recent_window is exactly ${RECENT_WINDOW_TARGET}.
- For each new history chunk: pick a meaningful \`period_label\`, set \`date_range\` from the rolled-up sessions, list the rolled-up \`session_indices\`, write a narrative \`summary\`, and lift any decisions belonging to that period from permanent_ledger into \`key_decisions\`.
- Then drop the rolled-up sessions from recent_window.
- If recent_window is already <= ${RECENT_WINDOW_TARGET}, leave it alone and emit history_chunks unchanged.`}

PERMANENT LEDGER RULE:
- Append new decisions and milestones from the new session as ledger entries.
- Mark resolved/cancelled loops as ledger entries with the appropriate \`kind\`.
- Never delete entries.

PURPOSE SOURCE RULE:
- Each session carries a \`purpose\` and a \`purpose_source\`.
- \`purpose_source: user\` is the owner's declared intent — canonical for that session. Trust it.
- \`purpose_source: ai\` is inferred from content and may be wrong.
- When user-declared purpose and AI-inferred content would conflict, trust user-declared. Do not flag the gap as drift — calls go off-script all the time, that's expected.

Output language for user-facing prose (current_status, covered, missing, next_actions, open_loops, narrative, history_chunks summaries, decision text): ${userLanguage}.
Type and role labels stay in the form they were saved (do not translate "${projectType || ''}" or "${userRole || ''}").

Return ONLY a valid JSON object — no markdown fences, no preamble, no commentary.

Set \`updated_at\` to the literal string "WORKER_SETS_THIS"; the worker replaces it.
Set \`pulse_version\` to ${(currentPulse?.pulse_version || 0) + 1}.
Set \`session_count\` to ${sessionIndex}.

JSON shape (write all fields, use [] / null where empty):
{
  "project_type": "${projectType}",
  "user_role": "${userRole}",
  "current_status": "string — where the project is in its natural arc",
  "covered": ["string", ...],
  "missing": ["string — notably absent for this kind of project", ...],
  "next_actions": ["string — typical next step grounded in what you've seen", ...],
  "open_loops": ["string", ...],
  "decision_log": [
    { "decision": "string", "session_index": 2, "session_date": "ISO-8601" }
  ],
  "participants": [
    { "name": "string", "sessions": [1, 2], "last_seen": "ISO-8601" }
  ],
  "narrative": "string — 60-second stakeholder read",
  "type_mismatch_suggestion": null,
  "recent_window": [ /* SessionDigest[] — see CURRENT for shape; engine may rewrite key_extracts */ ],
  "history_chunks": [
    {
      "period_label": "string",
      "date_range": { "from": "ISO-8601", "to": "ISO-8601" },
      "session_indices": [1, 2],
      "summary": "string",
      "key_decisions": ["string"]
    }
  ],
  "permanent_ledger": [
    {
      "kind": "decision|milestone|resolved_loop|cancelled_loop",
      "text": "string",
      "session_index": 2,
      "session_date": "ISO-8601",
      "resolved_at": null
    }
  ],
  "pulse_version": ${(currentPulse?.pulse_version || 0) + 1},
  "session_count": ${sessionIndex},
  "updated_at": "WORKER_SETS_THIS"
}

If you decide a type mismatch exists, fill type_mismatch_suggestion as:
{
  "suggested_type": "string",
  "suggested_role": "string",
  "confidence": 0.0,
  "rationale": "one sentence",
  "triggering_session_id": "${session.session_id}",
  "detected_at": "WORKER_SETS_THIS"
}`

  const projectMeta = `Project title:        ${String(projectContext?.title || '').trim() || 'n/a'}
Project description:  ${String(projectContext?.description || '').trim() || 'n/a'}
Project reference:    ${String(projectContext?.clientIdentifier || '').trim() || 'n/a'}
Case status:          ${caseStatus}
Tracked as:           ${projectType || 'unspecified'} (role: ${userRole || 'unspecified'})`

  const newSessionBlock = `NEW SESSION (index ${sessionIndex}):
session_id:     ${session.session_id}
recorded_at:    ${session.recorded_at}
purpose:        ${session.purpose || '(none)'}
purpose_source: ${session.purpose_source || 'unknown'}
domains:        ${session.domains.join(', ') || '(none)'}
speakers:       ${session.speakers.join(', ') || '(none)'}
recording_type: ${session.recording_type}
agenda:
${session.agenda.length ? session.agenda.map((a) => `- ${a}`).join('\n') : '- (none)'}
summary:
${session.summary.length ? session.summary.map((s) => `- ${s}`).join('\n') : '- (none)'}`

  const resolvedBlock = `Resolved loop markers from latest notes:
${resolvedMarkers.length ? resolvedMarkers.map((m) => `- ${m}`).join('\n') : '- none'}`

  const memoryBlock = currentPulse
    ? `CURRENT PULSE (read carefully — preserve permanent_ledger, evolve current_status, manage memory):
${JSON.stringify(
        {
          project_type: currentPulse.project_type,
          user_role: currentPulse.user_role,
          current_status: currentPulse.current_status,
          covered: currentPulse.covered,
          missing: currentPulse.missing,
          next_actions: currentPulse.next_actions,
          open_loops: currentPulse.open_loops,
          decision_log: currentPulse.decision_log,
          participants: currentPulse.participants,
          narrative: currentPulse.narrative,
          type_mismatch_suggestion: currentPulse.type_mismatch_suggestion,
          recent_window: recentWindow as SessionDigest[],
          history_chunks: historyChunks as HistoryChunk[],
          permanent_ledger: permanentLedger as LedgerEntry[],
          pulse_version: currentPulse.pulse_version,
          session_count: currentPulse.session_count,
        },
        null,
        2
      )}`
    : 'CURRENT PULSE: null (this is the first session in the project)'

  const user = `${projectMeta}

${memoryBlock}

${newSessionBlock}

${resolvedBlock}

Update the Project Pulse. Return only valid JSON in the shape defined in the system prompt.`

  return { system, user }
}
