/**
 * Transcript alignment service.
 * 
 * When a call has two separate audio tracks recorded via LiveKit Track Egress,
 * each is transcribed independently by Speechmatics. This service merges
 * the two transcripts into a single time-aligned conversation by:
 * 
 * 1. Using the egress `started_at` nanosecond timestamps as the per-track T0
 * 2. Converting each transcript's relative timestamps to absolute wall-clock time
 * 3. Re-labeling speakers as "Participant A" / "Participant B" (or their actual names)
 * 4. Merging and sorting by absolute time
 * 5. Converting back to relative timestamps (ms from call start)
 */

import type { TranscriptSegment } from '@/lib/types/database'

export interface AlignmentInput {
  trackASegments: TranscriptSegment[]
  trackBSegments: TranscriptSegment[]
  trackAStartedAtNs: number
  trackBStartedAtNs: number
  roomCreatedAtMs: number
  participantAName?: string
  participantBName?: string
}

export interface AlignedTranscript {
  segments: TranscriptSegment[]
  fullText: string
  participantAName: string
  participantBName: string
}

/**
 * Merge two independently-transcribed audio tracks into one chronological transcript.
 * 
 * Each track's Speechmatics timestamps are relative to the start of that track's
 * recording. We offset them using the difference between the track's egress
 * `started_at` (absolute, nanoseconds) and the room's creation time.
 */
export function alignTranscripts(input: AlignmentInput): AlignedTranscript {
  const {
    trackASegments,
    trackBSegments,
    trackAStartedAtNs,
    trackBStartedAtNs,
    roomCreatedAtMs,
    participantAName = 'Participant A',
    participantBName = 'Participant B',
  } = input

  const roomCreatedAtNs = roomCreatedAtMs * 1_000_000

  // Offset in ms: how many ms after room creation each track recording started
  const trackAOffsetMs = Math.round((trackAStartedAtNs - roomCreatedAtNs) / 1_000_000)
  const trackBOffsetMs = Math.round((trackBStartedAtNs - roomCreatedAtNs) / 1_000_000)

  console.log(`[TranscriptAligner] Track A offset: ${trackAOffsetMs}ms, Track B offset: ${trackBOffsetMs}ms`)
  console.log(`[TranscriptAligner] Track A segments: ${trackASegments.length}, Track B segments: ${trackBSegments.length}`)

  // Re-label and offset Track A segments
  const alignedA: TranscriptSegment[] = trackASegments.map((seg) => ({
    ...seg,
    start_ms: seg.start_ms + trackAOffsetMs,
    end_ms: seg.end_ms + trackAOffsetMs,
    speaker: participantAName,
  }))

  // Re-label and offset Track B segments
  const alignedB: TranscriptSegment[] = trackBSegments.map((seg) => ({
    ...seg,
    start_ms: seg.start_ms + trackBOffsetMs,
    end_ms: seg.end_ms + trackBOffsetMs,
    speaker: participantBName,
  }))

  // Merge and sort chronologically
  const merged = [...alignedA, ...alignedB].sort((a, b) => a.start_ms - b.start_ms)

  // Ensure no negative timestamps (can happen if egress started before room_created_at)
  const minTime = Math.min(...merged.map((s) => s.start_ms))
  if (minTime < 0) {
    const shift = Math.abs(minTime)
    for (const seg of merged) {
      seg.start_ms += shift
      seg.end_ms += shift
    }
  }

  const fullText = merged
    .map((seg) => `${seg.speaker}: ${seg.text}`)
    .join('\n')

  console.log(`[TranscriptAligner] Merged transcript: ${merged.length} segments, ${fullText.length} chars`)

  return {
    segments: merged,
    fullText,
    participantAName,
    participantBName,
  }
}
