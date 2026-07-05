// Resolve a public event's identity (name, venue, dates, speaker roster) from
// the signals a project already carries: speaker/company labels, the recording
// date, and the user's own project title. This is a public-web lookup — the same
// thing any attendee could Google — so it carries no private data beyond what
// was said on stage.
//
// Two engines, tried in order:
//   1. Perplexity Sonar (primary): one web-grounded call that does the search
//      reasoning for us and returns cited sources. This is the better fit for
//      "given these sparse signals, identify the one real event".
//   2. Firecrawl search + Claude extraction (fallback): used when Sonar is not
//      configured or returns nothing usable. Resilient to a single vendor being
//      down or unkeyed.

import Anthropic from '@anthropic-ai/sdk'
import { JSON_PREFILL, withJsonPrefill } from '@/lib/utils/claude-json'
import { buildEventSignals, type EventSessionRow, type EventSignals } from '@/lib/services/event/event-signals'

const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null

const FIRECRAWL_SEARCH_URL = 'https://api.firecrawl.dev/v1/search'
const PERPLEXITY_CHAT_URL = 'https://api.perplexity.ai/chat/completions'
const PERPLEXITY_MODEL = 'sonar'

// Below this, a proposal is treated as "not good enough" and we try the next
// engine before giving up.
const MIN_USABLE_CONFIDENCE = 0.4

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

