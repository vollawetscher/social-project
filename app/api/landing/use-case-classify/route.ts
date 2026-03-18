import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

type UseCaseClassification = {
  industry: string
  role: string
  context: string
  suggestedContexts: string[]
}

function parseClassification(raw: string): UseCaseClassification | null {
  const text = String(raw || '').trim()
  if (!text) return null

  let jsonText = text
  if (jsonText.startsWith('```')) {
    const match = jsonText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
    if (match?.[1]) jsonText = match[1]
  }

  try {
    const parsed = JSON.parse(jsonText)
    const industry = String(parsed?.industry || '').trim()
    const role = String(parsed?.role || '').trim()
    const context = String(parsed?.context || '').trim()
    const suggestedContexts = Array.isArray(parsed?.suggestedContexts)
      ? parsed.suggestedContexts.map((x: unknown) => String(x || '').trim()).filter(Boolean).slice(0, 3)
      : []

    if (!industry || !role || !context) return null
    return {
      industry,
      role,
      context,
      suggestedContexts: suggestedContexts.length > 0
        ? suggestedContexts
        : [context],
    }
  } catch {
    return null
  }
}

function fallbackClassification(jobTitle: string): UseCaseClassification {
  const role = jobTitle.trim() || 'Knowledge Worker'
  return {
    industry: 'Professional Services',
    role,
    context: 'Client/Project Work',
    suggestedContexts: ['Client/Project Work', 'Internal Meetings', 'Operations'],
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const jobTitle = String(body?.jobTitle || '').trim()

    if (!jobTitle) {
      return NextResponse.json({ error: 'jobTitle is required' }, { status: 400 })
    }
    if (jobTitle.length > 120) {
      return NextResponse.json({ error: 'jobTitle too long' }, { status: 400 })
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ classification: fallbackClassification(jobTitle), fallback: true })
    }

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [
        {
          role: 'user',
          content: `Classify this job title into Industry, Role, and likely work Context.

Job title: "${jobTitle}"

Return JSON only in this exact shape:
{
  "industry": "string",
  "role": "string",
  "context": "string",
  "suggestedContexts": ["string", "string", "string"]
}

Rules:
- Keep values concise and practical for business communication workflows.
- suggestedContexts must contain 2-3 realistic options and include the main context.
- No markdown, no explanation, JSON only.`,
        },
      ],
    })

    const text = message.content[0]?.type === 'text' ? message.content[0].text : ''
    const parsed = parseClassification(text) || fallbackClassification(jobTitle)
    return NextResponse.json({ classification: parsed })
  } catch (error) {
    console.error('[Use Case Classify] Error:', error)
    return NextResponse.json({ error: 'Failed to classify job title' }, { status: 500 })
  }
}

