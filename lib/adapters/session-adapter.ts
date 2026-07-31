/**
 * Adapter to convert between real database Sessions and v0 UI Session format
 */

import { Session as DbSession, SessionStatus as DbStatus } from '@/lib/types/database'
import { Session as V0Session, SessionStatus as V0Status } from '@/lib/types-v0'
import type { Domain } from '@/lib/types-v0'
import {
  CALL_NOTE_SPEAKER_ID,
  getCallNoteAuthor,
  isCallNoteSegment,
} from '@/lib/services/merge-call-notes'
import { resolveMergedSpeakerId } from '@/lib/utils/speaker-resolution'

const PRIMARY_TO_DOMAIN: Record<string, Domain> = {
  medical: 'medical',
  legal: 'legal',
  law: 'legal',
  sales: 'sales',
  hr: 'hr',
  'human resources': 'hr',
  education: 'education',
  consulting: 'consulting',
  finance: 'consulting',
  insurance: 'consulting',
  general: 'general',
}

const RECORDING_TYPE_TO_DOMAIN: Record<string, Domain> = {
  sales_call: 'sales',
  legal_deposition: 'legal',
  meeting: 'general',
  interview: 'hr',
  consultation: 'general',
  lecture: 'education',
  other: 'general',
}

function deriveDomain(dbSession: any): Domain {
  const domains = dbSession.suggested_domains as Array<{ primary?: string; specialty?: string; domain?: string }> | undefined
  if (domains && domains.length > 0) {
    const primary = (domains[0].primary || domains[0].domain || '').toLowerCase().trim()
    if (primary && PRIMARY_TO_DOMAIN[primary]) return PRIMARY_TO_DOMAIN[primary]
    for (const [key, tag] of Object.entries(PRIMARY_TO_DOMAIN)) {
      if (primary.includes(key)) return tag
    }
  }
  const rt = dbSession.recording_type as string | undefined
  if (rt && RECORDING_TYPE_TO_DOMAIN[rt]) return RECORDING_TYPE_TO_DOMAIN[rt]
  return 'general'
}

/**
 * Map database session status to v0 UI status
 */
export function mapStatus(dbStatus: DbStatus): V0Status {
  const statusMap: Record<DbStatus, V0Status> = {
    'created': 'uploading',
    'recording': 'recording',
    'uploading': 'uploading',
    'transcribing': 'transcribing',
    'awaiting_speaker_review': 'awaiting_speaker_review',
    'summarizing': 'transcribing',
    'done': 'ready',
    'error': 'failed',
  }
  return statusMap[dbStatus] || 'failed'
}

/**
 * Convert database Session to v0 UI Session format
 */