export interface EnrichEventOptions {
  // The user's own project title, e.g. "Accelerate AI Tomorrow 2026". Often the
  // single strongest search seed, so we use it when present.
  projectTitle?: string | null
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

// "2026-06-02T08:15:00Z" -> "2 June 2026". The day+month+year string is the
// distinctive signal that makes an event findable (a speaker name alone is not).
function formatReadableDate(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const day = d.getUTCDate()
  const month = d.toLocaleString('en-US', { month: 'long', timeZone: 'UTC' })
  return `${day} ${month} ${d.getUTCFullYear()}`
}

// Is a project title a real, user-given event name (worth searching) rather than
// our auto-generated placeholder like "Event · 02 June 2026"?
function usableTitle(title?: string | null): string {
  const t = String(title || '').trim()
  if (!t) return ''
  if (/^event\s*[·\-—]/i.test(t)) return ''
  return t
}

function shapeProposal(parsed: any, fallbackSourceUrl: string | null): EventEnrichmentProposal {
  const speakers: string[] = Array.isArray(parsed?.official_speakers)
    ? parsed.official_speakers.map((s: any) => String(s || '').trim()).filter(Boolean).slice(0, 60)
    : []
  const confidence = Number(parsed?.confidence)
  const sourceUrl = parsed?.source_url ? String(parsed.source_url).trim() : null

  return {
    event_name: String(parsed?.event_name || '').trim(),
    venue: String(parsed?.venue || '').trim(),
    address: String(parsed?.address || '').trim(),
    dates: String(parsed?.dates || '').trim(),
    official_speakers: speakers,
    agenda_url: parsed?.agenda_url ? String(parsed.agenda_url).trim() : null,
    source_url: sourceUrl || fallbackSourceUrl,
    confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : 0.5,
    rationale: String(parsed?.rationale || '').trim(),
  }
}

function isUsable(p: EventEnrichmentProposal | null): boolean {
  return Boolean(p && p.event_name && p.confidence >= MIN_USABLE_CONFIDENCE)
}

// Keep whichever proposal is more confident (a named-event guess always beats
// nothing). Used to retain the best low-confidence result across engines.
function pickBetter(
  current: EventEnrichmentProposal | null,
  candidate: EventEnrichmentProposal | null
): EventEnrichmentProposal | null {
  if (!candidate) return current
  if (!current) return candidate
  return candidate.confidence > current.confidence ? candidate : current
}

// Ordered list of search queries to try, strongest first. The key change from
// the original (which sent "<one label> <year> conference summit event speakers")
// is that we lead with the user's title and pair a speaker name with the EXACT
// date — the same query that surfaces the event in a plain web search — and we
// drop the generic filler words that dragged results toward listicles.
function buildSearchQueries(signals: EventSignals, projectTitle?: string | null): string[] {
  const title = usableTitle(projectTitle)
  const readableDate = formatReadableDate(signals.dateFrom)
  const topSpeaker = signals.participantNames[0] || signals.titleLabels[0] || ''
  const secondSpeaker = signals.participantNames[1] || signals.titleLabels[1] || ''

  const queries: string[] = []
  if (title) queries.push(readableDate ? `${title} ${readableDate}` : title)
  if (topSpeaker && readableDate) queries.push(`${topSpeaker} ${readableDate}`)
  if (topSpeaker && secondSpeaker && signals.year) {
    queries.push(`${topSpeaker} ${secondSpeaker} ${signals.year} event speakers`)
  }
  if (title && topSpeaker) queries.push(`${title} ${topSpeaker}`)

  // De-dupe while preserving order; never return an empty list.
  const seen = new Set<string>()
  const ordered = queries
    .map((q) => q.trim())
    .filter((q) => q.length > 0 && !seen.has(q.toLowerCase()) && seen.add(q.toLowerCase()))
  return ordered.length > 0 ? ordered : [signals.titleLabels[0] || signals.participantNames[0] || ''].filter(Boolean)
}

function buildSignalsBlock(signals: EventSignals, projectTitle?: string | null): string {
  const title = usableTitle(projectTitle)
  const dateLine = signals.dateFrom
    ? formatReadableDate(signals.dateFrom) +
      (signals.dateTo && signals.dateTo.slice(0, 10) !== signals.dateFrom.slice(0, 10)
        ? ` (recordings span to ${formatReadableDate(signals.dateTo)})`
        : '')
    : '(unknown)'

  return [
    title ? `- Project title given by the attendee: ${title}` : '',
    `- Speaker/company labels from the recordings: ${signals.titleLabels.join(' | ') || '(none)'}`,
    `- Participant names heard: ${signals.participantNames.join(', ') || '(none)'}`,
    `- Recording date: ${dateLine}`,
    `- Languages heard: ${signals.languages.join(', ') || '(unknown)'}`,
  ]
    .filter(Boolean)
    .join('\n')
}

const RESPONSE_SHAPE = `{
  "event_name": string,            // official event name, "" if unknown
  "venue": string,                 // venue name, "" if unknown
  "address": string,               // full street address, "" if unknown
  "dates": string,                 // human-readable dates, "" if unknown
  "official_speakers": string[],   // names from the official roster
  "agenda_url": string|null,       // URL to the program/agenda if known
  "source_url": string|null,       // the page you based this on
  "confidence": number,            // 0..1, how sure you are this is the right event
  "rationale": string              // one sentence: why this event matches the signals
}`

// ---------------------------------------------------------------------------
// Engine 1: Perplexity Sonar (primary)
// ---------------------------------------------------------------------------

async function enrichWithPerplexity(
  signals: EventSignals,
  apiKey: string,
  projectTitle?: string | null
): Promise<EventEnrichmentProposal | null> {
  const system = `You identify a single real-world public event from sparse signals an attendee captured (speaker names, a recording date, sometimes the event's name). Search the web, determine which one public event these recordings came from, and report its verified details. Only state facts you found on the web — never invent a venue, address, or speaker. If you cannot confidently identify one event, return an empty event_name and a low confidence.

Respond with ONLY a JSON object of this exact shape (no prose, no code fences):
${RESPONSE_SHAPE}`

  const user = `IDENTITY SIGNALS\n${buildSignalsBlock(signals, projectTitle)}\n\nIdentify the event and return the JSON object.`

  const res = await fetch(PERPLEXITY_CHAT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: PERPLEXITY_MODEL,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.1,
      max_tokens: 1200,
    }),
  })

  if (!res.ok) {
    throw new Error(`Perplexity search failed (${res.status})`)
  }

  const json = await res.json().catch(() => ({} as any))
  const content = String(json?.choices?.[0]?.message?.content || '').trim()
  if (!content) return null

  // Per Perplexity guidance, model-emitted URLs are unreliable; prefer the
  // grounded citations/search_results from the response metadata.
  const citationUrl: string | null =
    (Array.isArray(json?.search_results) && json.search_results[0]?.url
      ? String(json.search_results[0].url)
      : Array.isArray(json?.citations) && json.citations[0]
        ? String(json.citations[0])
        : null) || null

  let parsed: any
  try {
    parsed = parseJson(content)
  } catch {
    return null
  }
  return shapeProposal(parsed, citationUrl)
}

