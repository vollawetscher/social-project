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

export type TranscriptParseStrategy =
  | 'auto'
  | 'sprecher_zeit'
  | 'timestamped_speaker_lines'
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
  // S1:, S2:, Speaker 1:, Speaker 2:, SPEAKER_00:, Speaker_1:
  const match = trimmed.match(
    /^(S\d+|Speaker\s*\d+|Speaker_\d+|SPEAKER_\d+)\s*:?\s*(.*)$/i
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
 * Parse WebVTT format:
 * WEBVTT
 *
 * 00:00:00.000 --> 00:00:02.500
 * Subtitle text
 */
function parseVTT(content: string): ParseResult {
  const withoutHeader = content.replace(/^WEBVTT\s*\n?\s*(\d+\s*\n)?/i, '')
  const segments: ParsedSegment[] = []
  const blocks = withoutHeader
    .trim()
    .split(/\r?\n\r?\n+/)
    .filter(Boolean)

  for (const block of blocks) {
    const lines = block.split(/\r?\n/)
    if (lines.length < 2) continue

    const timeLine = lines[0].match(/\d{2}:\d{2}:\d{2}[.,]\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}[.,]\d{3}/)
      ? lines[0]
      : lines[1]
    const textLines = timeLine === lines[0] ? lines.slice(1) : [lines[0], ...lines.slice(2)]

    if (!timeLine) continue

    const match = timeLine.match(
      /(\d{2}):(\d{2}):(\d{2})[.,](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[.,](\d{3})/
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
function parseTimestampedSpeakerLines(content: string): ParseResult | null {
  const lines = content.trim().split(/\r?\n/).filter(l => l.trim().length > 0)
  if (lines.length < 2) return null

  const linePattern = /^\[(\d{1,2}):(\d{2})(?::(\d{2}))?\]\s*([A-ZÄÖÜ][\p{L}\p{N}.'’\- ]{1,80}|S\d+|Speaker\s*\d+|Speaker_\d+|SPEAKER_\d+)\s*:\s*(.+)$/iu
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
  const ext = filename.split('.').pop()?.toLowerCase() || ''

  if (strategy === 'sprecher_zeit') {
    return parseSprecherZeitFormat(content) || parseTXT(content, speakerHints)
  }
  if (strategy === 'timestamped_speaker_lines') {
    return parseTimestampedSpeakerLines(content) || parseTXT(content, speakerHints)
  }
  if (strategy === 'plain_txt') {
    return parseTXT(content, speakerHints)
  }
  if (strategy === 'raw_text') {
    return parseRawText(content)
  }

  if (ext === 'srt') return parseSRT(content)
  if (ext === 'vtt') return parseVTT(content)
  if (ext === 'txt' || ext === '') {
    const chatResult = parseChatFormat(content)
    if (chatResult) return chatResult
    const sprecherZeitResult = parseSprecherZeitFormat(content)
    if (sprecherZeitResult) return sprecherZeitResult
    const timestampedResult = parseTimestampedSpeakerLines(content)
    if (timestampedResult) return timestampedResult
    const inlineNamedTurnsResult = parseInlineNamedSpeakerTurns(content, speakerHints)
    if (inlineNamedTurnsResult) return inlineNamedTurnsResult
    return parseTXT(content, speakerHints)
  }
  const sprecherZeitResult = parseSprecherZeitFormat(content)
  if (sprecherZeitResult) return sprecherZeitResult
  const timestampedResult = parseTimestampedSpeakerLines(content)
  if (timestampedResult) return timestampedResult
  const inlineNamedTurnsResult = parseInlineNamedSpeakerTurns(content, speakerHints)
  if (inlineNamedTurnsResult) return inlineNamedTurnsResult
  return parseTXT(content, speakerHints)
}
