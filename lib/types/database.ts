export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type SessionStatus = 'created' | 'recording' | 'uploading' | 'transcribing' | 'summarizing' | 'done' | 'error'
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
  auto_generate_reports?: boolean  // User preference: auto-generate reports after transcription
  preferences?: Json  // Additional user preferences for future extensibility
  created_at: string
  onboarding_expires_at?: string | null  // Trial expiry set when callee claims a call
  meeting_slug?: string | null
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
  archived_at?: string | null
  retention_days: number
  last_output_at?: string | null
  scheduled_deletion_at?: string | null
  project_type?: string | null
  user_role?: string | null
  default_session_purpose?: string | null
  event_metadata?: EventMetadata | null
}

// Confirmed, web-enriched identity for an "Event" project. Free-form values
// resolved from the public web (a speaker name + recording date) and confirmed
// by the user. Null until enriched and confirmed.
export interface EventMetadata {
  event_name: string
  venue?: string
  address?: string
  dates?: string
  official_speakers?: string[]
  agenda_url?: string | null
  source_url?: string | null
  confirmed: boolean
}

// A single resolved person in the cross-session digest. People at an event are
// extracted from spoken content + session labels, so identity is best-effort.
export interface EventDigestPerson {
  name: string
  affiliation?: string
  note?: string
}

// Project-level cross-session digest for an Event project.
export interface EventDigestContent {
  event_name?: string
  key_takeaways: string[]
  // People who spoke/presented in the recorded talks (affiliation pulled from
  // the official roster + the session titles the attendee wrote).
  presenters?: EventDigestPerson[]
  // People the attendee personally met in conversation/networking — NOT stage
  // presenters. Often empty for a talk-heavy event.
  people_met: EventDigestPerson[]
  follow_ups: string[]
  narrative?: string
  language?: string
}

export interface EventDigest {
  id: string
  case_id: string
  content: EventDigestContent
  source_session_ids: string[]
  version: number
  created_at: string
}

export interface Session {
  id: string
  user_id: string | null
  case_id: string | null
  merged_into_session_id?: string | null
  created_at: string
  context_note: string  // Deprecated - use context_text instead
  context_text?: string  // New: transcribable/editable context
  context_text_locked?: boolean  // Lock status for context_text
  private_comments?: string  // Private notes (not in report)
  private_comments_locked?: boolean  // Lock status for private_comments
  instructions?: string  // Instructions for report generation
  instructions_locked?: boolean  // Lock status for instructions
  internal_case_id: string
  status: SessionStatus
  duration_sec: number
  last_error: string
  preferred_report_language?: 'de' | 'en' | null  // User override for report language (null = auto-detect)
  // User-declared session purpose (Phase 3). Canonical when purpose_source = 'user';
  // back-filled from analyze with purpose_source = 'ai' when the user does not provide one.
  purpose?: string | null
  purpose_source?: 'user' | 'ai' | null
  structured_context?: {
    meeting_type?: string
    participants?: Array<{ name: string; role?: string; party?: string }>
    agenda?: Array<{ number?: string; title: string; description?: string }>
    date?: string
    location?: string
    notes?: string
  }
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
// Broad categories for consistency, with optional subdomain for specificity
export type ReportDomain = 
  | 'social_work'           // Social work, case management
  | 'healthcare'            // Medical, nursing, patient care (physical health)
  | 'mental_health'         // Therapy, counseling, psychology
  | 'business'              // General business, management, strategy
  | 'finance'               // Banking, insurance, investments, accounting
  | 'human_resources'       // HR, recruiting, personnel management
  | 'public_services'       // Government, administration, public sector
  | 'legal'                 // Law, contracts, legal advice
  | 'education'             // Teaching, training, academic
  | 'technology'            // IT support, software, engineering
  | 'customer_service'      // Customer support, service inquiries
  | 'creative'              // Media, marketing, design, research
  | 'general'               // Other or mixed domains

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
  detected_subdomain?: string        // Free-form specific subdomain (e.g., "HR Recruiting", "Trauma Therapy")
  domain_description?: string        // Natural language description of the domain/topic
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
