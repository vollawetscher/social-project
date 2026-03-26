export interface UserProfile {
  id: string
  email: string | null
  phone_number: string | null
  role: 'user' | 'admin'
  created_at: string
  
  // Language preferences
  default_recording_language: string
  preferred_report_language: string
  preferred_locale: 'en' | 'de' | 'es'
  timezone: string
  
  // Workflow preferences
  after_transcript_action: 'nothing' | 'short_summary' | 'long_summary' | 'full_report'
  after_transcript_template_id: string | null // Template for auto-gen after transcription (preferred over action)
  auto_generate_reports: boolean
  
  // Additional fields
  display_name?: string
  email_verified?: boolean
  auth_method?: string
  preferences?: Record<string, any>

  // Data retention
  default_retention_days: number

  // Voice sample for speaker diarization priming
  voice_sample_path?: string | null
  voice_sample_duration_ms?: number | null

  // Trial / onboarding
  onboarding_expires_at?: string | null
}

export const SUPPORTED_LANGUAGES = [
  { value: 'auto', label: 'Auto' },
  { value: 'de', label: 'German' },
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'it', label: 'Italian' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'nl', label: 'Dutch' },
  { value: 'pl', label: 'Polish' },
] as const

export const TIMEZONES = [
  { value: 'Europe/Berlin', label: 'Berlin (CET/CEST)' },
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Paris (CET/CEST)' },
  { value: 'Europe/Vienna', label: 'Vienna (CET/CEST)' },
  { value: 'Europe/Zurich', label: 'Zurich (CET/CEST)' },
  { value: 'America/New_York', label: 'New York (EST/EDT)' },
  { value: 'America/Los_Angeles', label: 'Los Angeles (PST/PDT)' },
  { value: 'America/Chicago', label: 'Chicago (CST/CDT)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  { value: 'Asia/Shanghai', label: 'Shanghai (CST)' },
  { value: 'Asia/Dubai', label: 'Dubai (GST)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEDT/AEST)' },
] as const

export const AFTER_TRANSCRIPT_ACTIONS = [
  { value: 'nothing', label: 'Do Nothing', description: 'Manual report generation only' },
  { value: 'short_summary', label: 'Short Summary', description: 'Quick overview (1-2 paragraphs)' },
  { value: 'long_summary', label: 'Long Summary', description: 'Detailed summary with key points' },
  { value: 'full_report', label: 'Full Report', description: 'Complete analysis with all sections' },
] as const
