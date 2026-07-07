/**
 * Parse transcript files (TXT, SRT, VTT) into segment format compatible with the app.
 */

/** Strip formatting noise from pasted content so parseTXT handles it reliably. */
export function cleanPastedContent(raw: string): string {
  let t = raw
  // Remove emojis / symbol codepoints
  t = t.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/gu, '')
  // Remove markdown code fences and their content
  t = t.replace(/```[\s\S]*?```/g, '')
  // Convert markdown table rows to plain text
  t = t.replace(/^\|(.+)\|$/gm, (_, row: string) =>
    row.split('|').map((c: string) => c.trim()).filter(Boolean).join(' — ')
  )
  // Remove table separator rows
  t = t.replace(/^\|[-:\s|]+\|$/gm, '')
  // Strip bold / italic markers
  t = t.replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1')
  t = t.replace(/_{1,3}([^_]+)_{1,3}/g, '$1')
  // Strip heading markers
  t = t.replace(/^#{1,6}\s+/gm, '')
  // Remove standalone legacy speaker-ID lines (e.g. "S1", "S2") when the body uses named speaker labels.
  // This avoids showing a misleading synthetic "S1" header at the top of pasted imports.
  const hasNamedSpeakerTurns = /[A-ZÄÖÜ][\p{L}\p{N}.'’\- ]{1,80}\s*:\s+/u.test(t)
  if (hasNamedSpeakerTurns) {
    t = t.replace(/^\s*S\d+\s*$/gim, '')
  }
  // Collapse 3+ blank lines to 2
  t = t.replace(/\n{3,}/g, '\n\n')
  return t.trim()
}

export interface ParsedSegment {
  start_ms: number
  end_ms: number
  speaker: string
  text: string
}

export interface ParseResult {
  segments: ParsedSegment[]
  rawText: string
}

/** Matches WebVTT/SRT cue timestamps: HH:MM:SS.mmm, H:MM:SS.mmm, or MM:SS.mmm */
const CUE_TIMESTAMP_RE =
  /(\d{1,2}):(\d{2})(?::(\d{2}))?[.,](\d{3})\s*-->\s*(\d{1,2}):(\d{2})(?::(\d{2}))?[.,](\d{3})/

function parseCueTimestampToMs(
  hours: string,
  minutes: string,
  seconds: string | undefined,
  millis: string
): number {
  const h = parseInt(hours, 10)
  const m = parseInt(minutes, 10)
  const s = seconds ? parseInt(seconds, 10) : 0
  const ms = parseInt(millis, 10)
  if (!seconds) {
    return (h * 60 + m) * 1000 + ms
  }
  return h * 3600000 + m * 60000 + s * 1000 + ms
}

function parseCueTimestampLine(line: string): { startMs: number; endMs: number } | null {
  const match = line.match(CUE_TIMESTAMP_RE)
  if (!match) return null
  return {
    startMs: parseCueTimestampToMs(match[1], match[2], match[3], match[4]),
    endMs: parseCueTimestampToMs(match[5], match[6], match[7], match[8]),
  }
}

function stripVttHeader(content: string): string {
  const normalized = content.replace(/^\uFEFF/, '').trim()
  if (!/^WEBVTT/i.test(normalized)) return normalized

  const lines = normalized.split(/\r?\n/)
  let i = 1
  while (i < lines.length && lines[i].trim() !== '') {
    i++
  }
  if (i < lines.length) i++
  return lines.slice(i).join('\n')
}

function stripVttMarkup(text: string): string {
  return text
    .replace(/<v[^>]*>/gi, '')
    .replace(/<\/v>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .trim()
}

function looksLikeCueId(line: string): boolean {
  const trimmed = line.trim()
  if (!trimmed) return false
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?:\/\S+)?$/i.test(trimmed)) {
    return true
  }
  return /^\d+$/.test(trimmed)
}

function extractVttVoiceTag(text: string): { speaker: string | null; text: string } {
  const match = text.match(/<v([^>]*)>([\s\S]*?)<\/v>/i)
  if (!match) {
    return { speaker: null, text: stripVttMarkup(text) }
  }
  const speaker = match[1].trim() || null
  const inner = match[2].replace(/\s*\r?\n\s*/g, ' ').trim()
  return { speaker, text: inner }
}

