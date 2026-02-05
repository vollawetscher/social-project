import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import type { GenerateOutputConfig } from '@/lib/types-v0'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { 
      sessionId, 
      config 
    }: { 
      sessionId: string
      config: GenerateOutputConfig 
    } = body

    if (!sessionId || !config) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Fetch session and transcript
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .single()

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // Fetch transcript
    const { data: transcript, error: transcriptError } = await supabase
      .from('transcripts')
      .select('*')
      .eq('session_id', sessionId)
      .single()

    if (transcriptError || !transcript) {
      return NextResponse.json({ error: 'Transcript not found' }, { status: 404 })
    }

    // Fetch template if specified
    let template = null
    if (config.templateId) {
      const { data: templateData } = await supabase
        .from('templates')
        .select('*')
        .eq('id', config.templateId)
        .or(`is_system.eq.true,created_by.eq.${user.id}`)
        .single()
      
      template = templateData
    }

    // Build the generation prompt
    const transcriptText = transcript.text || ''
    const speakers = transcript.raw_json?.results?.speakers || []
    
    let speakersText = ''
    if (speakers.length > 0) {
      speakersText = '\n\nSpeakers identified:\n' + speakers.map((s: any) => 
        `- ${s.name} (Speaker ${s.id})`
      ).join('\n')
    }

    const perspectiveMap: Record<string, string> = {
      party_a: 'first speaker (party A)',
      party_b: 'second speaker (party B)',
      observer: 'neutral observer'
    }

    const audienceMap: Record<string, string> = {
      internal: 'internal team members',
      client: 'external clients',
      legal: 'legal professionals',
      executive: 'executive leadership'
    }

    const toneMap: Record<string, string> = {
      formal: 'formal and professional',
      casual: 'casual and conversational',
      technical: 'technical and detailed'
    }

    const formatMap: Record<string, string> = {
      email: 'an email',
      report: 'a formal report',
      meeting_notes: 'meeting notes',
      action_items: 'a list of action items'
    }

    let systemPrompt = `You are a professional report writer specializing in creating high-quality, accurate summaries and reports from conversation transcripts.

Your task is to generate ${formatMap[config.format] || 'a report'} from the following conversation.

Key requirements:
- Perspective: Write from the viewpoint of ${perspectiveMap[config.perspective || 'observer'] || 'a neutral observer'}
- Audience: The output is intended for ${audienceMap[config.audience || 'internal'] || 'internal use'}
- Tone: Use a ${toneMap[config.tone] || 'professional'} tone
- Language: Generate the output in ${config.language === 'de' ? 'German' : 'English'}
${config.citeTimestamps ? '- Include timestamps where relevant to cite specific moments' : ''}`

    if (template) {
      systemPrompt += `\n\nTemplate: ${template.name}
${template.description}

Required sections:
${template.sections?.map((s: any) => `- ${s.name}: ${s.description}${s.isRequired ? ' (Required)' : ''}`).join('\n')}

Style guidelines:
${template.style_rules?.map((r: string) => `- ${r}`).join('\n') || 'Follow professional writing standards'}`
    }

    if (config.doInstructions) {
      systemPrompt += `\n\nSpecial instructions (DO):
${config.doInstructions}`
    }

    if (config.dontInstructions) {
      systemPrompt += `\n\nAvoid (DON'T):
${config.dontInstructions}`
    }

    const userPrompt = `Conversation transcript:

${transcriptText}${speakersText}

Please generate the requested output following all requirements and guidelines.`

    // Generate with Claude
    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        }
      ],
      system: systemPrompt,
    })

    const generatedContent = message.content[0].type === 'text' 
      ? message.content[0].text 
      : ''

    if (!generatedContent) {
      return NextResponse.json({ error: 'Failed to generate output' }, { status: 500 })
    }

    // Save the output to database
    const { data: output, error: insertError } = await supabase
      .from('outputs')
      .insert({
        session_id: sessionId,
        template_id: config.templateId || null,
        template_name: template?.name || 'Custom Output',
        perspective: config.perspective || 'observer',
        audience: config.audience || 'internal',
        language: config.language || 'en',
        tone: config.tone,
        format: config.format,
        content: generatedContent,
        transcript_version_hash: transcript.id, // Using transcript ID as version
        cite_timestamps: config.citeTimestamps || false,
        created_by: user.id,
      })
      .select()
      .single()

    if (insertError || !output) {
      console.error('Error saving output:', insertError)
      return NextResponse.json({ error: 'Failed to save output' }, { status: 500 })
    }

    // Return the generated output
    return NextResponse.json({
      id: output.id,
      sessionId: output.session_id,
      sessionFilename: session.internal_case_id || 'Unknown',
      templateId: output.template_id || '',
      templateName: output.template_name,
      perspective: output.perspective,
      audience: output.audience,
      language: output.language,
      tone: output.tone,
      format: output.format,
      content: output.content,
      createdAt: output.created_at,
      transcriptVersionHash: output.transcript_version_hash || '',
      citeTimestamps: output.cite_timestamps || false,
    })

  } catch (error) {
    console.error('Error generating output:', error)
    return NextResponse.json(
      { error: 'Failed to generate output: ' + (error as Error).message }, 
      { status: 500 }
    )
  }
}
