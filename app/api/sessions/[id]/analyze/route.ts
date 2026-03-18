import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { recordAiTokens } from '@/lib/services/usage-tracker'
import { requireSessionAccess } from '@/lib/auth/helpers'

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

const asSegmentArray = (value: unknown): { start_ms?: number; end_ms?: number; [k: string]: any }[] =>
  Array.isArray(value) ? (value as { start_ms?: number; end_ms?: number; [k: string]: any }[]) : []

type PstnSpeakerNormalization = {
  participants: Array<{ name: string; role: string | null; isUser: boolean }>
  nameCorrections: Record<string, string>
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
    .replace(/[^a-z0-9\s'-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

function selfIntroMatchesName(text: string, name: string): boolean {
  const fn = firstName(name)
  if (!fn) return false
  const t = normalizeForMatch(text)
  return (
    new RegExp(`\\b(this is|it is|it's|i am|my name is)\\s+${fn}\\b`).test(t) ||
    new RegExp(`\\b${fn}\\b`).test(t.slice(0, 40)) // e.g. "Patrick. It's Christian..."
  )
}

function buildPstnSpeakerNormalization(params: {
  segments: Array<{ speaker?: string; text?: string; start_ms?: number; end_ms?: number }>
  callType?: string | null
  callUserId?: string | null
  sessionUserId?: string | null
  callerName?: string | null
  calleeName?: string | null
}): PstnSpeakerNormalization | null {
  const isPstn = (params.callType || '').includes('pstn')
  if (!isPstn) return null

  type SpeakerAgg = {
    speaker: string
    turns: number
    totalMs: number
    firstStart: number
    texts: string[]
  }
  const bySpeaker = new Map<string, SpeakerAgg>()

  for (const seg of params.segments) {
    const speaker = String(seg.speaker || '').trim()
    if (!speaker) continue
    const start = Number(seg.start_ms || 0)
    const end = Number(seg.end_ms || start)
    const dur = Math.max(0, end - start)
    const text = String(seg.text || '')

    const cur = bySpeaker.get(speaker) || {
      speaker,
      turns: 0,
      totalMs: 0,
      firstStart: Number.MAX_SAFE_INTEGER,
      texts: [],
    }
    cur.turns += 1
    cur.totalMs += dur
    cur.firstStart = Math.min(cur.firstStart, start)
    if (text.trim()) cur.texts.push(text.trim())
    bySpeaker.set(speaker, cur)
  }

  const ranked = Array.from(bySpeaker.values())
    .sort((a, b) => (b.totalMs - a.totalMs) || (b.turns - a.turns))
    .slice(0, 2)
  if (ranked.length < 2) return null

  const majorA = ranked[0]
  const majorB = ranked[1]
  const majorByStart = [majorA, majorB].sort((a, b) => a.firstStart - b.firstStart)

  const caller = normalizeHumanName(params.callerName)
  const callee = normalizeHumanName(params.calleeName)
  let callerSpeaker: string | null = null
  let calleeSpeaker: string | null = null

  for (const sp of [majorA, majorB]) {
    const introWindow = sp.texts.slice(0, 4).join(' ')
    if (!callerSpeaker && caller && selfIntroMatchesName(introWindow, caller)) {
      callerSpeaker = sp.speaker
    }
    if (!calleeSpeaker && callee && selfIntroMatchesName(introWindow, callee)) {
      calleeSpeaker = sp.speaker
    }
  }

  if (!callerSpeaker && !calleeSpeaker) {
    // Outbound PSTN commonly starts with callee greeting.
    calleeSpeaker = majorByStart[0].speaker
    callerSpeaker = majorByStart[1].speaker
  } else if (!callerSpeaker && calleeSpeaker) {
    callerSpeaker = [majorA.speaker, majorB.speaker].find((s) => s !== calleeSpeaker) || null
  } else if (!calleeSpeaker && callerSpeaker) {
    calleeSpeaker = [majorA.speaker, majorB.speaker].find((s) => s !== callerSpeaker) || null
  }

  if (!callerSpeaker || !calleeSpeaker) return null

  const isCallerSession = !!params.callUserId && !!params.sessionUserId && params.callUserId === params.sessionUserId
  const userIsCaller = isCallerSession

  const callerLabel = caller || 'Caller'
  const calleeLabel = callee || 'Callee'

  const nameCorrections: Record<string, string> = {
    [callerSpeaker]: callerLabel,
    [calleeSpeaker]: calleeLabel,
  }

  return {
    participants: [
      { name: callerLabel, role: null, isUser: userIsCaller },
      { name: calleeLabel, role: null, isUser: !userIsCaller },
    ],
    nameCorrections,
    reason: caller && callee ? 'pstn_metadata+self_intro' : 'pstn_metadata+turn_order',
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
      .select('id, user_id, call_type, contact_name, session_id, callee_session_id')
      .or(`session_id.eq.${params.id},callee_session_id.eq.${params.id}`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
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
    const linkedCallerName =
      linkedCall?.user_id === userId
        ? userName
        : (callOwnerName?.display_name || callOwnerName?.full_name || callOwnerName?.company_name || null)
    const linkedCalleeName =
      linkedCall?.user_id === userId
        ? (linkedCall?.contact_name || null)
        : userName
    const pstnNormalization = buildPstnSpeakerNormalization({
      segments: segments as Array<{ speaker?: string; text?: string; start_ms?: number; end_ms?: number }>,
      callType: linkedCall?.call_type,
      callUserId: linkedCall?.user_id,
      sessionUserId: userId,
      callerName: linkedCallerName,
      calleeName: linkedCalleeName,
    })
    const formatSegment = (seg: any) => `${seg.speaker || 'S1'}: ${seg.text}`
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
    const sample = sampled.join('\n\n---\n\n').substring(0, 3500)
    console.log('[Analyze API] Sampled', positions.length, 'sections,', sample.length, 'chars')

    // Check if already analyzed (skip re-analysis unless user wants to correct)
    const alreadyAnalyzed = session.recording_type && session.suggested_domains && session.ai_extracted_context
    
    if (session.context_locked || alreadyAnalyzed) {
      console.log('[Analyze API] Using cached analysis (locked or already analyzed)')
      const existingCorrections = ((session as any)?.transcript_corrections || {}) as Record<string, any>
      const existingNameCorrections = (existingCorrections.name_corrections || {}) as Record<string, string>
      const normalizedContext = ((session as any)?.ai_extracted_context || {}) as Record<string, any>
      let patchedContext = normalizedContext
      let patchedCorrections = existingCorrections
      let shouldPatch = false

      if (pstnNormalization) {
        const mergedNames = { ...existingNameCorrections, ...pstnNormalization.nameCorrections }
        const hasNewMapping = Object.keys(pstnNormalization.nameCorrections).some(
          (k) => existingNameCorrections[k] !== pstnNormalization.nameCorrections[k]
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
            participants: pstnNormalization.participants,
            speakerIdentification: {
              ...(normalizedContext.speakerIdentification || {}),
              strategy: pstnNormalization.reason,
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
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 3072,
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
5. **User Identification**: The recording was made by "${userName || 'unknown user'}". Try to identify which participant is this user.
6. **Transcription Consent**: At the START of the conversation, was consent to record/transcribe mentioned? The initiator (caller/recorder) implicitly consents. Look for: "This call may be recorded", "Do you consent?", "Okay to record?", affirmative replies. Extract: discussed (boolean), participantsConsented (array of speaker IDs who consented, e.g. ["S1","S2"]), summary (one-line description of how consent was obtained, or null if not discussed).
7. **Spoken Commands**: Detect voice commands directed at "Notissima" (the assistant). Use FUZZY matching—transcription/ASR often misspells proper nouns. Match variations such as: Notissima, Notisima, Notissma, Natissima, Notessima; with or without punctuation (Notissima:, Notissima,); after "Hey", "Ok", "So" etc. If a phrase looks like a command to an assistant (create X, send link, summarize) and the wake word is phonetically similar to Notissima, treat it as a match. Extract the exact phrase as spoken in transcript, speaker, and brief intent summary.
8. **Suggested Output Formats**: Based on the conversation type and domain, suggest exactly 3 different output formats that would be useful. Examples:
   - Sales call: meeting minutes, internal sales call analysis (what worked, what was missed, buying signals), short team update
   - Legal: deposition summary, client status memo, billing timeline notes
   - Medical: consultation notes, referral summary, patient-facing summary
   - General: meeting minutes, action items, executive summary
   Customize suggestions for the ACTUAL domain and conversation type. Each needs: title (short), description (1 line), generationInstructions (detailed prompt for AI to generate this output).
   **LANGUAGE for suggestedOutputFormats**: Write the title and description fields in **${outputLangName}**. The generationInstructions should also be in ${outputLangName}.

Transcript sample:
${sample}

Respond in this exact JSON format:
{
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
  "suggestedOutputFormats": [
    {"title": "...", "description": "...", "generationInstructions": "..."},
    {"title": "...", "description": "...", "generationInstructions": "..."},
    {"title": "...", "description": "...", "generationInstructions": "..."}
  ]
}

**CRITICAL Instructions for Participant Identification:**
- The recording was made BY: "${userName}"
- Look for speaker patterns to identify which SPEAKER is "${userName}":
  * If Speaker A says "Hey ${userName}" or addresses "${userName}", then the person who RESPONDS is likely "${userName}"
  * Don't assume the speaker who MENTIONS a name IS that person - they might be addressing them
  * Compare speaker IDs (S1, S2, etc.) with mentioned names in context
  * Example: If S1 says "Hey Christian" and S2 responds, then S2 is Christian
- Set "isUser": true ONLY if you have strong evidence that speaker matches "${userName}"
- **IMPORTANT**: If you cannot find "${userName}" mentioned or inferred in the conversation, DO NOT mark anyone as isUser: true
- Better to mark NO ONE as the user than to guess wrong
- Only use fallback logic (mark service receiver as user) if the context clearly suggests "${userName}" is present but unidentified
- Extract exact participant names from transcript (spell them correctly!)
- Infer specific roles from conversation content
- Be specific with domains - use actual field names (e.g., "Tax Law" not just "Legal")
- Use 2-layer domain structure: primary (broad) + specialty (specific)
- If User-Indicated Content Hint is "external_inquiry_email" OR sourceSignals.isExternalInquiry is true, do NOT classify as "dictation". Treat it as an external inquiry/correspondence-style import and choose a non-dictation type.
- If information isn't clearly available, use empty arrays [] or "unknown"
- Be accurate and preserve correct spelling from transcript
- For consent: focus on the first 1-2 minutes of the conversation. If nothing found, use discussed: false, participantsConsented: [], summary: null
- For spokenCommands: use fuzzy matching. Accept Notissima + common ASR misspellings (Notisima, Notissma, Natissima, etc.). Accept phonetically similar wake words. Include if it reasonably looks like a command to the assistant. Preserve the exact phrase from transcript. Empty array if none found`
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
    
    // Extract JSON from markdown code blocks if present
    let jsonText = responseText.trim()
    
    // Remove markdown code blocks (```json ... ``` or ``` ... ```)
    if (jsonText.startsWith('```')) {
      const jsonMatch = jsonText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
      if (jsonMatch) {
        jsonText = jsonMatch[1].trim()
      }
    }
    
    console.log('[Analyze API] Extracted JSON:', jsonText.substring(0, 200))
    const analysis = JSON.parse(jsonText)
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
    const mergedExtractedContext = {
      ...analysis.extractedContext,
      sourceSignals: existingExtractedContext.sourceSignals || sourceSignals || null,
      ...(pstnNormalization
        ? {
            participants: pstnNormalization.participants,
            speakerIdentification: {
              ...(analysis.extractedContext?.speakerIdentification || {}),
              strategy: pstnNormalization.reason,
              updatedAt: new Date().toISOString(),
            },
          }
        : {}),
    }
    const mergedTranscriptCorrections = pstnNormalization
      ? {
          ...existingCorrections,
          name_corrections: {
            ...existingNameCorrections,
            ...pstnNormalization.nameCorrections,
          },
        }
      : existingCorrections

    // Update session with AI suggestions and extracted context
    console.log('[Analyze API] Updating session in database...')
    const suggestedFormats = Array.isArray(analysis.suggestedOutputFormats)
      ? analysis.suggestedOutputFormats.slice(0, 3)
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
      })
      .eq('id', params.id)

    if (updateError) {
      console.error('[Analyze API] Error updating session:', updateError)
      // Don't fail the request if update fails, just log it
    } else {
      console.log('[Analyze API] Session updated successfully')
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
    return NextResponse.json({ 
      error: 'Failed to analyze session', 
      message: error?.message,
      type: error?.constructor?.name
    }, { status: 500 })
  }
}
