import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

type UseCaseResponse = {
  classification: {
    domain: string
    industry: string
    role: string
    context: string
  }
  useCases: Array<{ id: string; label: string }>
  documents: Array<{ documentType: string; sourceConversation: string }>
  valueProp: string
}

function parseJson(raw: string): UseCaseResponse | null {
  let text = String(raw || '').trim()
  if (!text) return null
  if (text.startsWith('```')) {
    const match = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
    if (match?.[1]) text = match[1]
  }
  try {
    const parsed = JSON.parse(text)
    if (!parsed || typeof parsed !== 'object') return null
    const classification = parsed.classification || {}
    const domain = String(classification.domain || '').trim()
    const industry = String(classification.industry || '').trim()
    const role = String(classification.role || '').trim()
    const context = String(classification.context || '').trim()
    const useCases = Array.isArray(parsed.useCases)
      ? parsed.useCases
        .map((u: any) => ({ id: String(u?.id || '').trim(), label: String(u?.label || '').trim() }))
        .filter((u: any) => u.id && u.label)
        .slice(0, 6)
      : []
    const documents = Array.isArray(parsed.documents)
      ? parsed.documents
        .map((d: any) => ({
          documentType: String(d?.documentType || '').trim(),
          sourceConversation: String(d?.sourceConversation || '').trim(),
        }))
        .filter((d: any) => d.documentType && d.sourceConversation)
        .slice(0, 10)
      : []
    const valueProp = String(parsed.valueProp || '').trim()
    if (!domain || !industry || !role || !context || useCases.length === 0 || documents.length === 0 || !valueProp) {
      return null
    }
    return {
      classification: { domain, industry, role, context },
      useCases,
      documents,
      valueProp,
    }
  } catch {
    return null
  }
}

function fallback(selfDescription: string): UseCaseResponse {
  const roleGuess = selfDescription.length > 80 ? selfDescription.slice(0, 80).trim() : selfDescription.trim()
  return {
    classification: {
      domain: 'Professional Services',
      industry: 'Professional Services',
      role: roleGuess || 'Knowledge Worker',
      context: 'Client/Project Work',
    },
    useCases: [
      { id: 'documentation', label: 'Conversation documentation' },
      { id: 'reporting', label: 'Status and decision reporting' },
      { id: 'client-communication', label: 'Client communication drafts' },
      { id: 'follow-ups', label: 'Follow-up actions and commitments' },
    ],
    documents: [
      { documentType: 'Structured meeting/call notes', sourceConversation: 'Client and team calls' },
      { documentType: 'Decision and action summary', sourceConversation: 'Planning and alignment conversations' },
      { documentType: 'Follow-up checklist', sourceConversation: 'Execution and handoff meetings' },
      { documentType: 'Stakeholder update brief', sourceConversation: 'Status and review calls' },
    ],
    valueProp:
      'Notissima turns your conversations into ready-to-use documentation, follow-ups, and reporting outputs in minutes. Instead of manually rewriting notes, you get consistent structure and clearer decisions from every meeting. This helps reduce admin effort while improving execution quality.',
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const selfDescription = String(body?.selfDescription || '').trim()
    const correction = String(body?.correction || '').trim()

    if (!selfDescription) {
      return NextResponse.json({ error: 'selfDescription is required' }, { status: 400 })
    }
    if (selfDescription.length > 320) {
      return NextResponse.json({ error: 'selfDescription too long' }, { status: 400 })
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ result: fallback(selfDescription), fallback: true })
    }

    const correctionInstruction = correction
      ? `\nUser correction to apply:\n"${correction}"\nTreat this correction as higher priority than your first-pass assumption.`
      : ''

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1400,
      messages: [
        {
          role: 'user',
          content: `You are generating a fast "find your use case" output for Notissima.

Input self-description:
"${selfDescription}"${correctionInstruction}

Task:
1) Classify into domain, industry, role, and context.
2) Propose the most-used documentation outputs from verbal communication for this profile.
3) Return practical, high-value suggestions (not generic fluff).

Return strict JSON:
{
  "classification": {
    "domain": "string",
    "industry": "string",
    "role": "string",
    "context": "string"
  },
  "useCases": [
    { "id": "kebab-case", "label": "string" }
  ],
  "documents": [
    { "documentType": "string", "sourceConversation": "string" }
  ],
  "valueProp": "2-3 sentences"
}

Constraints:
- useCases: 4-6
- documents: 5-10
- sourceConversation must be concrete (e.g. "customer implementation calls", "editorial planning meetings")
- documentType should sound like something professionals actually use
- No markdown, no explanation, JSON only.`,
        },
      ],
    })

    const raw = message.content[0]?.type === 'text' ? message.content[0].text : ''
    const parsed = parseJson(raw) || fallback(selfDescription)
    return NextResponse.json({ result: parsed })
  } catch (error) {
    console.error('[Landing Use Case] Error:', error)
    return NextResponse.json({ error: 'Failed to generate use case output' }, { status: 500 })
  }
}

