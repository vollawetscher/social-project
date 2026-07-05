// Cross-session Event digest: one project-level deliverable (key takeaways,
// people met, follow-ups) synthesized from the distilled per-session layer the
// pipeline already produces — never from raw transcripts (cost/scale). Sessions
// are deduplicated and ordered by recorded_at so the digest reflects the true
// event timeline regardless of upload order.

import Anthropic from '@anthropic-ai/sdk'
import type { SupabaseClient } from '@supabase/supabase-js'
import { JSON_PREFILL, withJsonPrefill } from '@/lib/utils/claude-json'
import { recordAiTokens } from '@/lib/services/usage-tracker'
import { normalizeLanguageCode } from '@/lib/utils/language'
import { buildEventSignals, dedupeAndOrder, titleToIdentityLabel, type EventSessionRow } from '@/lib/services/event/event-signals'
import type { EventDigestContent, EventMetadata } from '@/lib/types/database'

const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null

function summaryBullets(input: string | null | undefined): string[] {
  const raw = String(input || '').trim()
  if (!raw) return []
  return raw
    .split('\n')
    .map((l) => l.trim().replace(/^[-*•]\s+/, '').trim())
    .filter(Boolean)
    .slice(0, 6)
}

function participantNames(ctx: Record<string, any> | null): string[] {
  const participants = Array.isArray(ctx?.participants) ? ctx!.participants : []
  return participants
    .map((p: any) => (typeof p === 'string' ? p : String(p?.name || '')))
    .map((v: string) => v.trim())
    .filter(Boolean)
    .slice(0, 12)
}

function buildPrompt(input: {
  sessions: EventSessionRow[]
  eventMetadata: EventMetadata | null
  projectTitle: string
  language: string
}): { system: string; user: string } {
  const { sessions, eventMetadata, projectTitle, language } = input

  const sessionBlocks = sessions
    .map((s, i) => {
      // Use the FULL human title (not just the pre-dash identity), so an
      // affiliation written after a dash — e.g. "Matt Golubovic - Omnius" — is
      // visible to the model instead of being stripped away.
      const rawTitle = String(s.internal_case_id || '').trim()
      const isHumanTitle = Boolean(titleToIdentityLabel(rawTitle))
      const label = isHumanTitle ? rawTitle : `Recording ${i + 1}`
      const when = s.recorded_at ? new Date(s.recorded_at).toISOString() : 'unknown time'
      const ctx = s.ai_extracted_context
      const purpose = String(s.purpose || ctx?.purpose || '').trim()
      const bullets = summaryBullets(s.speechmatics_summary)
      const people = participantNames(ctx)
      const lines = [
        `SESSION ${i + 1}: ${label}`,
        `  recorded_at: ${when}`,
        `  type: ${s.recording_type || s.input_hint || 'unknown'} | language: ${s.language || 'unknown'}`,
        purpose ? `  purpose: ${purpose}` : '',
        people.length ? `  participants mentioned: ${people.join(', ')}` : '',
        bullets.length ? `  summary:\n${bullets.map((b) => `    - ${b}`).join('\n')}` : '',
      ].filter(Boolean)
      return lines.join('\n')
    })
    .join('\n\n')

  const eventBlock = eventMetadata
    ? `CONFIRMED EVENT IDENTITY (authoritative — prefer this over anything inferred from a single talk):
- Event: ${eventMetadata.event_name || 'unknown'}
- Venue: ${eventMetadata.venue || 'unknown'}${eventMetadata.address ? `, ${eventMetadata.address}` : ''}
- Dates: ${eventMetadata.dates || 'unknown'}
- Official speakers: ${(eventMetadata.official_speakers || []).slice(0, 60).join(', ') || '(none listed)'}
${eventMetadata.source_url ? `- Source: ${eventMetadata.source_url}` : ''}

Use the official speaker roster to correct and de-duplicate presenter names
(e.g. a misheard "Felix Schmidt" should match the roster's "Felix Schlenther").`
    : 'No confirmed event identity is available. Work from the recordings alone.'

  const system = `You are producing a single Event digest for a user who attended an event and recorded multiple talks/conversations there. This is a project of type "Event".

Synthesize ACROSS all the recordings into one concise, exportable digest with these sections:
- key_takeaways: the most important things learned across the whole event (not a per-talk list).
- presenters: the people who SPOKE or PRESENTED in the recorded talks, each with an affiliation and a one-line note on their topic. Pull the affiliation from the session title when present — titles are often written as "Speaker Name, Affiliation — Talk Title" or "Speaker Name - Company" (for example "Matt Golubovic - Omnius" means affiliation "Omnius"; "Felix Schlenther Founder, AI First — ..." means affiliation "Founder, AI First"). Correct names against the official roster when provided.
- people_met: individuals the attendee personally MET or spoke with in conversation/networking (hallway, booth, dinner, a one-on-one chat) who were NOT presenting on stage. Do NOT repeat stage presenters here. If a follow-up action is to contact someone the attendee met in conversation, that person belongs here. If no such people can be identified, return an empty array — do not pad it with presenters.
- follow_ups: concrete next actions the attendee should take (people to contact, things to evaluate, materials to request).

Names at an event are best-effort (extracted from spoken content and session titles); omit anyone you are unsure even exists.

Write in ${language === 'de' ? 'German' : 'English'}. Use professional judgment on length — match substance, do not pad. Do not invent facts not supported by the recordings or the confirmed event identity.

Respond with ONLY a JSON object of this exact shape:
{
  "event_name": string,
  "key_takeaways": string[],
  "presenters": [ { "name": string, "affiliation": string, "note": string } ],
  "people_met": [ { "name": string, "affiliation": string, "note": string } ],
  "follow_ups": string[],
  "narrative": string
}`

  const user = `${eventBlock}

PROJECT: ${projectTitle}

RECORDINGS (deduplicated, in event order):

${sessionBlocks || '(no recordings)'}`

  return { system, user }
}