function isVttMetadataBlock(block: string): boolean {
  const first = block.trim().split(/\r?\n/)[0]?.trim().toUpperCase() || ''
  return (
    first.startsWith('NOTE') ||
    first.startsWith('STYLE') ||
    first.startsWith('REGION') ||
    first === 'REGION'
  )
}

function findCueTimestampInLines(
  lines: string[]
): { lineIndex: number; times: { startMs: number; endMs: number } } | null {
  for (let i = 0; i < Math.min(lines.length, 4); i++) {
    const times = parseCueTimestampLine(lines[i])
    if (times) return { lineIndex: i, times }
  }
  return null
}

/** Infer subtitle format from content when filename extension is missing or wrong. */
export function resolveTranscriptFilename(content: string, filename: string): string {
  const trimmed = content.replace(/^\uFEFF/, '').trimStart()
  if (/^WEBVTT/i.test(trimmed)) {
    return filename.toLowerCase().endsWith('.vtt') ? filename : 'import.vtt'
  }
  if (/^\d+\s*\r?\n\d{2}:\d{2}:\d{2}[,.]\d{3}\s*-->/m.test(trimmed)) {
    return filename.toLowerCase().endsWith('.srt') ? filename : 'import.srt'
  }
  return filename
}

export function isStructuredSubtitleContent(content: string, filename?: string | null): boolean {
  const trimmed = content.replace(/^\uFEFF/, '').trimStart()
  if (/^WEBVTT/i.test(trimmed)) return true
  if (filename && /\.(vtt|srt)$/i.test(filename)) return true
  return /^\d+\s*\r?\n\d{2}:\d{2}:\d{2}[,.]\d{3}\s*-->/m.test(trimmed)
}

export type TranscriptParseStrategy =
  | 'auto'
  | 'sprecher_zeit'
  | 'timestamped_speaker_lines'
  | 'speaker_timestamp_lines'
  | 'plain_txt'
  | 'raw_text'

// Strict speaker label shape to avoid sentence fragments being captured as speaker names.
// Supports:
// - "Michael Westphal:"
// - "EXTERNAL Wussler Thomas (Media-Studios, BD/WPA-UCS4):"
const STRICT_SPEAKER_LABEL =
  '(?:(?:EXTERNAL|INTERNAL)\\s+)?[A-ZÄÖÜ][\\p{L}\\p{N}\'’\\-]*(?:\\s+[A-ZÄÖÜ][\\p{L}\\p{N}\'’\\-]*){0,5}(?:\\s*\\([^:\\n)]{1,120}\\))?'

/**
 * Parse SRT format:
 * 1
 * 00:00:00,000 --> 00:00:02,500
 * Subtitle text
 *
 * 2
 * ...
 */
function parseSRT(content: string): ParseResult {
  const segments: ParsedSegment[] = []
  const blocks = content
    .trim()
    .split(/\r?\n\r?\n+/)
    .filter(Boolean)

  for (const block of blocks) {
    const lines = block.split(/\r?\n/)
    if (lines.length < 2) continue

    // Second line (or first if no index) has timestamps
    const timeLine = lines[0].match(/\d{2}:\d{2}:\d{2}[,.]\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}[,.]\d{3}/)
      ? lines[0]
      : lines[1]
    const textLines = timeLine === lines[0] ? lines.slice(1) : [lines[0], ...lines.slice(2)]

    if (!timeLine) continue

    const match = timeLine.match(
      /(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/
    )
    if (!match) continue

    const startMs =
      parseInt(match[1], 10) * 3600000 +
      parseInt(match[2], 10) * 60000 +
      parseInt(match[3], 10) * 1000 +
      parseInt(match[4], 10)
    const endMs =
      parseInt(match[5], 10) * 3600000 +
      parseInt(match[6], 10) * 60000 +
      parseInt(match[7], 10) * 1000 +
      parseInt(match[8], 10)

    const text = textLines.join(' ').trim()
    if (text) {
      const { speaker, text: cleanText } = extractSpeakerFromText(text)
      segments.push({
        start_ms: startMs,
        end_ms: endMs,
        speaker,
        text: cleanText || text,
      })
    }
  }

  const rawText = segments.map(s => s.text).join(' ')
  return { segments, rawText }
}

