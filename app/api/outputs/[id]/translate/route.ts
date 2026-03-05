import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { recordAiTokens } from '@/lib/services/usage-tracker'
import { sanitizeOutputText } from '@/lib/utils/output-text-sanitizer'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const languageNames: Record<string, string> = {
  en: 'English',
  de: 'German',
  fr: 'French',
  es: 'Spanish',
  it: 'Italian',
  nl: 'Dutch',
  pt: 'Portuguese',
  pl: 'Polish',
  th: 'Thai',
  ru: 'Russian',
  sv: 'Swedish',
  no: 'Norwegian',
  da: 'Danish',
  cs: 'Czech',
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { targetLanguage = 'en' } = body

    if (!targetLanguage || typeof targetLanguage !== 'string') {
      return NextResponse.json(
        { error: 'targetLanguage is required' },
        { status: 400 }
      )
    }

    const targetLangName = languageNames[targetLanguage] || targetLanguage

    // Fetch the source output
    const { data: output, error } = await supabase
      .from('outputs')
      .select('*')
      .eq('id', params.id)
      .eq('created_by', user.id)
      .single()

    if (error || !output) {
      return NextResponse.json({ error: 'Output not found' }, { status: 404 })
    }

    // Don't translate if already in target language
    if ((output.language || 'en') === targetLanguage) {
      return NextResponse.json(
        { error: `Output is already in ${targetLangName}` },
        { status: 400 }
      )
    }

    const sourceLangName = languageNames[output.language || 'en'] || output.language || 'English'

    // Call Claude to translate, preserving format and structure
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 8192,
      system: `You are a professional translator. Your task is to translate document content from ${sourceLangName} to ${targetLangName}.

Critical rules:
- Preserve ALL formatting: markdown headers, lists, bullet points, line breaks, structure
- Preserve technical terms and proper nouns when appropriate
- Maintain the same tone and register
- Do NOT use any emojis or emoticons anywhere in the translated text
- Output ONLY the translated text, no explanations or metadata`,
      messages: [
        {
          role: 'user',
          content: `Translate the following content from ${sourceLangName} to ${targetLangName}. Preserve all formatting exactly:\n\n${output.content}`,
        },
      ],
    })

    const translatedContent =
      message.content[0].type === 'text' ? message.content[0].text : ''
    const sanitizedTranslatedContent = sanitizeOutputText(translatedContent)
    const usage = (message as { usage?: { input_tokens?: number; output_tokens?: number } }).usage

    if (!sanitizedTranslatedContent.trim()) {
      return NextResponse.json(
        { error: 'Failed to translate output' },
        { status: 500 }
      )
    }

    // Create new output with translated content (same session, template, metadata; different language)
    const { data: newOutput, error: insertError } = await supabase
      .from('outputs')
      .insert({
        session_id: output.session_id,
        template_id: output.template_id,
        template_name: output.template_name + ` (${targetLangName})`,
        perspective: output.perspective,
        audience: output.audience,
        language: targetLanguage,
        tone: output.tone,
        format: output.format,
        content: sanitizedTranslatedContent,
        transcript_version_hash: output.transcript_version_hash,
        cite_timestamps: output.cite_timestamps ?? false,
        created_by: user.id,
      })
      .select()
      .single()

    if (insertError || !newOutput) {
      console.error('[Translate] Insert error:', insertError)
      return NextResponse.json(
        { error: 'Failed to save translated output' },
        { status: 500 }
      )
    }

    // Record AI token usage
    if (usage?.input_tokens != null || usage?.output_tokens != null) {
      recordAiTokens(supabase, user.id, usage.input_tokens ?? 0, usage.output_tokens ?? 0, {
        sessionId: output.session_id,
        outputId: newOutput.id,
        endpoint: 'outputs/translate',
      })
    }

    // Return the new output in v0 format
    return NextResponse.json({
      id: newOutput.id,
      sessionId: newOutput.session_id,
      templateId: newOutput.template_id || '',
      templateName: newOutput.template_name,
      perspective: newOutput.perspective,
      audience: newOutput.audience,
      language: newOutput.language,
      tone: newOutput.tone,
      format: newOutput.format,
      content: newOutput.content,
      createdAt: newOutput.created_at,
      transcriptVersionHash: newOutput.transcript_version_hash || '',
      citeTimestamps: newOutput.cite_timestamps ?? false,
    })
  } catch (error) {
    console.error('[Translate] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to translate output',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
