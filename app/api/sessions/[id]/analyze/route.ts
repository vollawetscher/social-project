import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { recordAiTokens } from '@/lib/services/usage-tracker'
import { requireSessionAccess } from '@/lib/auth/helpers'
import { logPipelineEvent } from '@/lib/services/pipeline-logger'
import { resolveTokenBudget } from '@/lib/services/token-budget'
import { enqueueAsyncJob, triggerAsyncWorker } from '@/lib/services/queue'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

function normalizeLanguageCode(raw: string | null | undefined): string | null {
  const value = (raw || '').toLowerCase().trim()
  if (!value || value === 'auto' || value === 'session') return null
  return value.slice(0, 2)
}

function resolveOutputLanguageCode(
  preferredReportLanguage: string | null | undefined,
  sessionLanguage: string | null | undefined,
  detectedTranscriptLanguage?: string | null
): string {
  const pref = (preferredReportLanguage || '').toLowerCase()
  if (pref && pref !== 'session' && pref !== 'auto') return pref.slice(0, 2)
  const transcriptLang = normalizeLanguageCode(detectedTranscriptLanguage)
  if (transcriptLang) return transcriptLang
  const sessionLang = normalizeLanguageCode(sessionLanguage)
  if (sessionLang) return sessionLang
  return 'de'
}

