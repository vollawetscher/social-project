import Anthropic from '@anthropic-ai/sdk'
import type { SupabaseClient } from '@supabase/supabase-js'
import { buildPulsePrompt } from '@/lib/services/pulse/buildPulsePrompt'
import type { ProjectPulse, PulseSessionInput, ParticipantEntry, DecisionEntry } from '@/lib/types/pulse'

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

  const purpose = String(extracted.purpose || sessionRow?.context_note || '').trim()
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
    purpose: purpose || 'No explicit purpose captured',
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

export function sanitizePulseJson(parsed: any, currentPulse: ProjectPulse | null, sessionIndex: number, fallbackIntent: string): ProjectPulse {
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

  const baseVersion = currentPulse?.pulse_version || 0
  return {
    original_intent: currentPulse?.original_intent || String(parsed?.original_intent || fallbackIntent).trim() || fallbackIntent,
    current_direction: String(parsed?.current_direction || '').trim() || 'Direction still forming',
    drift_score: ['green', 'yellow', 'red'].includes(String(parsed?.drift_score))
      ? parsed.drift_score
      : 'yellow',
    drift_rationale: String(parsed?.drift_rationale || '').trim() || 'No rationale provided',
    open_loops: safeLoops,
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
      .select('id, user_id, status, pulse, pulse_version')
      .eq('id', caseId)
      .single(),
    supabase
      .from('sessions')
      .select('id, case_id, ai_extracted_context, speechmatics_summary, suggested_domains, recording_type, context_note, recorded_at, created_at')
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

  const sessionInput = mapSessionToPulseInput(sessionRow)
  if (sessionInput.summary.length === 0 && !sessionInput.purpose.trim()) {
    throw new Error(`No analysis for session ${sessionId} — retry later`)
  }

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
  const { system, user } = buildPulsePrompt({
    currentPulse,
    session: sessionInput,
    sessionIndex: countValue,
    userLanguage,
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
  const text = message.content
    .filter((block) => block.type === 'text')
    .map((block) => ('text' in block ? block.text : ''))
    .join('\n')
  const parsed = parseClaudeJson(text)
  const pulse = sanitizePulseJson(parsed, currentPulse, countValue, sessionInput.purpose)

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

