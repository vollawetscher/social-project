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
    console.log('[Auto-Generate API] Starting for session:', params.id)
    
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { action, language = 'de' } = body

    // Map action to template type
    const actionToTemplateMap: Record<string, string> = {
      'short_summary': 'Meeting Minutes',
      'long_summary': 'Detailed Meeting Summary',
      'action_items': 'Action Items List',
      // Add more mappings as needed
    }

    const templateName = actionToTemplateMap[action]
    if (!templateName) {
      console.log('[Auto-Generate API] No template mapping for action:', action)
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    // Find matching template
    const { data: template } = await supabase
      .from('templates')
      .select('*')
      .eq('name', templateName)
      .eq('is_system', true)
      .single()

    if (!template) {
      console.log('[Auto-Generate API] Template not found:', templateName)
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
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
    if (!transcript) {
      return NextResponse.json({ error: 'No transcript available' }, { status: 400 })
    }

    // Build prompt
    const transcriptText = transcript.raw_text || transcript.redacted_text || ''
    const segments = transcript.raw_json as any[]
    const uniqueSpeakers = Array.from(new Set(segments.map((s: any) => s.speaker).filter(Boolean)))

    const prompt = `Generate a ${templateName} in ${language === 'de' ? 'German' : 'English'}.

Transcript:
${transcriptText}

Speakers: ${uniqueSpeakers.join(', ')}

Instructions:
${template.instructions || 'Create a comprehensive summary.'}

Format the output clearly and professionally.`

    console.log('[Auto-Generate API] Calling Claude to generate output...')
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }]
    })

    const content = message.content[0].type === 'text' ? message.content[0].text : ''

    // Save output
    const { data: output, error: insertError } = await supabase
      .from('outputs')
      .insert({
        session_id: params.id,
        template_id: template.id,
        user_id: user.id,
        title: `${templateName} (Auto-generated)`,
        content,
        generated_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (insertError) {
      console.error('[Auto-Generate API] Error saving output:', insertError)
      return NextResponse.json({ error: 'Failed to save output', details: insertError }, { status: 500 })
    }

    console.log('[Auto-Generate API] Output generated successfully:', output.id)
    return NextResponse.json({ 
      success: true, 
      outputId: output.id,
      title: output.title
    })
  } catch (error: any) {
    console.error('[Auto-Generate API] Error:', error)
    return NextResponse.json({ 
      error: 'Failed to auto-generate output',
      message: error?.message 
    }, { status: 500 })
  }
}
