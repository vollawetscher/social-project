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

    // Call Claude to analyze
    console.log('[Analyze API] Calling Claude API...')
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `Analyze this conversation transcript and identify:
1. Recording Type (choose ONE): meeting, interview, presentation, consultation, lecture, other
2. Domains (choose up to 3 that apply): legal, sales, hr, medical, education, consulting, general

Transcript sample:
${sample}

Respond in this exact JSON format:
{
  "recordingType": "meeting",
  "recordingTypeConfidence": 0.90,
  "domains": [
    {"domain": "sales", "confidence": 0.85},
    {"domain": "consulting", "confidence": 0.70}
  ]
}

Be concise and accurate. Base your analysis on the conversation style, topics, and participant roles.`
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
    console.log('[Analyze API] Parsed analysis:', analysis)

    // Update session with suggestions
    console.log('[Analyze API] Updating session in database...')
    const { error: updateError } = await supabase
      .from('sessions')
      .update({
        recording_type: analysis.recordingType,
        recording_type_confidence: analysis.recordingTypeConfidence,
        suggested_domains: analysis.domains,
      })
      .eq('id', params.id)

    if (updateError) {
      console.error('[Analyze API] Error updating session:', updateError)
      // Don't fail the request if update fails, just log it
    } else {
      console.log('[Analyze API] Session updated successfully')
    }

    return NextResponse.json({
      recordingType: analysis.recordingType,
      recordingTypeConfidence: analysis.recordingTypeConfidence,
      domains: analysis.domains,
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