export function toV0Session(dbSession: DbSession, additionalData?: {
  filename?: string
  transcript?: any
  files?: any[]
}): V0Session {
  const corrections = ((dbSession as any).transcript_corrections || {}) as Record<string, any>
  const speakerNameMap = (corrections.speaker_name_map || corrections.name_corrections || {}) as Record<string, string>
  const speakerMergeMap = (corrections.speaker_merge_map || {}) as Record<string, string>

  // Extract speakers from transcript if available
  let speakers = additionalData?.transcript?.raw_json 
    ? extractSpeakers(additionalData.transcript.raw_json, speakerMergeMap, speakerNameMap)
    : []

  // Apply name corrections so S1/S2 show as real names (Christian, Azat, etc.)
  const nameCorrections = speakerNameMap
  if (nameCorrections && Object.keys(nameCorrections).length > 0) {
    speakers = speakers.map(s => ({
      ...s,
      name: nameCorrections[s.name] || nameCorrections[s.id] || s.name,
    }))
  }

  // Fallback: use extractedContext participants if no name_corrections (match by order)
  const rawContext = (dbSession as any).ai_extracted_context || {}
  const participantNames = Array.isArray(rawContext.participants)
    ? rawContext.participants.map((p: any) => typeof p === 'string' ? p : p?.name).filter(Boolean)
    : []
  if (participantNames.length >= speakers.length && speakers.some(s => /^S\d+$/i.test(s.name))) {
    speakers = speakers.map((s, idx) => ({
      ...s,
      name: participantNames[idx] || s.name,
    }))
  }

  // Transform transcript segments
  const transcriptSegments = additionalData?.transcript?.raw_json
    ? transformTranscriptSegments(additionalData.transcript.raw_json, speakerMergeMap, speakerNameMap)
    : []

  // Map language codes to display names
  const getLanguageDisplay = (langCode: string) => {
    const languageMap: Record<string, string> = {
      'auto': 'Auto',
      'de': 'German',
      'en': 'English',
      'es': 'Spanish',
      'fr': 'French',
      'it': 'Italian',
      'pt': 'Portuguese',
      'nl': 'Dutch',
      'pl': 'Polish',
      'cs': 'Czech',
      'da': 'Danish',
      'fi': 'Finnish',
      'no': 'Norwegian',
      'sv': 'Swedish',
      'ru': 'Russian',
      'ja': 'Japanese',
      'zh': 'Chinese',
      'ko': 'Korean',
      'ar': 'Arabic',
      'hi': 'Hindi',
      'th': 'Thai',
      'tr': 'Turkish',
      'vi': 'Vietnamese',
    }
    return languageMap[langCode] || langCode.toUpperCase()
  }

  // Session language = user's configured language; transcript language is only used for mismatch detection
  const languageCode = (dbSession as any).language || 
                       additionalData?.transcript?.language || 
                       'de'
  
  // Normalize extracted context - ensure participants are valid or fallback to speaker IDs
  const extractedContext = normalizeExtractedContext(rawContext, speakers)

  return {
    id: dbSession.id,
    filename: additionalData?.filename || dbSession.internal_case_id || `Session ${dbSession.id.slice(0, 8)}`,
    duration: dbSession.duration_sec ?? null,
    language: getLanguageDisplay(languageCode),
    languageCode: languageCode === 'auto' ? 'auto'
      : typeof languageCode === 'string' ? languageCode.slice(0, 2).toLowerCase()
      : 'auto',
    createdAt: dbSession.created_at,
    status: mapStatus(dbSession.status),
    piiRedactionEnabled: false, // TODO: Get from user preferences or session metadata
    isOfflineCached: false, // TODO: Implement offline caching detection
    speakers,
    transcript: transcriptSegments,
    audioUrl: (dbSession as any).audio_url
      || additionalData?.files?.find((f: any) => f.signed_url)?.signed_url
      || undefined,
    domain: deriveDomain(dbSession),
    domains: (dbSession as any).suggested_domains || [], // 2-layer domain structure
    recordingType: (dbSession as any).user_recording_type || (dbSession as any).recording_type,
    recordingTypeConfidence: (dbSession as any).user_recording_type
      ? 1.0
      : (dbSession as any).recording_type_confidence,
    outputCount: (dbSession as any).output_count || 0, // Number of generated outputs
    extractedContext, // Normalized AI-extracted rich context
    transcriptCorrections: corrections, // Alias system
    suggestedOutputFormats: (dbSession as any).suggested_output_formats || [],
    speechmaticsSummary: (dbSession as any).speechmatics_summary || undefined,
    recordedAt: (dbSession as any).recorded_at || undefined,
    ownerEmail: (dbSession as any).owner_email, // Admin view: session owner email
    ownerId: (dbSession as any).user_id, // For hand-off: show control when owner
    lastError: (dbSession as any).last_error, // Transcription/processing error
    isFromCall: (dbSession as any).is_from_call || false, // Callee's forked session from a call
    isSharedWithMe: Boolean((dbSession as any).is_shared_with_me), // Session is shared with caller (they are a collaborator, not owner)
    consentLogs: (dbSession as any).consent_logs || [],
    uploadSizeBytes: Number((dbSession as any).upload_size_bytes || 0),
    textUploadSizeBytes: Number((dbSession as any).text_upload_size_bytes || 0),
    inputHint: (dbSession as any).input_hint ?? undefined,
    userIsSpeaker: (dbSession as any).user_is_speaker ?? null,
    hasAudioFile: Boolean((dbSession as any).has_audio_file),
    wordCount: (dbSession as any).word_count ?? null,
    caseId: (dbSession as any).case_id ?? null,
    caseTitle: (dbSession as any).case?.title ?? null,
    curated: Boolean((dbSession as any).curated),
    ownerContext: ((dbSession as any).owner_context as V0Session['ownerContext']) ?? null,
    pendingClarification: ((dbSession as any).pending_clarification as V0Session['pendingClarification']) ?? null,
    purpose: ((dbSession as any).purpose as string | null | undefined) ?? null,
    purposeSource: ((dbSession as any).purpose_source as V0Session['purposeSource']) ?? null,
  }
}

