import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { recordAiTokens } from '@/lib/services/usage-tracker'

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
  affirmationsByUseCase: Array<{
    useCaseId: string
    complianceAffirmation: string
    securityAffirmation: string
  }>
  valueProp: string
  correctionPlaceholder?: string
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
    const useCases: UseCaseResponse['useCases'] = Array.isArray(parsed.useCases)
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
    const affirmationsByUseCase: UseCaseResponse['affirmationsByUseCase'] = Array.isArray(parsed.affirmationsByUseCase)
      ? parsed.affirmationsByUseCase
        .map((a: any) => ({
          useCaseId: String(a?.useCaseId || '').trim(),
          complianceAffirmation: String(a?.complianceAffirmation || '').trim(),
          securityAffirmation: String(a?.securityAffirmation || '').trim(),
        }))
        .filter((a: any) => a.useCaseId && a.complianceAffirmation && a.securityAffirmation)
        .slice(0, 8)
      : []
    const valueProp = String(parsed.valueProp || '').trim()
    const correctionPlaceholder = String(parsed.correctionPlaceholder || '').trim() || undefined
    const useCaseIds = new Set(useCases.map((u) => u.id))
    const linkedAffirmations = affirmationsByUseCase.filter((a) => useCaseIds.has(a.useCaseId))
    if (
      !domain ||
      !industry ||
      !role ||
      !context ||
      useCases.length === 0 ||
      documents.length === 0 ||
      linkedAffirmations.length === 0 ||
      !valueProp
    ) {
      return null
    }
    return {
      classification: { domain, industry, role, context },
      useCases,
      documents,
      affirmationsByUseCase: linkedAffirmations,
      valueProp,
      correctionPlaceholder,
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
    affirmationsByUseCase: [
      {
        useCaseId: 'documentation',
        complianceAffirmation: 'Meeting documentation can follow your retention and accountability requirements with traceable version history.',
        securityAffirmation: 'Conversation-derived notes can be access-scoped to approved collaborators only.',
      },
      {
        useCaseId: 'reporting',
        complianceAffirmation: 'Status reporting can standardize required fields for governance, audit, or stakeholder review.',
        securityAffirmation: 'Reporting outputs can be shared with role-based access controls and controlled distribution.',
      },
      {
        useCaseId: 'client-communication',
        complianceAffirmation: 'Client communication drafts can align to approved language and documentation obligations.',
        securityAffirmation: 'Externally shared drafts can be reviewed before send to prevent unintended disclosure.',
      },
      {
        useCaseId: 'follow-ups',
        complianceAffirmation: 'Action follow-ups can preserve accountable ownership and due-date traceability.',
        securityAffirmation: 'Follow-up records can stay inside protected workspaces with auditable access.',
      },
    ],
    valueProp:
      'Notissima turns your conversations into ready-to-use documentation, follow-ups, and reporting outputs in minutes. Instead of manually rewriting notes, you get consistent structure and clearer decisions from every meeting. This helps reduce admin effort while improving execution quality.',
  }
}