/** Extract speaker label (S1, S2, Speaker 1, etc.) from start of text if present */
function extractSpeakerFromText(text: string): { speaker: string; text: string } {
  let trimmed = text.trim()
  // Strip leading [timestamp] prefix (e.g. [0:08], [12:34], [1:02:15])
  trimmed = trimmed.replace(/^\[\d{1,2}:\d{2}(?::\d{2})?\]\s*/, '')
  // S1:, S2:, Speaker 1:, Speaker 2:, Sprecher 1:, SPEAKER_00:, Speaker_1:
  const match = trimmed.match(
    /^(S\d+|Speaker\s*\d+|Sprecher\s*\d+|Speaker_\d+|SPEAKER_\d+)\s*:?\s*(.*)$/i
  )
  if (match) {
    const label = match[1]
    const num = label.replace(/\D/g, '') || '1'
    const speaker = `S${num}`
    return { speaker, text: (match[2] || '').trim() }
  }
  // Generic named speaker label:
  // "Karsten Milde: ...", "Michael Westphal: ...",
  // "EXTERNAL Wussler Thomas (Media-Studios, BD/WPA-UCS4): ..."
  const nameMatch = trimmed.match(new RegExp(`^(${STRICT_SPEAKER_LABEL})\\s*:\\s*(.+)$`, 'u'))
  if (nameMatch) {
    return { speaker: nameMatch[1].trim(), text: (nameMatch[2] || '').trim() }
  }
  return { speaker: 'S1', text: trimmed }
}

/**
 * Parse MS Teams transcript export (.txt), which uses single-digit hours:
 *
 * Speaker Name
 * 0:00:12.340 --> 0:00:18.560
 * Spoken text here
 */
function parseMSTeams(content: string): ParseResult | null {
  if (!CUE_TIMESTAMP_RE.test(content)) return null

  const blocks = content.trim().split(/\r?\n\r?\n+/).filter(Boolean)
  const segments: ParsedSegment[] = []

  for (const block of blocks) {
    const lines = block.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
    if (lines.length < 2) continue

    let speakerLine: string | null = null
    let times: { startMs: number; endMs: number } | null = null
    let textStartIdx = 0

    for (let i = 0; i < Math.min(lines.length, 3); i++) {
      const parsed = parseCueTimestampLine(lines[i])
      if (parsed) {
        times = parsed
        speakerLine = i > 0 ? lines.slice(0, i).join(' ') : null
        textStartIdx = i + 1
        break
      }
    }
    if (!times) continue

    const textContent = lines.slice(textStartIdx).join(' ').trim()
    if (!textContent) continue

    const speaker = speakerLine?.trim() || 'S1'
    segments.push({ start_ms: times.startMs, end_ms: times.endMs, speaker, text: textContent })
  }

  if (segments.length < 2) return null
  return { segments, rawText: segments.map(s => s.text).join(' ') }
}

/**
 * Parse WebVTT format:
 * WEBVTT
 *
 * 00:00:00.000 --> 00:00:02.500
 * Subtitle text
 *
 * Also supports MS Teams VTT exports (UUID cue ids, <v Name> voice tags),
 * short MM:SS timestamps, cue settings, and NOTE/STYLE blocks.
 */
