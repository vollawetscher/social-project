type TranscriptSegment = { speaker?: string; text?: string }

export type VoiceMessageSpeakerResolution = {
  participants: Array<{ name: string; role: string | null; isUser: boolean }>
  nameMap: Record<string, string>
  knownParticipantBlock: string
  reason: 'voice_message'
}

export type VoiceMessageContext = {
  visitorName: string | null
  speakerResolution: VoiceMessageSpeakerResolution | null
  addresseeCorrections: Record<string, string>
}

const VISITOR_NAME_PATTERN = /^Voice message from (.+?)(?:\n|$)/i

export function parseVoiceMessageVisitorName(session: {
  context_note?: string | null
  internal_case_id?: string | null
}): string | null {
  const fromContext = String(session.context_note || '').trim()
  const contextMatch = fromContext.match(VISITOR_NAME_PATTERN)
  if (contextMatch?.[1]) {
    return contextMatch[1].trim() || null
  }

  const fromCaseId = String(session.internal_case_id || '').trim()
  const caseMatch = fromCaseId.match(/^Voice message from (.+)$/i)
  if (caseMatch?.[1]) {
    return caseMatch[1].trim() || null
  }

  return null
}

function speakerLabelsInOrder(segments: TranscriptSegment[]): string[] {
  const seen = new Set<string>()
  const order: string[] = []
  for (const seg of segments) {
    const label = String(seg.speaker || 'S1').trim()
    if (!label || seen.has(label)) continue
    seen.add(label)
    order.push(label)
  }
  return order
}

function formatNamePart(part: string): string {
  if (!part) return part
  return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
}

function userNameParts(userName: string): string[] {
  return userName
    .trim()
    .split(/\s+/)
    .map((p) => p.toLowerCase())
    .filter((p) => p.length >= 2)
}

function namePartMatchesUser(spokenName: string, userParts: string[]): boolean {
  const spoken = spokenName.toLowerCase()
  return userParts.some(
    (part) =>
      part === spoken ||
      spoken.startsWith(part) ||
      part.startsWith(spoken)
  )
}

/**
 * Voice messages are addressed TO the meeting-link owner. If the opening
 * salutation uses Herr/Frau + a name that is not the owner's, treat it as ASR
 * mishearing the recipient and suggest correcting to the owner's surname.
 */
export function detectVoiceMessageAddresseeCorrections(
  segments: TranscriptSegment[],
  userName: string
): Record<string, string> {
  const userParts = userNameParts(userName)
  if (userParts.length === 0) return {}

  const surname = userParts[userParts.length - 1]
  const correctedSalutation = formatNamePart(surname)
  const earlyText = segments
    .slice(0, 5)
    .map((seg) => String(seg.text || '').trim())
    .filter(Boolean)
    .join(' ')

  if (!earlyText) return {}

  const corrections: Record<string, string> = {}
  const salutationPattern = /\b(Herr|Frau|Mr\.?|Ms\.?|Mrs\.?)\s+([A-ZÄÖÜ][a-zäöüß]+)\b/g
  let match: RegExpExecArray | null

  while ((match = salutationPattern.exec(earlyText)) !== null) {
    const fullMatch = match[0]
    const title = match[1]
    const spokenName = match[2]
    if (!fullMatch || !title || !spokenName) continue
    if (namePartMatchesUser(spokenName, userParts)) continue

    corrections[fullMatch] = `${title} ${correctedSalutation}`
  }

  return corrections
}

export function buildVoiceMessageSpeakerResolution(
  segments: TranscriptSegment[],
  visitorName: string,
  userName: string
): VoiceMessageSpeakerResolution | null {
  const labels = speakerLabelsInOrder(segments)
  if (labels.length === 0 || !visitorName.trim()) return null

  const recipientLabel = userName.trim() || 'Recipient'
  const nameMap: Record<string, string> = {}
  for (const label of labels) {
    nameMap[label] = visitorName.trim()
  }

  return {
    participants: [
      { name: visitorName.trim(), role: 'sender', isUser: false },
      { name: recipientLabel, role: 'recipient', isUser: true },
    ],
    nameMap,
    knownParticipantBlock: `${visitorName.trim()} (visitor who left the voice message), ${recipientLabel} (You, recipient / meeting link owner — not a speaker in this recording)`,
    reason: 'voice_message',
  }
}

export function resolveVoiceMessageContext(params: {
  segments: TranscriptSegment[]
  session: { context_note?: string | null; internal_case_id?: string | null }
  userName: string
}): VoiceMessageContext {
  const visitorName = parseVoiceMessageVisitorName(params.session)
  const speakerResolution =
    visitorName && params.segments.length > 0
      ? buildVoiceMessageSpeakerResolution(params.segments, visitorName, params.userName)
      : null
  const addresseeCorrections =
    params.userName.trim().length > 0
      ? detectVoiceMessageAddresseeCorrections(params.segments, params.userName)
      : {}

  return { visitorName, speakerResolution, addresseeCorrections }
}