const LANG_NAMES: Record<string, string> = {
  de: 'German', en: 'English', es: 'Spanish', fr: 'French',
  it: 'Italian', pt: 'Portuguese', nl: 'Dutch', pl: 'Polish',
  cs: 'Czech', da: 'Danish', fi: 'Finnish', no: 'Norwegian',
  sv: 'Swedish', ru: 'Russian', ja: 'Japanese', zh: 'Chinese',
  ko: 'Korean', ar: 'Arabic', hi: 'Hindi',
}
const ALLOWED_SUGGESTION_AUDIENCES = ['internal', 'external', 'client', 'legal', 'executive'] as const
function isAllowedSuggestionAudience(value: unknown): value is (typeof ALLOWED_SUGGESTION_AUDIENCES)[number] {
  return typeof value === 'string' && ALLOWED_SUGGESTION_AUDIENCES.includes(value as (typeof ALLOWED_SUGGESTION_AUDIENCES)[number])
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
  if (!s.startsWith('{')) return null

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

type SpeakerResolution = {
  participants: Array<{ name: string; role: string | null; isUser: boolean }>
  nameMap: Record<string, string>
  knownParticipantBlock: string
  reason: string
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
  if (new RegExp(`\\b${escaped}\\b`).test(t.slice(0, 50))) return true
  return false
}

function addressMatchesName(text: string, name: string): boolean {
  const fn = firstName(name)
  if (!fn || fn.length < 2) return false
  const t = normalizeForMatch(text)
  const escaped = fn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const addressPatterns = new RegExp(
    `\\b(hey|hi|hallo|hello|guten tag|moin|servus|gr[uü][sß]|how are you|wie geht)\\b[\\s,]*${escaped}\\b` +
    `|\\b${escaped}[\\s,]+(are you|bist du|sind sie|h[oö]rst du|kannst du)`
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

function buildSpeakerResolution(params: {
  segments: Array<{ speaker?: string; text?: string; start_ms?: number; end_ms?: number }>
  callType?: string | null
  callUserId?: string | null
  sessionUserId?: string | null
  initiatorName?: string | null
  otherParticipantName?: string | null
}): SpeakerResolution | null {
  const bySpeaker = aggregateSpeakers(params.segments)
  const ranked = Array.from(bySpeaker.values())
    .sort((a, b) => (b.totalMs - a.totalMs) || (b.turns - a.turns))
    .slice(0, 2)
  if (ranked.length < 2) {
    if (ranked.length === 1 && params.initiatorName) {
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

  const participantParts: string[] = []
  participantParts.push(`${initiatorLabel} (${userIsInitiator ? 'You, session owner' : 'other participant'})`)
  participantParts.push(`${otherLabel} (${!userIsInitiator ? 'You, session owner' : 'other participant'})`)

  return {
    participants: [
      { name: initiatorLabel, role: null, isUser: userIsInitiator },
      { name: otherLabel, role: null, isUser: !userIsInitiator },
    ],
    nameMap,
    knownParticipantBlock: participantParts.join(', '),
    reason,
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

    // Quick cache check: if already analyzed, return cached data without heavy processing
    if (!isWorkerSync) {
      const cacheClient = isInternalCall ? createServiceRoleClient() : supabase
      const { data: cachedSession } = await cacheClient
        .from('sessions')
        .select('recording_type, recording_type_confidence, suggested_domains, ai_extracted_context, suggested_output_formats, context_locked, user_recording_type, user_domains, transcript_corrections')
        .eq('id', params.id)
        .maybeSingle()

      const alreadyCached = cachedSession?.recording_type && cachedSession?.suggested_domains && cachedSession?.ai_extracted_context
      if (alreadyCached) {
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
        const job = await enqueueAsyncJob({
          userId,
          jobType: 'session_analyze',
          payload: { sessionId: params.id },
          idempotencyKey: `session_analyze:${params.id}`,
          maxAttempts: 5,
        })
        triggerAsyncWorker()
        console.log('[Analyze API] Enqueued to async queue, jobId:', job.id)
        return NextResponse.json(
          { queued: true, jobId: job.id },
          { status: 202 }
        )
      }
    }

    // Fetch user profile for name comparison (and admin check for session fetch)
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, company_name, display_name, role, after_transcript_action, after_transcript_template_id, preferred_report_language')
      .eq('id', userId)
      .single()

    const isAdmin = profile?.role === 'admin'

    const userName = profile?.display_name || profile?.full_name || profile?.company_name || ''
    console.log('[Analyze API] Profile data:', { 
      display_name: profile?.display_name, 
      full_name: profile?.full_name, 
      company_name: profile?.company_name 
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

    // Sample from start, 25%, 50%, 75%, end to avoid misleading analysis of long transcripts
    const segments = allSegments
    const { data: linkedCall } = await sessionClient
      .from('calls')
      .select('id, user_id, callee_user_id, call_type, contact_name, session_id, callee_session_id')
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
              .select('display_name, full_name, company_name')
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
              .select('display_name, full_name')
              .eq('id', linkedCall.callee_user_id)
              .maybeSingle()
          ).data
        : null

    const linkedInitiatorName =
      linkedCall?.user_id === userId
        ? userName
        : (callOwnerName?.display_name || callOwnerName?.full_name || callOwnerName?.company_name || null)
    const linkedOtherName =
      linkedCall?.user_id === userId
        ? (calleeProfile?.display_name || calleeProfile?.full_name || linkedCall?.contact_name || null)
        : userName

    const speakerResolution = buildSpeakerResolution({
      segments: segments as Array<{ speaker?: string; text?: string; start_ms?: number; end_ms?: number }>,
      callType: linkedCall?.call_type,
      callUserId: linkedCall?.user_id,
      sessionUserId: userId,
      initiatorName: linkedInitiatorName,
      otherParticipantName: linkedOtherName,
    })
    if (speakerResolution) {
      console.log('[Analyze API] Speaker resolution:', speakerResolution.reason, JSON.stringify(speakerResolution.nameMap))
    }

    const speakerNameMap = speakerResolution?.nameMap ?? {}
    const formatSegment = (seg: any) => {
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
    
    if (session.context_locked || alreadyAnalyzed) {
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
        const mergedNames = { ...existingNameCorrections, ...speakerResolution.nameMap }
        const hasNewMapping = Object.keys(speakerResolution.nameMap).some(
          (k) => existingNameCorrections[k] !== speakerResolution.nameMap[k]
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
            participants: speakerResolution.participants,
            speakerIdentification: {
              ...(normalizedContext.speakerIdentification || {}),
              strategy: speakerResolution.reason,
              updatedAt: new Date().toISOString(),
            },
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

    // Resolve target language for suggested output format titles/descriptions
    const outputLangCode = resolveOutputLanguageCode(
      profile?.preferred_report_language,
      session.language,
      detectedTranscriptLanguage
    )
    const outputLangName = LANG_NAMES[outputLangCode] || outputLangCode

    // Call Claude to analyze with enhanced context extraction
    console.log('[Analyze API] Calling Claude API for enhanced analysis...')
    const analysisBudget = await resolveTokenBudget({
      task: 'session_analyze',
      model: 'claude-sonnet-4-5-20250929',
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
      model: 'claude-sonnet-4-5-20250929',
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
4. **User-Indicated Content Hint**: The user selected this before upload (use to guide recording type/domain if relevant): ${(session as { input_hint?: string }).input_hint || 'none'}
4b. **Imported Text Source Signals** (heuristic): ${sourceSignals ? JSON.stringify(sourceSignals) : 'none'}
5. **Known Participants** (pre-resolved from metadata — trust this data): ${knownParticipantBlock}
   The recording/session was made by "${userName || 'unknown user'}". Use speaker names from the transcript as-is; they have already been resolved.
6. **Transcription Consent**: At the START of the conversation, was consent to record/transcribe mentioned? The initiator (caller/recorder) implicitly consents. Look for: "This call may be recorded", "Do you consent?", "Okay to record?", affirmative replies. Extract: discussed (boolean), participantsConsented (array of speaker IDs who consented, e.g. ["S1","S2"]), summary (one-line description of how consent was obtained, or null if not discussed).
7. **Spoken Commands**: Detect voice commands directed at "Notissima" (the assistant). Use FUZZY matching—transcription/ASR often misspells proper nouns. Match variations such as: Notissima, Notisima, Notissma, Natissima, Notessima; with or without punctuation (Notissima:, Notissima,); after "Hey", "Ok", "So" etc. If a phrase looks like a command to an assistant (create X, send link, summarize) and the wake word is phonetically similar to Notissima, treat it as a match. Extract the exact phrase as spoken in transcript, speaker, and brief intent summary.
8. **Suggested Output Formats**: Based on the conversation type and domain, suggest exactly 3 different output formats that would be useful. Examples:
   - Sales call: meeting minutes, internal sales call analysis (what worked, what was missed, buying signals), short team update
   - Legal: deposition summary, client status memo, billing timeline notes
   - Medical: consultation notes, referral summary, patient-facing summary
   - General: meeting minutes, action items, executive summary
  Customize suggestions for the ACTUAL domain and conversation type. Each needs: title (short), description (1 line), generationInstructions (detailed prompt for AI to generate this output), audience.
  Audience must be one of: "internal", "external", "client", "legal", "executive".
   **LANGUAGE for suggestedOutputFormats**: Write the title and description fields in **${outputLangName}**. The generationInstructions should also be in ${outputLangName}.
9. **Transcript Corrections**: If you notice obvious transcription errors (ASR misspellings of proper nouns, technical terms, place names), suggest corrections. Also, if the transcript has more than 2 speaker labels but the conversation is clearly between only 2 speakers, suggest speaker merges (e.g. "S3" should be merged into "S1").

Transcript sample:
${sample}

Respond with ONLY raw JSON (no markdown fences, no backticks, no explanation). Use this exact format:
{
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
    ]
  },
  "wordCorrections": [
    {"original": "Feemi Paradox", "corrected": "Fermi Paradox", "confidence": 0.95}
  ],
  "speakerMerges": [
    {"from": "S3", "into": "S1", "confidence": 0.9, "reason": "Only 2 speakers in conversation"}
  ],
  "suggestedOutputFormats": [
    {"title": "...", "description": "...", "generationInstructions": "...", "audience": "internal"},
    {"title": "...", "description": "...", "generationInstructions": "...", "audience": "external"},
    {"title": "...", "description": "...", "generationInstructions": "...", "audience": "client"}
  ]
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
- Add "sessionSummary" as 2-5 concise bullets in the transcript language, focused on what happened, decisions, and next actions.
- For wordCorrections: only flag high-confidence corrections (names, places, technical terms that ASR clearly misspelled). Empty array if none.
- For speakerMerges: only suggest if clearly fewer actual speakers than labels. Empty array if none.`
        }
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

    // Parse Claude's response
    const responseText = message.content[0].type === 'text' ? message.content[0].text : ''
    console.log('[Analyze API] Claude response:', responseText.substring(0, 200))
    const analysis = parseAnalysisResponseText(responseText)
    console.log('[Analyze API] Parsed analysis:', JSON.stringify(analysis).substring(0, 300))
    console.log('[Analyze API] AI identified participants:', JSON.stringify(analysis.extractedContext?.participants, null, 2))

    // Prevent false "dictation" labels for external inbound inquiries.
    const finalRecordingType =
      hasExternalInquirySignal && analysis.recordingType === 'dictation'
        ? 'other'
        : analysis.recordingType
    const finalRecordingTypeConfidence =
      hasExternalInquirySignal && analysis.recordingType === 'dictation'
        ? Math.min(Number(analysis.recordingTypeConfidence || 0.5), 0.6)
        : analysis.recordingTypeConfidence

    const existingExtractedContext = ((session as any)?.ai_extracted_context || {}) as Record<string, any>
    const existingCorrections = ((session as any)?.transcript_corrections || {}) as Record<string, any>
    const existingNameCorrections = (existingCorrections.name_corrections || {}) as Record<string, string>

    const aiWordCorrections = Array.isArray(analysis.wordCorrections) ? analysis.wordCorrections : []
    const aiSpeakerMerges = Array.isArray(analysis.speakerMerges) ? analysis.speakerMerges : []

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
    const mergedTranscriptCorrections = {
      ...existingCorrections,
      ...(speakerResolution
        ? {
            name_corrections: {
              ...existingNameCorrections,
              ...speakerResolution.nameMap,
            },
          }
        : {}),
      ...(aiWordCorrections.length > 0 ? { word_corrections: aiWordCorrections } : {}),
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
            }
          })
      : []
    const { error: updateError } = await supabase
      .from('sessions')
      .update({
        recording_type: finalRecordingType,
        recording_type_confidence: finalRecordingTypeConfidence,
        suggested_domains: analysis.domains,
        ai_extracted_context: mergedExtractedContext,
        suggested_output_formats: suggestedFormats,
        transcript_corrections: mergedTranscriptCorrections,
        speechmatics_summary: canonicalSummary,
      })
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
    }

    // Check user's auto-generation preference (profile already fetched above)
    // Prefer after_transcript_template_id; fallback to after_transcript_action for backward compat
    let autoGeneratedOutput = null
    const templateId = (profile as any)?.after_transcript_template_id
    const legacyAction = profile?.after_transcript_action && profile.after_transcript_action !== 'nothing'
    const shouldAutoGenerate = templateId || legacyAction

    if (shouldAutoGenerate) {
      console.log('[Analyze API] Auto-generation enabled:', templateId ? `template ${templateId}` : legacyAction)
      
      // Trigger auto-generation asynchronously (don't wait)
      const autoGenHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(request.headers.get('Authorization') && { Authorization: request.headers.get('Authorization')! }),
        ...(request.headers.get('Cookie') && { Cookie: request.headers.get('Cookie')! }),
      }
      if (isInternalCall && process.env.INTERNAL_API_SECRET) {
        autoGenHeaders['x-internal-secret'] = process.env.INTERNAL_API_SECRET
        autoGenHeaders['x-internal-user-id'] = userId
      }
      const preferredOutputLanguage = resolveOutputLanguageCode(
        profile?.preferred_report_language,
        (session as any)?.language,
        detectedTranscriptLanguage
      )
      fetch(`${request.url.split('/analyze')[0]}/auto-generate`, {
        method: 'POST',
        headers: autoGenHeaders,
        body: JSON.stringify({
          templateId: templateId || undefined,
          action: legacyAction ? profile?.after_transcript_action : undefined,
          language: preferredOutputLanguage,
        })
      }).catch(err => console.error('[Analyze API] Auto-generation failed:', err))
      
      autoGeneratedOutput = {
        status: 'triggered',
        templateId: templateId || undefined,
        action: legacyAction ? profile.after_transcript_action : undefined,
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
        const baseUrl = new URL(request.url).origin
        const cmdHeaders: Record<string, string> = { 'Content-Type': 'application/json' }
        if (isInternalCall && process.env.INTERNAL_API_SECRET) {
          cmdHeaders['x-internal-secret'] = process.env.INTERNAL_API_SECRET
          cmdHeaders['x-internal-user-id'] = userId
        } else {
          // Forward auth for user-initiated analyze calls
          if (request.headers.get('Authorization')) cmdHeaders['Authorization'] = request.headers.get('Authorization')!
          if (request.headers.get('Cookie')) cmdHeaders['Cookie'] = request.headers.get('Cookie')!
        }

        const outputCreationIntent = /create|generat|summar|extract|report|analys|output|save|write/i

        for (const cmd of spokenCommands) {
          const isOutputCommand = outputCreationIntent.test(cmd.intentSummary || '') ||
            outputCreationIntent.test(cmd.phrase)

          if (!isOutputCommand) {
            console.log('[Analyze API] Skipping non-output command:', cmd.phrase)
            continue
          }

          console.log('[Analyze API] Executing spoken command:', cmd.phrase)
          fetch(`${baseUrl}/api/outputs/generate`, {
            method: 'POST',
            headers: cmdHeaders,
            body: JSON.stringify({
              sessionId: params.id,
              config: {
                templateId: commandTemplateId,
                perspective: 'observer',
                audience: 'internal',
                language: resolveOutputLanguageCode(
                  profile?.preferred_report_language,
                  (session as any)?.language,
                  detectedTranscriptLanguage
                ),
                tone: 'neutral',
                format: 'markdown',
                // Use the exact spoken phrase as the generation instruction
                doInstructions: cmd.phrase,
                dontInstructions: '',
                createTemplateFromConfig: false,
                citeTimestamps: false,
              },
            }),
          }).catch(err => console.error('[Analyze API] Spoken command execution failed:', cmd.phrase, err))
        }
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