function parseVTT(content: string): ParseResult {
  const withoutHeader = stripVttHeader(content)
  const segments: ParsedSegment[] = []
  const blocks = withoutHeader
    .trim()
    .split(/\r?\n\r?\n+/)
    .filter(Boolean)

  for (const block of blocks) {
    if (isVttMetadataBlock(block)) continue

    const lines = block.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
    if (lines.length < 2) continue

    const cue = findCueTimestampInLines(lines)
    if (!cue) continue

    const { lineIndex, times } = cue
    const speakerLines = lines
      .slice(0, lineIndex)
      .filter((line) => !CUE_TIMESTAMP_RE.test(line) && !looksLikeCueId(line))
    const textLines = lines.slice(lineIndex + 1)
    const rawText = textLines.join(' ').trim()
    const { speaker: voiceSpeaker, text } = extractVttVoiceTag(rawText)
    if (!text) continue

    const speakerFromLine = speakerLines.join(' ').trim()
    if (voiceSpeaker) {
      segments.push({
        start_ms: times.startMs,
        end_ms: times.endMs,
        speaker: voiceSpeaker,
        text,
      })
      continue
    }

    if (speakerFromLine) {
      segments.push({
        start_ms: times.startMs,
        end_ms: times.endMs,
        speaker: speakerFromLine,
        text,
      })
      continue
    }

    const { speaker, text: cleanText } = extractSpeakerFromText(text)
    segments.push({
      start_ms: times.startMs,
      end_ms: times.endMs,
      speaker,
      text: cleanText || text,
    })
  }

  if (segments.length >= 2) {
    const rawText = segments.map((s) => s.text).join(' ')
    return { segments, rawText }
  }

  // Fallback: Teams-style blocks saved as .vtt (speaker line + flexible timestamps)
  const msTeamsResult = parseMSTeams(content)
  if (msTeamsResult && msTeamsResult.segments.length >= segments.length) {
    return msTeamsResult
  }

  const rawText = segments.map((s) => s.text).join(' ')
  return { segments, rawText }
}

/**
 * Parse chat exports (ChatGPT "You said:" / "ChatGPT said:", User/Assistant, etc.).
 * Preserves BOTH sides of the conversation.
 */
function parseChatFormat(content: string): ParseResult | null {
  const trimmed = content.trim()
  if (!trimmed || trimmed.length < 20) return null

  // Patterns: "You said:", "ChatGPT said:", "User:", "Assistant:", "Human:", "AI said:", "Claude said:", etc.
  const speakerPattern = /(?:^|\n)\s*((?:You|User|Human)\s+said|(?:ChatGPT|Assistant|AI|Bot|Claude|Bard|Gemini)\s+said|User|Assistant|Human)\s*:?\s*\n/gi
  const blocks: { speaker: string; text: string }[] = []

  // Reset regex state for global match
  speakerPattern.lastIndex = 0
  const firstMatch = speakerPattern.exec(trimmed)
  if (!firstMatch) return null

  // We need at least 2 blocks (user + reply) to consider it a chat
  const allMatches: { index: number; label: string }[] = []
  speakerPattern.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = speakerPattern.exec(trimmed)) !== null) {
    allMatches.push({ index: m.index, label: m[1].toLowerCase() })
  }
  if (allMatches.length < 2) return null

  for (let i = 0; i < allMatches.length; i++) {
    const start = allMatches[i].index
    const end = i + 1 < allMatches.length ? allMatches[i + 1].index : trimmed.length
    const rawBlock = trimmed.slice(start, end)
    const labelMatch = rawBlock.match(/\s*((?:You|User|Human)\s+said|(?:ChatGPT|Assistant|AI|Bot|Claude|Bard|Gemini)\s+said|User|Assistant|Human)\s*:?\s*\n/i)
    if (!labelMatch) continue
    const label = labelMatch[1].toLowerCase()
    const textStart = (labelMatch.index || 0) + labelMatch[0].length
    const text = rawBlock.slice(textStart).trim()

    if (!text) continue
    const isUser = /^(you said|user said|human said|user|human)$/.test(label)
    const speaker = isUser ? 'S1' : 'S2'
    blocks.push({ speaker, text })
  }

  if (blocks.length === 0) return null

  const segments: ParsedSegment[] = []
  let currentMs = 0
  const msPerWord = 400
  for (const b of blocks) {
    const words = b.text.split(/\s+/).filter(Boolean)
    const durationMs = Math.max(1000, words.length * msPerWord)
    segments.push({
      start_ms: currentMs,
      end_ms: currentMs + durationMs,
      speaker: b.speaker,
      text: b.text,
    })
    currentMs += durationMs
  }
  const rawText = segments.map((s) => s.text).join('\n\n')
  return { segments, rawText }
}

