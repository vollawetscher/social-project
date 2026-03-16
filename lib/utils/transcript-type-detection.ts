export type TranscriptIngestionSource =
  | 'drag_drop'
  | 'file_select'
  | 'clipboard_paste'
  | 'unknown'

export type TranscriptDetectedType =
  | 'speaker_turns'
  | 'timestamped_speaker_turns'
  | 'subtitle_like'
  | 'chat_export'
  | 'non_transcript_note'
  | 'mixed_or_unknown'

export type TranscriptContentKind = 'transcript' | 'non_transcript' | 'mixed'

export interface TranscriptTypeSignals {
  contentKind: TranscriptContentKind
  detectedType: TranscriptDetectedType
  confidence: number
  reasons: string[]
  ingestionSource: TranscriptIngestionSource
}

interface DetectTranscriptTypeInput {
  text: string
  filename?: string
  ingestionSource?: TranscriptIngestionSource
}

const CHAT_MARKERS = [
  /(^|\n)\s*(you|user|human)\s+said:\s*$/im,
  /(^|\n)\s*(assistant|chatgpt|claude|ai)\s+said:\s*$/im,
]

const SPEAKER_LINE_RE =
  /^\s*(?:speaker\s*\d+|s\d+|sprecher|[A-Z][A-Za-z0-9.'’\- ]{1,70})\s*:\s+\S+/i

const SQUARE_TS_SPEAKER_RE =
  /^\s*\[\d{1,2}:\d{2}(?::\d{2})?\]\s*[A-Z][A-Za-z0-9.'’\- ]{0,70}:\s+\S+/i

const INLINE_TS_RE = /\b\d{1,2}:\d{2}(?::\d{2})?\b/
const SUBTITLE_ARROW_RE = /-->/
const SUBTITLE_TIME_RE = /\d{2}:\d{2}:\d{2}[.,]\d{3}/
const GERMAN_SPRECHER_RE = /\bSPRECHER\s*:/i
const GERMAN_ZEIT_RE = /\bZEIT\s*:\s*\d{2}:\d{2}:\d{2}[.,]\d{3}/i

const EXPLANATION_MARKERS = [
  /\bhow to\b/i,
  /\btypical patterns?\b/i,
  /\bways to detect\b/i,
  /\bwie .* erkannt werden\?/i,
  /\bes gibt mehrere\b/i,
]

function clamp(num: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, num))
}

function getSpeakerName(line: string): string | null {
  const idx = line.indexOf(':')
  if (idx < 1) return null
  return line.slice(0, idx).trim().toLowerCase()
}

export function detectTranscriptType(input: DetectTranscriptTypeInput): TranscriptTypeSignals {
  const text = String(input.text || '')
  const trimmed = text.trim()
  const file = String(input.filename || '').toLowerCase()
  const ingestionSource = input.ingestionSource || 'unknown'
  const reasons: string[] = []

  if (!trimmed || trimmed.length < 20) {
    return {
      contentKind: 'mixed',
      detectedType: 'mixed_or_unknown',
      confidence: 0.35,
      reasons: ['too_short'],
      ingestionSource,
    }
  }

  const lines = trimmed.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const speakerLines = lines.filter((l) => SPEAKER_LINE_RE.test(l))
  const timestampedSpeakerLines = lines.filter((l) => SQUARE_TS_SPEAKER_RE.test(l))
  const distinctSpeakers = new Set(
    speakerLines.map(getSpeakerName).filter((name): name is string => Boolean(name))
  )
  const hasSubtitleTiming = SUBTITLE_ARROW_RE.test(trimmed) && SUBTITLE_TIME_RE.test(trimmed)
  const hasGermanStructuredMarkers = GERMAN_SPRECHER_RE.test(trimmed) && GERMAN_ZEIT_RE.test(trimmed)
  const hasChatMarkers = CHAT_MARKERS.some((re) => re.test(trimmed))
  const hasInlineTimestamps = INLINE_TS_RE.test(trimmed)
  const hasNumberedSections = lines.filter((l) => /^\d+\.\s+/.test(l)).length >= 2
  const explanationHits = EXPLANATION_MARKERS.filter((re) => re.test(trimmed)).length

  let transcriptScore = 0
  let nonTranscriptScore = 0

  if (file.endsWith('.srt') || file.endsWith('.vtt') || hasSubtitleTiming) {
    transcriptScore += 4
    reasons.push('subtitle_timing_detected')
  }
  if (hasGermanStructuredMarkers) {
    transcriptScore += 4
    reasons.push('sprecher_zeit_pattern')
  }
  if (speakerLines.length >= 3 && distinctSpeakers.size >= 2) {
    transcriptScore += 4
    reasons.push('multi_speaker_turns')
  } else if (speakerLines.length >= 2) {
    transcriptScore += 2
    reasons.push('speaker_turns')
  }
  if (timestampedSpeakerLines.length >= 2 || (hasInlineTimestamps && speakerLines.length >= 2)) {
    transcriptScore += 2
    reasons.push('timestamped_turns')
  }
  if (hasChatMarkers) {
    transcriptScore += 2
    reasons.push('chat_markers')
  }

  if (hasNumberedSections && speakerLines.length === 0 && !hasSubtitleTiming && !hasGermanStructuredMarkers) {
    nonTranscriptScore += 2
    reasons.push('numbered_instructional_sections')
  }
  if (explanationHits >= 2) {
    nonTranscriptScore += 2
    reasons.push('instructional_language')
  }
  if (speakerLines.length === 0 && !hasInlineTimestamps && lines.length <= 3 && trimmed.length > 120) {
    nonTranscriptScore += 1
    reasons.push('paragraph_style_without_turns')
  }

  let detectedType: TranscriptDetectedType = 'mixed_or_unknown'
  let contentKind: TranscriptContentKind = 'mixed'

  if (transcriptScore >= nonTranscriptScore + 2) {
    contentKind = 'transcript'
    if (hasSubtitleTiming) detectedType = 'subtitle_like'
    else if (hasChatMarkers) detectedType = 'chat_export'
    else if (hasGermanStructuredMarkers || timestampedSpeakerLines.length >= 2) {
      detectedType = 'timestamped_speaker_turns'
    } else {
      detectedType = 'speaker_turns'
    }
  } else if (nonTranscriptScore >= transcriptScore + 2) {
    contentKind = 'non_transcript'
    detectedType = 'non_transcript_note'
  }

  const confidenceBase = 0.45 + Math.abs(transcriptScore - nonTranscriptScore) * 0.08
  const confidence = clamp(confidenceBase, 0.35, 0.95)

  return {
    contentKind,
    detectedType,
    confidence,
    reasons,
    ingestionSource,
  }
}
