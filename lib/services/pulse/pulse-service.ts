import Anthropic from '@anthropic-ai/sdk'
import type { SupabaseClient } from '@supabase/supabase-js'
import { buildPulsePrompt, RECENT_WINDOW_TARGET } from '@/lib/services/pulse/buildPulsePrompt'
import type {
  DecisionEntry,
  HistoryChunk,
  LedgerEntry,
  ParticipantEntry,
  ProjectPulse,
  PulseSessionInput,
  SessionDigest,
  TypeMismatchSuggestion,
} from '@/lib/types/pulse'
import { recordAiTokens } from '@/lib/services/usage-tracker'
import { normalizeLanguageCode } from '@/lib/utils/language'
import { JSON_PREFILL, withJsonPrefill } from '@/lib/utils/claude-json'

const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null

function readSummaryBullets(input: string | null | undefined): string[] {
  const raw = String(input || '').trim()
  if (!raw) return []
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^[-*•]\s+/, '').trim())
    .filter(Boolean)
    .slice(0, 8)
}

function extractResolvedLoopMarkers(text: string | null | undefined): string[] {
  const source = String(text || '')
  if (!source) return []
  return source
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^\[RESOLVED\]\s+/i.test(line))
    .map((line) => line.replace(/^\[RESOLVED\]\s+/i, '').trim())
    .filter(Boolean)
    .slice(0, 30)
}

function hasReadyAnalysisArtifacts(sessionRow: any): boolean {
  const hasRecordingType = typeof sessionRow?.recording_type === 'string' && sessionRow.recording_type.trim().length > 0
  const hasDomains = Array.isArray(sessionRow?.suggested_domains) && sessionRow.suggested_domains.length > 0
  const extracted = sessionRow?.ai_extracted_context
  const hasExtractedContext =
    extracted &&
    typeof extracted === 'object' &&
    !Array.isArray(extracted) &&
    Object.keys(extracted).length > 0

  return hasRecordingType && hasDomains && hasExtractedContext
}

export function mapSessionToPulseInput(sessionRow: any): PulseSessionInput {
  const extracted = (sessionRow?.ai_extracted_context || {}) as Record<string, any>
  const participants = Array.isArray(extracted.participants) ? extracted.participants : []
  const speakers = participants
    .map((p) => {
      if (typeof p === 'string') return p
      return p?.name ? String(p.name) : ''
    })
    .map((v) => v.trim())
    .filter(Boolean)
    .slice(0, 12)

  const purpose = String(extracted.purpose || '').trim()
  const agenda = Array.isArray(extracted.agenda)
    ? extracted.agenda.map((x: any) => String(x || '').trim()).filter(Boolean).slice(0, 12)
    : []

  const domainsRaw = Array.isArray(sessionRow?.suggested_domains) ? sessionRow.suggested_domains : []
  const domains = domainsRaw
    .map((d: any) => {
      if (typeof d === 'string') return d
      const primary = String(d?.primary || '').trim()
      const specialty = String(d?.specialty || '').trim()
      return [primary, specialty].filter(Boolean).join(' / ')
    })
    .map((v: string) => v.trim())
    .filter(Boolean)
    .slice(0, 6)

  const summary = readSummaryBullets(sessionRow?.speechmatics_summary)
  return {
    session_id: String(sessionRow?.id || ''),
    summary,
    purpose,
    agenda,
    domains,
    speakers,
    recording_type: ['meeting', 'call', 'interview', 'lecture'].includes(String(sessionRow?.recording_type || ''))
      ? (sessionRow.recording_type as PulseSessionInput['recording_type'])
      : 'other',
    recorded_at: String(sessionRow?.recorded_at || sessionRow?.created_at || new Date().toISOString()),
  }
}

// Build a SessionDigest for the new session before handing to the engine, so
// the engine can either keep the digest as-is in `recent_window` or use it
// when rolling oldest digests into a history chunk.
export function buildSessionDigest(input: {
  session: PulseSessionInput
  sessionIndex: number
}): SessionDigest {
  const { session, sessionIndex } = input
  return {
    session_id: session.session_id,
    session_index: sessionIndex,
    recorded_at: session.recorded_at,
    purpose: session.purpose || '',
    domains: session.domains.slice(0, 6),
    speakers: session.speakers.slice(0, 12),
    summary: session.summary.slice(0, 8),
    key_extracts: [],
  }
}

