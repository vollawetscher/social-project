/**
 * Parse transcript files (TXT, SRT, VTT) into segment format compatible with the app.
 */

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
      segments.push({
        start_ms: startMs,
        end_ms: endMs,
        speaker: 'S1',
        text,
      })
    }
  }

  const rawText = segments.map(s => s.text).join(' ')
  return { segments, rawText }
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
      segments.push({
        start_ms: startMs,
        end_ms: endMs,
        speaker: 'S1',
        text,
      })
    }
  }

  const rawText = segments.map(s => s.text).join(' ')
  return { segments, rawText }
}

/**
 * Parse plain TXT: split by double newlines (paragraphs) or single newlines.
 * Assign sequential timestamps (~150 words/min ≈ 2.5 words/sec).
 */
function parseTXT(content: string): ParseResult {
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
    segments.push({
      start_ms: currentMs,
      end_ms: currentMs + durationMs,
      speaker: 'S1',
      text: para,
    })
    currentMs += durationMs
  }

  const rawText = segments.map(s => s.text).join('\n\n')
  return { segments, rawText }
}

/**
 * Parse transcript file content by extension.
 */
export function parseTranscriptFile(
  content: string,
  filename: string
): ParseResult {
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  if (ext === 'srt') return parseSRT(content)
  if (ext === 'vtt') return parseVTT(content)
  if (ext === 'txt') return parseTXT(content)
  // Default to TXT for unknown text files
  return parseTXT(content)
}
