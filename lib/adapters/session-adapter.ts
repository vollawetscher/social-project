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
  return {
    id: dbSession.id,
    filename: additionalData?.filename || dbSession.internal_case_id || `Session ${dbSession.id.slice(0, 8)}`,
    duration: dbSession.duration_sec || 0,
    language: additionalData?.transcript?.language || 'English',
    createdAt: dbSession.created_at,
    status: mapStatus(dbSession.status),
    piiRedactionEnabled: false, // TODO: Get from user preferences or session metadata
    isOfflineCached: false, // TODO: Implement offline caching detection
    speakers: [], // TODO: Extract from transcript
    transcript: [], // TODO: Transform transcript segments
  }
}

/**
 * Convert array of database Sessions to v0 format
 */
export function toV0Sessions(dbSessions: DbSession[]): V0Session[] {
  return dbSessions.map(session => toV0Session(session))
}