export function parseClaudeJson(raw: string): any {
  const text = String(raw || '').trim()
  if (!text) throw new Error('Empty Claude response')
  let candidate = text
  if (candidate.startsWith('```')) {
    const match = candidate.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
    if (match?.[1]) candidate = match[1].trim()
  }
  try {
    return JSON.parse(candidate)
  } catch {
    const fallbackMatch = candidate.match(/\{[\s\S]*\}/)
    if (!fallbackMatch) throw new Error('Claude response is not valid JSON')
    return JSON.parse(fallbackMatch[0])
  }
}

function normalizeLoopText(value: string): string {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function isResolvedLoop(loop: string, resolvedMarkers: string[]): boolean {
  const normalizedLoop = normalizeLoopText(loop)
  if (!normalizedLoop) return false
  return resolvedMarkers.some((marker) => {
    const normalizedMarker = normalizeLoopText(marker)
    if (!normalizedMarker) return false
    return (
      normalizedLoop === normalizedMarker ||
      normalizedLoop.includes(normalizedMarker) ||
      normalizedMarker.includes(normalizedLoop)
    )
  })
}

function asStringArray(value: any, max = 30): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map((x) => String(x || '').trim())
    .filter(Boolean)
    .slice(0, max)
}

function sanitizeDecisionLog(value: any, sessionIndex: number): DecisionEntry[] {
  if (!Array.isArray(value)) return []
  return value
    .map((d: any) => ({
      decision: String(d?.decision || '').trim(),
      session_index: Number.isFinite(Number(d?.session_index)) ? Number(d.session_index) : sessionIndex,
      session_date: String(d?.session_date || new Date().toISOString()),
    }))
    .filter((d) => Boolean(d.decision))
    .slice(0, 50)
}

function sanitizeParticipants(value: any): ParticipantEntry[] {
  if (!Array.isArray(value)) return []
  return value
    .map((p: any) => ({
      name: String(p?.name || '').trim(),
      sessions: Array.isArray(p?.sessions)
        ? p.sessions.map((s: any) => Number(s)).filter((n: number) => Number.isFinite(n) && n > 0).slice(0, 80)
        : [],
      last_seen: String(p?.last_seen || new Date().toISOString()),
    }))
    .filter((p) => Boolean(p.name))
    .slice(0, 60)
}

function sanitizeRecentWindow(value: any): SessionDigest[] {
  if (!Array.isArray(value)) return []
  return value
    .map((d: any) => ({
      session_id: String(d?.session_id || '').trim(),
      session_index: Number.isFinite(Number(d?.session_index)) ? Number(d.session_index) : 0,
      recorded_at: String(d?.recorded_at || new Date().toISOString()),
      purpose: String(d?.purpose || '').trim(),
      domains: asStringArray(d?.domains, 6),
      speakers: asStringArray(d?.speakers, 12),
      summary: asStringArray(d?.summary, 8),
      key_extracts: asStringArray(d?.key_extracts, 8),
    }))
    .filter((d) => d.session_index > 0)
    .slice(0, 20)
}

function sanitizeHistoryChunks(value: any): HistoryChunk[] {
  if (!Array.isArray(value)) return []
  return value
    .map((c: any) => ({
      period_label: String(c?.period_label || '').trim(),
      date_range: {
        from: String(c?.date_range?.from || '').trim(),
        to: String(c?.date_range?.to || '').trim(),
      },
      session_indices: Array.isArray(c?.session_indices)
        ? c.session_indices.map((s: any) => Number(s)).filter((n: number) => Number.isFinite(n) && n > 0).slice(0, 200)
        : [],
      summary: String(c?.summary || '').trim(),
      key_decisions: asStringArray(c?.key_decisions, 30),
    }))
    .filter((c) => c.period_label && c.summary)
    .slice(0, 50)
}

function sanitizeLedger(value: any): LedgerEntry[] {
  if (!Array.isArray(value)) return []
  const allowedKinds: LedgerEntry['kind'][] = ['decision', 'milestone', 'resolved_loop', 'cancelled_loop']
  return value
    .map((e: any) => {
      const kind = allowedKinds.includes(String(e?.kind) as LedgerEntry['kind'])
        ? (e.kind as LedgerEntry['kind'])
        : 'milestone'
      const entry: LedgerEntry = {
        kind,
        text: String(e?.text || '').trim(),
        session_index: Number.isFinite(Number(e?.session_index)) ? Number(e.session_index) : 0,
        session_date: String(e?.session_date || new Date().toISOString()),
      }
      if (e?.resolved_at) entry.resolved_at = String(e.resolved_at)
      return entry
    })
    .filter((e) => Boolean(e.text))
    .slice(0, 500)
}