/**
 * Parse timestamped speaker-line format: [M:SS] S1: text or [MM:SS] Speaker 1: text
 * Common in Notissima exports and similar transcript tools.
 */
const TIMESTAMPED_SPEAKER_LINE_RE = new RegExp(
  `^\\[(\\d{1,2}):(\\d{2})(?::(\\d{2}))?\\]\\s*(${STRICT_SPEAKER_LABEL}|S\\d+|Speaker\\s*\\d+|Speaker_\\d+|SPEAKER_\\d+)\\s*:\\s*(.+)$`,
  'iu'
)

function parseTimestampedSpeakerLines(content: string): ParseResult | null {
  const lines = content.trim().split(/\r?\n/).filter(l => l.trim().length > 0)
  if (lines.length < 2) return null

  const linePattern = TIMESTAMPED_SPEAKER_LINE_RE
  const matched: { startMs: number; speaker: string; text: string }[] = []
  let misses = 0

  for (const line of lines) {
    const m = line.trim().match(linePattern)
    if (m) {
      const mins = parseInt(m[1], 10)
      const secs = parseInt(m[2], 10)
      const extraSecs = m[3] ? parseInt(m[3], 10) : 0
      const startMs = (mins * 60 + secs + extraSecs) * 1000
      const rawSpeaker = m[4].trim()
      const normalizedSpeaker = /^(S\d+|Speaker\s*\d+|Speaker_\d+|SPEAKER_\d+)$/i.test(rawSpeaker)
        ? `S${rawSpeaker.replace(/\D/g, '') || '1'}`
        : rawSpeaker
      matched.push({ startMs, speaker: normalizedSpeaker, text: m[5].trim() })
    } else {
      misses++
    }
  }

  if (matched.length < 2 || misses > matched.length * 0.5) return null

  const segments: ParsedSegment[] = matched.map((entry, i) => {
    const nextStart = i + 1 < matched.length ? matched[i + 1].startMs : entry.startMs + 5000
    return {
      start_ms: entry.startMs,
      end_ms: Math.max(nextStart, entry.startMs + 1000),
      speaker: entry.speaker,
      text: entry.text,
    }
  })

  const rawText = segments.map(s => s.text).join('\n\n')
  return { segments, rawText }
}

/**
 * Parse German structured format like:
 * SPRECHER: Karsten Milde, ZEIT: 00:00:01.550 Text...
 */
function parseSprecherZeitFormat(content: string): ParseResult | null {
  const normalized = content.replace(/\r?\n/g, ' ').trim()
  if (!normalized) return null

  // Accept variants like:
  // SPRECHER: Name, ZEIT: 00:00:01.550 ...
  // SPRECHER: Name, [00:01] ZEIT: 00:00:01.550 ...
  // ... - : [01:22] SPRECHER: Name, [01:24] ZEIT: 00:01:26.880 ...
  const tokenRe =
    /SPRECHER:\s*([^,\n]+?)\s*,\s*(?:\[\d{1,2}:\d{2}(?::\d{2})?\]\s*)?ZEIT:\s*(\d{2}):(\d{2}):(\d{2})[.,](\d{3})\s*/gi

  const matches: Array<{
    idx: number
    end: number
    speaker: string
    startMs: number
  }> = []

  let m: RegExpExecArray | null
  while ((m = tokenRe.exec(normalized)) !== null) {
    const hh = parseInt(m[2], 10)
    const mm = parseInt(m[3], 10)
    const ss = parseInt(m[4], 10)
    const ms = parseInt(m[5], 10)
    matches.push({
      idx: m.index,
      end: tokenRe.lastIndex,
      speaker: (m[1] || '').trim(),
      startMs: hh * 3600000 + mm * 60000 + ss * 1000 + ms,
    })
  }

  if (matches.length === 0) return null

  const segments: ParsedSegment[] = []
  for (let i = 0; i < matches.length; i++) {
    const curr = matches[i]
    const nextStart = i + 1 < matches.length ? matches[i + 1].idx : normalized.length
    let text = normalized.slice(curr.end, nextStart).trim()
    // Remove separator artifacts between blocks, e.g. "- : [01:22]"
    text = text.replace(/^-?\s*:\s*\[\d{1,2}:\d{2}(?::\d{2})?\]\s*/g, '').trim()
    // Remove standalone legacy labels accidentally embedded.
    text = text.replace(/\bS\d+\b/g, '').replace(/\s{2,}/g, ' ').trim()
    if (!text) continue

    segments.push({
      start_ms: curr.startMs,
      end_ms: curr.startMs + 1000, // resolved in second pass
      speaker: curr.speaker || 'S1',
      text,
    })
  }

  if (segments.length === 0) return null

  for (let i = 0; i < segments.length; i++) {
    const next = i + 1 < segments.length ? segments[i + 1].start_ms : segments[i].start_ms + 5000
    segments[i].end_ms = Math.max(next, segments[i].start_ms + 1000)
  }

  const rawText = segments.map((s) => `${s.speaker}: ${s.text}`.trim()).join('\n')
  return { segments, rawText }
}