/**
 * Extract unique speakers from transcript (preserves order from first appearance).
 * Assigns party_a to first speaker, party_b to second, observer to rest.
 */
function extractSpeakers(
  transcriptSegments: any[],
  speakerMergeMap: Record<string, string>,
  speakerNameMap: Record<string, string>
): any[] {
  const speakerMap = new Map<string, { id: string; name: string; participantRole: 'party_a' | 'party_b' | 'observer' }>()
  const order: string[] = []

  transcriptSegments.forEach((segment: any) => {
    if (isCallNoteSegment(segment)) return
    const rawSpeaker = String(segment.speaker || '').trim()
    if (!rawSpeaker) return
    const mergedSpeaker = resolveMergedSpeakerId(rawSpeaker, speakerMergeMap)
    if (!speakerMap.has(mergedSpeaker)) {
      order.push(mergedSpeaker)
      const idx = order.length - 1
      const role: 'party_a' | 'party_b' | 'observer' =
        idx === 0 ? 'party_a' : idx === 1 ? 'party_b' : 'observer'
      speakerMap.set(mergedSpeaker, {
        id: mergedSpeaker,
        name: speakerNameMap[mergedSpeaker] || mergedSpeaker,
        participantRole: role,
      })
    }
  })

  return order.map(id => speakerMap.get(id)!)
}

/**
 * Transform transcript segments to v0 format
 */
function transformTranscriptSegments(
  dbSegments: any[],
  speakerMergeMap: Record<string, string>,
  speakerNameMap: Record<string, string>
): any[] {
  return dbSegments.map((segment: any, index: number) => {
    const isNote = isCallNoteSegment(segment)
    const noteAuthor = getCallNoteAuthor(segment)
    const mergedSpeakerId = isNote
      ? CALL_NOTE_SPEAKER_ID
      : resolveMergedSpeakerId(segment.speaker || 'unknown', speakerMergeMap)

    return {
      id: `seg_${index}`,
      speakerId: mergedSpeakerId,
      speakerName: isNote
        ? (noteAuthor || 'Session owner')
        : (speakerNameMap[mergedSpeakerId] || mergedSpeakerId),
      startTime: (segment.start_ms || 0) / 1000,
      endTime: (segment.end_ms || 0) / 1000,
      text: segment.text || '',
      isPiiRedacted: false,
      isCallNote: isNote,
      noteAuthorName: noteAuthor,
    }
  })
}

/**
 * Normalize extracted context to ensure participants are valid
 * Fallback to speaker IDs (S1, S2, etc.) if AI couldn't detect names
 */
function normalizeExtractedContext(rawContext: any, speakers: any[]): any {
  if (!rawContext || typeof rawContext !== 'object') {
    return {}
  }

  // Normalize participants
  let participants = rawContext.participants || []
  
  // If participants is empty or invalid, fallback to speaker IDs
  if (!Array.isArray(participants) || participants.length === 0) {
    participants = speakers.map(speaker => ({
      name: speaker.name, // S1, S2, S3, etc.
      role: null,
      isUser: false
    }))
  } else {
    // Ensure all participants are proper objects with name field
    participants = participants.map((p: any, idx: number) => {
      if (typeof p === 'string') {
        return { name: p, role: null, isUser: false }
      } else if (p && typeof p === 'object' && p.name) {
        return {
          name: p.name || speakers[idx]?.name || `Speaker ${idx + 1}`,
          role: p.role || null,
          isUser: p.isUser || false
        }
      } else {
        // Invalid participant object - fallback to speaker ID
        return {
          name: speakers[idx]?.name || `S${idx + 1}`,
          role: null,
          isUser: false
        }
      }
    })
  }

  return {
    ...rawContext,
    participants
  }
}

/**
 * Convert array of database Sessions to v0 format
 */
export function toV0Sessions(dbSessions: DbSession[]): V0Session[] {
  return dbSessions.map(session => toV0Session(session))
}