function sanitizeTypeMismatch(
  value: any,
  triggeringSessionId: string,
  nowIso: string,
  projectType: string,
  projectRole: string
): TypeMismatchSuggestion | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const suggestedType = String(value.suggested_type || '').trim()
  const suggestedRole = String(value.suggested_role || '').trim()
  if (!suggestedType) return null

  // If the engine's suggestion matches what we already track, treat it as no
  // mismatch. This protects against the model echoing the current type.
  if (
    suggestedType.toLowerCase() === String(projectType || '').toLowerCase() &&
    (suggestedRole.toLowerCase() === String(projectRole || '').toLowerCase() || !suggestedRole)
  ) {
    return null
  }

  const confidence = Number(value.confidence)
  return {
    suggested_type: suggestedType,
    suggested_role: suggestedRole,
    confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : 0.5,
    rationale: String(value.rationale || '').trim() || 'No rationale provided',
    triggering_session_id: String(value.triggering_session_id || triggeringSessionId || '').trim(),
    detected_at: nowIso,
  }
}

export interface SanitizePulseInput {
  parsed: any
  currentPulse: ProjectPulse | null
  sessionIndex: number
  resolvedMarkers?: string[]
  projectType: string
  userRole: string
  triggeringSessionId: string
  nowIso?: string
}

export function sanitizePulseJson(input: SanitizePulseInput): ProjectPulse {
  const {
    parsed,
    currentPulse,
    sessionIndex,
    resolvedMarkers = [],
    projectType,
    userRole,
    triggeringSessionId,
  } = input
  const nowIso = input.nowIso || new Date().toISOString()

  const safeOpenLoops = asStringArray(parsed?.open_loops, 30)
  const filteredLoops = safeOpenLoops.filter((loop) => !isResolvedLoop(loop, resolvedMarkers))

  const baseVersion = currentPulse?.pulse_version || 0

  const pulse: ProjectPulse = {
    project_type: String(parsed?.project_type || projectType || '').trim() || 'unspecified',
    user_role: String(parsed?.user_role || userRole || '').trim() || 'unspecified',
    current_status: String(parsed?.current_status || '').trim() || 'Status not yet determined',
    covered: asStringArray(parsed?.covered, 20),
    missing: asStringArray(parsed?.missing, 20),
    next_actions: asStringArray(parsed?.next_actions, 20),
    open_loops: filteredLoops,
    decision_log: sanitizeDecisionLog(parsed?.decision_log, sessionIndex),
    participants: sanitizeParticipants(parsed?.participants),
    narrative: String(parsed?.narrative || '').trim() || 'No narrative available',
    type_mismatch_suggestion: sanitizeTypeMismatch(
      parsed?.type_mismatch_suggestion,
      triggeringSessionId,
      nowIso,
      projectType,
      userRole
    ),
    recent_window: sanitizeRecentWindow(parsed?.recent_window),
    history_chunks: sanitizeHistoryChunks(parsed?.history_chunks),
    permanent_ledger: sanitizeLedger(parsed?.permanent_ledger),
    pulse_version: baseVersion + 1,
    updated_at: nowIso,
    session_count: sessionIndex,
  }

  return pulse
}

