import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import type { GenerateOutputConfig } from '@/lib/types-v0'
import { recordAiTokens } from '@/lib/services/usage-tracker'

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
    const transcriptText = transcript.raw_text || transcript.redacted_text || ''
    console.log('[Generate Output] Transcript text length:', transcriptText.length)
    
    // Extract speakers from raw_json segments
    const segments = transcript.raw_json as any[]
    const uniqueSpeakers = Array.from(new Set(segments.map((s: any) => s.speaker).filter(Boolean)))
    
    let speakersText = ''
    if (uniqueSpeakers.length > 0) {
      speakersText = '\n\nSpeakers identified:\n' + uniqueSpeakers.map((speaker, idx) => 
        `- ${speaker}`
      ).join('\n')
    }
    console.log('[Generate Output] Speakers found:', uniqueSpeakers.length)

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

    const languageMap: Record<string, string> = {
      en: 'English',
      de: 'German',
      pl: 'Polish',
      fr: 'French',
      es: 'Spanish',
      it: 'Italian',
      pt: 'Portuguese',
      nl: 'Dutch',
    }
    const outputLanguage = languageMap[config.language || 'en'] || 'English'

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
- Language: Generate the output in ${outputLanguage}
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

    // Validate transcript exists
    if (!transcriptText || transcriptText.length < 10) {
      console.error('[Generate Output] Transcript is empty or too short')
      return NextResponse.json({ error: 'No transcript content available' }, { status: 400 })
    }

    const userPrompt = `Conversation transcript:

${transcriptText}${speakersText}

Please generate the requested output following all requirements and guidelines.`
    
    console.log('[Generate Output] Prompt length:', userPrompt.length)

    // Generate with Claude
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
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

    const usage = (message as { usage?: { input_tokens?: number; output_tokens?: number } }).usage

    if (!generatedContent) {
      return NextResponse.json({ error: 'Failed to generate output' }, { status: 500 })
    }

    // Save the output to database
    console.log('[Generate Output] Saving to database...')
    console.log('[Generate Output] Insert data:', {
      session_id: sessionId,
      template_id: config.templateId || null,
      template_name: template?.name || 'Custom Output',
      perspective: config.perspective || 'observer',
      audience: config.audience || 'internal',
      language: config.language || 'en',
      tone: config.tone,
      format: config.format,
      content_length: generatedContent.length,
      created_by: user.id,
    })
    
    const { data: output, error: insertError } = await supabase
      .from('outputs')
      .insert({
        session_id: sessionId,
        template_id: config.templateId || null,
        template_name: template?.name || config.templateName || 'Custom Output',
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
      console.error('[Generate Output] Database insert error:', insertError)
      console.error('[Generate Output] Error details:', JSON.stringify(insertError, null, 2))
      return NextResponse.json({ 
        error: 'Failed to save output',
        details: insertError,
        message: insertError?.message,
        code: insertError?.code
      }, { status: 500 })
    }
    
    console.log('[Generate Output] Output saved successfully:', output.id)

    // Record AI token usage for beta cost tracking
    if (usage?.input_tokens != null || usage?.output_tokens != null) {
      recordAiTokens(supabase, user.id, usage.input_tokens ?? 0, usage.output_tokens ?? 0, {
        sessionId,
        outputId: output.id,
        endpoint: 'outputs/generate',
      })
    }

    // Increment template used_count (non-blocking)
    if (config.templateId) {
      void (async () => {
        try {
          const { error: updateError } = await supabase.rpc('increment_template_used_count', {
            template_id: config.templateId
          })
          if (updateError) {
            console.error('[Generate Output] Failed to increment template count:', updateError)
            // Try direct update as fallback
            const { data: currentTemplate } = await supabase
              .from('templates')
              .select('used_count')
              .eq('id', config.templateId)
              .single()
            
            if (currentTemplate) {
              await supabase
                .from('templates')
                .update({ used_count: (currentTemplate.used_count || 0) + 1 })
                .eq('id', config.templateId)
            }
          }
          console.log('[Generate Output] Template used_count incremented')
        } catch (err) {
          console.error('[Generate Output] Error incrementing template count:', err)
        }
      })()
    }

    // Create template from config when requested (e.g. from AI suggestion or modal checkbox)
    let createdTemplateId: string | null = null
    if (config.createTemplateFromConfig) {
      const templateName = config.templateName || output.template_name || 'Custom Output'
      const description = config.doInstructions
        ? config.doInstructions.slice(0, 200) + (config.doInstructions.length > 200 ? '...' : '')
        : `Custom output format: ${templateName}`
      const styleRules: string[] = []
      if (config.tone) styleRules.push(`Tone: ${config.tone}`)
      if (config.format) styleRules.push(`Format: ${config.format}`)
      const instructions = config.doInstructions
        ? `Generate a ${templateName}. ${config.doInstructions}`
        : `Generate a ${templateName} following the defined style.`
      const { data: newTemplate, error: templateError } = await supabase
        .from('templates')
        .insert({
          name: templateName,
          description,
          intended_perspectives: [config.perspective || 'observer'],
          allowed_audience: [config.audience || 'internal'],
          domain_tags: ['general'],
          sections: [],
          required_inputs: [],
          style_rules: styleRules.length > 0 ? styleRules : [`Generate ${templateName} with professional tone and clear structure.`],
          instructions,
          created_by: user.id,
          is_system: false,
        })
        .select('id')
        .single()
      if (templateError) {
        console.error('[Generate Output] Failed to create template from config:', templateError)
      } else if (newTemplate) {
        createdTemplateId = newTemplate.id
        console.log('[Generate Output] Template created from config:', newTemplate.id)
      }
    }

    // Return the generated output
    return NextResponse.json({
      id: output.id,
      sessionId: output.session_id,
      sessionFilename: session.internal_case_id || 'Unknown',
      templateId: output.template_id || '',
      templateName: output.template_name,
      createdTemplateId: createdTemplateId || undefined,
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
