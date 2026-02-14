/**
 * GET /api/templates/suggested?sessionId=xxx
 *
 * Returns templates ranked by relevance for a session, using:
 * - Session domain (from suggested_domains or recording_type)
 * - Transcript text for suggestion_triggers keyword matching
 */

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireAuth, requireSessionAccess, handleAuthError } from '@/lib/auth/helpers'
import type { Template } from '@/lib/types-v0'

// Domain type used in templates
const DOMAIN_TAGS = ['legal', 'sales', 'hr', 'medical', 'education', 'consulting', 'general'] as const
type DomainTag = (typeof DOMAIN_TAGS)[number]

// Map AI domain names (primary/specialty) to template domain_tags
const PRIMARY_TO_DOMAIN: Record<string, DomainTag> = {
  medical: 'medical',
  legal: 'legal',
  law: 'legal',
  sales: 'sales',
  hr: 'hr',
  'human resources': 'hr',
  education: 'education',
  consulting: 'consulting',
  finance: 'consulting',
  insurance: 'consulting',
  general: 'general',
}

// Map recording_type to domain when no suggested_domains
const RECORDING_TYPE_TO_DOMAIN: Record<string, DomainTag> = {
  sales_call: 'sales',
  legal_deposition: 'legal',
  meeting: 'general',
  interview: 'hr',
  presentation: 'education',
  consultation: 'general', // Will be overridden by suggested_domains when available
  call_inbound: 'general',
  call_outbound: 'general',
  dictation: 'general',
  ai_agent_conversation: 'general',
  lecture: 'education',
  other: 'general',
}

function normalizeToDomainTag(value: string): DomainTag {
  const lower = value.toLowerCase().trim()
  if (PRIMARY_TO_DOMAIN[lower]) return PRIMARY_TO_DOMAIN[lower]
  for (const [key, tag] of Object.entries(PRIMARY_TO_DOMAIN)) {
    if (lower.includes(key) || key.includes(lower)) return tag
  }
  return 'general'
}

/**
 * Derive session domain tags from suggested_domains and recording_type
 */
function deriveSessionDomainTags(session: {
  suggested_domains?: Array<{ primary?: string; specialty?: string; domain?: string; confidence?: number }>
  recording_type?: string
}): DomainTag[] {
  const tags = new Set<DomainTag>()

  // 1. From suggested_domains (AI analysis)
  const domains = session.suggested_domains || []
  for (const d of domains) {
    const primary = d.primary || d.domain
    if (primary) tags.add(normalizeToDomainTag(primary))
    if (d.specialty) tags.add(normalizeToDomainTag(d.specialty))
  }

  // 2. Fallback: recording_type
  if (tags.size === 0 && session.recording_type) {
    const mapped = RECORDING_TYPE_TO_DOMAIN[session.recording_type]
    if (mapped) tags.add(mapped)
  }

  // 3. Always include general as fallback
  if (tags.size === 0) tags.add('general')
  tags.add('general')

  return Array.from(tags)
}

/**
 * Score a template for a session (higher = better match)
 */
function scoreTemplate(
  template: { domain_tags: string[]; suggestion_triggers?: string[] },
  sessionDomainTags: DomainTag[],
  transcriptText: string
): number {
  let score = 0

  const templateDomains = (template.domain_tags || []).map((d) => d.toLowerCase())
  const transcriptLower = transcriptText.toLowerCase()

  // Domain overlap (primary signal)
  const domainOverlap = sessionDomainTags.filter((sd) =>
    templateDomains.some((td) => td === sd || td.includes(sd))
  )
  if (domainOverlap.length > 0) {
    // Exact domain match: strong boost; general-only: weak
    const hasSpecific = domainOverlap.some((d) => d !== 'general')
    score += hasSpecific ? 10 : 2
    score += domainOverlap.length
  } else {
    // No domain overlap - check if template has only general
    if (templateDomains.includes('general')) score += 1
  }

  // Suggestion triggers in transcript
  const triggers = template.suggestion_triggers || []
  for (const trigger of triggers) {
    if (transcriptLower.includes(trigger.toLowerCase())) {
      score += 3
    }
  }

  return score
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')
    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 })
    }

    const user = await requireAuth()
    await requireSessionAccess(sessionId, user.id)

    const supabase = await createClient()

    // Fetch session
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('id, suggested_domains, recording_type')
      .eq('id', sessionId)
      .single()

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // Fetch transcript (first ~3000 chars for trigger matching)
    let transcriptText = ''
    const { data: transcripts } = await supabase
      .from('transcripts')
      .select('raw_json')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
      .limit(1)
    if (transcripts?.[0]?.raw_json) {
      const segments = transcripts[0].raw_json as Array<{ text?: string }>
      transcriptText = (segments || [])
        .map((s) => s?.text || '')
        .join(' ')
        .substring(0, 4000)
    }

    const sessionDomainTags = deriveSessionDomainTags(session as any)

    // Fetch all templates (system + user's)
    const { data: templates, error: templatesError } = await supabase
      .from('templates')
      .select('*')
      .or(`is_system.eq.true,created_by.eq.${user.id}`)
      .order('is_system', { ascending: false })
      .order('used_count', { ascending: false })

    if (templatesError) {
      console.error('[suggested templates] Error:', templatesError)
      return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 })
    }

    // Score and sort
    const scored = (templates || []).map((t: any) => ({
      template: {
        id: t.id,
        name: t.name,
        description: t.description,
        intendedPerspectives: t.intended_perspectives || [],
        allowedAudience: t.allowed_audience || [],
        domainTags: t.domain_tags || [],
        usedCount: t.used_count || 0,
        sections: t.sections || [],
        requiredInputs: t.required_inputs || [],
        styleRules: t.style_rules || [],
        suggestionTriggers: t.suggestion_triggers || [],
        sampleContent: t.sample_content || null,
      } satisfies Template,
      score: scoreTemplate(
        { domain_tags: t.domain_tags || [], suggestion_triggers: t.suggestion_triggers || [] },
        sessionDomainTags,
        transcriptText
      ),
    }))

    // Sort by score desc, then by usedCount
    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      return (b.template.usedCount || 0) - (a.template.usedCount || 0)
    })

    // Return top templates (at least 5, up to 10) - always include some general fallbacks
    const result = scored.slice(0, 10).map((s) => s.template)

    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof Error) {
      const authError = handleAuthError(error)
      return NextResponse.json({ error: authError.message }, { status: authError.status })
    }
    console.error('[suggested templates] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
