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
    const supabase = await createClient()
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch session and transcript
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('*, transcripts(*)')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single()

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    const transcript = session.transcripts?.[0]
    if (!transcript || !transcript.segments) {
      return NextResponse.json({ error: 'No transcript found' }, { status: 400 })
    }

    // Build conversation sample (first 5 minutes or 2000 characters)
    const segments = transcript.segments as any[]
    const sample = segments
      .slice(0, Math.min(segments.length, 20))
      .map((seg: any) => `${seg.speaker}: ${seg.text}`)
      .join('\n')
      .substring(0, 2000)

    // Call Claude to analyze
    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
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

    // Parse Claude's response
    const responseText = message.content[0].type === 'text' ? message.content[0].text : ''
    const analysis = JSON.parse(responseText)

    // Update session with suggestions
    const { error: updateError } = await supabase
      .from('sessions')
      .update({
        recording_type: analysis.recordingType,
        recording_type_confidence: analysis.recordingTypeConfidence,
        suggested_domains: analysis.domains,
      })
      .eq('id', params.id)

    if (updateError) {
      console.error('Error updating session:', updateError)
    }

    return NextResponse.json({
      recordingType: analysis.recordingType,
      recordingTypeConfidence: analysis.recordingTypeConfidence,
      domains: analysis.domains,
    })
  } catch (error) {
    console.error('Error analyzing session:', error)
    return NextResponse.json({ error: 'Failed to analyze session' }, { status: 500 })
  }
}
