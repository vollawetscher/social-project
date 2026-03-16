import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { recordAiTokens } from '@/lib/services/usage-tracker'
import { requireSessionAccess } from '@/lib/auth/helpers'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

function resolveOutputLanguageCode(preferredReportLanguage: string | null | undefined, sessionLanguage: string | null | undefined): string {
  const pref = (preferredReportLanguage || '').toLowerCase()
  if (pref && pref !== 'session' && pref !== 'auto') return pref.slice(0, 2)
  const sessionLang = (sessionLanguage || '').toLowerCase()
  if (sessionLang && sessionLang !== 'auto') return sessionLang.slice(0, 2)
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
      return NextResponse.json({
        recordingType: session.user_recording_type || session.recording_type,
        recordingTypeConfidence: session.recording_type_confidence || 1.0,
        domains: session.user_domains || session.suggested_domains || [],
        extractedContext: session.ai_extracted_context || {},
        suggestedOutputFormats: (session as any).suggested_output_formats || [],
        locked: session.context_locked || false,
        cached: true
      })
    }

    // Resolve target language for suggested output format titles/descriptions
    const outputLangCode = resolveOutputLanguageCode(profile?.preferred_report_language, session.language)
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
    const mergedExtractedContext = {
      ...analysis.extractedContext,
      sourceSignals: existingExtractedContext.sourceSignals || sourceSignals || null,
    }

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
        (session as any)?.language
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
                language: resolveOutputLanguageCode(profile?.preferred_report_language, (session as any)?.language),
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
