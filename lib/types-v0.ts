// Core enums and types for Notissima

export type SessionStatus = 'recording' | 'uploading' | 'transcribing' | 'ready' | 'failed'

export type RecordingType = 
  | 'meeting'                  // In-person or virtual meeting
  | 'interview'                // Job, media, or research interview
  | 'presentation'             // Lecture, webinar, training session
  | 'consultation'             // Professional advice, client consultation
  | 'call_inbound'             // Incoming phone call
  | 'call_outbound'            // Outgoing phone call
  | 'dictation'                // Voice memo, notes, letter dictation
  | 'ai_agent_conversation'    // Conversation with AI assistant
  | 'legal_deposition'         // Legacy: legal deposition
  | 'sales_call'               // Legacy: sales call
  | 'lecture'                  // Legacy: lecture
  | 'other'

export type Domain =
  | 'psychology'
  | 'medical'
  | 'sales'
  | 'legal'
  | 'education'
  | 'it'
  | 'consulting'
  | 'hr'
  | 'general'
  | 'meetings'
  | 'business'
  | 'support'
  | 'technical'

// Participant role in the conversation (assigned at transcription level)
export type ParticipantRole = 'party_a' | 'party_b' | 'observer'
export type OutputPerspective = ParticipantRole | 'reader_facing'

// Semantic labels for participant roles based on domain context
export type SemanticRole = 
  | 'lawyer' 
  | 'client' 
  | 'sales_rep' 
  | 'prospect' 
  | 'interviewer' 
  | 'candidate' 
  | 'doctor' 
  | 'patient'
  | 'consultant'
  | 'teacher'
  | 'student'
  | 'moderator'
  | 'participant'

export type Audience = 'internal' | 'external' | 'client' | 'legal' | 'executive'

export type OutputTone = 'direct' | 'neutral' | 'formal' | 'casual' | 'funny' | 'technical'
export type OutputLengthPreference = 'short' | 'medium' | 'long'

export type OutputFormat = 'markdown' | 'json' | 'email'
export type TemplateOutputFormat = 'markdown' | 'json' | 'email_text'

export type UserRole = 'internal' | 'external' // Declaration of UserRole

export interface Speaker {
  id: string
  name: string
  participantRole: ParticipantRole // party_a, party_b, or observer
  semanticRole?: SemanticRole // e.g., lawyer, client - inferred from domain
}

export interface TranscriptSegment {
  id: string
  speakerId: string
  speakerName: string
  startTime: number
  endTime: number
  text: string
  isPiiRedacted?: boolean
  /** Typed in-call note from the session owner — not spoken audio. */
  isCallNote?: boolean
  noteAuthorName?: string
}

export interface DomainDetection {
  primary: string      // Broad category (Medical, Legal, Sales, etc.)
  specialty?: string   // Specific field (Cardiology, Tax Law, etc.)
  confidence: number   // 0-1 confidence score
  description?: string // Brief description
  domain?: string      // Fallback for legacy simple domain
}

export interface TranscriptCorrections {
  name_corrections?: Record<string, string>  // "Hazard" → "Azat"
  speaker_name_map?: Record<string, string>  // "S1" -> "Christian"
  speaker_merge_map?: Record<string, string> // "S3" -> "S2"
  segment_speaker_overrides?: Record<string, string> // segment index → speaker label (per-segment diarization fix)
  pii_redactions?: Record<string, string>     // "John Smith" → "[NAME_1]"
  word_corrections?: Record<string, string>  // "SPQR" → "speaker", "Maître Spet" → "Mattress Bed"
  accepted_suggestions?: string[]
}

