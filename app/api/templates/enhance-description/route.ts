import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { requireAuth } from '@/lib/auth/helpers'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export async function POST(request: Request) {
  try {
    await requireAuth()

    const { name, description } = await request.json()

    if (!description?.trim() && !name?.trim()) {
      return NextResponse.json(
        { error: 'Provide at least a template name or rough description' },
        { status: 400 }
      )
    }

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 512,
      messages: [
        {
          role: 'user',
          content: `You are helping a user write a template description for an AI-powered transcription documentation tool called Notissima. The template description is the PRIMARY instruction the AI uses when generating outputs from meeting/call transcripts.

A good description should:
- State clearly what type of document this template produces
- Specify the structure/format expected (sections, bullet points, narrative, etc.)
- Mention what information to prioritize or extract
- Define the tone and level of detail
- Be 2-4 sentences, concise but specific

The user's template is named: "${name || '(unnamed)'}"
The user's rough description: "${description || '(none provided, infer from the name)'}"

Rewrite this into a polished, effective template description. Return ONLY the improved description text, nothing else. Do not use quotes around it.`,
        },
      ],
    })

    const enhanced =
      message.content[0].type === 'text' ? message.content[0].text.trim() : ''

    return NextResponse.json({ enhanced })
  } catch (error: any) {
    console.error('[Enhance Description] Error:', error.message)
    return NextResponse.json(
      { error: error.message || 'Failed to enhance description' },
      { status: 500 }
    )
  }
}
