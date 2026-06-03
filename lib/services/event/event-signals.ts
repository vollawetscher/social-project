// Shared helpers for turning a project's sessions into the identity signals an
// Event needs: the recording date range, the recordings in true chronological
// order, and the speaker/company labels that make a web lookup possible.

import { dedupeSessions, type ClusterableSession } from '@/lib/services/event/event-clustering'

export interface EventSessionRow extends ClusterableSession {
  language: string | null
  speechmatics_summary: string | null
  purpose: string | null
  ai_extracted_context: Record<string, any> | null
}

export interface EventSignals {
  dateFrom: string | null
  dateTo: string | null
  year: number | null
  // Best human-written titles (speaker / company labels), raw recorder names excluded.
  titleLabels: string[]
  // Names pulled from analyze participants across sessions.
  participantNames: string[]
  languages: string[]
  sessionCount: number
}

function isRawRecorderName(title: string): boolean {
  return /^rec\d+$/i.test(title.replace(/\.[a-z0-9]+$/i, '').trim())
}

// The part of a session title that names the person/company, dropping the talk
// title after a dash, e.g. "Till Behnke, Rulemapping - Beyond the Black Box"
// -> "Till Behnke, Rulemapping".
export function titleToIdentityLabel(title: string): string {
  const cleaned = String(title || '').trim()
  if (!cleaned || isRawRecorderName(cleaned)) return ''
  const beforeDash = cleaned.split(/\s+[-–—]\s+/)[0]?.trim() || cleaned
  return beforeDash
}

function extractParticipantNames(ctx: Record<string, any> | null): string[] {
  const participants = Array.isArray(ctx?.participants) ? ctx!.participants : []
  return participants
    .map((p: any) => (typeof p === 'string' ? p : String(p?.name || '')))
    .map((v: string) => v.trim())
    .filter(Boolean)
}

export function buildEventSignals(sessions: EventSessionRow[]): EventSignals {
  const dates = sessions
    .map((s) => s.recorded_at)
    .filter((d): d is string => Boolean(d))
    .map((d) => new Date(d).getTime())
    .filter((t) => !Number.isNaN(t))
    .sort((a, b) => a - b)

  const dateFrom = dates.length > 0 ? new Date(dates[0]).toISOString() : null
  const dateTo = dates.length > 0 ? new Date(dates[dates.length - 1]).toISOString() : null
  const year = dateFrom ? new Date(dateFrom).getUTCFullYear() : null

  const titleLabels = Array.from(
    new Set(
      sessions
        .map((s) => titleToIdentityLabel(s.internal_case_id || ''))
        .filter(Boolean)
    )
  ).slice(0, 8)

  const participantNames = Array.from(
    new Set(sessions.flatMap((s) => extractParticipantNames(s.ai_extracted_context)))
  ).slice(0, 20)

  const languages = Array.from(
    new Set(sessions.map((s) => (s.language || '').trim()).filter(Boolean))
  )

  return {
    dateFrom,
    dateTo,
    year,
    titleLabels,
    participantNames,
    languages,
    sessionCount: sessions.length,
  }
}

// Dedupe + order sessions by recorded_at (true event timeline), so both digest
// and enrichment operate on each physical recording exactly once.
export function dedupeAndOrder(sessions: EventSessionRow[]): EventSessionRow[] {
  const { kept } = dedupeSessions(sessions)
  const keptIds = new Set(kept.map((s) => s.id))
  return sessions
    .filter((s) => keptIds.has(s.id))
    .sort((a, b) => {
      const at = a.recorded_at ? new Date(a.recorded_at).getTime() : new Date(a.created_at).getTime()
      const bt = b.recorded_at ? new Date(b.recorded_at).getTime() : new Date(b.created_at).getTime()
      return at - bt
    })
}
