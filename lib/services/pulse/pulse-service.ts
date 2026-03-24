import Anthropic from '@anthropic-ai/sdk'
import type { SupabaseClient } from '@supabase/supabase-js'
import { buildPulsePrompt } from '@/lib/services/pulse/buildPulsePrompt'
import type { ProjectPulse, PulseSessionInput, ParticipantEntry, DecisionEntry } from '@/lib/types/pulse'
import { recordAiTokens } from '@/lib/services/usage-tracker'

const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null

function normalizeLanguageCode(value?: string | null): string {
  const raw = String(value || '').trim().toLowerCase()
  if (!raw || raw === 'session' || raw === 'auto') return 'de'
  return raw.slice(0, 2)
}

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

function buildFallbackIntent(input: {
  sessionPurpose?: string
  caseTitle?: string
  caseDescription?: string
}): string {
  const sessionPurpose = String(input.sessionPurpose || '').trim()
  if (sessionPurpose) return sessionPurpose
  const caseTitle = String(input.caseTitle || '').trim()
  const caseDescription = String(input.caseDescription || '').trim()
  if (caseTitle && caseDescription) return `${caseTitle}: ${caseDescription}`
  if (caseTitle) return caseTitle
  if (caseDescription) return caseDescription
  return 'Project direction not yet specified'
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

export function sanitizePulseJson(
  parsed: any,
  currentPulse: ProjectPulse | null,
  sessionIndex: number,
  fallbackIntent: string,
  resolvedMarkers: string[] = []
): ProjectPulse {
  const safeDecisionLog: DecisionEntry[] = Array.isArray(parsed?.decision_log)
    ? parsed.decision_log
      .map((d: any) => ({
        decision: String(d?.decision || '').trim(),
        session_index: Number(d?.session_index || sessionIndex),
        session_date: String(d?.session_date || new Date().toISOString()),
      }))
      .filter((d: DecisionEntry) => Boolean(d.decision))
      .slice(0, 30)
    : []

  const safeParticipantMap: ParticipantEntry[] = Array.isArray(parsed?.participant_map)
    ? parsed.participant_map
      .map((p: any) => ({
        name: String(p?.name || '').trim(),
        sessions: Array.isArray(p?.sessions)
          ? p.sessions.map((s: any) => Number(s)).filter((n: number) => Number.isFinite(n) && n > 0).slice(0, 60)
          : [],
        last_seen: String(p?.last_seen || new Date().toISOString()),
      }))
      .filter((p: ParticipantEntry) => Boolean(p.name))
      .slice(0, 50)
    : []

  const safeLoops = Array.isArray(parsed?.open_loops)
    ? parsed.open_loops.map((x: any) => String(x || '').trim()).filter(Boolean).slice(0, 30)
    : []
  const filteredLoops = safeLoops.filter((loop: string) => !isResolvedLoop(loop, resolvedMarkers))

  const baseVersion = currentPulse?.pulse_version || 0
  return {
    original_intent: currentPulse?.original_intent || String(parsed?.original_intent || fallbackIntent).trim() || fallbackIntent,
    current_direction: String(parsed?.current_direction || '').trim() || 'Direction still forming',
    drift_score: ['green', 'yellow', 'red'].includes(String(parsed?.drift_score))
      ? parsed.drift_score
      : 'yellow',
    drift_rationale: String(parsed?.drift_rationale || '').trim() || 'No rationale provided',
    open_loops: filteredLoops,
    decision_log: safeDecisionLog,
    momentum: ['accelerating', 'stable', 'stalling'].includes(String(parsed?.momentum))
      ? parsed.momentum
      : 'stable',
    momentum_rationale: String(parsed?.momentum_rationale || '').trim() || 'No rationale provided',
    participant_map: safeParticipantMap,
    session_count: sessionIndex,
    narrative: String(parsed?.narrative || '').trim() || 'No narrative available',
    updated_at: new Date().toISOString(),
    pulse_version: baseVersion + 1,
  }
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
      .select('id, user_id, title, description, client_identifier, status, pulse, pulse_version')
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
    (ownerProfile as any)?.preferred_report_language || (ownerProfile as any)?.preferred_locale || 'de'
  )
  const currentPulse = (caseRow.pulse || null) as ProjectPulse | null
  const resolvedMarkers = extractResolvedLoopMarkers(
    `${String(sessionRow?.private_comments || '')}\n${String(sessionRow?.context_note || '')}`
  )
  const { system, user } = buildPulsePrompt({
    currentPulse,
    session: sessionInput,
    sessionIndex: countValue,
    userLanguage,
    resolvedMarkers,
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
    max_tokens: 2000,
    messages: [{ role: 'user', content: user }],
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
  const parsed = parseClaudeJson(text)
  const fallbackIntent = buildFallbackIntent({
    sessionPurpose: sessionInput.purpose,
    caseTitle: (caseRow as any)?.title,
    caseDescription: (caseRow as any)?.description,
  })
  const pulse = sanitizePulseJson(parsed, currentPulse, countValue, fallbackIntent, resolvedMarkers)

  const nowIso = new Date().toISOString()
  pulse.updated_at = nowIso

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

