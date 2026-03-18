import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

function fallbackRecommendations(context: string, workMode: string) {
  const modeText =
    workMode === 'owner'
      ? 'as an owner'
      : workMode === 'employer'
        ? 'as an in-house professional'
        : 'across both in-house and independent work'
  return {
    useCaseOptions: [
      { id: 'documentation', label: 'Conversation documentation' },
      { id: 'reporting', label: 'Status and decision reporting' },
      { id: 'client-communication', label: 'Client communication drafts' },
      { id: 'follow-ups', label: 'Follow-up actions and commitments' },
      { id: 'compliance', label: 'Compliance and audit-ready records' },
    ],
    documentsByUseCase: {
      documentation: [
        { documentType: 'Structured conversation notes', sourceConversation: `${context} meetings and calls` },
        { documentType: 'Decision and topic summary', sourceConversation: 'Planning and alignment discussions' },
        { documentType: 'Action tracker', sourceConversation: 'Execution and handoff conversations' },
      ],
      reporting: [
        { documentType: 'Weekly status report', sourceConversation: `${context} progress updates` },
        { documentType: 'Risk and blocker log', sourceConversation: 'Escalation conversations' },
        { documentType: 'Decision brief', sourceConversation: 'Leadership or stakeholder calls' },
      ],
      'client-communication': [
        { documentType: 'Client follow-up draft', sourceConversation: 'Client meetings and review calls' },
        { documentType: 'Plain-language summary', sourceConversation: 'Complex alignment conversations' },
        { documentType: 'Commitment confirmation', sourceConversation: 'Deadline and scope discussions' },
      ],
      'follow-ups': [
        { documentType: 'Follow-up checklist', sourceConversation: 'Project sync meetings' },
        { documentType: 'Owner/deadline matrix', sourceConversation: 'Handoff discussions' },
        { documentType: 'Dependency tracker', sourceConversation: 'Cross-team planning calls' },
      ],
      compliance: [
        { documentType: 'Compliance-ready record', sourceConversation: 'Regulated conversations' },
        { documentType: 'Consent and obligations summary', sourceConversation: 'Client/service conversations' },
        { documentType: 'Audit trail brief', sourceConversation: 'Review and verification meetings' },
      ],
    },
    valueProp: `Notissima turns your conversations into the documentation your role needs most ${modeText}. You get reusable, structured outputs for follow-ups, reporting, and communication without rewriting everything manually. That means faster execution, fewer dropped commitments, and clearer project memory.`,
  }
}

function parseResponse(raw: string) {
  const text = String(raw || '').trim()
  if (!text) return null
  let jsonText = text
  if (jsonText.startsWith('```')) {
    const match = jsonText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
    if (match?.[1]) jsonText = match[1]
  }
  try {
    const parsed = JSON.parse(jsonText)
    if (!parsed || typeof parsed !== 'object') return null
    return parsed
  } catch {
    return null
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const jobTitle = String(body?.jobTitle || '').trim()
    const industry = String(body?.industry || '').trim()
    const role = String(body?.role || '').trim()
    const context = String(body?.context || '').trim()
    const workMode = String(body?.workMode || '').trim()

    if (!jobTitle || !industry || !role || !context || !workMode) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ recommendations: fallbackRecommendations(context, workMode), fallback: true })
    }

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1200,
      messages: [
        {
          role: 'user',
          content: `Create practical recommendations for documentation generated from verbal communication.

Profile:
- Job title: ${jobTitle}
- Industry: ${industry}
- Role: ${role}
- Work context: ${context}
- Work mode: ${workMode}

Goal:
- Return the MOST USED documentation outputs this profile typically needs after meetings/calls/interviews.
- Keep everything practical, realistic, and professional.

Return strict JSON in this exact structure:
{
  "useCaseOptions": [
    { "id": "kebab-case-id", "label": "Human readable label" }
  ],
  "documentsByUseCase": {
    "kebab-case-id": [
      { "documentType": "string", "sourceConversation": "string" }
    ]
  },
  "valueProp": "2-3 sentence concise value proposition"
}

Constraints:
- useCaseOptions: 4 to 6 options
- each use case id must be unique and reusable
- each use case must have 2 to 3 document rows
- documentType must be specific and useful
- sourceConversation should describe typical verbal source (e.g. client call, internal meeting, interview)
- No markdown, no commentary, JSON only.`,
        },
      ],
    })

    const raw = message.content[0]?.type === 'text' ? message.content[0].text : ''
    const parsed = parseResponse(raw)
    if (!parsed) {
      return NextResponse.json({ recommendations: fallbackRecommendations(context, workMode), fallback: true })
    }
    return NextResponse.json({ recommendations: parsed })
  } catch (error) {
    console.error('[Use Case Recommendations] Error:', error)
    return NextResponse.json({ error: 'Failed to generate recommendations' }, { status: 500 })
  }
}

