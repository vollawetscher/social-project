export type ImportedTextContentType = 'email' | 'chat' | 'transcript' | 'note'
export type ImportedTextAuthorRole = 'self' | 'external' | 'mixed' | 'unknown'

export interface ImportedTextSourceSignals {
  contentType: ImportedTextContentType
  authorRole: ImportedTextAuthorRole
  isExternalInquiry: boolean
  confidence: number
  reasons: string[]
}

interface DetectImportedTextSourceInput {
  text: string
  filename?: string
  sessionName?: string
  userEmail?: string | null
  userDisplayName?: string | null
}

const HEADER_PATTERNS = [
  /(^|\n)\s*from:\s.+/i,
  /(^|\n)\s*to:\s.+/i,
  /(^|\n)\s*subject:\s.+/i,
  /(^|\n)\s*sent:\s.+/i,
]

const REPLY_CHAIN_PATTERNS = [
  /-----original message-----/i,
  /(^|\n)\s*on .+ wrote:\s*$/im,
  /(^|\n)\s*>.+/m,
]

const INQUIRY_PATTERNS = [
  /\b(can you|could you|would you|please)\b/i,
  /\b(i need|we need|i would like|we would like)\b/i,
  /\b(question|inquiry|request|quote|pricing|proposal)\b/i,
  /\bwhen can|how much|timeline|next steps\b/i,
]

const CHAT_MARKERS = [
  /(^|\n)\s*(you|user|human)\s+said:\s*$/im,
  /(^|\n)\s*(assistant|chatgpt|claude|ai)\s+said:\s*$/im,
]

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim()
}

function containsAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(text))
}

function countMatches(text: string, patterns: RegExp[]): number {
  return patterns.reduce((acc, p) => acc + (p.test(text) ? 1 : 0), 0)
}

function inferContentType(text: string, filename?: string, sessionName?: string): ImportedTextContentType {
  const file = String(filename || '').toLowerCase()
  const title = String(sessionName || '').toLowerCase()

  if (containsAny(text, CHAT_MARKERS)) return 'chat'
  if (file.endsWith('.eml') || file.endsWith('.msg')) return 'email'
  if (HEADER_PATTERNS.filter((p) => p.test(text)).length >= 2) return 'email'
  if (file.endsWith('.srt') || file.endsWith('.vtt')) return 'transcript'
  if (title.includes('pasted') && containsAny(text, HEADER_PATTERNS)) return 'email'
  return 'note'
}

function inferAuthorRole(
  text: string,
  userEmail?: string | null,
  userDisplayName?: string | null
): { role: ImportedTextAuthorRole; reasons: string[] } {
  const reasons: string[] = []
  const lowered = normalize(text)
  const userEmailLower = normalize(String(userEmail || ''))
  const userNameLower = normalize(String(userDisplayName || ''))

  const fromLineMatch = text.match(/(^|\n)\s*from:\s*([^\n]+)/i)
  const fromLine = normalize(fromLineMatch?.[2] || '')

  const fromMatchesUser =
    (!!userEmailLower && fromLine.includes(userEmailLower)) ||
    (!!userNameLower && fromLine.includes(userNameLower))

  if (fromLine) {
    if (fromMatchesUser) {
      reasons.push('from_matches_user')
      return { role: 'self', reasons }
    }
    reasons.push('from_differs_user')
    return { role: 'external', reasons }
  }

  // No explicit sender header. Use weak linguistic signals.
  const hasQuotedHistory = containsAny(text, REPLY_CHAIN_PATTERNS)
  const firstPersonHeavy = /\b(i|my|me)\b/i.test(lowered)
  const directRequest = containsAny(text, INQUIRY_PATTERNS)

  if (hasQuotedHistory && directRequest) {
    reasons.push('quoted_chain_and_request_language')
    return { role: 'external', reasons }
  }
  if (firstPersonHeavy && !directRequest) {
    reasons.push('first_person_without_inquiry')
    return { role: 'self', reasons }
  }

  reasons.push('insufficient_sender_signals')
  return { role: 'unknown', reasons }
}

export function detectImportedTextSource(input: DetectImportedTextSourceInput): ImportedTextSourceSignals {
  const text = input.text || ''
  const reasons: string[] = []
  const contentType = inferContentType(text, input.filename, input.sessionName)
  reasons.push(`content_type:${contentType}`)

  const author = inferAuthorRole(text, input.userEmail, input.userDisplayName)
  reasons.push(...author.reasons)

  const headerCount = countMatches(text, HEADER_PATTERNS)
  const hasInquiryLanguage = containsAny(text, INQUIRY_PATTERNS)
  const isExternalInquiry =
    contentType === 'email' &&
    (author.role === 'external' || author.role === 'mixed' || author.role === 'unknown') &&
    (headerCount >= 2 || hasInquiryLanguage)

  if (isExternalInquiry) reasons.push('external_inquiry_detected')

  const confidence = Math.max(
    0.35,
    Math.min(
      0.95,
      (contentType === 'email' ? 0.3 : 0.1) +
        (author.role === 'external' ? 0.35 : author.role === 'self' ? 0.2 : 0.1) +
        (headerCount >= 2 ? 0.2 : 0) +
        (hasInquiryLanguage ? 0.1 : 0)
    )
  )

  return {
    contentType,
    authorRole: author.role,
    isExternalInquiry,
    confidence,
    reasons,
  }
}
