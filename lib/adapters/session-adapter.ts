/**
 * Adapter to convert between real database Sessions and v0 UI Session format
 */

import { Session as DbSession, SessionStatus as DbStatus } from '@/lib/types/database'
import { Session as V0Session, SessionStatus as V0Status } from '@/lib/types-v0'
import type { Domain } from '@/lib/types-v0'

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
    'uploading': 'uploading',
    'transcribing': 'transcribing',
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
  // Extract speakers from transcript if available
  let speakers = additionalData?.transcript?.raw_json 
    ? extractSpeakers(additionalData.transcript.raw_json)
    : []

  // Apply name corrections so S1/S2 show as real names (Christian, Azat, etc.)
  const nameCorrections = (dbSession as any).transcript_corrections?.name_corrections as Record<string, string> | undefined
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
    ? transformTranscriptSegments(additionalData.transcript.raw_json)
    : []

  // Map language codes to display names
  const getLanguageDisplay = (langCode: string) => {
    const languageMap: Record<string, string> = {
      'de': 'German (Deutsch)',
      'en': 'English',
      'es': 'Spanish (Español)',
      'fr': 'French (Français)',
      'it': 'Italian (Italiano)',
      'pt': 'Portuguese (Português)',
      'nl': 'Dutch (Nederlands)',
      'pl': 'Polish (Polski)',
    }
    return languageMap[langCode] || langCode.toUpperCase()
  }

  // Get language: prefer transcript language, then session language, finally default to German (app default)
  const languageCode = additionalData?.transcript?.language || 
                       (dbSession as any).language || 
                       'de'
  
  // Normalize extracted context - ensure participants are valid or fallback to speaker IDs
  const extractedContext = normalizeExtractedContext(rawContext, speakers)

  return {
    id: dbSession.id,
    filename: additionalData?.filename || dbSession.internal_case_id || `Session ${dbSession.id.slice(0, 8)}`,
    duration: dbSession.duration_sec || 0,
    language: getLanguageDisplay(languageCode),
    languageCode: typeof languageCode === 'string' ? languageCode.slice(0, 2).toLowerCase() : 'en',
    createdAt: dbSession.created_at,
    status: mapStatus(dbSession.status),
    piiRedactionEnabled: false, // TODO: Get from user preferences or session metadata
    isOfflineCached: false, // TODO: Implement offline caching detection
    speakers,
    transcript: transcriptSegments,
    audioUrl: (dbSession as any).audio_url, // Include audio URL if available
    domain: deriveDomain(dbSession),
    domains: (dbSession as any).suggested_domains || [], // 2-layer domain structure
    recordingType: (dbSession as any).recording_type,
    recordingTypeConfidence: (dbSession as any).recording_type_confidence,
    outputCount: (dbSession as any).output_count || 0, // Number of generated outputs
    extractedContext, // Normalized AI-extracted rich context
    transcriptCorrections: (dbSession as any).transcript_corrections || {}, // Alias system
    suggestedOutputFormats: (dbSession as any).suggested_output_formats || [],
    speechmaticsSummary: (dbSession as any).speechmatics_summary || undefined,
    recordedAt: (dbSession as any).recorded_at || undefined,
    ownerEmail: (dbSession as any).owner_email, // Admin view: session owner email
    lastError: (dbSession as any).last_error, // Transcription/processing error
  }
}

/**
 * Extract unique speakers from transcript (preserves order from first appearance).
 * Assigns party_a to first speaker, party_b to second, observer to rest.
 */
function extractSpeakers(transcriptSegments: any[]): any[] {
  const speakerMap = new Map<string, { id: string; name: string; participantRole: 'party_a' | 'party_b' | 'observer' }>()
  const order: string[] = []

  transcriptSegments.forEach((segment: any) => {
    if (segment.speaker && !speakerMap.has(segment.speaker)) {
      order.push(segment.speaker)
      const idx = order.length - 1
      const role: 'party_a' | 'party_b' | 'observer' =
        idx === 0 ? 'party_a' : idx === 1 ? 'party_b' : 'observer'
      speakerMap.set(segment.speaker, {
        id: segment.speaker,
        name: segment.speaker,
        participantRole: role,
      })
    }
  })

  return order.map(id => speakerMap.get(id)!)
}

/**
 * Transform transcript segments to v0 format
 */
function transformTranscriptSegments(dbSegments: any[]): any[] {
  return dbSegments.map((segment: any, index: number) => ({
    id: `seg_${index}`,
    speakerId: segment.speaker || 'unknown',
    speakerName: segment.speaker || 'Unknown',
    startTime: (segment.start_ms || 0) / 1000, // Convert milliseconds to seconds
    endTime: (segment.end_ms || 0) / 1000, // Convert milliseconds to seconds
    text: segment.text || '',
    isPiiRedacted: false,
  }))
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
