import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { createHash } from 'crypto'
import Anthropic from '@anthropic-ai/sdk'
import { recordAiTokens } from '@/lib/services/usage-tracker'
import { requireSessionAccess } from '@/lib/auth/helpers'
import { logPipelineEvent } from '@/lib/services/pipeline-logger'
import { resolveTokenBudget } from '@/lib/services/token-budget'
import { enqueueAsyncJob, triggerAsyncWorker, linkJobToSession } from '@/lib/services/queue'
import { createNotification } from '@/lib/services/notification-service'
import { normalizeLanguageCode, resolveOutputLanguageCode, LANG_NAMES } from '@/lib/utils/language'
import { JSON_ONLY_SUFFIX, withJsonPrefill } from '@/lib/utils/claude-json'
import {
  formatCallNoteTranscriptLine,
  getCallNoteAuthor,
  isCallNoteSegment,
} from '@/lib/services/merge-call-notes'
import { resolveVoiceMessageContext } from '@/lib/utils/voice-message'
import { applySpeakerCorrectionsToSegments } from '@/lib/utils/speaker-resolution'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

const ALLOWED_SUGGESTION_AUDIENCES = ['internal', 'external', 'client', 'legal', 'executive'] as const
function isAllowedSuggestionAudience(value: unknown): value is (typeof ALLOWED_SUGGESTION_AUDIENCES)[number] {
  return typeof value === 'string' && ALLOWED_SUGGESTION_AUDIENCES.includes(value as (typeof ALLOWED_SUGGESTION_AUDIENCES)[number])
}
const ALLOWED_SUGGESTION_PERSPECTIVES = ['observer', 'reader_facing'] as const
function isAllowedSuggestionPerspective(value: unknown): value is (typeof ALLOWED_SUGGESTION_PERSPECTIVES)[number] {
  return typeof value === 'string' && ALLOWED_SUGGESTION_PERSPECTIVES.includes(value as (typeof ALLOWED_SUGGESTION_PERSPECTIVES)[number])
}

function extractBalancedJsonObject(input: string): string | null {
  const text = String(input || '')
  const start = text.indexOf('{')
  if (start < 0) return null

  let depth = 0
  let inString = false
  let escaped = false

  for (let i = start; i < text.length; i += 1) {
    const ch = text[i]
    if (escaped) {
      escaped = false
      continue
    }
    if (ch === '\\') {
      escaped = true
      continue
    }
    if (ch === '"') {
      inString = !inString
      continue
    }
    if (inString) continue
    if (ch === '{') depth += 1
    else if (ch === '}') {
      depth -= 1
      if (depth === 0) {
        return text.slice(start, i + 1)
      }
    }
  }
  return null
}

function repairTruncatedJson(text: string): string | null {
  let s = text.trim()
  s = s.replace(/^`{3,}\s*(?:json)?\s*\n?/i, '').replace(/\n?`{3,}\s*$/i, '').trim()
  if (s.startsWith('{')) {
    // already starts with object body
  } else {
    const objStart = s.indexOf('{')
    if (objStart < 0) return null
    s = s.slice(objStart)
  }

  let inStr = false
  let escaped = false
  let depth = 0
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (escaped) { escaped = false; continue }
    if (ch === '\\') { escaped = true; continue }
    if (ch === '"') { inStr = !inStr; continue }
    if (inStr) continue
    if (ch === '{' || ch === '[') depth++
    else if (ch === '}' || ch === ']') depth--
  }
  if (depth === 0) return null

  if (inStr) s += '"'

  const tail = s.slice(Math.max(0, s.length - 40))
  if (/,\s*$/.test(tail)) s = s.replace(/,\s*$/, '')

  for (let d = depth; d > 0; d--) {
    const lastOpen = Math.max(s.lastIndexOf('{'), s.lastIndexOf('['))
    const lastClose = Math.max(s.lastIndexOf('}'), s.lastIndexOf(']'))
    if (lastOpen > lastClose) {
      s += s[lastOpen] === '{' ? '}' : ']'
    } else {
      s += '}'
    }
  }
  return s
}

function parseAnalysisResponseText(responseText: string): Record<string, any> {
  const raw = String(responseText || '').trim()
  if (!raw) throw new Error('Empty analysis response')

  const candidates: string[] = [raw]

  const fencedMatches = raw.match(/`{3,}(?:json)?\s*([\s\S]*?)`{3,}/gi) || []
  for (const block of fencedMatches) {
    const inner = block.replace(/`{3,}(?:json)?/i, '').replace(/`{3,}/g, '').trim()
    if (inner) candidates.push(inner)
  }

  for (const c of [...candidates]) {
    const extracted = extractBalancedJsonObject(c)
    if (extracted) candidates.push(extracted)
  }

  candidates.push(raw.replace(/^`+|`+$/g, '').trim())

  const seen = new Set<string>()
  for (const candidate of candidates) {
    if (!candidate || seen.has(candidate)) continue
    seen.add(candidate)
    try {
      return JSON.parse(candidate) as Record<string, any>
    } catch {
      // continue
    }
  }

  for (const candidate of candidates) {
    if (!candidate) continue
    const repaired = repairTruncatedJson(candidate)
    if (repaired) {
      try {
        console.warn('[Analyze API] Recovered truncated JSON response')
        return JSON.parse(repaired) as Record<string, any>
      } catch {
        // continue
      }
    }
  }

  throw new Error('Failed to parse analysis JSON response')
}

function compactSessionSummaryText(raw: string, maxChars = 1200): string {
  const normalized = String(raw || '')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  if (!normalized) return ''
  if (normalized.length <= maxChars) return normalized
  return `${normalized.slice(0, maxChars - 1).trimEnd()}…`
}

function synthesizeSummaryFromContext(extractedContext: Record<string, any>): string {
  const lines: string[] = []
  const purpose = String(extractedContext?.purpose || '').trim()
  const outcome = String(extractedContext?.outcome || '').trim()
  const topics = Array.isArray(extractedContext?.topics)
    ? extractedContext.topics.map((t: unknown) => String(t || '').trim()).filter(Boolean)
    : []
  const decisions = Array.isArray(extractedContext?.decisions)
    ? extractedContext.decisions.map((d: unknown) => String(d || '').trim()).filter(Boolean)
    : []
  const actionItems = Array.isArray(extractedContext?.actionItems)
    ? extractedContext.actionItems
        .map((a: unknown) => {
          const item = (typeof a === 'object' && a !== null ? a : {}) as Record<string, unknown>
          const task = String(item.task || '').trim()
          const owner = String(item.owner || '').trim()
          if (!task) return ''
          return owner ? `${task} (${owner})` : task
        })
        .filter(Boolean)
    : []

  if (purpose) lines.push(`- Purpose: ${purpose}`)
  if (topics.length > 0) lines.push(`- Topics: ${topics.slice(0, 4).join(', ')}`)
  if (decisions.length > 0) lines.push(`- Decisions: ${decisions.slice(0, 3).join('; ')}`)
  if (actionItems.length > 0) lines.push(`- Actions: ${actionItems.slice(0, 3).join('; ')}`)
  if (outcome) lines.push(`- Outcome: ${outcome}`)

  return lines.join('\n')
}

function resolveSessionSummary(
  analysis: Record<string, any>,
  mergedExtractedContext: Record<string, any>,
  existingSummary: string | null
): string | null {
  const direct =
    String(analysis.sessionSummary || analysis.summary || analysis.briefSummary || '').trim()
  if (direct) return compactSessionSummaryText(direct)

  const fromContext = synthesizeSummaryFromContext(mergedExtractedContext)
  if (fromContext) return compactSessionSummaryText(fromContext)

  const fallback = String(existingSummary || '').trim()
  return fallback ? compactSessionSummaryText(fallback) : null
}

const asSegmentArray = (value: unknown): { start_ms?: number; end_ms?: number; [k: string]: any }[] =>
  Array.isArray(value) ? (value as { start_ms?: number; end_ms?: number; [k: string]: any }[]) : []

function coerceWordCorrectionsMap(raw: unknown): Record<string, string> {
  if (Array.isArray(raw)) {
    const map: Record<string, string> = {}
    for (const item of raw) {
      if (item && typeof item === 'object' && 'original' in item && 'corrected' in item) {
        map[String((item as Record<string, unknown>).original)] = String(
          (item as Record<string, unknown>).corrected
        )
      }
    }
    return map
  }
  if (raw && typeof raw === 'object') {
    const map: Record<string, string> = {}
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (typeof v === 'string') map[k] = v
    }
    return map
  }
  return {}
}

function mergeWordCorrections(
  existing: unknown,
  deterministic: Record<string, string>,
  aiItems: Array<{ original?: string; corrected?: string }>
): Record<string, string> {
  const fromAi: Record<string, string> = {}
  for (const item of aiItems) {
    const original = String(item?.original || '').trim()
    const corrected = String(item?.corrected || '').trim()
    if (original && corrected) fromAi[original] = corrected
  }
  return { ...coerceWordCorrectionsMap(existing), ...deterministic, ...fromAi }
}

type SpeakerResolution = {
  participants: Array<{ name: string; role: string | null; isUser: boolean }>
  nameMap: Record<string, string>
  knownParticipantBlock: string
  reason: string
}

/** Personal meeting link: host (session owner) identity is always known. */
type MeetingLinkContext = {
  hostUserId: string
  hostName: string
  guestName: string | null
  participantAIdentity: string | null
}

const normalizeHumanName = (name: string | null | undefined): string =>
  String(name || '')
    .trim()
    .replace(/\s+/g, ' ')

const firstName = (name: string | null | undefined): string =>
  normalizeHumanName(name).split(' ')[0]?.toLowerCase() || ''

const normalizeForMatch = (value: string | null | undefined): string =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s\u00e0-\u024f'-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

