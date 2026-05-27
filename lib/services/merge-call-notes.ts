import type { TranscriptSegment } from '@/lib/types/database'

export const CALL_NOTE_SPEAKER_ID = '__in_call_note__'

export interface TimedCallNote {
  id: string
  text: string
  /** Milliseconds after call.started_at (when recording begins). */
  start_ms: number
  author_name?: string
  created_at: string
}

export interface CallNoteTimingContext {
  room_created_at_ms?: number | null
  started_at?: string | null
  track_a_started_at_ns?: number | null
}

export function parseTimedCallNotes(value: unknown): TimedCallNote[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((entry): TimedCallNote[] => {
    if (!entry || typeof entry !== 'object') return []
    const text = String((entry as TimedCallNote).text || '').trim()
    const start_ms = Number((entry as TimedCallNote).start_ms)
    const id = String((entry as TimedCallNote).id || '').trim()
    if (!text || !id || !Number.isFinite(start_ms) || start_ms < 0) return []
    return [{
      id,
      text,
      start_ms: Math.round(start_ms),
      author_name: (entry as TimedCallNote).author_name
        ? String((entry as TimedCallNote).author_name)
        : undefined,
      created_at: String((entry as TimedCallNote).created_at || new Date().toISOString()),
    }]
  })
}

/** True for merged in-call notes (current and legacy speaker labels). */
export function isCallNoteSegment(segment: {
  is_call_note?: boolean
  speaker?: string
}): boolean {
  if (segment?.is_call_note) return true
  const speaker = String(segment?.speaker || '')
  return speaker === CALL_NOTE_SPEAKER_ID || /^Note(\s|\(|$)/i.test(speaker)
}

export function getCallNoteAuthor(segment: {
  author_name?: string
  speaker?: string
}): string | undefined {
  if (segment?.author_name?.trim()) return segment.author_name.trim()
  const speaker = String(segment?.speaker || '')
  const parenMatch = speaker.match(/^Note\s*\(([^)]+)\)$/i)
  if (parenMatch?.[1]) return parenMatch[1].trim()
  return undefined
}

export function formatCallNoteTranscriptLine(
  authorName: string | undefined,
  text: string
): string {
  const by = authorName?.trim() || 'session owner'
  return `[In-call note · typed by ${by}] ${text}`
}

function noteSegmentDurationMs(text: string): number {
  const words = text.split(/\s+/).filter(Boolean).length
  return Math.max(1200, words * 350)
}

function resolveNoteStartMs(
  note: TimedCallNote,
  timing: CallNoteTimingContext,
  timeline: 'recording' | 'room_aligned'
): number {
  if (timeline === 'recording') {
    return note.start_ms
  }

  const roomCreatedAtMs = Number(timing.room_created_at_ms || 0)
  const startedAtMs = timing.started_at
    ? new Date(timing.started_at).getTime()
    : roomCreatedAtMs
  const recordingAnchorMs = Math.max(0, startedAtMs - roomCreatedAtMs)
  return recordingAnchorMs + note.start_ms
}

export function mergeTimedNotesIntoSegments(
  segments: TranscriptSegment[],
  notes: TimedCallNote[],
  opts: {
    timing: CallNoteTimingContext
    /** Composite single-file transcripts start at recording time 0. */
    timeline?: 'recording' | 'room_aligned'
    speakerLabel?: string
  }
): TranscriptSegment[] {
  if (!notes.length) return segments

  const timeline = opts.timeline || 'recording'
  const speechSegments = segments.filter((seg) => !isCallNoteSegment(seg as { is_call_note?: boolean; speaker?: string }))

  const noteSegments: TranscriptSegment[] = notes.map((note) => {
    const start_ms = resolveNoteStartMs(note, opts.timing, timeline)
    const duration = noteSegmentDurationMs(note.text)
    return {
      start_ms,
      end_ms: start_ms + duration,
      speaker: CALL_NOTE_SPEAKER_ID,
      text: note.text,
      is_call_note: true,
      author_name: note.author_name,
    } as TranscriptSegment & { is_call_note: boolean; author_name?: string }
  })

  const merged = [...speechSegments, ...noteSegments].sort((a, b) => {
    if (a.start_ms !== b.start_ms) return a.start_ms - b.start_ms
    if (isCallNoteSegment(a as { is_call_note?: boolean; speaker?: string }) &&
        !isCallNoteSegment(b as { is_call_note?: boolean; speaker?: string })) return 1
    if (!isCallNoteSegment(a as { is_call_note?: boolean; speaker?: string }) &&
        isCallNoteSegment(b as { is_call_note?: boolean; speaker?: string })) return -1
    return 0
  })

  return merged
}

export function segmentsToTranscriptText(segments: TranscriptSegment[]): string {
  return segments
    .map((seg) => {
      if (isCallNoteSegment(seg as { is_call_note?: boolean; speaker?: string; author_name?: string })) {
        return formatCallNoteTranscriptLine(
          getCallNoteAuthor(seg as { author_name?: string; speaker?: string }),
          seg.text
        )
      }
      return `${seg.speaker}: ${seg.text}`
    })
    .join('\n')
}

export function computeNoteStartMs(call: CallNoteTimingContext): number {
  const startedAtMs = call.started_at
    ? new Date(call.started_at).getTime()
    : Number(call.room_created_at_ms || Date.now())
  return Math.max(0, Date.now() - startedAtMs)
}

export async function applyTimedCallNotesToSessionTranscripts(
  supabase: {
    from: (table: string) => any
  },
  sessionId: string,
  call: CallNoteTimingContext & { timed_call_notes?: unknown },
  dualTrackMerged: boolean
): Promise<void> {
  const notes = parseTimedCallNotes(call.timed_call_notes)
  if (!notes.length) return

  const { data: transcripts, error } = await supabase
    .from('transcripts')
    .select('id, file_id, raw_json, redacted_json')
    .eq('session_id', sessionId)

  if (error || !transcripts?.length) return

  const timing: CallNoteTimingContext = {
    room_created_at_ms: call.room_created_at_ms,
    started_at: call.started_at,
    track_a_started_at_ns: call.track_a_started_at_ns,
  }

  for (const transcript of transcripts) {
    const rawSegments = Array.isArray(transcript.raw_json) ? transcript.raw_json : []
    const redactedSegments = Array.isArray(transcript.redacted_json) && transcript.redacted_json.length > 0
      ? transcript.redacted_json
      : rawSegments
    const timeline =
      dualTrackMerged && transcript.file_id === null ? 'room_aligned' : 'recording'

    const mergedRaw = mergeTimedNotesIntoSegments(rawSegments, notes, { timing, timeline })
    const mergedRedacted = mergeTimedNotesIntoSegments(redactedSegments, notes, { timing, timeline })

    await supabase
      .from('transcripts')
      .update({
        raw_json: mergedRaw,
        redacted_json: mergedRedacted,
        raw_text: segmentsToTranscriptText(mergedRaw),
        redacted_text: segmentsToTranscriptText(mergedRedacted),
      })
      .eq('id', transcript.id)
  }
}
