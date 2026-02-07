/**
 * Adapter to convert between real database Sessions and v0 UI Session format
 */

import { Session as DbSession, SessionStatus as DbStatus } from '@/lib/types/database'
import { Session as V0Session, SessionStatus as V0Status } from '@/lib/types-v0'

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
  const speakers = additionalData?.transcript?.raw_json 
    ? extractSpeakers(additionalData.transcript.raw_json)
    : []

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

  // Get language: prefer transcript language, then session language, finally default to English
  const languageCode = additionalData?.transcript?.language || 
                       (dbSession as any).language || 
                       'en'
  
  return {
    id: dbSession.id,
    filename: additionalData?.filename || dbSession.internal_case_id || `Session ${dbSession.id.slice(0, 8)}`,
    duration: dbSession.duration_sec || 0,
    language: getLanguageDisplay(languageCode),
    createdAt: dbSession.created_at,
    status: mapStatus(dbSession.status),
    piiRedactionEnabled: false, // TODO: Get from user preferences or session metadata
    isOfflineCached: false, // TODO: Implement offline caching detection
    speakers,
    transcript: transcriptSegments,
    audioUrl: (dbSession as any).audio_url, // Include audio URL if available
    domain: (dbSession as any).recording_type || 'general',
    outputCount: (dbSession as any).output_count || 0, // Number of generated outputs
    extractedContext: (dbSession as any).ai_extracted_context || {}, // AI-extracted rich context
  }
}

/**
 * Extract unique speakers from transcript
 */
function extractSpeakers(transcriptSegments: any[]): any[] {
  const speakerMap = new Map()
  
  transcriptSegments.forEach((segment: any) => {
    if (segment.speaker && !speakerMap.has(segment.speaker)) {
      speakerMap.set(segment.speaker, {
        id: segment.speaker,
        name: segment.speaker,
        participantRole: 'party_a', // Default, could be enhanced
      })
    }
  })
  
  return Array.from(speakerMap.values())
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
 * Convert array of database Sessions to v0 format
 */
export function toV0Sessions(dbSessions: DbSession[]): V0Session[] {
  return dbSessions.map(session => toV0Session(session))
}
