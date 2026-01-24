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
export type FilePurpose = 'context' | 'meeting' | 'dictation' | 'instruction' | 'addition'
export type CaseStatus = 'active' | 'closed' | 'archived'

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

export interface Case {
  id: string
  user_id: string
  title: string
  client_identifier: string
  description: string
  status: CaseStatus
  created_at: string
  updated_at: string
}

export interface Session {
  id: string
  user_id: string | null
  case_id: string | null
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
  file_purpose: FilePurpose
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
  file_id: string | null
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

// Generic types for flexible reports
export type ReportDomain = 'social_work' | 'healthcare' | 'business' | 'education' | 'legal' | 'customer_service' | 'general'

export interface ReportMetadata {
  date: string
  duration: string
  setting: string
  participants: string[]
  topic?: string
  detected_domain?: ReportDomain
}

export interface KeyQuote {
  quote: string
  timecode: string
  speaker: string
  context?: string
}

export interface GenericReportData {
  metadata: ReportMetadata
  summary_points: string[]
  key_quotes: KeyQuote[]
  observations: string[]
  topics: string[]
  positive_aspects: string[]
  concerns_or_challenges: string[]
  open_questions: string[]
  suggested_next_steps: string[]
  // Domain-specific fields (optional)
  domain_specific?: Record<string, any>
}

export interface QualityNotes {
  audio_quality: string
  transcript_confidence: string
  pii_redaction_applied: boolean
}

export interface GenericReportJSON {
  session_id: string
  summary_short: string
  detected_domain: ReportDomain
  detected_language: string
  report: GenericReportData
  quality_notes: QualityNotes
}

// Legacy types for backward compatibility
export interface GespraechsberichtMetadata {
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

export interface GespraechsberichtData {
  metadaten: GespraechsberichtMetadata
  gespraechsverlauf_kurz: string[]
  kernaussagen_zitate: KernaussageZitat[]
  beobachtungen: string[]
  themen: string[]
  ressourcen_und_schutzfaktoren: string[]
  belastungen_und_risikoindikatoren: string[]
  offene_punkte: string[]
  naechste_schritte_vorschlag: string[]
}

export interface GespraechsberichtJSON {
  session_id: string
  summary_short: string
  gespraechsbericht: GespraechsberichtData
  quality_notes: QualityNotes
}

export interface Report {
  id: string
  session_id: string
  claude_json: GespraechsberichtJSON | GenericReportJSON
  created_at: string
}