function browserLocaleToJurisdiction(browserLocale: string): string {
  if (!browserLocale) return ''
  const tag = browserLocale.toLowerCase()
  const regionMap: Record<string, string> = {
    'de': 'Germany (German/civil law jurisdiction)',
    'de-de': 'Germany (German/civil law jurisdiction)',
    'de-at': 'Austria (Austrian/civil law jurisdiction)',
    'de-ch': 'Switzerland (Swiss/civil law jurisdiction)',
    'fr': 'France (French/civil law jurisdiction)',
    'fr-fr': 'France (French/civil law jurisdiction)',
    'fr-be': 'Belgium (Belgian/civil law jurisdiction)',
    'fr-ch': 'Switzerland (Swiss/civil law jurisdiction)',
    'nl': 'Netherlands (Dutch/civil law jurisdiction)',
    'nl-nl': 'Netherlands (Dutch/civil law jurisdiction)',
    'nl-be': 'Belgium (Belgian/civil law jurisdiction)',
    'es': 'Spain (Spanish civil law jurisdiction)',
    'es-es': 'Spain (Spanish civil law jurisdiction)',
    'es-mx': 'Mexico (Mexican civil law jurisdiction)',
    'es-ar': 'Argentina (Argentine civil law jurisdiction)',
    'es-co': 'Colombia (Colombian civil law jurisdiction)',
    'pt': 'Portugal (Portuguese civil law jurisdiction)',
    'pt-pt': 'Portugal (Portuguese civil law jurisdiction)',
    'pt-br': 'Brazil (Brazilian civil law jurisdiction)',
    'it': 'Italy (Italian civil law jurisdiction)',
    'it-it': 'Italy (Italian civil law jurisdiction)',
    'pl': 'Poland (Polish civil law jurisdiction)',
    'sv': 'Sweden (Swedish/Nordic civil law jurisdiction)',
    'sv-se': 'Sweden (Swedish/Nordic civil law jurisdiction)',
    'nb': 'Norway (Norwegian/Nordic civil law jurisdiction)',
    'da': 'Denmark (Danish/Nordic civil law jurisdiction)',
    'fi': 'Finland (Finnish/Nordic civil law jurisdiction)',
    'en-gb': 'United Kingdom (English common law jurisdiction)',
    'en-au': 'Australia (Australian common law jurisdiction)',
    'en-ca': 'Canada (Canadian common law jurisdiction)',
    'en-nz': 'New Zealand (NZ common law jurisdiction)',
    'en-in': 'India (Indian common law jurisdiction)',
    'en-us': 'United States (US common law jurisdiction)',
    'ja': 'Japan (Japanese law)',
    'ko': 'South Korea (Korean law)',
    'zh': 'China (Chinese law)',
    'zh-cn': 'China (Chinese law)',
    'zh-tw': 'Taiwan (Taiwanese law)',
  }
  return regionMap[tag] || regionMap[tag.split('-')[0]] || ''
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const selfDescription = String(body?.selfDescription || '').trim()
    const correction = String(body?.correction || '').trim()
    const browserLocale = String(body?.browserLocale || '').trim()

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

    const jurisdictionFallback = browserLocaleToJurisdiction(browserLocale)
    const jurisdictionHint = jurisdictionFallback
      ? `\nBrowser locale signal (use ONLY if no location is mentioned in the input): the user appears to be in ${jurisdictionFallback}.`
      : ''

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1400,
      messages: [
        {
          role: 'user',
          content: `You are generating a "find your use case" output for Notissima — a communication intelligence platform for professionals whose work involves structured verbal communication: client calls, project meetings, consultations, negotiations, team briefings, case reviews, etc.

Input self-description:
"${selfDescription}"${correctionInstruction}${jurisdictionHint}

STEP 1 — Relevance gate:
Assess whether this role plausibly involves regular structured professional communication where capturing decisions, actions, or documentation from calls/meetings adds real value.

Relevant: executives, managers, consultants, lawyers, doctors, project leads, sales professionals, HR, team leads, researchers, coaches, account managers, coordinators, analysts, therapists, auditors, officers, directors, specialists — essentially any knowledge worker or professional who holds or participates in consequential verbal communications.

NOT relevant: purely manual/physical trade roles with no professional communication documentation need (e.g. bus driver, factory operator, cashier), obviously fictional/joke inputs, or inputs that are not a professional role description at all.

If NOT relevant, return ONLY this JSON:
{ "relevant": false, "notRelevantMessage": "One friendly sentence explaining Notissima is designed for professionals who manage calls, meetings, and client communication — and inviting them to try describing a work context where they lead or participate in those conversations." }

If relevant, proceed to STEP 2.

STEP 2 — Output (only if relevant):
1) Classify into domain, industry, role, and context.
2) Propose the most-used documentation outputs from verbal communication for this profile.
3) Return practical, high-value suggestions (not generic fluff).
4) IMPORTANT — jurisdiction and location awareness: if the input explicitly mentions a country, region, or legal system, ALL terminology, document types, use cases, and examples MUST reflect that jurisdiction. If no location is mentioned in the input but a browser locale hint is provided above, use that as the fallback jurisdiction. For example: a lawyer in Germany operates under German/civil law — use terms like Mandantengespräch, Aktennotiz, Beratungsprotokoll, Schriftsatzvorbereitung, not common-law concepts like Discovery, Deposition, or Pleadings. A doctor in France follows French healthcare regulations, not US HIPAA. Always adapt to the stated or implied local professional context — never default to Anglo-American terminology when a different jurisdiction is indicated.

Return strict JSON:
{
  "relevant": true,
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
  "affirmationsByUseCase": [
    {
      "useCaseId": "kebab-case",
      "complianceAffirmation": "string",
      "securityAffirmation": "string"
    }
  ],
  "valueProp": "2-3 sentences",
  "correctionPlaceholder": "string"
}

Constraints:
- useCases: 4-6
- documents: 5-10
- affirmationsByUseCase: exactly one item per use case id
- complianceAffirmation: concrete, use-case specific compliance or regulatory relevance for this role
- securityAffirmation: MUST describe a specific Notissima security feature that makes it safe to use in this professional context. Notissima's security features include: end-to-end encryption of all recordings and transcripts, automatic PII detection and redaction before storage, data is never used to train AI models, per-user and per-team access controls with no cross-account sharing, GDPR-compliant processing with EU data residency options, and audit-ready access logs. Pick the feature(s) most relevant to this use case and explain why they matter for this specific role — do not write abstract "can be" statements.
- sourceConversation must be concrete (e.g. "customer implementation calls", "editorial planning meetings")
- documentType should sound like something professionals actually use
- correctionPlaceholder: a short, realistic example correction a person in THIS specific role might give — e.g. for a lawyer it might be "Not litigation — mostly M&A and corporate advisory", for a doctor "Not hospital setting — private outpatient clinic". It should help them understand what kind of refinement is useful.
- No markdown, no explanation, JSON only.`,
        },
      ],
    })
    const usage = (message as { usage?: { input_tokens?: number; output_tokens?: number } }).usage
    if (usage?.input_tokens != null || usage?.output_tokens != null) {
      const trackingClient = createServiceRoleClient()
      recordAiTokens(trackingClient, null, usage.input_tokens ?? 0, usage.output_tokens ?? 0, {
        endpoint: 'landing/use-case',
      })
    }

    const raw = message.content[0]?.type === 'text' ? message.content[0].text : ''

    // Check for not-relevant gate response first
    try {
      let text = raw.trim()
      if (text.startsWith('```')) {
        const m = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
        if (m?.[1]) text = m[1]
      }
      const gate = JSON.parse(text)
      if (gate?.relevant === false && gate?.notRelevantMessage) {
        return NextResponse.json({ notRelevant: true, notRelevantMessage: gate.notRelevantMessage })
      }
    } catch { /* fall through to normal parse */ }

    const parsed = parseJson(raw) || fallback(selfDescription)
    return NextResponse.json({ result: parsed })
  } catch (error) {
    console.error('[Landing Use Case] Error:', error)
    return NextResponse.json({ error: 'Failed to generate use case output' }, { status: 500 })
  }
}