function speakerMatchesName(text: string, name: string): boolean {
  const fn = firstName(name)
  if (!fn || fn.length < 2) return false
  const t = normalizeForMatch(text)
  const escaped = fn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const selfIntroEn = new RegExp(`\\b(this is|it is|it's|i am|i'm|my name is)\\s+${escaped}\\b`)
  const selfIntroDe = new RegExp(`\\b(hier ist|hier spricht|ich bin|mein name ist)\\s+${escaped}\\b`)
  if (selfIntroEn.test(t) || selfIntroDe.test(t)) return true
  return false
}

function addressMatchesName(text: string, name: string): boolean {
  const fn = firstName(name)
  if (!fn || fn.length < 2) return false
  const t = normalizeForMatch(text)
  const escaped = fn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const addressPatterns = new RegExp(
    `\\b(hey|hi|hallo|hello|guten tag|moin|servus|gr[uü][sß]|how are you|wie geht|bye|thanks|thank you|danke|ciao|cheers|okay|ok)\\b[\\s,]*${escaped}\\b` +
    `|\\b${escaped}[\\s,]+(are you|bist du|sind sie|h[oö]rst du|kannst du|how are you)`
  )
  return addressPatterns.test(t)
}

type SpeakerAgg = {
  speaker: string
  turns: number
  totalMs: number
  firstStart: number
  texts: string[]
}

function aggregateSpeakers(
  segments: Array<{ speaker?: string; text?: string; start_ms?: number; end_ms?: number }>
): Map<string, SpeakerAgg> {
  const bySpeaker = new Map<string, SpeakerAgg>()
  for (const seg of segments) {
    const speaker = String(seg.speaker || '').trim()
    if (!speaker) continue
    const start = Number(seg.start_ms || 0)
    const end = Number(seg.end_ms || start)
    const dur = Math.max(0, end - start)
    const text = String(seg.text || '')
    const cur = bySpeaker.get(speaker) || {
      speaker, turns: 0, totalMs: 0, firstStart: Number.MAX_SAFE_INTEGER, texts: [],
    }
    cur.turns += 1
    cur.totalMs += dur
    cur.firstStart = Math.min(cur.firstStart, start)
    if (text.trim()) cur.texts.push(text.trim())
    bySpeaker.set(speaker, cur)
  }
  return bySpeaker
}

function resolveMeetingLinkSpeakers(
  majorA: SpeakerAgg,
  majorB: SpeakerAgg,
  majorByStart: SpeakerAgg[],
  ml: MeetingLinkContext,
): { hostSpeaker: string; guestSpeaker: string; reason: string } | null {
  const host = normalizeHumanName(ml.hostName)
  const guest = normalizeHumanName(ml.guestName)
  if (!host || !guest) return null

  for (const sp of [majorA, majorB]) {
    const otherSp = sp === majorA ? majorB : majorA
    const allText = sp.texts.join(' ')
    if (addressMatchesName(allText, guest) || speakerMatchesName(allText, host)) {
      return { hostSpeaker: sp.speaker, guestSpeaker: otherSp.speaker, reason: 'pml_content_hint' }
    }
    if (addressMatchesName(allText, host) || speakerMatchesName(allText, guest)) {
      return { hostSpeaker: otherSp.speaker, guestSpeaker: sp.speaker, reason: 'pml_content_hint' }
    }
  }

  const guestCalledIn = ml.participantAIdentity != null && ml.participantAIdentity !== ml.hostUserId
  if (guestCalledIn) {
    return {
      hostSpeaker: majorByStart[1].speaker,
      guestSpeaker: majorByStart[0].speaker,
      reason: 'pml_guest_called_first',
    }
  }

  return {
    hostSpeaker: majorByStart[0].speaker,
    guestSpeaker: majorByStart[1].speaker,
    reason: 'pml_host_waiting_first',
  }
}