/**
 * Parse inline named-speaker turns in dense text blocks, e.g.
 * "Michael Westphal: ... Alisa Mulic: ... Michael Westphal: ..."
 */
function parseInlineNamedSpeakerTurns(content: string, speakerHints?: string[]): ParseResult | null {
  const sanitized = content
    .replace(/\r?\n/g, ' ')
    .replace(/\bS\d+\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (sanitized.length < 20) return null

  const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const normalizedHints = Array.isArray(speakerHints)
    ? Array.from(new Set(speakerHints.map((h) => String(h || '').trim()).filter((h) => h.length > 1)))
    : []
  const hintPattern =
    normalizedHints.length >= 2
      ? new RegExp(
          `(^|\\s)(${normalizedHints
            .sort((a, b) => b.length - a.length)
            .map(escapeRegex)
            .join('|')})\\s*:\\s*`,
          'gu'
        )
      : null

  // Prefer exact participant-name hints from context when available, fallback to generic pattern.
  const speakerPattern = hintPattern || new RegExp(`(^|\\s)(${STRICT_SPEAKER_LABEL})\\s*:\\s*`, 'gu')
  const matches: Array<{ index: number; speaker: string; markerLength: number }> = []
  let m: RegExpExecArray | null
  while ((m = speakerPattern.exec(sanitized)) !== null) {
    const prefixLen = (m[1] || '').length
    const speaker = (m[2] || '').trim()
    const markerStart = m.index + prefixLen
    const markerLength = `${speaker}:`.length
    matches.push({ index: markerStart, speaker, markerLength })
  }

  if (matches.length < 2) return null
  const uniqueSpeakers = new Set(matches.map((x) => x.speaker))
  if (uniqueSpeakers.size < 2) return null

  const turns: Array<{ speaker: string; text: string }> = []
  for (let i = 0; i < matches.length; i++) {
    const curr = matches[i]
    const textStart = curr.index + curr.markerLength
    const nextStart = i + 1 < matches.length ? matches[i + 1].index : sanitized.length
    const text = sanitized.slice(textStart, nextStart).trim().replace(/^[,.;:\-–—\s]+/, '').trim()
    if (!text) continue
    turns.push({ speaker: curr.speaker, text })
  }

  if (turns.length < 2) return null

  const segments: ParsedSegment[] = []
  let currentMs = 0
  const msPerWord = 380
  for (const turn of turns) {
    const words = turn.text.split(/\s+/).filter(Boolean)
    const durationMs = Math.max(1200, words.length * msPerWord)
    segments.push({
      start_ms: currentMs,
      end_ms: currentMs + durationMs,
      speaker: turn.speaker,
      text: turn.text,
    })
    currentMs += durationMs
  }

  const rawText = segments.map((s) => `${s.speaker}: ${s.text}`).join('\n')
  return { segments, rawText }
}

/**
 * Parse "Speaker N HH:MM text" format common in German meeting transcripts and
 * recording tools. Also handles English "Speaker N" variants.
 *
 * Lines like:
 *   Sprecher 1 14:00 Hallo zusammen. Also, äh, …
 *   Sprecher 2 14:01 Ja, passt.
 *   [System] 14:00 Aufzeichnung gestartet        ← skipped
 *
 * The key difference from parseTimestampedSpeakerLines is that
 * the timestamp has NO brackets and the speaker label has NO colon.
 */
function parseSpeakerTimestampLines(content: string): ParseResult | null {
  const lines = content.trim().split(/\r?\n/).filter(l => l.trim().length > 0)
  if (lines.length < 3) return null

  // Match: "Sprecher 1 14:00 text" / "Speaker 1 14:00 text" / "S1 14:00 text"
  // Also handle generic names: "Max Müller 14:05 text" (name + time + text,
  // only when at least some Sprecher/Speaker lines anchor the format).
  const SPEAKER_TS_RE =
    /^(Sprecher\s*\d+|Speaker\s*\d+|S\d+|SPEAKER_\d+)\s+(\d{1,2}):(\d{2})\s+(.+)$/iu
  const SYSTEM_RE = /^\[.*?\]\s+\d{1,2}:\d{2}/

  const matched: { startMs: number; speaker: string; text: string }[] = []
  let systemLines = 0
  let headerLines = 0

  for (const line of lines) {
    const trimmed = line.trim()
    if (SYSTEM_RE.test(trimmed)) { systemLines++; continue }

    const m = trimmed.match(SPEAKER_TS_RE)
    if (m) {
      const hours = parseInt(m[2], 10)
      const mins = parseInt(m[3], 10)
      const startMs = (hours * 60 + mins) * 60 * 1000
      const rawSpeaker = m[1].trim()
      const speaker = /^(S\d+|Speaker\s*\d+|Sprecher\s*\d+|SPEAKER_\d+)$/i.test(rawSpeaker)
        ? `S${rawSpeaker.replace(/\D/g, '') || '1'}`
        : rawSpeaker
      matched.push({ startMs, speaker, text: m[4].trim() })
    } else {
      headerLines++
    }
  }

  if (matched.length < 3) return null
  // Too many non-matching lines → probably not this format
  if (headerLines > matched.length) return null

  // Normalize wall-clock times relative to the first segment (e.g. 14:00 → 0:00)
  const baseMs = matched[0].startMs

  const segments: ParsedSegment[] = matched.map((entry, i) => {
    const relStart = entry.startMs - baseMs
    const nextRelStart = i + 1 < matched.length ? matched[i + 1].startMs - baseMs : relStart + 5000
    return {
      start_ms: relStart,
      end_ms: Math.max(nextRelStart, relStart + 1000),
      speaker: entry.speaker,
      text: entry.text,
    }
  })

  const rawText = segments.map(s => s.text).join('\n\n')
  return { segments, rawText }
}

/**
 * Parse plain TXT: split by double newlines (paragraphs) or single newlines.
 * Assign sequential timestamps (~150 words/min ≈ 2.5 words/sec).
 */
function parseTXT(content: string, speakerHints?: string[]): ParseResult {
  // Even in plain-text mode, preserve obvious inline speaker turns when present.
  const inlineNamedTurns = parseInlineNamedSpeakerTurns(content, speakerHints)
  if (inlineNamedTurns) return inlineNamedTurns

  const paragraphs = content
    .trim()
    .split(/\r?\n\r?\n+/)
    .map(p => p.trim())
    .filter(Boolean)

  if (paragraphs.length === 0) {
    const trimmed = content.trim()
    if (trimmed) {
      return {
        segments: [
          { start_ms: 0, end_ms: 5000, speaker: 'S1', text: trimmed },
        ],
        rawText: trimmed,
      }
    }
    return { segments: [], rawText: '' }
  }

  const segments: ParsedSegment[] = []
  let currentMs = 0
  const msPerWord = 400 // ~150 words/min

  for (const para of paragraphs) {
    const words = para.split(/\s+/).filter(Boolean)
    const durationMs = Math.max(1000, words.length * msPerWord)
    const { speaker, text } = extractSpeakerFromText(para)
    segments.push({
      start_ms: currentMs,
      end_ms: currentMs + durationMs,
      speaker,
      text: text || para,
    })
    currentMs += durationMs
  }

  const rawText = segments.map(s => s.text).join('\n\n')
  return { segments, rawText }
}

function parseRawText(content: string): ParseResult {
  const trimmed = content.trim()
  if (!trimmed) return { segments: [], rawText: '' }

  const paragraphs = trimmed
    .split(/\r?\n\s*\r?\n+/)
    .map((p) => p.replace(/\s*\r?\n\s*/g, ' ').replace(/\s{2,}/g, ' ').trim())
    .filter(Boolean)

  if (paragraphs.length === 0) {
    return { segments: [], rawText: '' }
  }

  const segments: ParsedSegment[] = []
  let currentMs = 0
  const msPerWord = 400
  for (const para of paragraphs) {
    const words = para.split(/\s+/).filter(Boolean)
    const durationMs = Math.max(1200, words.length * msPerWord)
    segments.push({
      start_ms: currentMs,
      end_ms: currentMs + durationMs,
      speaker: 'TEXT',
      text: para,
    })
    currentMs += durationMs
  }

  return {
    segments,
    rawText: paragraphs.join('\n\n'),
  }
}

/**
 * Parse transcript file content by extension.
 * For TXT/pasted content, tries chat format first (You said/ChatGPT said, User/Assistant).
 */
export function parseTranscriptFile(
  content: string,
  filename: string,
  options?: { strategy?: TranscriptParseStrategy; speakerHints?: string[] }
): ParseResult {
  const strategy = options?.strategy || 'auto'
  const speakerHints = Array.isArray(options?.speakerHints) ? options?.speakerHints : []
  const effectiveFilename = resolveTranscriptFilename(content, filename)
  const ext = effectiveFilename.split('.').pop()?.toLowerCase() || ''
  const trimmedContent = content.replace(/^\uFEFF/, '').trimStart()

  if (strategy === 'sprecher_zeit') {
    return parseSprecherZeitFormat(content) || parseTXT(content, speakerHints)
  }
  if (strategy === 'timestamped_speaker_lines') {
    return parseTimestampedSpeakerLines(content) || parseTXT(content, speakerHints)
  }
  if (strategy === 'speaker_timestamp_lines') {
    return parseSpeakerTimestampLines(content) || parseTXT(content, speakerHints)
  }
  if (strategy === 'plain_txt') {
    return parseTXT(content, speakerHints)
  }
  if (strategy === 'raw_text') {
    return parseRawText(content)
  }

  if (ext === 'srt') return parseSRT(content)
  if (ext === 'vtt' || /^WEBVTT/i.test(trimmedContent)) return parseVTT(content)

  // Try MS Teams format early — it uses .txt extension with timed --> blocks
  const msTeamsResult = parseMSTeams(content)
  if (msTeamsResult) return msTeamsResult

  if (ext === 'txt' || ext === '') {
    const chatResult = parseChatFormat(content)
    if (chatResult) return chatResult
    const sprecherZeitResult = parseSprecherZeitFormat(content)
    if (sprecherZeitResult) return sprecherZeitResult
    const timestampedResult = parseTimestampedSpeakerLines(content)
    if (timestampedResult) return timestampedResult
    const speakerTsResult = parseSpeakerTimestampLines(content)
    if (speakerTsResult) return speakerTsResult
    const inlineNamedTurnsResult = parseInlineNamedSpeakerTurns(content, speakerHints)
    if (inlineNamedTurnsResult) return inlineNamedTurnsResult
    return parseTXT(content, speakerHints)
  }
  const sprecherZeitResult = parseSprecherZeitFormat(content)
  if (sprecherZeitResult) return sprecherZeitResult
  const timestampedResult = parseTimestampedSpeakerLines(content)
  if (timestampedResult) return timestampedResult
  const speakerTsResult = parseSpeakerTimestampLines(content)
  if (speakerTsResult) return speakerTsResult
  const inlineNamedTurnsResult = parseInlineNamedSpeakerTurns(content, speakerHints)
  if (inlineNamedTurnsResult) return inlineNamedTurnsResult
  return parseTXT(content, speakerHints)
}