function sanitizeContent(parsed: any, language: string): EventDigestContent {
  const takeaways: string[] = Array.isArray(parsed?.key_takeaways)
    ? parsed.key_takeaways.map((x: any) => String(x || '').trim()).filter(Boolean).slice(0, 30)
    : []
  const followUps: string[] = Array.isArray(parsed?.follow_ups)
    ? parsed.follow_ups.map((x: any) => String(x || '').trim()).filter(Boolean).slice(0, 30)
    : []
  const toPeople = (raw: any) =>
    Array.isArray(raw)
      ? raw
          .map((p: any) => ({
            name: String(p?.name || '').trim(),
            affiliation: String(p?.affiliation || '').trim() || undefined,
            note: String(p?.note || '').trim() || undefined,
          }))
          .filter((p: any) => Boolean(p.name))
          .slice(0, 60)
      : []

  const presenters = toPeople(parsed?.presenters)
  const people = toPeople(parsed?.people_met)

  return {
    event_name: String(parsed?.event_name || '').trim() || undefined,
    key_takeaways: takeaways,
    presenters,
    people_met: people,
    follow_ups: followUps,
    narrative: String(parsed?.narrative || '').trim() || undefined,
    language,
  }
}

export interface GenerateEventDigestResult {
  content: EventDigestContent
  sourceSessionIds: string[]
  version: number
}

