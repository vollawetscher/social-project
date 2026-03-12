import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import type { GenerateOutputConfig } from '@/lib/types-v0'
import { recordAiTokens } from '@/lib/services/usage-tracker'
import { applyTranscriptCorrections } from '@/lib/utils/transcript-corrections'
import { mergeTranscripts } from '@/lib/utils/merge-transcripts'
import { logError } from '@/lib/services/error-logger'
import { sanitizeOutputText } from '@/lib/utils/output-text-sanitizer'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export async function POST(request: Request) {
  try {
    const internalSecret = request.headers.get('x-internal-secret')
    const internalUserId = request.headers.get('x-internal-user-id')
    const isInternalCall = !!process.env.INTERNAL_API_SECRET &&
      internalSecret === process.env.INTERNAL_API_SECRET &&
      internalUserId

    let supabase: Awaited<ReturnType<typeof createClient>>
    let userId: string

    if (isInternalCall) {
      supabase = createServiceRoleClient()
      userId = internalUserId!
    } else {
      supabase = await createClient()
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      userId = user.id
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

    // Fetch session (internal: verify user_id matches; normal: enforced by query)
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', sessionId)
      .single()

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }
    if (session.user_id !== userId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single()
      if (profile?.role !== 'admin') {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 })
      }
    }

    // Fetch call/file timing context + user timezone so reports can include concrete date/time.
    const [{ data: callRows }, { data: fileRows }, { data: profileData }] = await Promise.all([
      supabase
        .from('calls')
        .select('id, contact_name, call_type, call_mode, scheduled_for, started_at, ended_at, created_at')
        .or(`session_id.eq.${sessionId},callee_session_id.eq.${sessionId}`)
        .order('created_at', { ascending: false })
        .limit(1),
      supabase
        .from('files')
        .select('created_at, original_filename, file_purpose, mime_type')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true })
        .limit(1),
      supabase
        .from('profiles')
        .select('timezone')
        .eq('id', userId)
        .single(),
    ])

    const callContext = callRows?.[0]
    const fileContext = fileRows?.[0]
    const userTimezone = profileData?.timezone || 'Europe/Berlin'

    const eventStartIso =
      callContext?.started_at ||
      callContext?.scheduled_for ||
      fileContext?.created_at ||
      (session as any).created_at ||
      null
    const eventEndIso = callContext?.ended_at || null

    // Fetch transcripts (multiple rows if session has multiple audio files)
    const { data: transcriptRows, error: transcriptError } = await supabase
      .from('transcripts')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })

    if (transcriptError || !transcriptRows?.length) {
      return NextResponse.json({ error: 'Transcript not found' }, { status: 404 })
    }

    const transcript = mergeTranscripts(transcriptRows)
    if (!transcript) {
      return NextResponse.json({ error: 'Transcript not found' }, { status: 404 })
    }

    // Fetch template if specified
    let template = null
    if (config.templateId) {
      const { data: templateData } = await supabase
        .from('templates')
        .select('*')
        .eq('id', config.templateId)
        .or(`is_system.eq.true,created_by.eq.${userId}`)
        .single()
      
      template = templateData
    }

    // Build the generation prompt - apply corrections so output reflects fixed transcript
    let transcriptText = transcript.raw_text || transcript.redacted_text || ''
    const corrections = (session as any).transcript_corrections || {}
    const allCorrections: Record<string, string> = {
      ...(corrections.name_corrections || {}),
      ...(corrections.pii_redactions || {}),
      ...(corrections.word_corrections || {}),
    }
    if (Object.keys(allCorrections).length > 0) {
      transcriptText = applyTranscriptCorrections(transcriptText, allCorrections)
    }
    console.log('[Generate Output] Transcript text length:', transcriptText.length)
    
    // Extract speakers from raw_json segments (apply name corrections)
    const segments = transcript.raw_json as any[]
    const nameCorrections = corrections.name_corrections || {}
    const uniqueSpeakers = Array.from(
      new Set(segments.map((s: any) => nameCorrections[s.speaker] || s.speaker).filter(Boolean))
    )
    
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

    // Build perspective instruction using speaker name when available
    const speakerName = config.perspectiveSpeakerName
    let perspectiveInstruction: string
    if (config.perspective === 'observer' || !config.perspective) {
      perspectiveInstruction = 'a neutral observer (third person)'
    } else if (speakerName) {
      perspectiveInstruction = `${speakerName} (first person — use "I" when referring to ${speakerName}, and refer to other participants by name)`
    } else {
      perspectiveInstruction = perspectiveMap[config.perspective] || 'a neutral observer'
    }

    const audienceMap: Record<string, string> = {
      internal: 'internal team members',
      external: 'external third parties',
      client: 'external clients (client-facing — professional, clear, no internal jargon)',
      legal: 'legal professionals (precise language, factual, avoid speculation)',
      executive: 'executive leadership (high-level, concise, focus on outcomes and decisions)',
    }

    const toneMap: Record<string, string> = {
      direct: 'direct and to the point',
      neutral: 'neutral and balanced',
      formal: 'formal and professional',
      casual: 'casual and conversational',
      funny: 'light-hearted and witty (while remaining accurate)',
      technical: 'technical and detailed',
    }

    const normalizeLanguageCode = (value?: string | null): string | null => {
      const raw = String(value || '').trim().toLowerCase()
      if (!raw || raw === 'auto' || raw === 'session') return null

      const aliases: Record<string, string> = {
        en: 'en',
        english: 'en',
        de: 'de',
        german: 'de',
        deutsch: 'de',
        es: 'es',
        spanish: 'es',
        espanol: 'es',
        'español': 'es',
        fr: 'fr',
        french: 'fr',
        it: 'it',
        italian: 'it',
        pt: 'pt',
        portuguese: 'pt',
        nl: 'nl',
        dutch: 'nl',
        pl: 'pl',
        polish: 'pl',
        th: 'th',
        thai: 'th',
        ja: 'ja',
        japanese: 'ja',
        ko: 'ko',
        korean: 'ko',
        zh: 'zh',
        chinese: 'zh',
        ar: 'ar',
        arabic: 'ar',
        ru: 'ru',
        russian: 'ru',
        tr: 'tr',
        turkish: 'tr',
        vi: 'vi',
        vietnamese: 'vi',
        hi: 'hi',
        hindi: 'hi',
      }

      if (aliases[raw]) return aliases[raw]

      // Handle locale variants like de-DE, en_US, pt-BR.
      const localePrefix = raw.split(/[-_]/)[0]
      if (aliases[localePrefix]) return aliases[localePrefix]

      return null
    }

    const resolveOutputLanguageCode = (
      requested: string | undefined,
      sessionLang: string | undefined,
      preferredReportLanguage: string | undefined
    ): string => {
      const requestedRaw = String(requested || '').trim().toLowerCase()
      if (requestedRaw && requestedRaw !== 'session' && requestedRaw !== 'auto') {
        return normalizeLanguageCode(requested) || 'de'
      }
      return (
        normalizeLanguageCode(preferredReportLanguage) ||
        normalizeLanguageCode(sessionLang) ||
        'de'
      )
    }

    const resolvedLanguageCode = resolveOutputLanguageCode(
      config.language,
      (session as any).language,
      (session as any).preferred_report_language
    )

    const dateLocaleCodeMap: Record<string, string> = {
      de: 'de-DE', en: 'en-US', es: 'es-ES', fr: 'fr-FR', it: 'it-IT',
      pt: 'pt-PT', nl: 'nl-NL', pl: 'pl-PL', ja: 'ja-JP', ko: 'ko-KR',
      zh: 'zh-CN', ar: 'ar-SA', ru: 'ru-RU', tr: 'tr-TR', vi: 'vi-VN',
      th: 'th-TH',
    }
    const formatEventDateTime = (iso: string | null): string | null => {
      if (!iso) return null
      try {
        const localeCode = dateLocaleCodeMap[resolvedLanguageCode] || 'en-US'
        return new Date(iso).toLocaleString(localeCode, {
          timeZone: userTimezone,
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      } catch {
        return iso
      }
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
      th: 'Thai',
      ja: 'Japanese',
      ko: 'Korean',
      zh: 'Chinese',
      ar: 'Arabic',
      ru: 'Russian',
      tr: 'Turkish',
      vi: 'Vietnamese',
      hi: 'Hindi',
    }
    const outputLanguage = languageMap[resolvedLanguageCode] || 'English'

    const formatMap: Record<string, string> = {
      email: 'an email',
      report: 'a formal report',
      meeting_notes: 'meeting notes',
      action_items: 'a list of action items'
    }

    let systemPrompt = `You are a professional report writer specializing in creating high-quality, accurate summaries and reports from conversation transcripts.

Your task is to generate ${formatMap[config.format] || 'a report'} from the following conversation.

Key requirements:
- Perspective: Write from the viewpoint of ${perspectiveInstruction}
- Audience: The output is intended for ${audienceMap[config.audience || 'internal'] || 'internal use'}
- Tone: Use a ${toneMap[config.tone] || 'professional'} tone
- Language: Generate the ENTIRE output in ${outputLanguage}, including all section headers, titles, labels, and body text. Do NOT leave any headers or structural elements in another language.
- Include a clear "Date/Time" line near the top of the output using the provided session start date/time value.
- Do NOT use any emojis or emoticons anywhere in the output.
${config.citeTimestamps ? '- Include timestamps where relevant to cite specific moments' : ''}`

    if (template) {
      systemPrompt += `\n\nTemplate: ${template.name}
${template.description}

Required sections (translate section names and descriptions into ${outputLanguage}):
${template.sections?.map((s: any) => `- ${s.name}: ${s.description}${s.isRequired ? ' (Required)' : ''}`).join('\n')}

Style guidelines:
${template.style_rules?.map((r: string) => `- ${r}`).join('\n') || 'Follow professional writing standards'}`

      if (template.custom_instructions?.trim()) {
        systemPrompt += `\n\nAdditional user instructions:\n${template.custom_instructions}`
      }
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

    const formattedStartDateTime = formatEventDateTime(eventStartIso)
    const formattedEndDateTime = formatEventDateTime(eventEndIso)

    const sessionContextLines = [
      formattedStartDateTime ? `- Session start: ${formattedStartDateTime}` : null,
      formattedEndDateTime ? `- Session end: ${formattedEndDateTime}` : null,
      typeof (session as any).duration_sec === 'number' && (session as any).duration_sec > 0
        ? `- Session duration (seconds): ${(session as any).duration_sec}`
        : null,
      callContext?.call_type ? `- Call type: ${callContext.call_type}` : null,
      callContext?.call_mode ? `- Call mode: ${callContext.call_mode}` : null,
      callContext?.contact_name ? `- Contact name: ${callContext.contact_name}` : null,
      fileContext?.original_filename ? `- Source filename: ${fileContext.original_filename}` : null,
      fileContext?.file_purpose ? `- Source file purpose: ${fileContext.file_purpose}` : null,
    ].filter(Boolean).join('\n')

    const userPrompt = `Session context:
${sessionContextLines || '- Date/time context not available'}

Conversation transcript:

${transcriptText}${speakersText}

Please generate the requested output following all requirements and guidelines.`
    
    console.log('[Generate Output] Prompt length:', userPrompt.length)

    // Generate with Claude (use generous token limit to avoid truncated reports)
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 16384,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        }
      ],
      system: systemPrompt,
    })

    let generatedContent = message.content[0].type === 'text'
      ? message.content[0].text 
      : ''

    if (config.includeDate) {
      const now = new Date()
      const dateLabelMap: Record<string, string> = {
        de: 'Datum', en: 'Date', es: 'Fecha', fr: 'Date', it: 'Data',
        pt: 'Data', nl: 'Datum', pl: 'Data', ja: '日付', ko: '날짜',
        zh: '日期', ar: 'التاريخ', ru: 'Дата', tr: 'Tarih', vi: 'Ngày',
        th: 'วันที่',
      }
      const loc = dateLocaleCodeMap[resolvedLanguageCode] || 'en-US'
      const label = dateLabelMap[resolvedLanguageCode] || 'Date'
      const formatted = now.toLocaleDateString(loc, {
        timeZone: userTimezone,
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
      generatedContent = `${label}: ${formatted}\n\n${generatedContent}`
    }

    const sanitizedContent = sanitizeOutputText(generatedContent)

    const usage = (message as { usage?: { input_tokens?: number; output_tokens?: number } }).usage

    if (!sanitizedContent.trim()) {
      return NextResponse.json({ error: 'Failed to generate output' }, { status: 500 })
    }

    // Detect truncated output - if Claude hit the token limit the report is incomplete
    if (message.stop_reason === 'max_tokens') {
      console.warn('[Generate Output] Response was truncated (hit max_tokens). Output may be incomplete.')
    }

    // Save the output to database
    console.log('[Generate Output] Saving to database...')
    console.log('[Generate Output] Insert data:', {
      session_id: sessionId,
      template_id: config.templateId || null,
      template_name: template?.name || 'Custom Output',
      perspective: config.perspective || 'observer',
      audience: config.audience || 'internal',
      language: resolvedLanguageCode,
      tone: config.tone,
      format: config.format,
      content_length: sanitizedContent.length,
      created_by: userId,
    })
    
    const { data: output, error: insertError } = await supabase
      .from('outputs')
      .insert({
        session_id: sessionId,
        template_id: config.templateId || null,
        template_name: template?.name || config.templateName || 'Custom Output',
        perspective: config.perspective || 'observer',
        audience: config.audience || 'internal',
        language: resolvedLanguageCode,
        tone: config.tone,
        format: config.format,
        content: sanitizedContent,
        transcript_version_hash: transcript.id,
        cite_timestamps: config.citeTimestamps || false,
        do_instructions: config.doInstructions || '',
        dont_instructions: config.dontInstructions || '',
        created_by: userId,
      })
      .select()
      .single()

    if (insertError || !output) {
      console.error('[Generate Output] Database insert error:', insertError)
      await logError({
        errorType: 'api_error',
        severity: 'error',
        message: `Failed to save generated output: ${insertError?.message || 'No data returned'}`,
        userId,
        sessionId,
        endpoint: '/api/outputs/generate',
        method: 'POST',
        errorCode: insertError?.code,
        metadata: {
          step: 'output_insert',
          contentLength: sanitizedContent.length,
          templateId: config.templateId,
          dbError: insertError,
        },
      }).catch(() => {})
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
      recordAiTokens(supabase, userId, usage.input_tokens ?? 0, usage.output_tokens ?? 0, {
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
          created_by: userId,
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
    await logError({
      errorType: 'server_error',
      severity: 'error',
      message: `Output generation failed: ${(error as Error).message}`,
      error,
      endpoint: '/api/outputs/generate',
      method: 'POST',
      metadata: { step: 'unhandled_exception' },
    }).catch(() => {})
    return NextResponse.json(
      { error: 'Failed to generate output: ' + (error as Error).message }, 
      { status: 500 }
    )
  }
}
