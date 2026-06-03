// Pure, testable helpers for Event auto-grouping.
//
// Two problems they solve, both observed in real upload data:
//   1. The same physical recording gets uploaded twice (once with the raw
//      recorder name, once after the user renames the session). These must be
//      collapsed before anything counts or synthesizes them.
//   2. Upload order is scrambled; recorded_at (from file metadata) is the true
//      event timeline and the basis for grouping same-day recordings.

export interface ClusterableSession {
  id: string
  internal_case_id: string | null
  recorded_at: string | null
  created_at: string
  duration_sec: number | null
  input_hint: string | null
  recording_type: string | null
  original_filename: string | null
}

export interface EventCluster {
  signature: string
  date: string // YYYY-MM-DD (local to the recordings)
  sessionIds: string[] // deduped members, ordered by recorded_at
  duplicateSessionIds: string[] // dropped as duplicates of a kept member
  count: number // deduped member count
  sampleTitles: string[]
}

// Recording kinds that plausibly belong to a single event (a day of talks,
// booth conversations, etc.). Deliberately broad — the user confirms or
// dismisses each suggestion, so over-inclusion is cheap and under-inclusion is
// the real failure.
const EVENT_LIKE_INPUT_HINTS = new Set([
  'audio_upload',
  'trade_show',
  'presentation',
  'meeting',
])

const EVENT_LIKE_RECORDING_TYPES = new Set([
  'presentation',
  'lecture',
  'meeting',
  'consultation',
  'interview',
  'other',
])

export const MIN_CLUSTER_SIZE = 3

function isEventLike(session: ClusterableSession): boolean {
  const hint = (session.input_hint || '').trim()
  const recType = (session.recording_type || '').trim()
  return EVENT_LIKE_INPUT_HINTS.has(hint) || EVENT_LIKE_RECORDING_TYPES.has(recType)
}

function localDate(session: ClusterableSession): string | null {
  const raw = session.recorded_at || null
  if (!raw) return null
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return null
  // Group by the calendar date of the recording. recorded_at is stored UTC;
  // for the supported single-venue use case the event sits within one UTC day.
  return d.toISOString().slice(0, 10)
}

// A raw recorder name like "REC00037.WAV" or "REC00037". A human-given title
// like "Felix Schlenther - AI First" is strictly more useful, so we prefer it
// when collapsing duplicates.
function isRawRecorderName(title: string): boolean {
  return /^rec\d+$/i.test(title.replace(/\.[a-z0-9]+$/i, '').trim())
}

function dedupKey(session: ClusterableSession): string | null {
  const name = (session.original_filename || '').trim().toLowerCase()
  if (!name) return null
  return `${name}|${session.duration_sec ?? ''}|${session.recorded_at ?? ''}`
}

// Collapse sessions that point at the same physical recording. Keeps the member
// with the most useful title (human label over raw recorder name; otherwise the
// earliest-created). Returns kept sessions plus the ids that were dropped.
export function dedupeSessions(sessions: ClusterableSession[]): {
  kept: ClusterableSession[]
  duplicateIds: string[]
} {
  const groups = new Map<string, ClusterableSession[]>()
  const noKey: ClusterableSession[] = []

  for (const s of sessions) {
    const key = dedupKey(s)
    if (!key) {
      noKey.push(s)
      continue
    }
    const arr = groups.get(key) || []
    arr.push(s)
    groups.set(key, arr)
  }

  const kept: ClusterableSession[] = [...noKey]
  const duplicateIds: string[] = []

  for (const arr of Array.from(groups.values())) {
    if (arr.length === 1) {
      kept.push(arr[0])
      continue
    }
    const ranked = [...arr].sort((a, b) => {
      const aRaw = isRawRecorderName(a.internal_case_id || '') ? 1 : 0
      const bRaw = isRawRecorderName(b.internal_case_id || '') ? 1 : 0
      if (aRaw !== bRaw) return aRaw - bRaw // prefer non-raw titles
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    })
    kept.push(ranked[0])
    duplicateIds.push(...ranked.slice(1).map((s) => s.id))
  }

  return { kept, duplicateIds }
}

function buildSignature(date: string): string {
  // Date-only signature keeps a dismissal stable even if more recordings from
  // the same day are added later (we don't want to re-nag for the same event).
  return `event-cluster:${date}`
}

// Group ungrouped, event-like sessions by recording date, after deduplication.
// Only clusters with at least MIN_CLUSTER_SIZE deduped members are returned.
export function clusterSessions(sessions: ClusterableSession[]): EventCluster[] {
  const eventLike = sessions.filter(isEventLike).filter((s) => localDate(s) !== null)

  const byDate = new Map<string, ClusterableSession[]>()
  for (const s of eventLike) {
    const date = localDate(s) as string
    const arr = byDate.get(date) || []
    arr.push(s)
    byDate.set(date, arr)
  }

  const clusters: EventCluster[] = []
  for (const [date, group] of Array.from(byDate.entries())) {
    const { kept, duplicateIds } = dedupeSessions(group)
    if (kept.length < MIN_CLUSTER_SIZE) continue

    const ordered = [...kept].sort((a, b) => {
      const at = a.recorded_at ? new Date(a.recorded_at).getTime() : 0
      const bt = b.recorded_at ? new Date(b.recorded_at).getTime() : 0
      return at - bt
    })

    const sampleTitles = ordered
      .map((s) => (s.internal_case_id || '').trim())
      .filter((t) => t && !isRawRecorderName(t))
      .slice(0, 4)

    clusters.push({
      signature: buildSignature(date),
      date,
      sessionIds: ordered.map((s) => s.id),
      duplicateSessionIds: duplicateIds,
      count: ordered.length,
      sampleTitles,
    })
  }

  // Most recent events first.
  clusters.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
  return clusters
}
