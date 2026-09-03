/**
 * When session analysis may run, and how listener/owner role must reshape
 * the transcript before that expensive Claude call.
 */

export type OwnerContextLike = {
  role?: string | null
  speakerId?: string | null
  source?: string | null
  goal?: string | null
  counterpartyRole?: string | null
}

function normalizePersonName(value: string | null | undefined): string {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s'-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function namesLooselyMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = normalizePersonName(a)
  const right = normalizePersonName(b)
  if (!left || !right) return false
  return left === right || left.includes(right) || right.includes(left)
}

export function hasConfirmedOwnerRole(ownerContext: unknown): boolean {
  if (!ownerContext || typeof ownerContext !== 'object') return false
  const role = String((ownerContext as OwnerContextLike).role || '').trim()
  return role.length > 0
}

const LISTENER_ROLE_RE =
  /\b(listener|observer|zuh[oö]rer|oyente|recipient|empf[aä]nger|not[_\s-]?speaker|not in(?: the)? recording)\b/i

export function isListenerOwnerRole(ownerContext: OwnerContextLike | null | undefined): boolean {
  if (!ownerContext) return false
  if (ownerContext.source === 'not_speaker') return true
  const role = String(ownerContext.role || '').trim()
  const speakerId = String(ownerContext.speakerId || '').trim()
  if (!speakerId && LISTENER_ROLE_RE.test(role)) return true
  if (!role) return false
  return LISTENER_ROLE_RE.test(role)
}

export function uniqueSpeakerLabels(
  segments: Array<{ speaker?: string; isCallNote?: boolean }>
): string[] {
  const seen = new Set<string>()
  const order: string[] = []
  for (const seg of segments || []) {
    if (seg?.isCallNote) continue
    const label = String(seg?.speaker || '').trim()
    if (!label || seen.has(label)) continue
    seen.add(label)
    order.push(label)
  }
  return order
}

export function resolveAutoOwnerContext(params: {
  ownerContext?: unknown
  userIsSpeaker?: boolean | null
  inputHint?: string | null
  speakers?: string[]
}): { role: string; speakerId: string | null; source: 'auto' | 'not_speaker'; updatedAt: string } | null {
  if (hasConfirmedOwnerRole(params.ownerContext)) return null

  const hint = String(params.inputHint || '').trim()
  if (params.userIsSpeaker === false || hint === 'voice_message') {
    return {
      role: 'observer',
      speakerId: null,
      source: 'not_speaker',
      updatedAt: new Date().toISOString(),
    }
  }

  const speakers = (params.speakers || []).map((s) => String(s || '').trim()).filter(Boolean)
  if (speakers.length === 1) {
    return {
      role: 'speaker',
      speakerId: speakers[0] || null,
      source: 'auto',
      updatedAt: new Date().toISOString(),
    }
  }

  return null
}

export function applyListenerTranscriptAdjustments(
  corrections: Record<string, any> | null | undefined,
  ownerName: string
): Record<string, any> {
  const current = { ...(corrections || {}) }
  const existingMap = {
    ...((current.speaker_name_map || {}) as Record<string, string>),
    ...((current.name_corrections || {}) as Record<string, string>),
  }
  const nextMap: Record<string, string> = {}
  let removed = false
  for (const [from, to] of Object.entries(existingMap)) {
    if (namesLooselyMatch(from, ownerName) || namesLooselyMatch(String(to), ownerName)) {
      removed = true
      continue
    }
    nextMap[from] = String(to)
  }
  if (!removed) return current
  return {
    ...current,
    speaker_name_map: nextMap,
    name_corrections: nextMap,
  }
}

export function stripOwnerNameFromDisplayMap(
  nameMap: Record<string, string>,
  ownerName: string
): Record<string, string> {
  const next: Record<string, string> = {}
  for (const [from, to] of Object.entries(nameMap || {})) {
    if (namesLooselyMatch(from, ownerName) || namesLooselyMatch(to, ownerName)) continue
    next[from] = to
  }
  return next
}

/**
 * Send the whole transcript when it fits. If not, keep start + end — never
 * only the first segment (a 6-minute recording can be 9 long turns).
 */
export function buildTranscriptSample(
  segments: Array<{ speaker?: string; text?: string }>,
  formatSegment: (seg: (typeof segments)[number]) => string,
  maxChars = 12000
): string {
  const lines = (segments || []).map(formatSegment).filter((line) => String(line || '').trim())
  if (lines.length === 0) return ''
  const full = lines.join('\n')
  if (full.length <= maxChars) return full

  if (lines.length === 1) {
    const line = lines[0]
    const headLen = Math.floor(maxChars * 0.6)
    const tailLen = maxChars - headLen - 8
    return `${line.slice(0, headLen)}\n---\n${line.slice(-tailLen)}`
  }

  const headBudget = Math.floor(maxChars * 0.55)
  const tailBudget = maxChars - headBudget - 8
  let head = ''
  for (const line of lines) {
    const next = head ? `${head}\n${line}` : line
    if (next.length > headBudget) break
    head = next
  }
  if (!head) head = lines[0].slice(0, headBudget)

  let tail = ''
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i]
    const next = tail ? `${line}\n${tail}` : line
    if (next.length > tailBudget) break
    tail = next
  }
  if (!tail) tail = lines[lines.length - 1].slice(-tailBudget)

  const headLast = head.split('\n').pop()
  const tailFirst = tail.split('\n')[0]
  if (head && tail && headLast !== tailFirst) {
    return `${head}\n\n---\n\n${tail}`
  }
  return (head || tail).slice(0, maxChars)
}
