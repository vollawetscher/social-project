/**
 * Extracts a shortened sample from generated output for template preview.
 * Format: headings, first sentence per section, short numbered bullet points (1, 2, 3).
 */

const MAX_BULLETS_PER_SECTION = 4
const MAX_FIRST_SENTENCE_LENGTH = 120

function getFirstSentence(text: string): string {
  const trimmed = text.trim()
  if (!trimmed) return ''
  // Match first sentence: ends at . ! ? or newline
  const match = trimmed.match(/^[^.!?\n]+[.!?]?/)
  const sentence = match ? match[0].trim() : trimmed
  if (sentence.length <= MAX_FIRST_SENTENCE_LENGTH) return sentence
  return sentence.slice(0, MAX_FIRST_SENTENCE_LENGTH - 3) + '...'
}

function normalizeBullet(line: string): string {
  // Remove leading - * • or numbers, trim
  return line.replace(/^[\s]*[-*•]\s*/, '').replace(/^\d+\.\s*/, '').trim()
}

function extractBullets(text: string): string[] {
  const lines = text.split('\n')
  const bullets: string[] = []
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue
    // Match lines starting with - * • or 1. 2. etc
    if (/^[-*•]\s/.test(trimmed) || /^\d+\.\s/.test(trimmed)) {
      const content = normalizeBullet(trimmed)
      if (content.length > 0) bullets.push(content)
      if (bullets.length >= MAX_BULLETS_PER_SECTION) break
    }
  }
  return bullets
}

export function extractSampleFromOutput(content: string): string {
  if (!content || typeof content !== 'string') return ''

  const lines = content.split('\n')
  const sections: { heading: string; firstSentence: string; bullets: string[] }[] = []
  let currentHeading = ''
  let currentBody = ''

  for (const line of lines) {
    const trimmed = line.trim()
    // Match ## Heading or # Heading
    const headingMatch = trimmed.match(/^#{1,6}\s+(.+)$/)
    if (headingMatch) {
      if (currentHeading || currentBody) {
        const firstSentence = getFirstSentence(currentBody)
        const bullets = extractBullets(currentBody)
        sections.push({
          heading: currentHeading,
          firstSentence,
          bullets,
        })
      }
      currentHeading = headingMatch[1].trim()
      currentBody = ''
    } else if (currentHeading) {
      currentBody += (currentBody ? '\n' : '') + trimmed
    } else if (!currentHeading && trimmed) {
      // Content before first heading - treat as intro
      currentHeading = 'Overview'
      currentBody = trimmed
    }
  }

  if (currentHeading || currentBody) {
    const firstSentence = getFirstSentence(currentBody)
    const bullets = extractBullets(currentBody)
    sections.push({
      heading: currentHeading || 'Content',
      firstSentence,
      bullets,
    })
  }

  // If no markdown headings, treat whole content as one section
  if (sections.length === 0 && content.trim()) {
    const firstSentence = getFirstSentence(content)
    const bullets = extractBullets(content)
    sections.push({
      heading: 'Content',
      firstSentence,
      bullets,
    })
  }

  // Build output markdown
  const parts: string[] = []
  for (const s of sections) {
    parts.push(`## ${s.heading}`)
    if (s.firstSentence) parts.push(s.firstSentence)
    if (s.bullets.length > 0) {
      parts.push('')
      s.bullets.forEach((b, i) => parts.push(`${i + 1}. ${b}`))
    }
    parts.push('')
  }
  return parts.join('\n').trim()
}