export async function runPulseUpdateJob(input: {
  supabase: SupabaseClient
  caseId: string
  sessionId: string
}): Promise<{ pulse: ProjectPulse | null; sessionCount: number; skipped?: string }> {
  const { supabase, caseId, sessionId } = input

  const [{ data: caseRow, error: caseError }, { data: sessionRow, error: sessionError }] = await Promise.all([
    supabase
      .from('cases')
      .select('id, user_id, title, description, client_identifier, status, project_type, user_role, pulse, pulse_version')
      .eq('id', caseId)
      .single(),
    supabase
      .from('sessions')
      .select('id, case_id, status, ai_extracted_context, speechmatics_summary, suggested_domains, recording_type, context_note, private_comments, recorded_at, created_at')
      .eq('id', sessionId)
      .single(),
  ])

  if (caseError || !caseRow) throw new Error(`Case not found for pulse update: ${caseId}`)
  if (caseRow.status === 'archived') {
    return {
      pulse: (caseRow.pulse || null) as ProjectPulse | null,
      sessionCount: 0,
      skipped: 'archived_case',
    }
  }
  if (sessionError || !sessionRow) throw new Error(`Session not found for pulse update: ${sessionId}`)
  if (sessionRow.case_id !== caseId) {
    throw new Error(`Session ${sessionId} does not belong to case ${caseId}`)
  }

  if (!hasReadyAnalysisArtifacts(sessionRow)) {
    const status = String(sessionRow?.status || '')
    throw new Error(
      `Pulse dependency not ready: analysis missing for session ${sessionId} (status=${status || 'unknown'})`
    )
  }
  const sessionInput = mapSessionToPulseInput(sessionRow)

  const { count: sessionCount } = await supabase
    .from('sessions')
    .select('id', { count: 'exact', head: true })
    .eq('case_id', caseId)

  const countValue = Math.max(1, sessionCount || 1)

  const { data: ownerProfile } = await supabase
    .from('profiles')
    .select('preferred_report_language, preferred_locale')
    .eq('id', caseRow.user_id)
    .maybeSingle()

  const userLanguage = normalizeLanguageCode(
    (ownerProfile as any)?.preferred_report_language || (ownerProfile as any)?.preferred_locale
  ) || 'de'
  const currentPulse = (caseRow.pulse || null) as ProjectPulse | null
  const resolvedMarkers = extractResolvedLoopMarkers(
    `${String(sessionRow?.private_comments || '')}\n${String(sessionRow?.context_note || '')}`
  )

  // Pre-pend the new session's digest to recent_window before sending to the
  // engine. The engine is responsible for compressing oldest entries when the
  // window exceeds RECENT_WINDOW_TARGET (lazy compression). For closed/archived
  // cases the engine collapses the entire window into history_chunks.
  const newDigest = buildSessionDigest({ session: sessionInput, sessionIndex: countValue })
  const seededWindow: SessionDigest[] = [
    newDigest,
    ...((currentPulse?.recent_window || []) as SessionDigest[]).filter(
      (d) => d.session_id !== newDigest.session_id && d.session_index !== newDigest.session_index
    ),
  ]
  const seededPulse: ProjectPulse | null = currentPulse
    ? { ...currentPulse, recent_window: seededWindow }
    : null

  const projectType = String((caseRow as any)?.project_type || '').trim()
  const userRole = String((caseRow as any)?.user_role || '').trim()
  const caseStatus = (caseRow.status as 'active' | 'closed' | 'archived') || 'active'

  const { system, user } = buildPulsePrompt({
    currentPulse: seededPulse,
    session: sessionInput,
    sessionIndex: countValue,
    userLanguage,
    resolvedMarkers,
    caseStatus,
    projectType,
    userRole,
    projectContext: {
      title: (caseRow as any)?.title || null,
      description: (caseRow as any)?.description || null,
      clientIdentifier: (caseRow as any)?.client_identifier || null,
    },
  })

  if (!anthropic) {
    throw new Error('ANTHROPIC_API_KEY is not configured')
  }
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 3000,
    messages: [
      { role: 'user', content: user },
      JSON_PREFILL,
    ],
    system,
  })
  const usage = (message as { usage?: { input_tokens?: number; output_tokens?: number } }).usage
  if (usage?.input_tokens != null || usage?.output_tokens != null) {
    recordAiTokens(supabase, caseRow.user_id, usage.input_tokens ?? 0, usage.output_tokens ?? 0, {
      sessionId,
      endpoint: 'pulse_update',
    })
  }
  const text = message.content
    .filter((block) => block.type === 'text')
    .map((block) => ('text' in block ? block.text : ''))
    .join('\n')
  const parsed = parseClaudeJson(withJsonPrefill(text))
  const nowIso = new Date().toISOString()
  const pulse = sanitizePulseJson({
    parsed,
    currentPulse,
    sessionIndex: countValue,
    resolvedMarkers,
    projectType,
    userRole,
    triggeringSessionId: sessionId,
    nowIso,
  })

  // Floor: recent_window must contain at least the new digest. If the engine
  // returned an empty window for an active project (e.g., it confused itself),
  // recover by seeding the new digest. Closed/archived projects intentionally
  // empty the window.
  if (caseStatus === 'active' && pulse.recent_window.length === 0) {
    pulse.recent_window = [newDigest]
  }

  // Cap recent_window in case the engine over-shoots without compressing.
  if (pulse.recent_window.length > RECENT_WINDOW_TARGET + 2) {
    pulse.recent_window = pulse.recent_window
      .sort((a, b) => b.session_index - a.session_index)
      .slice(0, RECENT_WINDOW_TARGET)
  }

  const { error: updateError } = await supabase
    .from('cases')
    .update({
      pulse,
      pulse_updated_at: nowIso,
      pulse_version: pulse.pulse_version,
    })
    .eq('id', caseId)
  if (updateError) throw updateError

  const { error: historyError } = await supabase
    .from('project_pulse_history')
    .insert({
      case_id: caseId,
      version: pulse.pulse_version,
      pulse,
      created_at: nowIso,
    })
  if (historyError) throw historyError

  return { pulse, sessionCount: countValue }
}
