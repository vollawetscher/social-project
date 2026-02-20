/**
 * Quick peek heuristics to detect if a transcript file needs AI structuring.
 * SRT/VTT are considered already structured. TXT is checked for messy patterns
 * (chat logs, summaries, mixed formats).
 */

/**
 * Returns true if the content likely needs AI structuring before analysis.
 * Runs only on content - no API calls.
 */
export function needsStructureHeuristic(rawFileContent: string, filename: string): boolean {
  const trimmed = rawFileContent.trim()
  if (!trimmed || trimmed.length < 50) return false

  const ext = filename.split('.').pop()?.toLowerCase() || ''
  const lower = trimmed.toLowerCase()

  // Chat export format (ChatGPT "You said"/"ChatGPT said", User/Assistant) - parsed by transcript-parser
  if (/(?:^|\n)\s*(You said|ChatGPT said|User|Assistant)\s*:?\s*\n/i.test(trimmed)) return false

  // SRT/VTT: timed subtitle format = already structured, skip AI
  if (ext === 'srt' || ext === 'vtt') return false
  if (trimmed.includes('-->') && /\d{2}:\d{2}:\d{2}[.,]\d{3}/.test(trimmed)) return false
  if (lower.startsWith('webvtt')) return false

  // Speaker-labeled transcript (S1:, S2:, Speaker 1:, SPEAKER_00:) — already handled by parseTXT
  const speakerLabelLines = trimmed.split(/\r?\n/).filter(l =>
    /^\s*(S\d+|Speaker\s*\d+|Speaker_\d+|SPEAKER_\d+)\s*:\s+/i.test(l)
  )
  if (speakerLabelLines.length >= 2) return false

  // TXT: check for messy patterns (chat, summaries, mixed)
  const messyPatterns = [
    /\b(chat|message|pm|dm)\s*(from|by|with)?\s*:?/i,
    /\bsummary\s*:?\s*/i,
    /\bkey\s*points?\s*:?\s*/i,
    /\b(excerpt|excerpts?)\s*:?\s*/i,
    /\bconference\s*call\s*(notes?|summary|recap)?\s*:?\s*/i,
    /\bmeeting\s*(notes?|summary|recap)\s*:?\s*/i,
    /^\s*\d{1,2}:\d{2}\s*(am|pm)?\s+-?\s*[A-Za-z]/m,  // "10:32 - John:"
    /^\s*\[\d{1,2}:\d{2}\]\s*[A-Za-z]/m,              // "[10:32] John:"
    /^\s*\(\d{1,2}:\d{2}\)\s*[A-Za-z]/m,              // "(10:32) John:"
    /^[A-Za-z][a-z]*\s*\(\d{1,2}:\d{2}\)\s*:?\s*/m,   // "John (10:32):"
    /^[\*\-\•]\s+/m,                                   // bullet lists
    /^\d+\.\s+/m,                                      // numbered lists
  ]

  let score = 0
  for (const re of messyPatterns) {
    if (re.test(trimmed)) score++
    if (score >= 2) return true
  }

  // Many very short lines (chat-like)
  const lines = trimmed.split(/\r?\n/).filter((l) => l.trim().length > 0)
  const shortLines = lines.filter((l) => l.trim().length < 80).length
  if (lines.length >= 5 && shortLines / lines.length > 0.7) score++

  // Mixed line lengths and formats
  const hasColonSpeaker = /^[A-Za-z][^:\n]{0,30}\s*:\s+/.test(trimmed)
  const hasTimestamp = /\d{1,2}:\d{2}/.test(trimmed)
  if (hasColonSpeaker && hasTimestamp && lines.length >= 3) score++

  return score >= 2
}
