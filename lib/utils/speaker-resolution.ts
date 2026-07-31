/**
 * Canonical speaker-correction resolution shared across the pipeline.
 *
 * There is exactly ONE applied representation of speaker corrections:
 *   - `speaker_merge_map`        { fromLabel: toLabel }   — global label merges
 *   - `segment_speaker_overrides`{ segmentIndex: label }  — per-segment reattribution
 *
 * `speaker_merges` (array, produced by the analyzer) and the deterministic
 * cleanup suggestions are SUGGESTION sources only. They are promoted into
 * `speaker_merge_map` when accepted (via the cleanup UI, the review gate, or
 * the reconciliation step) — they are never applied implicitly.
 *
 * Analyze, output generation, the session adapter and the transcript viewer
 * must all resolve speakers through the helpers here so what Claude sees, what
 * the user sees, and what ends up in generated documents stay consistent.
 */

export function normalizeCorrectionMap(value: unknown): Record<string, string> {
  if (!value) return {}
  if (Array.isArray(value)) {
    const map: Record<string, string> = {}
    for (const item of value) {
      if (!item || typeof item !== 'object') continue
      const original = String((item as any).original ?? (item as any).from ?? '').trim()
      const corrected = String((item as any).corrected ?? (item as any).to ?? '').trim()
      if (original && corrected) map[original] = corrected
    }
    return map
  }
  if (typeof value !== 'object') return {}
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .map(([from, to]) => [String(from).trim(), String(to ?? '').trim()])
      .filter(([from, to]) => from && to)
  )
}

/** An acoustic diarization label, e.g. "S1", "S12" (case-insensitive). */
const ACOUSTIC_SPEAKER_LABEL = /^S\d+$/i

export function isAcousticSpeakerLabel(speaker: unknown): boolean {
  return typeof speaker === 'string' && ACOUSTIC_SPEAKER_LABEL.test(speaker.trim())
}

/**
 * The speaker-review gate exists for transcripts whose speaker identity was
 * *guessed* acoustically (S1, S2, …). Known/explicit speakers (imported labels,
 * pasted chats, named call participants) never carry these labels and skip the
 * gate. A single acoustic speaker (e.g. a dictation) needs no reconciliation
 * either — the gate only matters once there are ≥2 distinct acoustic labels.
 */
export function countAcousticSpeakers(
  segments: Array<{ speaker?: string }>
): number {
  const labels = new Set<string>()
  for (const seg of segments) {
    const s = String(seg?.speaker || '').trim()
    if (isAcousticSpeakerLabel(s)) labels.add(s.toUpperCase())
  }
  return labels.size
}

export function transcriptNeedsSpeakerReview(
  segments: Array<{ speaker?: string }>
): boolean {
  return countAcousticSpeakers(segments) >= 2
}

/**
 * Follow the merge chain (A→B→C) with cycle protection so a label resolves to
 * its final target.
 */
export function resolveMergedSpeakerId(
  speakerId: string,
  mergeMap: Record<string, string>
): string {
  let current = String(speakerId || '').trim()
  const visited = new Set<string>()
  while (current && mergeMap[current] && !visited.has(current)) {
    visited.add(current)
    const next = String(mergeMap[current] || '').trim()
    if (!next || next === current) break
    current = next
  }
  return current || String(speakerId || '').trim()
}

/**
 * Apply the canonical speaker corrections to a raw segment array, returning a
 * new array where each segment's `speaker` is the effective (merged +
 * per-segment overridden) label. Text and timings are preserved.
 *
 * `segment_speaker_overrides` is keyed by segment index in the transcript's
 * natural order — the same order the viewer and adapter use — and takes
 * precedence over `speaker_merge_map` for that segment.
 */
export function applySpeakerCorrectionsToSegments<T extends { speaker?: string }>(
  segments: T[],
  corrections: Record<string, any> | null | undefined
): T[] {
  const mergeMap = normalizeCorrectionMap(corrections?.speaker_merge_map)
  const overrides = normalizeCorrectionMap(corrections?.segment_speaker_overrides)
  const hasMerge = Object.keys(mergeMap).length > 0
  const hasOverrides = Object.keys(overrides).length > 0
  if (!hasMerge && !hasOverrides) return segments

  return segments.map((seg, index) => {
    const override = overrides[String(index)]
    if (override) {
      return { ...seg, speaker: override }
    }
    if (hasMerge) {
      const merged = resolveMergedSpeakerId(String(seg.speaker || ''), mergeMap)
      if (merged !== seg.speaker) return { ...seg, speaker: merged }
    }
    return seg
  })
}
