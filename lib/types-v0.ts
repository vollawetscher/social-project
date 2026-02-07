// Core enums and types for Notissima

export type SessionStatus = 'uploading' | 'transcribing' | 'ready' | 'failed'

export type RecordingType = 
  | 'meeting' 
  | 'interview' 
  | 'legal_deposition' 
  | 'sales_call' 
  | 'lecture' 
  | 'consultation' 
  | 'other'

export type Domain = 
  | 'legal' 
  | 'sales' 
  | 'hr' 
  | 'medical' 
  | 'education' 
  | 'consulting' 
  | 'general'

// Participant role in the conversation (assigned at transcription level)
export type ParticipantRole = 'party_a' | 'party_b' | 'observer'

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

export type Audience = 'internal' | 'external'

export type OutputTone = 'direct' | 'neutral' | 'formal'

export type OutputFormat = 'markdown' | 'json'

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
}

export interface Session {
  id: string
  filename: string
  duration: number
  language: string
  createdAt: string
  status: SessionStatus
  piiRedactionEnabled: boolean
  isOfflineCached: boolean
  recordingType?: RecordingType
  recordingTypeConfidence?: number
  domain?: Domain
  domainConfidence?: number
  speakers: Speaker[]
  transcript: TranscriptSegment[]
  extractedContext?: ExtractedContext
  audioUrl?: string // Optional audio file URL
  outputCount?: number // Number of generated outputs for this session
}

export interface ExtractedContext {
  participants: string[]
  purpose: string
  agenda: string[]
  venue: string
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
}

export interface Output {
  id: string
  sessionId: string
  sessionFilename: string
  templateId: string
  templateName: string
  perspective: ParticipantRole // From whose perspective (party_a, party_b, observer)
  audience: Audience
  language: string
  tone: OutputTone
  format: OutputFormat
  content: string
  createdAt: string
  transcriptVersionHash: string
  citeTimestamps: boolean
}

export interface AiSuggestion<T> {
  value: T
  confidence: number
  label: string
}

export interface GenerateOutputConfig {
  templateId: string
  perspective: ParticipantRole | null // From whose perspective to generate
  audience: Audience | null
  language: string
  tone: OutputTone
  format: OutputFormat
  doInstructions: string
  dontInstructions: string
  createTemplateFromConfig: boolean
  citeTimestamps: boolean
}