export async function generateEventDigest(input: {
  supabase: SupabaseClient
  caseId: string
}): Promise<GenerateEventDigestResult> {
  const { supabase, caseId } = input

  if (!anthropic) {
    throw new Error('ANTHROPIC_API_KEY is not configured')
  }

  const { data: caseRow, error: caseError } = await supabase
    .from('cases')
    .select('id, user_id, title, project_type, event_metadata')
    .eq('id', caseId)
    .single()

  if (caseError || !caseRow) throw new Error('Project not found')

  const { data: sessionsRaw, error: sessionsError } = await supabase
    .from('sessions')
    .select('id, internal_case_id, recorded_at, created_at, duration_sec, input_hint, recording_type, language, speechmatics_summary, purpose, ai_extracted_context')
    .eq('case_id', caseId)
  if (sessionsError) throw sessionsError

  const sessionIds = (sessionsRaw || []).map((s: any) => s.id)
  const { data: files } = sessionIds.length
    ? await supabase.from('files').select('session_id, original_filename').in('session_id', sessionIds)
    : { data: [] as any[] }
  const filenameBySession = new Map<string, string>()
  for (const f of files || []) {
    const sid = (f as any).session_id as string
    const name = ((f as any).original_filename as string | null) || ''
    if (name && !filenameBySession.has(sid)) filenameBySession.set(sid, name)
  }

  const rows: EventSessionRow[] = (sessionsRaw || []).map((s: any) => ({
    id: s.id,
    internal_case_id: s.internal_case_id ?? null,
    recorded_at: s.recorded_at ?? null,
    created_at: s.created_at,
    duration_sec: s.duration_sec ?? null,
    input_hint: s.input_hint ?? null,
    recording_type: s.recording_type ?? null,
    original_filename: filenameBySession.get(s.id) ?? null,
    language: s.language ?? null,
    speechmatics_summary: s.speechmatics_summary ?? null,
    purpose: s.purpose ?? null,
    ai_extracted_context: (s.ai_extracted_context as Record<string, any> | null) ?? null,
  }))

  const ordered = dedupeAndOrder(rows)
  if (ordered.length === 0) {
    throw new Error('This project has no sessions to summarize yet.')
  }

  const signals = buildEventSignals(ordered)

  const { data: ownerProfile } = await supabase
    .from('profiles')
    .select('preferred_report_language, preferred_locale')
    .eq('id', caseRow.user_id)
    .maybeSingle()

  // Prefer the owner's report language; otherwise the dominant recording language.
  const dominantSessionLanguage = signals.languages[0] || 'en'
  const language =
    normalizeLanguageCode(
      (ownerProfile as any)?.preferred_report_language || (ownerProfile as any)?.preferred_locale
    ) || normalizeLanguageCode(dominantSessionLanguage) || 'en'

  const { system, user } = buildPrompt({
    sessions: ordered,
    eventMetadata: (caseRow.event_metadata as EventMetadata | null) || null,
    projectTitle: String(caseRow.title || 'Event'),
    language,
  })

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4000,
    system,
    messages: [{ role: 'user', content: user }, JSON_PREFILL],
  })

  const usage = (message as { usage?: { input_tokens?: number; output_tokens?: number } }).usage
  if (usage?.input_tokens != null || usage?.output_tokens != null) {
    recordAiTokens(supabase, caseRow.user_id, usage.input_tokens ?? 0, usage.output_tokens ?? 0, {
      endpoint: 'event_digest',
    })
  }

  const text = message.content
    .filter((b) => b.type === 'text')
    .map((b) => ('text' in b ? b.text : ''))
    .join('\n')
  const parsed = (() => {
    const t = withJsonPrefill(text)
    try {
      return JSON.parse(t)
    } catch {
      const m = t.match(/\{[\s\S]*\}/)
      if (!m) throw new Error('Digest response is not valid JSON')
      return JSON.parse(m[0])
    }
  })()

  const content = sanitizeContent(parsed, language)
  const sourceSessionIds = ordered.map((s) => s.id)

  // Next version = current max + 1.
  const { data: latest } = await supabase
    .from('event_digests')
    .select('version')
    .eq('case_id', caseId)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle()
  const version = ((latest as any)?.version || 0) + 1

  const { error: insertError } = await supabase.from('event_digests').insert({
    case_id: caseId,
    content,
    source_session_ids: sourceSessionIds,
    version,
  })
  if (insertError) throw insertError

  return { content, sourceSessionIds, version }
}