function buildSpeakerResolution(params: {
  segments: Array<{ speaker?: string; text?: string; start_ms?: number; end_ms?: number }>
  callType?: string | null
  callUserId?: string | null
  sessionUserId?: string | null
  initiatorName?: string | null
  otherParticipantName?: string | null
  meetingLinkContext?: MeetingLinkContext | null
}): SpeakerResolution | null {
  const bySpeaker = aggregateSpeakers(params.segments)
  const ranked = Array.from(bySpeaker.values())
    .sort((a, b) => (b.totalMs - a.totalMs) || (b.turns - a.turns))
  if (ranked.length === 0) return null

  if (ranked.length === 1) {
    if (params.initiatorName) {
      return {
        participants: [{ name: params.initiatorName, role: null, isUser: true }],
        nameMap: { [ranked[0].speaker]: params.initiatorName },
        knownParticipantBlock: `${params.initiatorName} (You, session owner)`,
        reason: 'single_speaker',
      }
    }
    return null
  }

  const majorA = ranked[0]
  const majorB = ranked[1]
  const additionalSpeakers = ranked.slice(2)
  const majorByStart = [majorA, majorB].sort((a, b) => a.firstStart - b.firstStart)

  const initiator = normalizeHumanName(params.initiatorName)
  const other = normalizeHumanName(params.otherParticipantName)
  let initiatorSpeaker: string | null = null
  let otherSpeaker: string | null = null

  for (const sp of [majorA, majorB]) {
    const introWindow = sp.texts.slice(0, 6).join(' ')
    if (!initiatorSpeaker && initiator && speakerMatchesName(introWindow, initiator)) {
      initiatorSpeaker = sp.speaker
    }
    if (!otherSpeaker && other && speakerMatchesName(introWindow, other)) {
      otherSpeaker = sp.speaker
    }
  }

  if (!initiatorSpeaker && !otherSpeaker) {
    for (const sp of [majorA, majorB]) {
      const otherSp = sp === majorA ? majorB : majorA
      const allText = sp.texts.join(' ')
      if (initiator && addressMatchesName(allText, initiator)) {
        initiatorSpeaker = otherSp.speaker
      }
      if (other && addressMatchesName(allText, other)) {
        otherSpeaker = otherSp.speaker
      }
    }
  }

  let reason = 'transcript_hints'
  if (!initiatorSpeaker && !otherSpeaker) {
    const pml = params.meetingLinkContext
      ? resolveMeetingLinkSpeakers(majorA, majorB, majorByStart, params.meetingLinkContext)
      : null
    if (pml) {
      initiatorSpeaker = pml.hostSpeaker
      otherSpeaker = pml.guestSpeaker
      reason = pml.reason
    }
  }

  if (!initiatorSpeaker && !otherSpeaker) {
    const isPstn = (params.callType || '').includes('pstn')
    if (isPstn) {
      otherSpeaker = majorByStart[0].speaker
      initiatorSpeaker = majorByStart[1].speaker
      reason = 'pstn_turn_order'
    } else if (params.callType) {
      initiatorSpeaker = majorByStart[0].speaker
      otherSpeaker = majorByStart[1].speaker
      reason = 'webrtc_turn_order'
    } else {
      return null
    }
  } else if (!initiatorSpeaker && otherSpeaker) {
    initiatorSpeaker = [majorA.speaker, majorB.speaker].find((s) => s !== otherSpeaker) || null
    reason = 'partial_hint+complement'
  } else if (!otherSpeaker && initiatorSpeaker) {
    otherSpeaker = [majorA.speaker, majorB.speaker].find((s) => s !== initiatorSpeaker) || null
    reason = 'partial_hint+complement'
  }

  if (!initiatorSpeaker || !otherSpeaker) return null

  const isInitiatorSession = !!params.callUserId && !!params.sessionUserId && params.callUserId === params.sessionUserId
  const userIsInitiator = isInitiatorSession

  const initiatorLabel = initiator || 'Caller'
  const otherLabel = other || 'Callee'

  const nameMap: Record<string, string> = {
    [initiatorSpeaker]: initiatorLabel,
    [otherSpeaker]: otherLabel,
  }

  const participants: Array<{ name: string; role: string | null; isUser: boolean }> = [
    { name: initiatorLabel, role: null, isUser: userIsInitiator },
    { name: otherLabel, role: null, isUser: !userIsInitiator },
  ]

  const isMeetingLinkHost =
    !!params.meetingLinkContext &&
    params.sessionUserId === params.meetingLinkContext.hostUserId

  const participantParts: string[] = []
  if (isMeetingLinkHost) {
    participantParts.push(`${initiatorLabel} (You, meeting link host / session owner)`)
    participantParts.push(`${otherLabel} (Guest who called your link)`)
  } else {
    participantParts.push(`${initiatorLabel} (${userIsInitiator ? 'You, session owner' : 'other participant'})`)
    participantParts.push(`${otherLabel} (${!userIsInitiator ? 'You, session owner' : 'other participant'})`)
  }

  for (const sp of additionalSpeakers) {
    const label = sp.speaker
    nameMap[sp.speaker] = label
    participants.push({ name: label, role: null, isUser: false })
    participantParts.push(`${label} (additional participant, ${sp.turns} turns)`)
  }

  return {
    participants,
    nameMap,
    knownParticipantBlock: participantParts.join(', '),
    reason: additionalSpeakers.length > 0 ? `${reason}+${additionalSpeakers.length}_additional` : reason,
  }
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    console.log('[Analyze API] Starting analysis for session:', params.id)
    
    // Check if API key exists
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error('[Analyze API] ANTHROPIC_API_KEY is not set!')
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 })
    }

    // Internal call from transcribe job (no user session/cookies)
    const internalSecret = request.headers.get('x-internal-secret')
    const internalUserId = request.headers.get('x-internal-user-id')
    const isInternalCall = !!process.env.INTERNAL_API_SECRET &&
      internalSecret === process.env.INTERNAL_API_SECRET &&
      internalUserId

    let supabase: Awaited<ReturnType<typeof createClient>>
    let userId: string

    if (isInternalCall) {
      supabase = createServiceRoleClient()
      userId = internalUserId
      console.log('[Analyze API] Internal call mode, userId:', userId)
    } else {
      const authSupabase = await createClient()
      const { data: { user }, error: authError } = await authSupabase.auth.getUser()
      if (authError || !user) {
        console.error('[Analyze API] Auth error:', authError)
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      userId = user.id
      await requireSessionAccess(params.id, userId)
      supabase = authSupabase
      console.log('[Analyze API] User authenticated:', userId)
    }

    const isWorkerSync = request.headers.get('x-queue-worker') === '1'

    let force = request.headers.get('x-analyze-force') === '1'
    if (!force) {
      try {
        const body = await request.json()
        force = body?.force === true
      } catch {
        // empty body is fine for normal analyze requests
      }
    }

    // Admin-only: force re-analyze bypasses cached analysis
    if (force && !isInternalCall && !isWorkerSync) {
      const { data: adminProfile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single()
      if (adminProfile?.role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    // Quick cache check: if already analyzed, return cached data without heavy processing
    if (!isWorkerSync && !force) {
      const cacheClient = isInternalCall ? createServiceRoleClient() : supabase
      const svcClient = createServiceRoleClient()
      const { data: cachedSession } = await cacheClient
        .from('sessions')
        .select('recording_type, recording_type_confidence, suggested_domains, ai_extracted_context, suggested_output_formats, context_locked, user_recording_type, user_domains, transcript_corrections')
        .eq('id', params.id)
        .maybeSingle()

      const alreadyCached = cachedSession?.recording_type && cachedSession?.suggested_domains && cachedSession?.ai_extracted_context
      if (alreadyCached) {
        const { data: pendingJob } = await svcClient
          .from('async_jobs')
          .select('id')
          .eq('idempotency_key', `session_analyze:${params.id}`)
          .in('status', ['pending', 'running'])
          .maybeSingle()
        if (pendingJob) {
          console.log('[Analyze API] Analysis in progress, returning 202')
          return NextResponse.json(
            { queued: true, jobId: pendingJob.id },
            { status: 202 }
          )
        }

        console.log('[Analyze API] Returning cached analysis (quick path)')
        return NextResponse.json({
          recordingType: cachedSession.user_recording_type || cachedSession.recording_type,
          recordingTypeConfidence: cachedSession.recording_type_confidence || 1.0,
          domains: cachedSession.user_domains || cachedSession.suggested_domains || [],
          extractedContext: cachedSession.ai_extracted_context || {},
          suggestedOutputFormats: cachedSession.suggested_output_formats || [],
          locked: cachedSession.context_locked || false,
          cached: true,
        })
      }

      // Not cached — enqueue for async processing
      if (!isInternalCall) {
        // Clear any old completed job so a fresh analysis can be enqueued
        await svcClient
          .from('async_jobs')
          .delete()
          .eq('idempotency_key', `session_analyze:${params.id}`)
          .eq('status', 'completed')

        const job = await enqueueAsyncJob({
          userId,
          jobType: 'session_analyze',
          payload: { sessionId: params.id },
          idempotencyKey: `session_analyze:${params.id}`,
          maxAttempts: 5,
        })
        await linkJobToSession(job.id, params.id)
        triggerAsyncWorker()
        console.log('[Analyze API] Enqueued to async queue, jobId:', job.id)
        return NextResponse.json(
          { queued: true, jobId: job.id },
          { status: 202 }
        )
      }
    }

    // Admin force re-analyze: enqueue a fresh job that bypasses cached analysis
    if (!isWorkerSync && force && !isInternalCall) {
      const svcClient = createServiceRoleClient()
      await svcClient
        .from('async_jobs')
        .delete()
        .eq('idempotency_key', `session_analyze:${params.id}`)

      const job = await enqueueAsyncJob({
        userId,
        jobType: 'session_analyze',
        payload: { sessionId: params.id, force: true },
        idempotencyKey: `session_analyze:${params.id}`,
        maxAttempts: 5,
      })
      await linkJobToSession(job.id, params.id)
      triggerAsyncWorker()
      console.log('[Analyze API] Force re-analyze enqueued, jobId:', job.id)
      return NextResponse.json(
        { queued: true, jobId: job.id, force: true },
        { status: 202 }
      )
    }

    // Fetch user profile for name comparison (and admin check for session fetch)
    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name, role, after_transcript_action, after_transcript_template_id, preferred_report_language')
      .eq('id', userId)
      .single()

    const isAdmin = profile?.role === 'admin'

    const userName = profile?.display_name || ''
    console.log('[Analyze API] Profile data:', {
      display_name: profile?.display_name,
    })
    console.log('[Analyze API] User name for AI identification:', userName)

    // Fetch session and transcript (internal/admin use service role to bypass RLS)
    const sessionClient = isInternalCall || isAdmin ? createServiceRoleClient() : supabase
    const sessionFetchQuery = sessionClient
      .from('sessions')
      .select('*, transcripts(*)')
      .eq('id', params.id)
    const { data: session, error: sessionError } = isInternalCall || isAdmin
      ? await sessionFetchQuery.single()
      : await sessionFetchQuery.eq('user_id', userId).single()

    if (sessionError) {
      console.error('[Analyze API] Session error:', sessionError)
      return NextResponse.json({ error: 'Session not found', details: sessionError }, { status: 404 })
    }
    if (!session) {
      console.error('[Analyze API] Session not found')
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }
    await logPipelineEvent({
      sessionId: params.id,
      caseId: (session as any)?.case_id || null,
      userId,
      stage: 'analyze',
      event: 'job_started',
      metadata: { internalCall: isInternalCall },
    }, supabase)
    console.log('[Analyze API] Session found, transcripts count:', session.transcripts?.length || 0)

    const inputHint = (session as any)?.input_hint as string | undefined
    const isVoiceMessage = inputHint === 'voice_message'

    const sourceSignals = ((session as any)?.ai_extracted_context?.sourceSignals || null) as
      | { contentType?: string; authorRole?: string; isExternalInquiry?: boolean; confidence?: number }
      | null
    const hasExternalInquirySignal =
      (session as any)?.input_hint === 'external_inquiry_email' ||
      sourceSignals?.isExternalInquiry === true

    const transcripts = (session.transcripts || []).sort((a: any, b: any) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )
    const detectedTranscriptLanguage =
      transcripts
        .map((t: any) => normalizeLanguageCode(t?.language))
        .find((lang: string | null) => !!lang) || null
    if (transcripts.length === 0 || !transcripts[0]?.raw_json) {
      console.log('[Analyze API] No transcript or raw_json found')
      return NextResponse.json({ error: 'No transcript found' }, { status: 400 })
    }

    // Merge multiple transcripts (grouped sessions) with time offset
    let timeOffset = 0
    const allSegments: any[] = []
    for (const t of transcripts) {
      const segs = asSegmentArray(t.raw_json)
      for (const seg of segs) {
        allSegments.push({
          ...seg,
          start_ms: (seg.start_ms ?? 0) + timeOffset,
          end_ms: (seg.end_ms ?? 0) + timeOffset,
        })
      }
      const last = segs[segs.length - 1]
      timeOffset += last?.end_ms ?? 0
    }
    console.log('[Analyze API] Transcript found, segments count:', allSegments.length)

    // Apply the user's/reconciler's canonical speaker corrections BEFORE
    // analysis so Claude sees the same merged/overridden speakers the user
    // sees — otherwise cleanup and reconciliation would never reach the model.
    const analyzeCorrections = ((session as any)?.transcript_corrections || {}) as Record<string, any>
    // Sample from start, 25%, 50%, 75%, end to avoid misleading analysis of long transcripts
    const segments = applySpeakerCorrectionsToSegments(allSegments, analyzeCorrections)
    const speechSegments = segments.filter((seg) => !isCallNoteSegment(seg))
    const { data: linkedCall } = await sessionClient
      .from('calls')
      .select('id, user_id, callee_user_id, call_type, contact_name, phone_number, session_id, callee_session_id, room_name, participant_a_identity')
      .or(`session_id.eq.${params.id},callee_session_id.eq.${params.id}`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    // Load profile for the OTHER call participant (caller if we're callee, callee if we're caller)
    const callOwnerName =
      linkedCall?.user_id && linkedCall.user_id !== userId
        ? (
            await sessionClient
              .from('profiles')
              .select('display_name')
              .eq('id', linkedCall.user_id)
              .maybeSingle()
          ).data
        : null

    // Load callee profile for WebRTC calls where callee is a Notissima user
    const calleeProfile =
      linkedCall?.callee_user_id && linkedCall.callee_user_id !== userId
        ? (
            await sessionClient
              .from('profiles')
              .select('display_name')
              .eq('id', linkedCall.callee_user_id)
              .maybeSingle()
          ).data
        : null

    // Fallback: look up consent logs for participant names when callee info is missing
    let consentOtherName: string | null = null
    if (linkedCall?.id && !calleeProfile?.display_name && !linkedCall?.contact_name) {
      const { data: consentLogs } = await sessionClient
        .from('consent_logs')
        .select('participant_name, participant_identity')
        .eq('call_id', linkedCall.id)
        .eq('granted', true)
      // Exclude the session owner's / call owner's own consent entry — not the
      // analyzer's — so the "other" name isn't taken from the viewer's identity.
      const excludeIdentities = new Set(
        [((session as any)?.user_id as string | null), linkedCall?.user_id].filter(Boolean) as string[]
      )
      const otherConsent = (consentLogs || []).find(
        (cl: any) => !excludeIdentities.has(cl.participant_identity) && cl.participant_name && cl.participant_name !== 'Guest'
      )
      if (otherConsent?.participant_name) {
        consentOtherName = otherConsent.participant_name
        console.log('[Analyze API] Resolved other participant name from consent log:', consentOtherName)
      }
    }

    // The owner of the session being analyzed — NOT necessarily the user who
    // triggered analysis (e.g. an admin viewing another user's session).
    const sessionOwnerId = ((session as any)?.user_id as string | null) || null

    // Resolve the two call sides from actual participant data, independent of who
    // triggered the analysis. Only fall back to the analyzer's own name when the
    // analyzer genuinely is that participant. Previously the "other" side fell back
    // to `userName` whenever the analyzer wasn't the call owner, which leaked the
    // analyzer's name (e.g. an admin's) onto the callee/phone participant.
    const linkedInitiatorName =
      (linkedCall?.user_id === userId ? userName : callOwnerName?.display_name) || null
    const linkedOtherName =
      (linkedCall?.callee_user_id && linkedCall.callee_user_id === userId
        ? userName
        : calleeProfile?.display_name)
      || linkedCall?.contact_name
      || linkedCall?.phone_number
      || consentOtherName
      || null

    const meetingLinkHostName =
      linkedCall?.user_id === userId
        ? linkedInitiatorName
        : (callOwnerName?.display_name || null)
    const meetingLinkGuestName = linkedCall?.contact_name || consentOtherName || null
    const meetingLinkContext: MeetingLinkContext | null =
      linkedCall?.room_name?.startsWith('meet-') && linkedCall?.user_id && meetingLinkHostName
        ? {
            hostUserId: linkedCall.user_id,
            hostName: meetingLinkHostName,
            guestName: meetingLinkGuestName,
            participantAIdentity: linkedCall.participant_a_identity || null,
          }
        : null

    // Voice-agent calls include the AI assistant as a "speaker" (e.g. "Frau
    // Peters" / "Notissima Agent"). Exclude it from human speaker-name resolution
    // so its label isn't swapped onto a person or phone number.
    const agentOwnerId = (linkedCall?.user_id || (session as any)?.user_id) as string | null
    const agentSpeakerNames = new Set<string>([normalizeForMatch('Notissima Agent')])
    if (agentOwnerId) {
      const { data: agentProfile } = await sessionClient
        .from('profiles')
        .select('voice_agent_display_name')
        .eq('id', agentOwnerId)
        .maybeSingle()
      const agentName = normalizeForMatch(String(agentProfile?.voice_agent_display_name || ''))
      if (agentName) agentSpeakerNames.add(agentName)
    }
    const isAgentSpeaker = (speaker?: string) => agentSpeakerNames.has(normalizeForMatch(String(speaker || '')))
    const humanSpeechSegments = speechSegments.filter((seg) => !isAgentSpeaker(seg.speaker))

    let speakerResolution = buildSpeakerResolution({
      segments: humanSpeechSegments as Array<{ speaker?: string; text?: string; start_ms?: number; end_ms?: number }>,
      callType: linkedCall?.call_type,
      callUserId: linkedCall?.user_id,
      sessionUserId: sessionOwnerId,
      initiatorName: linkedInitiatorName,
      otherParticipantName: linkedOtherName,
      meetingLinkContext,
    })

    const voiceMessageContext = isVoiceMessage
      ? resolveVoiceMessageContext({
          segments: speechSegments,
          session: session as { context_note?: string | null; internal_case_id?: string | null },
          userName,
        })
      : null
    const voiceMessageAddresseeCorrections = voiceMessageContext?.addresseeCorrections ?? {}

    if (voiceMessageContext?.speakerResolution) {
      speakerResolution = voiceMessageContext.speakerResolution
    }

    if (speakerResolution) {
      console.log('[Analyze API] Speaker resolution:', speakerResolution.reason, JSON.stringify(speakerResolution.nameMap))
    }
    if (Object.keys(voiceMessageAddresseeCorrections).length > 0) {
      console.log('[Analyze API] Voice message addressee corrections:', voiceMessageAddresseeCorrections)
    }

    const speakerNameMap = speakerResolution?.nameMap ?? {}
    const formatSegment = (seg: any) => {
      if (isCallNoteSegment(seg)) {
        return formatCallNoteTranscriptLine(getCallNoteAuthor(seg), seg.text)
      }
      const raw = seg.speaker || 'S1'
      return `${speakerNameMap[raw] || raw}: ${seg.text}`
    }
    const n = segments.length
    const segsPerChunk = Math.max(1, Math.floor(n / 20))
    const positions = n <= 10
      ? [0]
      : [0, Math.floor(n * 0.25), Math.floor(n * 0.5), Math.floor(n * 0.75), Math.max(0, n - segsPerChunk)]
    const sampled: string[] = []
    for (const pos of positions) {
      const chunk = segments.slice(pos, Math.min(pos + segsPerChunk, n))
      if (chunk.length) sampled.push(chunk.map(formatSegment).join('\n'))
    }
    const sample = sampled.join('\n\n---\n\n').substring(0, 6000)
    const knownParticipantBlock = speakerResolution?.knownParticipantBlock || 'No participant metadata available.'
    console.log('[Analyze API] Sampled', positions.length, 'sections,', sample.length, 'chars')

    // Check if already analyzed (skip re-analysis unless user wants to correct)
    const alreadyAnalyzed = session.recording_type && session.suggested_domains && session.ai_extracted_context
    
    if (!force && (session.context_locked || alreadyAnalyzed)) {
      console.log('[Analyze API] Using cached analysis (locked or already analyzed)')
      await logPipelineEvent({
        sessionId: params.id,
        caseId: (session as any)?.case_id || null,
        userId,
        stage: 'analyze',
        event: 'job_skipped_cached',
        metadata: {
          contextLocked: Boolean(session.context_locked),
          alreadyAnalyzed: Boolean(alreadyAnalyzed),
        },
      }, supabase)
      const existingCorrections = ((session as any)?.transcript_corrections || {}) as Record<string, any>
      const existingNameCorrections = (existingCorrections.name_corrections || {}) as Record<string, string>
      const normalizedContext = ((session as any)?.ai_extracted_context || {}) as Record<string, any>
      let patchedContext = normalizedContext
      let patchedCorrections = existingCorrections
      let shouldPatch = false

      if (speakerResolution) {
        const resolvedSpeakers = speakerResolution
        const mergedNames = { ...existingNameCorrections, ...resolvedSpeakers.nameMap }
        const hasNewMapping = Object.keys(resolvedSpeakers.nameMap).some(
          (k) => existingNameCorrections[k] !== resolvedSpeakers.nameMap[k]
        )
        const contextParticipants = Array.isArray(normalizedContext.participants) ? normalizedContext.participants : []
        const hasUnresolvedSpeaker = contextParticipants.some((p: any) => typeof p?.name === 'string' && /^S\d+$/i.test(p.name))
        if (hasNewMapping || hasUnresolvedSpeaker) {
          shouldPatch = true
          patchedCorrections = {
            ...existingCorrections,
            name_corrections: mergedNames,
          }
          patchedContext = {
            ...normalizedContext,
            participants: resolvedSpeakers.participants,
            speakerIdentification: {
              ...(normalizedContext.speakerIdentification || {}),
              strategy: resolvedSpeakers.reason,
              updatedAt: new Date().toISOString(),
            },
          }
        }
      }

      if (Object.keys(voiceMessageAddresseeCorrections).length > 0) {
        const existingWordCorrections = coerceWordCorrectionsMap(existingCorrections.word_corrections)
        const mergedWordCorrections = { ...existingWordCorrections, ...voiceMessageAddresseeCorrections }
        const hasNewWordCorrection = Object.keys(voiceMessageAddresseeCorrections).some(
          (k) => existingWordCorrections[k] !== voiceMessageAddresseeCorrections[k]
        )
        if (hasNewWordCorrection) {
          shouldPatch = true
          patchedCorrections = {
            ...patchedCorrections,
            word_corrections: mergedWordCorrections,
          }
        }
      }

      if (shouldPatch) {
        await supabase
          .from('sessions')
          .update({
            ai_extracted_context: patchedContext,
            transcript_corrections: patchedCorrections,
          })
          .eq('id', params.id)
      }

      return NextResponse.json({
        recordingType: session.user_recording_type || session.recording_type,
        recordingTypeConfidence: session.recording_type_confidence || 1.0,
        domains: session.user_domains || session.suggested_domains || [],
        extractedContext: shouldPatch ? patchedContext : (session.ai_extracted_context || {}),
        suggestedOutputFormats: (session as any).suggested_output_formats || [],
        locked: session.context_locked || false,
        cached: true
      })
    }

    // Resolve output language for suggested output format titles/descriptions.
    // This respects the user's preferred_report_language setting.
    const outputLangCode = resolveOutputLanguageCode({
      userPreference: profile?.preferred_report_language,
      sessionLanguage: session.language,
      transcriptLanguage: detectedTranscriptLanguage,
      transcriptText: sample,
    })
    const outputLangName = LANG_NAMES[outputLangCode] || outputLangCode

    // Owner context: did the user already answer a "who are you in this
    // conversation?" clarification? If so, feed it into the prompt so the
    // analyzer tailors suggestions to the owner's interests and does not
    // re-ask.
    const existingOwnerContext = ((session as any)?.owner_context || null) as
      | {
          role?: string
          speakerId?: string | null
          goal?: string | null
          counterpartyRole?: string | null
          source?: string
        }
      | null
    const ownerContextBlock = existingOwnerContext
      ? `OWNER CONTEXT (already known — use this to frame suggestions, do not ask again):
${JSON.stringify(existingOwnerContext)}

Tailor the 3 suggested outputs to serve the OWNER (role: ${existingOwnerContext.role || 'unknown'}) — their post-conversation needs, not the counterparty's. Perspective should default to the owner's viewpoint where appropriate.`
      : `OWNER CONTEXT ASSESSMENT (required):

The recording was made by the session owner ("${userName || 'the user'}"). Before producing suggestions, assess whether you can confidently infer:
  - Which transcript speaker is the owner (speakerId) — or "not in the recording"
  - The owner's role in this conversation (e.g. applicant, interviewer, customer, service provider, patient, doctor, consultant, client, teacher, student, coach, therapist, mediator, caller, recipient, etc.)
  - The owner's likely goal
  - The counterparty's role

If confidence is HIGH (>= 0.75): set ownerAssessment.needsClarification = false and fill ownerAssessment.context with your inference. Tailor the 3 suggestedOutputFormats to serve the OWNER, not the counterparty (e.g. for an applicant post-interview: follow-up thank-you email, personal retrospective / coaching notes, negotiation prep — NOT interviewer's candidate evaluation report).

If confidence is LOW: set ownerAssessment.needsClarification = true and emit a SINGLE transcript-grounded question plus 2-4 concrete options. Ground the options in actual speaker labels and conversation content. Include suggestedContext on each option so the UI can persist it on click. Still emit 3 suggestedOutputFormats with a neutral/observer default — they will be regenerated after the user answers.

Prefer asking when in doubt. A 2-second click is cheaper than a misframed 3-page report.`

    // Phase 2: when this session belongs to a project, fetch the project's
    // saved type/role and current pulse status so per-session classification
    // inherits the project's framing instead of being computed cold from the
    // transcript alone. This stops "Project A is tracked as a New Hire but
    // session 3 happened to be a sprint planning meeting" from re-classifying
    // the project as a tech build. The Pulse engine still detects mismatches
    // separately and surfaces them as a switch-lens suggestion.
    let projectContextBlock = ''
    try {
      const sessionCaseId = (session as any)?.case_id as string | null | undefined
      if (sessionCaseId) {
        const { data: caseRow } = await supabase
          .from('cases')
          .select('title, status, project_type, user_role, pulse')
          .eq('id', sessionCaseId)
          .maybeSingle()
        if (caseRow) {
          const pt = String((caseRow as any).project_type || '').trim()
          const ur = String((caseRow as any).user_role || '').trim()
          const status = String((caseRow as any).status || 'active')
          const pulse = (caseRow as any).pulse || null
          const currentStatus = pulse && typeof pulse === 'object'
            ? String(pulse.current_status || pulse.current_direction || '').trim()
            : ''
          const lines: string[] = []
          if (pt) lines.push(`project_type: ${pt}`)
          if (ur) lines.push(`user_role:    ${ur}`)
          lines.push(`case_status:  ${status}`)
          if (currentStatus) lines.push(`current_status: ${currentStatus}`)
          if (lines.length > 0) {
            projectContextBlock = `PROJECT CONTEXT (this session belongs to an active project — frame your analysis through this lens):
${lines.join('\n')}

When you classify suggested_project_type / suggested_user_role, default to the project's saved type/role above unless this session strongly contradicts it. If it does contradict, classify on its own merits — the Pulse engine will reconcile and surface a switch suggestion to the user. Do not silently change framing.`
          }
        }
      }
    } catch (err) {
      console.warn('[Analyze API] Failed to load project context for prompt:', err)
    }

    // Phase 3: when the session owner has declared a purpose, treat it as
    // ground truth. This is the fix for the Loerrach failure mode (a
    // post-rollout follow-up call mislabeled as "CRM training" because the
    // call happened to include a feature demonstration). Drift between
    // declared intent and what was actually discussed is normal — never
    // flag it.
    let userPurposeBlock = ''
    const declaredPurpose = String((session as any)?.purpose || '').trim()
    const declaredPurposeSource = String((session as any)?.purpose_source || '')
    const hasUserDeclaredPurpose = declaredPurpose.length > 0 && declaredPurposeSource === 'user'
    if (hasUserDeclaredPurpose) {
      userPurposeBlock = `USER-DECLARED PURPOSE (canonical — do not contradict, do not flag as drift):
"${declaredPurpose}"

This is what the session owner says the conversation was for. Treat it as ground truth for intent. Your AI-extracted purpose, classification, and project_type suggestions should be consistent with this declared purpose. Do not flag divergence between this declared purpose and what was actually discussed — conversations frequently take unexpected turns, that is not a bug.`
    }

    // Call Claude to analyze with enhanced context extraction
    console.log('[Analyze API] Calling Claude API for enhanced analysis...')
    const analysisBudget = await resolveTokenBudget({
      task: 'session_analyze',
      model: 'claude-sonnet-4-6',
      // Approximate full prompt size from transcript sample + fixed instructions.
      promptChars: sample.length + 4500,
    }, supabase)
    await logPipelineEvent({
      sessionId: params.id,
      caseId: (session as any)?.case_id || null,
      userId,
      stage: 'analyze',
      event: 'token_budget_resolved',
      metadata: {
        source: analysisBudget.source,
        budgetId: analysisBudget.budgetId || null,
        minTokens: analysisBudget.minTokens,
        maxTokens: analysisBudget.maxTokens,
        ceilingTokens: analysisBudget.ceilingTokens,
        scalingFactor: analysisBudget.scalingFactor,
        estimatedInputTokens: analysisBudget.estimatedInputTokens,
      },
    }, supabase)
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: analysisBudget.maxTokens,
      messages: [
        {
          role: 'user',
          content: `Analyze this conversation transcript comprehensively and extract:

1. **Recording Type** (choose ONE): 
   - meeting (in-person or virtual meeting)
   - interview (job interview, media interview, research interview)
   - presentation (lecture, webinar, training session)
   - consultation (professional advice, client consultation)
   - call_inbound (incoming phone call)
   - call_outbound (outgoing phone call)
   - dictation (voice memo, notes, letter dictation)
   - ai_agent_conversation (conversation with AI assistant)
   - other

2. **Domains** (2-layer structure):
   - Primary Domain: broad category (Medical, Legal, Sales, Education, Finance, etc.)
   - Specialty: specific field (e.g., "Cardiology", "Tax Law", "B2B Sales", "Higher Education")
   - Detect up to 2 domain combinations with confidence scores
   - Use free-form text - be specific and accurate

3. **Rich Context** to help understand and document this session
4. **User-Indicated Content Hint**: The user selected this before upload (use to guide recording type/domain if relevant): ${inputHint || 'none'}${isVoiceMessage ? `\n   NOTE: This is a VOICE MESSAGE left by a visitor on the user's meeting link while the user was unavailable. Treat it as a message TO "${userName || 'the session owner'}", not a meeting. The visitor is the only speaker; "${userName || 'the session owner'}" is the recipient and is NOT speaking in this recording. Set isUser: false for the visitor/speaker and isUser: true only for the recipient if listed as a participant. If the opening salutation addresses someone by name (e.g. "Hallo, Herr …") and that name is NOT "${userName || 'the session owner'}", it is very likely an ASR mishearing of the recipient's name — suggest a high-confidence wordCorrection to the recipient's actual name. Extract: who left the message, what they want/need, urgency level, any callback contact info. The recording type should be "dictation". For suggested outputs, focus on: message summary, reply draft, action items.` : ''}
4b. **Imported Text Source Signals** (heuristic): ${sourceSignals ? JSON.stringify(sourceSignals) : 'none'}
5. **Known Participants** (pre-resolved from metadata — trust this data): ${knownParticipantBlock}
   The recording/session was made by "${userName || 'unknown user'}". Use speaker names from the transcript as-is; they have already been resolved.
6. **Transcription Consent**: At the START of the conversation, was consent to record/transcribe mentioned? The initiator (caller/recorder) implicitly consents. Look for: "This call may be recorded", "Do you consent?", "Okay to record?", affirmative replies. Extract: discussed (boolean), participantsConsented (array of speaker IDs who consented, e.g. ["S1","S2"]), summary (one-line description of how consent was obtained, or null if not discussed).
7. **Spoken Commands**: Detect voice commands directed at "Notissima" (the assistant). Use FUZZY matching—transcription/ASR often misspells proper nouns. Match variations such as: Notissima, Notisima, Notissma, Natissima, Notessima; with or without punctuation (Notissima:, Notissima,); after "Hey", "Ok", "So" etc. If a phrase looks like a command to an assistant (create X, send link, summarize) and the wake word is phonetically similar to Notissima, treat it as a match. Extract the exact phrase as spoken in transcript, speaker, and brief intent summary.
8a. **Owner context assessment**: ${ownerContextBlock}
8b. **Project context**: ${projectContextBlock || 'This session is not (yet) attached to a project.'}
8c. **User-declared purpose**: ${userPurposeBlock || 'No user-declared purpose; infer from content.'}

8. **Suggested Output Formats**: Based on the conversation type and domain, suggest exactly 3 different output formats that would be useful. Examples:
   - Sales call: meeting minutes, internal sales call analysis (what worked, what was missed, buying signals), short team update
   - Legal: deposition summary, client status memo, billing timeline notes
   - Medical: consultation notes, referral summary, patient-facing summary
   - General: meeting minutes, action items, executive summary
  Customize suggestions for the ACTUAL domain and conversation type. Each needs: title (short), description (1 line), generationInstructions (detailed prompt for AI to generate this output), audience, perspective.
  Audience must be one of: "internal", "external", "client", "legal", "executive".
  Perspective must be one of: "observer" (neutral third person — default for most professional documents), "reader_facing" (second person addressing the reader directly as "you" — use for patient summaries, client-facing explanations, or any document written TO someone rather than ABOUT them). Choose the perspective that best matches the output's purpose and audience.
   **LANGUAGE for suggestedOutputFormats**: Write the title and description fields in **${outputLangName}**. The generationInstructions should also be in ${outputLangName}. Do NOT use English for these fields when the output language is not English.

**CRITICAL GLOBAL LANGUAGE RULE**: ALL user-facing text fields MUST be written in **${outputLangName}** — NOT in English (unless ${outputLangName} IS English). This applies to: sessionSummary, extractedContext.purpose, extractedContext.topics, extractedContext.agenda, extractedContext.decisions, extractedContext.actionItems (task field), extractedContext.mood, extractedContext.outcome, extractedContext.suggested_project_type, extractedContext.suggested_user_role, domain descriptions, and ALL suggestedOutputFormats fields (title, description, generationInstructions). Only participant names, role/side qualifiers in parentheses (e.g. "(employer side)"), and technical identifiers should remain in their original language. Violating this rule by writing English text when the output language is ${outputLangName} is a critical error.
9. **Transcript Corrections**: If you notice obvious transcription errors (ASR misspellings of proper nouns, technical terms, place names), suggest corrections. Also, if the transcript has more than 2 speaker labels but the conversation is clearly between only 2 speakers, suggest speaker merges (e.g. "S3" should be merged into "S1").
10. **Detected Language**: Return the ISO 639-1 language code of the primary language SPOKEN in the transcript (e.g., "en", "de", "fr"). This is the language of the conversation itself, NOT the output language you are writing in.
11. **Project Classification (suggested_project_type, suggested_user_role)**: If this conversation could plausibly be the start of (or part of) a bounded project that the session owner might want to track over time — e.g. a hire, a sale, a customer rollout, a marketing campaign, a trade show visit, a fundraise, a vendor evaluation, a job search, a major personal goal — classify what kind of project it would be **from the session owner's perspective**. Use a free-text label that names BOTH the activity AND the owner's side, because the same conversation maps to a different project depending on who recorded it (e.g. an interviewer recording a job interview is "New Hire (employer side)"; the same interview recorded by the candidate is "Job Search (candidate side)"). Examples: "New Hire (employer side)", "Job Search (candidate side)", "Account Sale (seller side)", "Vendor Evaluation (buyer side)", "Customer Rollout (vendor side)", "Trade Show Visit (attendee side)", "Marketing Campaign Launch", "Investor Fundraise", "Software Development Project". Also write a short free-text **suggested_user_role** describing the owner's role in such a project (e.g. "Hiring manager", "Job applicant", "Account executive", "Implementation lead", "Investment club host"). If the conversation is a one-off standalone call, a recurring operational session (daily standup, weekly sync), a personal/social call, or otherwise NOT something the owner would track as a bounded project, set BOTH fields to null. Do not invent a project where there isn't one.

Lines prefixed with "[In-call note · typed by …]" are NOT spoken dialogue — they are text notes typed by the session owner during the call. Do not attribute them to transcript speakers or treat them as things said aloud.

Transcript sample:
${sample}

Respond with ONLY raw JSON (no markdown fences, no backticks, no explanation). Use this exact format:
{
  "detectedLanguage": "de",
  "sessionSummary": "- concise bullet 1\\n- concise bullet 2\\n- concise bullet 3",
  "recordingType": "consultation",
  "recordingTypeConfidence": 0.92,
  "domains": [
    {
      "primary": "Medical",
      "specialty": "Cardiology",
      "confidence": 0.88,
      "description": "Medical consultation focused on heart health"
    },
    {
      "primary": "Insurance",
      "specialty": "Health Insurance",
      "confidence": 0.65,
      "description": "Discussion about coverage options"
    }
  ],
  "extractedContext": {
    "participants": [
      {"name": "Dr. Schmidt", "role": "cardiologist", "isUser": false},
      {"name": "${userName || 'User'}", "role": "patient", "isUser": true}
    ],
    "purpose": "Annual cardiology checkup and medication review",
    "topics": ["blood pressure", "medication dosage", "lifestyle recommendations"],
    "agenda": ["Review test results", "Adjust medication", "Schedule follow-up"],
    "venue": "Cardiology Clinic Berlin (or unknown if not mentioned)",
    "keyDates": ["2026-03-15"],
    "decisions": ["Increase medication dosage", "Schedule stress test"],
    "actionItems": [
      {"task": "Schedule stress test", "owner": "Clinic", "deadline": "2026-03-15"}
    ],
    "mood": "professional, reassuring",
    "outcome": "positive",
    "consent": {
      "discussed": true,
      "participantsConsented": ["S1", "S2"],
      "summary": "S1 asked if recording was okay; S2 agreed"
    },
    "spokenCommands": [
      {"phrase": "Notissima: Create sales opportunity analysis and send me link", "speaker": "S1", "intentSummary": "create_output, send_link"}
    ],
    "suggested_project_type": "New Hire (employer side)",
    "suggested_user_role": "Hiring manager"
  },
  "wordCorrections": [
    {"original": "Feemi Paradox", "corrected": "Fermi Paradox", "confidence": 0.95}
  ],
  "speakerMerges": [
    {"from": "S3", "into": "S1", "confidence": 0.9, "reason": "Only 2 speakers in conversation"}
  ],
  "suggestedOutputFormats": [
    {"title": "${outputLangCode !== 'en' ? `<title in ${outputLangName}>` : '...'}", "description": "${outputLangCode !== 'en' ? `<in ${outputLangName}>` : '...'}", "generationInstructions": "${outputLangCode !== 'en' ? `<in ${outputLangName}>` : '...'}", "audience": "internal", "perspective": "observer"},
    {"title": "${outputLangCode !== 'en' ? `<title in ${outputLangName}>` : '...'}", "description": "${outputLangCode !== 'en' ? `<in ${outputLangName}>` : '...'}", "generationInstructions": "${outputLangCode !== 'en' ? `<in ${outputLangName}>` : '...'}", "audience": "external", "perspective": "reader_facing"},
    {"title": "${outputLangCode !== 'en' ? `<title in ${outputLangName}>` : '...'}", "description": "${outputLangCode !== 'en' ? `<in ${outputLangName}>` : '...'}", "generationInstructions": "${outputLangCode !== 'en' ? `<in ${outputLangName}>` : '...'}", "audience": "executive", "perspective": "observer"}
  ],
  "ownerAssessment": {
    "needsClarification": false,
    "context": {
      "role": "applicant",
      "speakerId": "S1",
      "goal": "pass the job interview and receive an offer",
      "counterpartyRole": "interviewer",
      "confidence": 0.85
    },
    "clarification": null
  }
}

**ownerAssessment schema** (required — pick ONE branch):

Branch A (confident inference — set needsClarification=false):
  "ownerAssessment": {
    "needsClarification": false,
    "context": {
      "role": "<owner's role, short noun, in ${outputLangName} or English>",
      "speakerId": "<S1|S2|... or null if owner is not in recording>",
      "goal": "<one short sentence, in ${outputLangName}>",
      "counterpartyRole": "<short noun>",
      "confidence": <0..1>
    },
    "clarification": null
  }

Branch B (low confidence — ASK):
  "ownerAssessment": {
    "needsClarification": true,
    "context": null,
    "clarification": {
      "question": "<ONE short, transcript-grounded question in ${outputLangName}>",
      "options": [
        {"id": "applicant", "label": "<label in ${outputLangName}, reference the speaker>", "suggestedContext": {"role": "applicant", "speakerId": "S1", "counterpartyRole": "interviewer"}},
        {"id": "interviewer", "label": "<label in ${outputLangName}>", "suggestedContext": {"role": "interviewer", "speakerId": "S2", "counterpartyRole": "applicant"}},
        {"id": "observer", "label": "<label meaning 'I am not in the recording'>", "suggestedContext": {"role": "observer", "speakerId": null}}
      ],
      "allowFreeText": true
    }
  }


**CRITICAL Instructions for Participant Identification:**
- Speaker names in the transcript may already be resolved to real names (e.g., "Patrick" instead of "S1"). Use them as-is in participants.
- The recording was made BY: "${userName}"
- If speaker names are still labels like S1/S2, look for speaker patterns to identify which SPEAKER is "${userName}":
  * If Speaker A says "Hey ${userName}" or addresses "${userName}", then the person who RESPONDS is likely "${userName}"
  * Don't assume the speaker who MENTIONS a name IS that person - they might be addressing them
- Set "isUser": true for the participant matching "${userName}" or the session owner indicated in Known Participants.
- **IMPORTANT**: If you cannot find "${userName}" mentioned or inferred in the conversation, DO NOT mark anyone as isUser: true
- Better to mark NO ONE as the user than to guess wrong
- Extract exact participant names from transcript (spell them correctly!)
- Infer specific roles from conversation content
- Be specific with domains - use actual field names (e.g., "Tax Law" not just "Legal")
- Use 2-layer domain structure: primary (broad) + specialty (specific)
- If User-Indicated Content Hint is "external_inquiry_email" OR sourceSignals.isExternalInquiry is true, do NOT classify as "dictation". Treat it as an external inquiry/correspondence-style import and choose a non-dictation type.
- If information isn't clearly available, use empty arrays [] or "unknown"
- Be accurate and preserve correct spelling from transcript
- For consent: focus on the first 1-2 minutes of the conversation. If nothing found, use discussed: false, participantsConsented: [], summary: null
- For spokenCommands: use fuzzy matching. Accept Notissima + common ASR misspellings (Notisima, Notissma, Natissima, etc.). Accept phonetically similar wake words. Include if it reasonably looks like a command to the assistant. Preserve the exact phrase from transcript. Empty array if none found
- Add "sessionSummary" as 2-5 concise bullets in **${outputLangName}**, focused on what happened, decisions, and next actions.
- For wordCorrections: only flag high-confidence corrections (names, places, technical terms that ASR clearly misspelled). Empty array if none.
- For speakerMerges: only suggest if clearly fewer actual speakers than labels. Empty array if none.
- For suggested_project_type and suggested_user_role: ONLY populate when the conversation plausibly starts (or belongs to) a bounded project the owner would track over time. Default to null. Examples that should be null: daily standup, recurring weekly sync, ad-hoc tech support call, casual personal call, voice memo to self, training session that is not a customer rollout. Examples that should be populated: first interview with a candidate, kickoff call with a new client, first sales discovery call, first trade-show contact follow-up, first post-rollout customer follow-up. Always include the owner's side in the type label (employer side / candidate side / seller side / buyer side / vendor side / attendee side, etc.) because the same conversation maps to different projects depending on whose perspective records it.${JSON_ONLY_SUFFIX}`
        },
      ]
    })
    console.log('[Analyze API] Claude responded successfully')

    // Record AI token usage for beta cost tracking
    const usage = (message as { usage?: { input_tokens?: number; output_tokens?: number } }).usage
    if (usage?.input_tokens != null || usage?.output_tokens != null) {
      recordAiTokens(supabase, userId, usage.input_tokens ?? 0, usage.output_tokens ?? 0, {
        sessionId: params.id,
        endpoint: 'sessions/analyze',
      })
    }

    // Parse Claude's response — re-attach the prefilled `{` before parsing.
    const rawResponseText = message.content[0].type === 'text' ? message.content[0].text : ''
    const responseText = withJsonPrefill(rawResponseText)
    console.log('[Analyze API] Claude response:', responseText.substring(0, 200))
    let analysis: Record<string, any>
    try {
      analysis = parseAnalysisResponseText(responseText)
    } catch (parseError: any) {
      const head = responseText.slice(0, 400)
      const tail = responseText.length > 800 ? responseText.slice(-400) : ''
      await logPipelineEvent({
        sessionId: params.id,
        caseId: (session as any)?.case_id || null,
        userId,
        stage: 'analyze',
        event: 'parse_failed',
        severity: 'critical',
        metadata: {
          message: String(parseError?.message || 'parse failed'),
          stopReason: (message as { stop_reason?: string | null }).stop_reason ?? null,
          outputTokens: usage?.output_tokens ?? null,
          inputTokens: usage?.input_tokens ?? null,
          maxTokens: analysisBudget.maxTokens,
          responseLength: responseText.length,
          responseHead: head,
          responseTail: tail,
        },
      }, supabase)
      throw parseError
    }
    console.log('[Analyze API] Parsed analysis:', JSON.stringify(analysis).substring(0, 300))
    console.log('[Analyze API] AI identified participants:', JSON.stringify(analysis.extractedContext?.participants, null, 2))

    // Prevent false "dictation" labels for external inbound inquiries.
    let finalRecordingType =
      hasExternalInquirySignal && analysis.recordingType === 'dictation'
        ? 'other'
        : analysis.recordingType
    let finalRecordingTypeConfidence =
      hasExternalInquirySignal && analysis.recordingType === 'dictation'
        ? Math.min(Number(analysis.recordingTypeConfidence || 0.5), 0.6)
        : analysis.recordingTypeConfidence

    // Prevent false "ai_agent_conversation" for known human calls.
    // When input_hint says video_call/phone_call, or the call has two real participants,
    // override to "meeting" since it's clearly a human-to-human conversation.
    const isKnownHumanCall =
      (inputHint === 'video_call' || inputHint === 'phone_call') ||
      (linkedCall?.call_type === 'web' && linkedCall?.callee_user_id)
    if (isKnownHumanCall && finalRecordingType === 'ai_agent_conversation') {
      console.log(`[Analyze API] Overriding ai_agent_conversation → meeting (input_hint=${inputHint}, callType=${linkedCall?.call_type})`)
      finalRecordingType = 'meeting'
      finalRecordingTypeConfidence = Math.min(Number(finalRecordingTypeConfidence || 0.7), 0.75)
    }

    if (inputHint === 'voice_message' && finalRecordingType !== 'dictation') {
      finalRecordingType = 'dictation'
      finalRecordingTypeConfidence = 0.95
    }

    // Trust the linked call's call_type over the LLM's transcript-based guess.
    // `calls.call_type` is authoritative metadata (PSTN direction, web meeting),
    // whereas the LLM routinely flips call_inbound ↔ call_outbound based on who
    // speaks first, greetings, etc. Only apply when the LLM still has the
    // recording classified as a call; other overrides above (voice_message,
    // ai_agent_conversation → meeting) take precedence.
    if (linkedCall?.call_type && (finalRecordingType === 'call_inbound' || finalRecordingType === 'call_outbound')) {
      const directionFromCall: 'call_inbound' | 'call_outbound' | null =
        linkedCall.call_type === 'pstn_outbound'
          ? 'call_outbound'
          : linkedCall.call_type === 'pstn_inbound'
            ? 'call_inbound'
            : null
      if (directionFromCall && directionFromCall !== finalRecordingType) {
        console.log(
          `[Analyze API] Overriding ${finalRecordingType} → ${directionFromCall} from linked call.call_type=${linkedCall.call_type}`
        )
        finalRecordingType = directionFromCall
        finalRecordingTypeConfidence = 1.0
      }
    }

    const existingExtractedContext = ((session as any)?.ai_extracted_context || {}) as Record<string, any>
    const existingCorrections = ((session as any)?.transcript_corrections || {}) as Record<string, any>
    const existingNameCorrections = (existingCorrections.name_corrections || {}) as Record<string, string>

    const aiWordCorrections = Array.isArray(analysis.wordCorrections) ? analysis.wordCorrections : []
    const aiSpeakerMerges = Array.isArray(analysis.speakerMerges) ? analysis.speakerMerges : []
    const mergedWordCorrections = mergeWordCorrections(
      existingCorrections.word_corrections,
      voiceMessageAddresseeCorrections,
      aiWordCorrections
    )

    const mergedExtractedContext = {
      ...analysis.extractedContext,
      sourceSignals: existingExtractedContext.sourceSignals || sourceSignals || null,
      ...(speakerResolution
        ? {
            participants: speakerResolution.participants,
            speakerIdentification: {
              ...(analysis.extractedContext?.speakerIdentification || {}),
              strategy: speakerResolution.reason,
              updatedAt: new Date().toISOString(),
            },
          }
        : {}),
    }
    // Never remap the assistant's own speaker label, and prune any stale agent
    // entry a previous (buggy) run may have written (e.g. "Frau Peters" -> phone).
    const cleanedNameCorrections = Object.fromEntries(
      Object.entries({ ...existingNameCorrections, ...(speakerResolution?.nameMap ?? {}) })
        .filter(([rawLabel]) => !isAgentSpeaker(rawLabel))
    )
    const mergedTranscriptCorrections = {
      ...existingCorrections,
      ...(Object.keys(cleanedNameCorrections).length > 0
        ? { name_corrections: cleanedNameCorrections }
        : {}),
      ...(Object.keys(mergedWordCorrections).length > 0 ? { word_corrections: mergedWordCorrections } : {}),
      ...(aiSpeakerMerges.length > 0 ? { speaker_merges: aiSpeakerMerges } : {}),
    }
    const canonicalSummary = resolveSessionSummary(
      analysis,
      mergedExtractedContext,
      ((session as any)?.speechmatics_summary ?? null) as string | null
    )

    // Update session with AI suggestions and extracted context
    console.log('[Analyze API] Updating session in database...')
    const suggestedFormats = Array.isArray(analysis.suggestedOutputFormats)
      ? analysis.suggestedOutputFormats
          .slice(0, 3)
          .map((s: unknown) => {
            const suggestion = (typeof s === 'object' && s !== null ? s : {}) as Record<string, unknown>
            return {
              title: String(suggestion.title || ''),
              description: String(suggestion.description || ''),
              generationInstructions: String(suggestion.generationInstructions || ''),
              audience: isAllowedSuggestionAudience(suggestion.audience)
                ? suggestion.audience
                : 'internal',
              perspective: isAllowedSuggestionPerspective(suggestion.perspective)
                ? suggestion.perspective
                : 'observer',
            }
          })
      : []
    // Owner-context assessment from Claude. If existing owner_context is
    // already set, we keep it (user has answered) and ignore re-assessment.
    // Otherwise: persist either an inferred owner_context (high confidence)
    // or a pending_clarification (low confidence) for the UI to resolve.
    let nextOwnerContext: Record<string, any> | null = existingOwnerContext
    let nextPendingClarification: Record<string, any> | null = null
    const ownerAssessment = (analysis as any)?.ownerAssessment
    if (!existingOwnerContext && ownerAssessment && typeof ownerAssessment === 'object') {
      const needsClarification = Boolean(ownerAssessment.needsClarification)
      if (needsClarification && ownerAssessment.clarification && typeof ownerAssessment.clarification === 'object') {
        const clarification = ownerAssessment.clarification as Record<string, any>
        const rawOptions = Array.isArray(clarification.options) ? clarification.options : []
        const options = rawOptions
          .map((opt: any) => {
            if (!opt || typeof opt !== 'object') return null
            const id = String(opt.id || '').trim()
            const label = String(opt.label || '').trim()
            if (!id || !label) return null
            return {
              id,
              label,
              suggestedContext:
                opt.suggestedContext && typeof opt.suggestedContext === 'object'
                  ? opt.suggestedContext
                  : null,
            }
          })
          .filter(Boolean)
        const question = String(clarification.question || '').trim()
        if (question && options.length >= 2) {
          nextPendingClarification = {
            question,
            options,
            allowFreeText: clarification.allowFreeText !== false,
            createdAt: new Date().toISOString(),
          }
        }
      } else if (ownerAssessment.context && typeof ownerAssessment.context === 'object') {
        const ctx = ownerAssessment.context as Record<string, any>
        const role = String(ctx.role || '').trim()
        if (role) {
          nextOwnerContext = {
            role,
            speakerId: ctx.speakerId ? String(ctx.speakerId) : null,
            goal: ctx.goal ? String(ctx.goal) : null,
            counterpartyRole: ctx.counterpartyRole ? String(ctx.counterpartyRole) : null,
            confidence: typeof ctx.confidence === 'number' ? ctx.confidence : null,
            source: 'inferred',
            updatedAt: new Date().toISOString(),
          }
        }
      }
    }

    const sessionUpdate: Record<string, any> = {
      recording_type: finalRecordingType,
      recording_type_confidence: finalRecordingTypeConfidence,
      suggested_domains: analysis.domains,
      ai_extracted_context: mergedExtractedContext,
      suggested_output_formats: suggestedFormats,
      transcript_corrections: mergedTranscriptCorrections,
      speechmatics_summary: canonicalSummary,
      owner_context: nextOwnerContext,
      pending_clarification: nextPendingClarification,
    }

    // Phase 3: backfill sessions.purpose from AI-extracted purpose when the
    // user did not declare one. Marked as purpose_source = 'ai' so downstream
    // code can tell user-declared from inferred. If the user declared a
    // purpose, preserve it untouched.
    if (!hasUserDeclaredPurpose) {
      const aiPurpose = String(mergedExtractedContext?.purpose || '').trim()
      if (aiPurpose) {
        sessionUpdate.purpose = aiPurpose
        sessionUpdate.purpose_source = 'ai'
      }
    }
    // Claude detects the transcript language authoritatively — always trust it over heuristics.
    const claudeDetectedLang = normalizeLanguageCode(analysis.detectedLanguage)
    if (claudeDetectedLang) {
      sessionUpdate.language = claudeDetectedLang
      console.log(`[Analyze API] Session language set from Claude detection: ${claudeDetectedLang} (output lang: ${outputLangCode})`)
    }
    const { error: updateError } = await supabase
      .from('sessions')
      .update(sessionUpdate)
      .eq('id', params.id)

    if (updateError) {
      console.error('[Analyze API] Error updating session:', updateError)
      await logPipelineEvent({
        sessionId: params.id,
        caseId: (session as any)?.case_id || null,
        userId,
        stage: 'analyze',
        event: 'job_failed',
        severity: 'error',
        metadata: { message: updateError.message },
      }, supabase)
      // Don't fail the request if update fails, just log it
    } else {
      console.log('[Analyze API] Session updated successfully')
      await logPipelineEvent({
        sessionId: params.id,
        caseId: (session as any)?.case_id || null,
        userId,
        stage: 'analyze',
        event: 'job_completed',
        metadata: {
          recordingType: finalRecordingType,
          suggestedFormats: suggestedFormats.length,
        },
      }, supabase)

      const summaryFirstLine = (canonicalSummary || '')
        .split('\n')
        .map((l: string) => l.replace(/^[-•*]\s*/, '').trim())
        .find((l: string) => l.length > 0) || undefined
      const sessionLabel = (session as any)?.internal_case_id || summaryFirstLine || `Session ${params.id.slice(0, 8)}`
      createNotification({
        userId,
        type: 'analysis_complete',
        title: sessionLabel,
        message: summaryFirstLine && summaryFirstLine !== sessionLabel ? summaryFirstLine : undefined,
        actionHref: `/sessions/${params.id}?tab=context`,
        data: { sessionId: params.id, recordingType: finalRecordingType, domains: analysis.domains },
      }).catch(() => {})
    }

    // Check user's auto-generation preference (profile already fetched above)
    // Prefer after_transcript_template_id; fallback to after_transcript_action for backward compat
    let autoGeneratedOutput = null
    const templateId = (profile as any)?.after_transcript_template_id
    const legacyAction = profile?.after_transcript_action && profile.after_transcript_action !== 'nothing'
    const shouldAutoGenerate = templateId || legacyAction

    if (shouldAutoGenerate) {
      console.log('[Analyze API] Auto-generation enabled:', templateId ? `template ${templateId}` : legacyAction)

      const preferredOutputLanguage = resolveOutputLanguageCode({
        userPreference: profile?.preferred_report_language,
        sessionLanguage: (session as any)?.language,
        transcriptLanguage: detectedTranscriptLanguage,
        transcriptText: sample,
      })

      // Resolve template directly here (previously /auto-generate did this
      // via self-HTTP fetch, which fails in Railway's container network).
      let autoTemplateId: string | null = templateId || null
      let autoTemplateFormat: string | null = null
      let autoTemplateName: string | null = null
      try {
        const svc = createServiceRoleClient()
        if (autoTemplateId) {
          const { data } = await svc
            .from('templates')
            .select('id, name, output_format')
            .eq('id', autoTemplateId)
            .or(`is_system.eq.true,created_by.eq.${userId}`)
            .maybeSingle()
          if (data) {
            autoTemplateId = data.id
            autoTemplateName = data.name || null
            autoTemplateFormat = (data as any).output_format || null
          } else {
            console.warn('[Analyze API] Auto-gen template not found:', templateId)
            autoTemplateId = null
          }
        } else if (legacyAction) {
          const legacyMap: Record<string, string> = {
            short_summary: 'Meeting Minutes',
            long_summary: 'Meeting Summary',
            full_report: 'Meeting Summary',
            action_items: 'Action Items & Next Steps',
          }
          const name = legacyMap[profile?.after_transcript_action as string]
          if (name) {
            const { data } = await svc
              .from('templates')
              .select('id, name, output_format')
              .eq('name', name)
              .eq('is_system', true)
              .maybeSingle()
            if (data) {
              autoTemplateId = data.id
              autoTemplateName = data.name || null
              autoTemplateFormat = (data as any).output_format || null
            }
          }
        }

        if (autoTemplateId) {
          const config = {
            templateId: autoTemplateId,
            templateName: autoTemplateName || undefined,
            perspective: 'observer' as const,
            audience: 'internal' as const,
            language: preferredOutputLanguage,
            tone: 'neutral' as const,
            format: autoTemplateFormat === 'email_text' ? 'email' : 'markdown',
            doInstructions: '',
            dontInstructions: '',
            createTemplateFromConfig: false,
            citeTimestamps: false,
          }
          const idempotencySource = `${userId}:${params.id}:${JSON.stringify(config)}`
          const idempotencyKey = createHash('sha256').update(idempotencySource).digest('hex')
          const job = await enqueueAsyncJob({
            userId,
            jobType: 'output_generate',
            payload: { sessionId: params.id, config },
            idempotencyKey,
            maxAttempts: 5,
          })
          await linkJobToSession(job.id, params.id)
          triggerAsyncWorker()
          console.log('[Analyze API] Auto-generation enqueued, jobId:', job.id)
          autoGeneratedOutput = {
            status: 'queued',
            jobId: job.id,
            templateId: autoTemplateId,
            templateName: autoTemplateName,
          }
        }
      } catch (err) {
        console.error('[Analyze API] Auto-generation enqueue failed:', err)
      }
    } else {
      console.log('[Analyze API] Auto-generation disabled')
    }

    // Execute spoken commands (e.g. "Notissima: create a summary focusing on cost savings")
    // Commands are already detected by Claude and stored in ai_extracted_context.spokenCommands.
    // For each output-creation command, call outputs/generate using the spoken phrase as the
    // doInstructions so the user's exact intent drives the output.
    const spokenCommands: Array<{ phrase: string; speaker: string; intentSummary?: string }> =
      analysis.extractedContext?.spokenCommands || []

    if (spokenCommands.length > 0) {
      console.log('[Analyze API] Found', spokenCommands.length, 'spoken command(s) — executing...')

      // Resolve template: prefer user's default, fall back to first available system template
      let commandTemplateId: string | null = templateId || null
      if (!commandTemplateId) {
        const supabaseAdmin = createServiceRoleClient()
        const { data: sysTemplate } = await supabaseAdmin
          .from('templates')
          .select('id')
          .eq('is_system', true)
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle()
        commandTemplateId = sysTemplate?.id || null
      }

      if (commandTemplateId) {
        const outputCreationIntent = /create|generat|summar|extract|report|analys|output|save|write/i

        for (const cmd of spokenCommands) {
          const isOutputCommand = outputCreationIntent.test(cmd.intentSummary || '') ||
            outputCreationIntent.test(cmd.phrase)

          if (!isOutputCommand) {
            console.log('[Analyze API] Skipping non-output command:', cmd.phrase)
            continue
          }

          console.log('[Analyze API] Executing spoken command:', cmd.phrase)
          try {
            const config = {
              templateId: commandTemplateId,
              perspective: 'observer' as const,
              audience: 'internal' as const,
              language: resolveOutputLanguageCode({
                userPreference: profile?.preferred_report_language,
                sessionLanguage: (session as any)?.language,
                transcriptLanguage: detectedTranscriptLanguage,
                transcriptText: sample,
              }),
              tone: 'neutral' as const,
              format: 'markdown',
              // Use the exact spoken phrase as the generation instruction
              doInstructions: cmd.phrase,
              dontInstructions: '',
              createTemplateFromConfig: false,
              citeTimestamps: false,
            }
            const idempotencySource = `${userId}:${params.id}:spoken:${cmd.phrase}`
            const idempotencyKey = createHash('sha256').update(idempotencySource).digest('hex')
            const job = await enqueueAsyncJob({
              userId,
              jobType: 'output_generate',
              payload: { sessionId: params.id, config },
              idempotencyKey,
              maxAttempts: 5,
            })
            await linkJobToSession(job.id, params.id)
            console.log('[Analyze API] Spoken command enqueued, jobId:', job.id)
          } catch (err) {
            console.error('[Analyze API] Spoken command enqueue failed:', cmd.phrase, err)
          }
        }
        triggerAsyncWorker()
      } else {
        console.warn('[Analyze API] No template available to execute spoken commands')
      }
    }

    return NextResponse.json({
      recordingType: finalRecordingType,
      recordingTypeConfidence: finalRecordingTypeConfidence,
      domains: analysis.domains,
      extractedContext: mergedExtractedContext,
      suggestedOutputFormats: suggestedFormats,
      autoGeneration: autoGeneratedOutput,
      ownerContext: nextOwnerContext,
      pendingClarification: nextPendingClarification,
    })
  } catch (error: any) {
    console.error('[Analyze API] Error:', error)
    console.error('[Analyze API] Error stack:', error?.stack)
    console.error('[Analyze API] Error message:', error?.message)
    await logPipelineEvent({
      sessionId: params.id,
      stage: 'analyze',
      event: 'job_failed',
      severity: 'critical',
      metadata: { message: String(error?.message || 'unknown') },
    })
    return NextResponse.json({ 
      error: 'Failed to analyze session', 
      message: error?.message,
      type: error?.constructor?.name
    }, { status: 500 })
  }
}
