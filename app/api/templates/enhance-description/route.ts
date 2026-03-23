import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { requireAuth } from '@/lib/auth/helpers'
import { createClient } from '@/lib/supabase/server'
import { recordAiTokens } from '@/lib/services/usage-tracker'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export async function POST(request: Request) {
  try {
    const user = await requireAuth()
    const supabase = await createClient()

    const { name, description } = await request.json()

    if (!description?.trim() && !name?.trim()) {
      return NextResponse.json(
        { error: 'Provide at least a template name or rough description' },
        { status: 400 }
      )
    }

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `You are helping a user with an AI-powered transcription documentation tool called Notissima. You have TWO tasks:

TASK 1 — Generation Instructions (AI prompt):
Rewrite the user's rough instructions into polished, effective AI generation instructions. These tell the AI how to generate outputs from meeting/call transcripts.
Good instructions should:
- State clearly what type of document this template produces
- Specify the structure/format expected (sections, bullet points, narrative, etc.)
- Mention what information to prioritize or extract
- Define the tone and level of detail
- Be 2-4 sentences, concise but specific

TASK 2 — User-Facing Description:
Generate a short, user-friendly description (MAX 250 characters) that explains what this template does. This is shown publicly in the Marketplace.
- Write for end-users, not for AI
- Do NOT reveal any AI prompt details, instructions, or technical implementation
- Focus on the benefit/outcome for the user
- 1-2 sentences maximum
- Must be 250 characters or fewer

The user's template is named: "${name || '(unnamed)'}"
The user's rough instructions: "${description || '(none provided, infer from the name)'}"

Return ONLY a valid JSON object with exactly these two keys, nothing else:
{"instructions": "...", "description": "..."}`,
        },
      ],
    })
    const usage = (message as { usage?: { input_tokens?: number; output_tokens?: number } }).usage
    if (usage?.input_tokens != null || usage?.output_tokens != null) {
      recordAiTokens(supabase, user.id, usage.input_tokens ?? 0, usage.output_tokens ?? 0, {
        endpoint: 'templates/enhance-description',
      })
    }

    const rawText =
      message.content[0].type === 'text' ? message.content[0].text.trim() : ''

    let enhancedInstructions = ''
    let generatedDescription = ''

    try {
      const parsed = JSON.parse(rawText)
      enhancedInstructions = (parsed.instructions || '').trim()
      generatedDescription = (parsed.description || '').substring(0, 250).trim()
    } catch {
      enhancedInstructions = rawText
    }

    return NextResponse.json({
      enhancedInstructions,
      generatedDescription,
      enhanced: enhancedInstructions,
    })
  } catch (error: any) {
    console.error('[Enhance Description] Error:', error.message)
    return NextResponse.json(
      { error: error.message || 'Failed to enhance description' },
      { status: 500 }
    )
  }
}