export interface Session {
  id: string
  filename: string
  duration: number | null
  language: string
  languageCode?: string  // ISO code (en, de, etc) for API calls
  createdAt: string
  status: SessionStatus
  piiRedactionEnabled: boolean
  isOfflineCached: boolean
  recordingType?: RecordingType
  recordingTypeConfidence?: number
  domain?: Domain // Legacy single domain (deprecated)
  domainConfidence?: number // Legacy confidence (deprecated)
  domains?: DomainDetection[] // New 2-layer domain structure
  speakers: Speaker[]
  transcript: TranscriptSegment[]
  extractedContext?: ExtractedContext
  audioUrl?: string // Optional audio file URL
  outputCount?: number // Number of generated outputs for this session
  transcriptCorrections?: TranscriptCorrections // Alias system for corrections & PII
  suggestedOutputFormats?: SuggestedOutputFormat[] // AI-suggested output formats for this session (domain-aware)
  speechmaticsSummary?: string // Canonical session summary (generated during AI analysis)
  recordedAt?: string // Date/time from audio file metadata when available (ISO string)
  ownerEmail?: string // Admin view: session owner email
  ownerId?: string // Session owner user_id (for hand-off visibility)
  lastError?: string // Transcription or processing error message
  isFromCall?: boolean // True when this session was forked from a caller's session (callee claim)
  isSharedWithMe?: boolean // True when the caller is a collaborator on this session (not the owner)
  consentLogs?: Array<{ participant_name: string; participant_identity: string; granted: boolean; created_at: string }>
  uploadSizeBytes?: number
  textUploadSizeBytes?: number
  inputHint?: string // Creation-time hint: phone_call | video_call | quick_record | voice_note | voice_message | meeting | presentation | trade_show
  userIsSpeaker?: boolean | null // Whether the user is a speaker in this recording
  hasAudioFile?: boolean // True when at least one audio/video file is attached
  wordCount?: number | null // Word count for text-only imports; null for audio sessions
  caseId?: string | null // Project/case this session belongs to
  caseTitle?: string | null // Project/case display title (denormalized for list rendering)
  curated?: boolean // True when session was prepared as a curated trial import — hides destructive controls
  ownerContext?: OwnerContext | null // Structured context about the session owner's role in the conversation
  pendingClarification?: PendingClarification | null // LLM-emitted question to disambiguate owner role
}

export interface OwnerContext {
  role?: string // e.g. 'applicant', 'interviewer', 'patient', 'consultant' — omitted when source is 'dismissed'
  speakerId?: string | null // Transcript speaker label (S1, S2, ...) the owner corresponds to, or null if not in recording
  goal?: string | null // One-line goal summary
  counterpartyRole?: string | null
  confidence?: number | null
  source?: 'user' | 'inferred' | 'dismissed'
  updatedAt?: string
}

export interface ClarificationOption {
  id: string
  label: string
  suggestedContext?: Partial<OwnerContext> | null
}

export interface PendingClarification {
  question: string
  options: ClarificationOption[]
  allowFreeText: boolean
  createdAt?: string
}

export interface ParticipantInfo {
  name: string
  role?: string
  isUser?: boolean
}

export interface ExtractedContext {
  participants: (string | ParticipantInfo)[] // Can be string (legacy) or ParticipantInfo object
  purpose: string
  agenda: string[]
  venue: string
  sourceSignals?: {
    contentType?: 'email' | 'chat' | 'transcript' | 'note'
    authorRole?: 'self' | 'external' | 'mixed' | 'unknown'
    isExternalInquiry?: boolean
    confidence?: number
    reasons?: string[]
  } | null
  consent?: {
    discussed: boolean
    participantsConsented?: string[]
    summary?: string | null
  } | null
  spokenCommands?: Array<{
    phrase: string
    speaker: string
    intentSummary?: string
  }> | null
}

export interface SuggestedOutputFormat {
  title: string
  description: string
  generationInstructions: string
  audience?: Audience
  perspective?: 'observer' | 'party_a' | 'party_b' | 'reader_facing'
}

export interface TemplateSection {
  id: string
  name: string
  description: string
  isRequired: boolean
}

export interface Template {
  id: string
  name: string
  description: string
  intendedPerspectives: ParticipantRole[] // Which perspectives this template is designed for
  allowedAudience: Audience[]
  domainTags: Domain[]
  usedCount: number
  sections: TemplateSection[]
  requiredInputs: string[]
  styleRules: string[]
  suggestionTriggers: string[]
  sampleContent?: string | null
  defaultDoInstructions?: string
  defaultDontInstructions?: string
  marketplaceSourceId?: string | null
  customInstructions?: string
  language?: string | null
  outputFormat?: TemplateOutputFormat
}

export interface Output {
  id: string
  sessionId: string
  sessionFilename: string
  templateId: string
  templateName: string
  perspective: OutputPerspective
  audience: Audience
  language: string
  tone: OutputTone
  format: OutputFormat
  content: string
  createdAt: string
  transcriptVersionHash: string
  citeTimestamps: boolean
  costUsd?: number | null
  isPublic?: boolean
  shareToken?: string | null
  viewCount?: number
  sharedAt?: string | null
}

export interface AiSuggestion<T> {
  value: T
  confidence: number
  label: string
}

export interface GenerateOutputConfig {
  templateId?: string | null // Optional - when generating from AI suggestion, can be empty
  templateName?: string // Custom name when no template (e.g. suggestion title)
  perspective: OutputPerspective | null
  perspectiveSpeakerName?: string // Actual name of the selected speaker (for first-person perspective)
  audience: Audience | null
  language: string
  tone: OutputTone
  format: OutputFormat
  doInstructions: string
  dontInstructions: string
  createTemplateFromConfig: boolean
  citeTimestamps: boolean
  includeDate?: boolean
  lengthPreference?: OutputLengthPreference
}
