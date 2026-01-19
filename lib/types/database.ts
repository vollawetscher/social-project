export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type SessionStatus = 'created' | 'uploading' | 'transcribing' | 'summarizing' | 'done' | 'error'
export type UserRole = 'user' | 'admin'
export type PIIType = 'name' | 'phone' | 'email' | 'address' | 'date'

export interface Profile {
  id: string
  email?: string
  phone_number?: string
  phone_verified_at?: string
  auth_method: 'email' | 'phone'
  role: UserRole
  display_name?: string
  created_at: string
}

export interface Session {
  id: string
  user_id: string | null
  created_at: string
  context_note: string
  internal_case_id: string
  status: SessionStatus
  duration_sec: number
  last_error: string
}

export interface File {
  id: string
  session_id: string
  storage_path: string
  mime_type: string
  size_bytes: number
  created_at: string
}

export interface TranscriptSegment {
  start_ms: number
  end_ms: number
  speaker: string
  text: string
  confidence?: number
}

export interface Transcript {
  id: string
  session_id: string
  raw_json: TranscriptSegment[]
  redacted_json: TranscriptSegment[]
  raw_text: string
  redacted_text: string
  language: string
  created_at: string
}

export interface PIIHit {
  id: string
  session_id: string
  type: PIIType
  placeholder: string
  original_hash: string
  start_ms: number
  end_ms: number
  created_at: string
}

export interface RohberichtMetadata {
  datum: string
  dauer: string
  setting: string
  beteiligte_rollen: string[]
}

export interface KernaussageZitat {
  quote: string
  timecode: string
  speaker: string
}

export interface RohberichtData {
  metadaten: RohberichtMetadata
  gespraechsverlauf_kurz: string[]
  kernaussagen_zitate: KernaussageZitat[]
  beobachtungen: string[]
  themen: string[]
  ressourcen_und_schutzfaktoren: string[]
  belastungen_und_risikoindikatoren: string[]
  offene_punkte: string[]
  naechste_schritte_vorschlag: string[]
}

export interface QualityNotes {
  audio_quality: string
  transcript_confidence: string
  pii_redaction_applied: boolean
}

export interface RohberichtJSON {
  session_id: string
  summary_short: string
  rohbericht: RohberichtData
  quality_notes: QualityNotes
}

export interface Report {
  id: string
  session_id: string
  claude_json: RohberichtJSON
  created_at: string
}
