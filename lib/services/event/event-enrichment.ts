// Resolve a public event's identity (name, venue, dates, speaker roster) from
// the signals a project already carries: a speaker/company label plus the
// recording date. This is a public-web lookup — the same thing any attendee
// could Google — so it carries no private data beyond what was said on stage.

import Anthropic from '@anthropic-ai/sdk'
import { JSON_PREFILL, withJsonPrefill } from '@/lib/utils/claude-json'
import { buildEventSignals, type EventSessionRow, type EventSignals } from '@/lib/services/event/event-signals'

const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null

const FIRECRAWL_SEARCH_URL = 'https://api.firecrawl.dev/v1/search'

export interface EventEnrichmentProposal {
  event_name: string
  venue: string
  address: string
  dates: string
  official_speakers: string[]
  agenda_url: string | null
  source_url: string | null
  confidence: number
  rationale: string
}

interface FirecrawlResult {
  url: string
  title: string
  description: string
  markdown: string
}

function parseJson(raw: string): any {
  const text = String(raw || '').trim()
  if (!text) throw new Error('Empty model response')
  let candidate = text
  if (candidate.startsWith('```')) {
    const match = candidate.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
    if (match?.[1]) candidate = match[1].trim()
  }
  try {
    return JSON.parse(candidate)
  } catch {
    const fallback = candidate.match(/\{[\s\S]*\}/)
    if (!fallback) throw new Error('Model response is not valid JSON')
    return JSON.parse(fallback[0])
  }
}

function buildSearchQuery(signals: EventSignals): string {
  const label = signals.titleLabels[0] || signals.participantNames[0] || ''
  const yearPart = signals.year ? String(signals.year) : ''
  const parts = [label, yearPart, 'conference summit event speakers'].filter(Boolean)
  return parts.join(' ').trim()
}

async function firecrawlSearch(query: string, apiKey: string): Promise<FirecrawlResult[]> {
  const res = await fetch(FIRECRAWL_SEARCH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      query,
      limit: 5,
      scrapeOptions: { formats: ['markdown'] },
    }),
  })

  if (!res.ok) {
    throw new Error(`Firecrawl search failed (${res.status})`)
  }

  const json = await res.json().catch(() => ({}))
  // The search API has returned both a flat array and a categorized object
  // across versions; accept either shape.
  const rawList: any[] = Array.isArray(json?.data)
    ? json.data
    : Array.isArray(json?.data?.web)
      ? json.data.web
      : []

  return rawList.map((r: any) => ({
    url: String(r?.url || ''),
    title: String(r?.title || ''),
    description: String(r?.description || ''),
    markdown: String(r?.markdown || ''),
  }))
}

function buildExtractionPrompt(input: {
  signals: EventSignals
  results: FirecrawlResult[]
}): { system: string; user: string } {
  const { signals, results } = input

  const resultsBlock = results
    .map((r, i) => {
      const md = r.markdown ? r.markdown.slice(0, 3500) : ''
      return `RESULT ${i + 1}
URL: ${r.url}
TITLE: ${r.title}
DESCRIPTION: ${r.description}
CONTENT:
${md}`
    })
    .join('\n\n---\n\n')

  const system = `You identify a real-world event from web search results.

The user recorded several talks/conversations at one event. You are given identity
signals (speaker/company labels and the recording date) and web search results.
Determine which single public event these recordings came from, and extract its
verified details. Only use facts present in the search results — never invent a
venue, address, or speaker. If the results do not clearly identify one event,
return low confidence and leave unknown fields empty.

Respond with ONLY a JSON object of this exact shape:
{
  "event_name": string,            // official event name, "" if unknown
  "venue": string,                 // venue name, "" if unknown
  "address": string,               // full street address, "" if unknown
  "dates": string,                 // human-readable dates, "" if unknown
  "official_speakers": string[],   // names from the official roster found in results
  "agenda_url": string|null,       // URL to the program/agenda if present
  "source_url": string|null,       // the result URL you based this on
  "confidence": number,            // 0..1, how sure you are this is the right event
  "rationale": string              // one sentence: why this event matches the signals
}`

  const user = `IDENTITY SIGNALS
- Speaker/company labels: ${signals.titleLabels.join(' | ') || '(none)'}
- Participant names: ${signals.participantNames.join(', ') || '(none)'}
- Recording date(s): ${signals.dateFrom ? signals.dateFrom.slice(0, 10) : '(unknown)'}${
    signals.dateTo && signals.dateTo.slice(0, 10) !== signals.dateFrom?.slice(0, 10)
      ? ` to ${signals.dateTo.slice(0, 10)}`
      : ''
  }
- Languages heard: ${signals.languages.join(', ') || '(unknown)'}

WEB SEARCH RESULTS
${resultsBlock || '(no results)'}`

  return { system, user }
}

export async function enrichEvent(sessions: EventSessionRow[]): Promise<EventEnrichmentProposal> {
  const apiKey = process.env.FIRECRAWL_API_KEY
  if (!apiKey) {
    throw new Error('Web lookup is not configured (FIRECRAWL_API_KEY missing)')
  }
  if (!anthropic) {
    throw new Error('ANTHROPIC_API_KEY is not configured')
  }

  const signals = buildEventSignals(sessions)
  if (signals.titleLabels.length === 0 && signals.participantNames.length === 0) {
    throw new Error('Not enough identity signals to look up this event. Add a speaker or company name to a session title.')
  }

  const query = buildSearchQuery(signals)
  const results = await firecrawlSearch(query, apiKey)

  const { system, user } = buildExtractionPrompt({ signals, results })
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 1500,
    system,
    messages: [{ role: 'user', content: user }, JSON_PREFILL],
  })

  const text = message.content
    .filter((b) => b.type === 'text')
    .map((b) => ('text' in b ? b.text : ''))
    .join('\n')
  const parsed = parseJson(withJsonPrefill(text))

  const speakers: string[] = Array.isArray(parsed?.official_speakers)
    ? parsed.official_speakers.map((s: any) => String(s || '').trim()).filter(Boolean).slice(0, 60)
    : []
  const confidence = Number(parsed?.confidence)

  return {
    event_name: String(parsed?.event_name || '').trim(),
    venue: String(parsed?.venue || '').trim(),
    address: String(parsed?.address || '').trim(),
    dates: String(parsed?.dates || '').trim(),
    official_speakers: speakers,
    agenda_url: parsed?.agenda_url ? String(parsed.agenda_url).trim() : null,
    source_url: parsed?.source_url ? String(parsed.source_url).trim() : null,
    confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : 0.5,
    rationale: String(parsed?.rationale || '').trim(),
  }
}
