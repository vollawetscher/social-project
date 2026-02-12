import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { recordAiTokens } from '@/lib/services/usage-tracker'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

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
      supabase = await createClient()
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        console.error('[Analyze API] Auth error:', authError)
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      userId = user.id
      console.log('[Analyze API] User authenticated:', userId)
    }

    // Fetch user profile for name comparison
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, company_name, display_name, after_transcript_action, after_transcript_template_id, preferred_report_language')
      .eq('id', userId)
      .single()

    const userName = profile?.display_name || profile?.full_name || profile?.company_name || ''
    console.log('[Analyze API] Profile data:', { 
      display_name: profile?.display_name, 
      full_name: profile?.full_name, 
      company_name: profile?.company_name 
    })
    console.log('[Analyze API] User name for AI identification:', userName)

    // Fetch session and transcript (internal calls use service role, no user filter needed)
    const sessionQuery = supabase
      .from('sessions')
      .select('*, transcripts(*)')
      .eq('id', params.id)
    const { data: session, error: sessionError } = isInternalCall
      ? await sessionQuery.single()
      : await sessionQuery.eq('user_id', userId).single()

    if (sessionError) {
      console.error('[Analyze API] Session error:', sessionError)
      return NextResponse.json({ error: 'Session not found', details: sessionError }, { status: 404 })
    }
    if (!session) {
      console.error('[Analyze API] Session not found')
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }
    console.log('[Analyze API] Session found, transcripts count:', session.transcripts?.length || 0)

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
      const segs = (t.raw_json || []) as { start_ms?: number; end_ms?: number; [k: string]: any }[]
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

    // Build conversation sample (first 5 minutes or 2000 characters)
    const segments = allSegments
    const sample = segments
      .slice(0, Math.min(segments.length, 20))
      .map((seg: any) => `${seg.speaker}: ${seg.text}`)
      .join('\n')
      .substring(0, 2000)
    
    console.log('[Analyze API] Sample length:', sample.length, 'characters')

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
4. **User Identification**: The recording was made by "${userName || 'unknown user'}". Try to identify which participant is this user.
5. **Suggested Output Formats**: Based on the conversation type and domain, suggest exactly 3 different output formats that would be useful. Examples:
   - Sales call: meeting minutes, internal sales call analysis (what worked, what was missed, buying signals), short team update
   - Legal: deposition summary, client status memo, billing timeline notes
   - Medical: consultation notes, referral summary, patient-facing summary
   - General: meeting minutes, action items, executive summary
   Customize suggestions for the ACTUAL domain and conversation type. Each needs: title (short), description (1 line), generationInstructions (detailed prompt for AI to generate this output).

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
    "outcome": "positive"
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
- If information isn't clearly available, use empty arrays [] or "unknown"
- Be accurate and preserve correct spelling from transcript`
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

    // Update session with AI suggestions and extracted context
    console.log('[Analyze API] Updating session in database...')
    const suggestedFormats = Array.isArray(analysis.suggestedOutputFormats)
      ? analysis.suggestedOutputFormats.slice(0, 3)
      : []
    const { error: updateError } = await supabase
      .from('sessions')
      .update({
        recording_type: analysis.recordingType,
        recording_type_confidence: analysis.recordingTypeConfidence,
        suggested_domains: analysis.domains,
        ai_extracted_context: analysis.extractedContext || {},
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
      fetch(`${request.url.split('/analyze')[0]}/auto-generate`, {
        method: 'POST',
        headers: autoGenHeaders,
        body: JSON.stringify({
          templateId: templateId || undefined,
          action: legacyAction ? profile?.after_transcript_action : undefined,
          language: profile?.preferred_report_language || 'de'
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

    return NextResponse.json({
      recordingType: analysis.recordingType,
      recordingTypeConfidence: analysis.recordingTypeConfidence,
      domains: analysis.domains,
      extractedContext: analysis.extractedContext || {},
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