// ---------------------------------------------------------------------------
// Engine 2: Firecrawl search + Claude extraction (fallback)
// ---------------------------------------------------------------------------

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
  projectTitle?: string | null
}): { system: string; user: string } {
  const { signals, results, projectTitle } = input

  const resultsBlock = results
    .map((r, i) => {
      const md = r.markdown ? r.markdown.slice(0, 3500) : ''
      return `RESULT ${i + 1}\nURL: ${r.url}\nTITLE: ${r.title}\nDESCRIPTION: ${r.description}\nCONTENT:\n${md}`
    })
    .join('\n\n---\n\n')

  const system = `You identify a real-world event from web search results.

The user recorded several talks/conversations at one event. You are given identity
signals (a project title, speaker/company labels, and the recording date) and web
search results. Determine which single public event these recordings came from, and
extract its verified details. Only use facts present in the search results — never
invent a venue, address, or speaker. If the results do not clearly identify one
event, return low confidence and leave unknown fields empty.

Respond with ONLY a JSON object of this exact shape:
${RESPONSE_SHAPE}`

  const user = `IDENTITY SIGNALS\n${buildSignalsBlock(signals, projectTitle)}\n\nWEB SEARCH RESULTS\n${resultsBlock || '(no results)'}`

  return { system, user }
}

async function enrichWithFirecrawl(
  signals: EventSignals,
  apiKey: string,
  projectTitle?: string | null
): Promise<EventEnrichmentProposal | null> {
  if (!anthropic) {
    throw new Error('ANTHROPIC_API_KEY is not configured')
  }

  // Try queries strongest-first until one returns results.
  const queries = buildSearchQueries(signals, projectTitle)
  let results: FirecrawlResult[] = []
  for (const query of queries) {
    results = await firecrawlSearch(query, apiKey)
    if (results.length > 0) break
  }

  const { system, user } = buildExtractionPrompt({ signals, results, projectTitle })
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1500,
    system,
    messages: [{ role: 'user', content: user }, JSON_PREFILL],
  })

  const text = message.content
    .filter((b) => b.type === 'text')
    .map((b) => ('text' in b ? b.text : ''))
    .join('\n')
  const parsed = parseJson(withJsonPrefill(text))
  const topSource = results[0]?.url || null
  return shapeProposal(parsed, topSource)
}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------

export async function enrichEvent(
  sessions: EventSessionRow[],
  options: EnrichEventOptions = {}
): Promise<EventEnrichmentProposal> {
  const perplexityKey = process.env.PERPLEXITY_API_KEY
  const firecrawlKey = process.env.FIRECRAWL_API_KEY
  const projectTitle = options.projectTitle ?? null

  if (!perplexityKey && !firecrawlKey) {
    throw new Error('Web lookup is not configured (set PERPLEXITY_API_KEY or FIRECRAWL_API_KEY)')
  }

  const signals = buildEventSignals(sessions)
  if (
    signals.titleLabels.length === 0 &&
    signals.participantNames.length === 0 &&
    !usableTitle(projectTitle)
  ) {
    throw new Error(
      'Not enough identity signals to look up this event. Add a speaker or company name to a session title, or rename the project to the event name.'
    )
  }

  let best: EventEnrichmentProposal | null = null
  const errors: string[] = []

  // Engine 1: Perplexity Sonar.
  if (perplexityKey) {
    try {
      const proposal = await enrichWithPerplexity(signals, perplexityKey, projectTitle)
      if (proposal && isUsable(proposal)) return proposal
      best = pickBetter(best, proposal)
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err))
    }
  }

  // Engine 2: Firecrawl + Claude fallback.
  if (firecrawlKey) {
    try {
      const proposal = await enrichWithFirecrawl(signals, firecrawlKey, projectTitle)
      if (proposal && isUsable(proposal)) return proposal
      best = pickBetter(best, proposal)
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err))
    }
  }

  // Nothing crossed the confidence bar. Return the best low-confidence guess so
  // the user can correct it, or surface the errors if every engine threw.
  if (best) return best
  throw new Error(
    errors.length > 0 ? `Event lookup failed: ${errors.join('; ')}` : 'Event lookup returned no usable result.'
  )
}
