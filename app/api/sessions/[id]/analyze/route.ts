import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

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
    
    const supabase = await createClient()
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      console.error('[Analyze API] Auth error:', authError)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.log('[Analyze API] User authenticated:', user.id)

    // Fetch session and transcript
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('*, transcripts(*)')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single()

    if (sessionError) {
      console.error('[Analyze API] Session error:', sessionError)
      return NextResponse.json({ error: 'Session not found', details: sessionError }, { status: 404 })
    }
    if (!session) {
      console.error('[Analyze API] Session not found')
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }
    console.log('[Analyze API] Session found, transcripts count:', session.transcripts?.length || 0)

    const transcript = session.transcripts?.[0]
    if (!transcript || !transcript.raw_json) {
      console.log('[Analyze API] No transcript or raw_json found')
      return NextResponse.json({ error: 'No transcript found' }, { status: 400 })
    }
    console.log('[Analyze API] Transcript found, segments count:', (transcript.raw_json as any[]).length)

    // Build conversation sample (first 5 minutes or 2000 characters)
    const segments = transcript.raw_json as any[]
    const sample = segments
      .slice(0, Math.min(segments.length, 20))
      .map((seg: any) => `${seg.speaker}: ${seg.text}`)
      .join('\n')
      .substring(0, 2000)
    
    console.log('[Analyze API] Sample length:', sample.length, 'characters')

    // Check if context is locked (user has overridden)
    if (session.context_locked) {
      console.log('[Analyze API] Context is locked by user, skipping AI analysis')
      return NextResponse.json({
        recordingType: session.user_recording_type || session.recording_type,
        recordingTypeConfidence: session.recording_type_confidence || 1.0,
        domains: session.user_domains || session.suggested_domains || [],
        extractedContext: session.ai_extracted_context || {},
        locked: true
      })
    }

    // Call Claude to analyze with enhanced context extraction
    console.log('[Analyze API] Calling Claude API for enhanced analysis...')
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: `Analyze this conversation transcript comprehensively and extract:

1. **Recording Type** (choose ONE): meeting, interview, presentation, consultation, lecture, dictation, other
2. **Domains** (choose up to 3): legal, sales, hr, medical, education, consulting, general
3. **Rich Context** to help understand and document this session

Transcript sample:
${sample}

Respond in this exact JSON format:
{
  "recordingType": "meeting",
  "recordingTypeConfidence": 0.90,
  "domains": [
    {"domain": "sales", "confidence": 0.85},
    {"domain": "consulting", "confidence": 0.70}
  ],
  "extractedContext": {
    "participants": [
      {"name": "Dr. Schmidt", "role": "consultant"},
      {"name": "Frau Meyer", "role": "client"}
    ],
    "purpose": "Initial consultation about tax planning",
    "topics": ["tax optimization", "retirement planning"],
    "agenda": ["Review current situation", "Discuss options", "Plan next steps"],
    "venue": "Office Berlin (or unknown if not mentioned)",
    "keyDates": ["2026-03-01"],
    "decisions": ["Schedule follow-up meeting"],
    "actionItems": [
      {"task": "Send tax forms", "owner": "Dr. Schmidt", "deadline": "2026-02-15"}
    ],
    "mood": "professional, collaborative",
    "outcome": "positive"
  }
}

**Instructions:**
- Extract participant names if mentioned (or use "Speaker 1", "Speaker 2" if unknown)
- Infer roles from conversation (client, consultant, doctor, patient, manager, employee, etc.)
- Identify the main purpose/goal of the conversation
- List key topics discussed
- Extract any mentioned locations, dates, decisions, or action items
- Assess overall mood and outcome
- If information isn't available, use empty arrays [] or "unknown"
- Be accurate and concise`
        }
      ]
    })
    console.log('[Analyze API] Claude responded successfully')

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

    // Update session with AI suggestions and extracted context
    console.log('[Analyze API] Updating session in database...')
    const { error: updateError } = await supabase
      .from('sessions')
      .update({
        recording_type: analysis.recordingType,
        recording_type_confidence: analysis.recordingTypeConfidence,
        suggested_domains: analysis.domains,
        ai_extracted_context: analysis.extractedContext || {},
      })
      .eq('id', params.id)

    if (updateError) {
      console.error('[Analyze API] Error updating session:', updateError)
      // Don't fail the request if update fails, just log it
    } else {
      console.log('[Analyze API] Session updated successfully')
    }

    // Check user's auto-generation preference
    console.log('[Analyze API] Checking user auto-generation preferences...')
    const { data: profile } = await supabase
      .from('profiles')
      .select('after_transcript_action, preferred_report_language')
      .eq('id', user.id)
      .single()

    let autoGeneratedOutput = null
    if (profile?.after_transcript_action && profile.after_transcript_action !== 'nothing') {
      console.log('[Analyze API] Auto-generation enabled:', profile.after_transcript_action)
      
      // Trigger auto-generation asynchronously (don't wait)
      fetch(`${request.url.split('/analyze')[0]}/auto-generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': request.headers.get('Authorization') || '',
          'Cookie': request.headers.get('Cookie') || ''
        },
        body: JSON.stringify({
          action: profile.after_transcript_action,
          language: profile.preferred_report_language || 'de'
        })
      }).catch(err => console.error('[Analyze API] Auto-generation failed:', err))
      
      autoGeneratedOutput = {
        status: 'triggered',
        action: profile.after_transcript_action
      }
    } else {
      console.log('[Analyze API] Auto-generation disabled')
    }

    return NextResponse.json({
      recordingType: analysis.recordingType,
      recordingTypeConfidence: analysis.recordingTypeConfidence,
      domains: analysis.domains,
      extractedContext: analysis.extractedContext || {},
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
