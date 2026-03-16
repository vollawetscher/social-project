/**
 * Merge multiple transcript rows (one per file) into a single transcript object.
 * Used when a session has multiple audio files.
 */
export function mergeTranscripts(transcripts: any[]): any {
  if (transcripts.length === 0) return null
  if (transcripts.length === 1) return transcripts[0]

  let timeOffset = 0
  const mergedRawJson: any[] = []
  const mergedRedactedJson: any[] = []
  const rawTextParts: string[] = []
  const redactedTextParts: string[] = []
  const asSegmentArray = (value: unknown): { start_ms?: number; end_ms?: number; [k: string]: any }[] =>
    Array.isArray(value) ? (value as { start_ms?: number; end_ms?: number; [k: string]: any }[]) : []

  for (const t of transcripts) {
    const segments = asSegmentArray(t.raw_json)
    const redactedSegments = asSegmentArray(t.redacted_json).length
      ? asSegmentArray(t.redacted_json)
      : segments
    for (const seg of segments) {
      mergedRawJson.push({
        ...seg,
        start_ms: (seg.start_ms ?? 0) + timeOffset,
        end_ms: (seg.end_ms ?? 0) + timeOffset,
      })
    }
    for (const seg of redactedSegments) {
      mergedRedactedJson.push({
        ...seg,
        start_ms: (seg.start_ms ?? 0) + timeOffset,
        end_ms: (seg.end_ms ?? 0) + timeOffset,
      })
    }
    rawTextParts.push(t.raw_text || '')
    redactedTextParts.push(t.redacted_text || t.raw_text || '')
    const lastSeg = segments[segments.length - 1]
    timeOffset += lastSeg?.end_ms ?? 0
  }

  return {
    ...transcripts[0],
    id: transcripts[0].id,
    raw_json: mergedRawJson,
    redacted_json: mergedRedactedJson,
    raw_text: rawTextParts.filter(Boolean).join('\n\n'),
    redacted_text: redactedTextParts.filter(Boolean).join('\n\n'),
  }
}
