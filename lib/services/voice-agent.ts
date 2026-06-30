import type { SupabaseClient } from '@supabase/supabase-js'

export interface VoiceAgentSettings {
  enabled: boolean
  displayName: string
  wakeWord: string
  wakeSoundsLike: string[]
  dismissPhrase: string
  ackPhrases: string[]
  language: string
  voiceId: string
  speechSpeed: number
}

const DEFAULT_ACK_PHRASES = ['Gerne!', 'Bitte sehr.', 'Gern geschehen.']
export const DEFAULT_VOICE_AGENT_VOICE_ID = '38aabb6a-f52b-4fb0-a3d1-988518f4dc06'

// Cartesia sonic-3 accepts a speech speed between 0.6 and 2.0 (1.0 = normal).
export const DEFAULT_VOICE_AGENT_SPEECH_SPEED = 1.0
export const MIN_VOICE_AGENT_SPEECH_SPEED = 0.6
export const MAX_VOICE_AGENT_SPEECH_SPEED = 2.0

export const VOICE_AGENT_SPEED_OPTIONS = [
  { value: 0.8, label: 'Langsam' },
  { value: 0.9, label: 'Etwas langsamer' },
  { value: 1.0, label: 'Normal' },
  { value: 1.1, label: 'Etwas schneller' },
  { value: 1.2, label: 'Schnell' },
] as const

export function normalizeSpeechSpeed(value: unknown): number {
  const num = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(num)) return DEFAULT_VOICE_AGENT_SPEECH_SPEED
  return Math.min(MAX_VOICE_AGENT_SPEECH_SPEED, Math.max(MIN_VOICE_AGENT_SPEECH_SPEED, num))
}

/**
 * Cartesia REST /tts/bytes (sonic-3) accepts `generation_config.speed` between
 * 0.6 and 1.5, where 1.0 is normal — the same direction as our stored speed.
 * Clamp the user's speed into that range for the voice preview.
 */
export function speechSpeedToCartesiaRest(speed: number): number {
  const normalized = normalizeSpeechSpeed(speed)
  return Math.max(0.6, Math.min(1.5, Math.round(normalized * 100) / 100))
}

export const VOICE_AGENT_VOICE_OPTIONS = [
  {
    id: DEFAULT_VOICE_AGENT_VOICE_ID,
    label: 'Alina - German Assistant',
    description: 'Warm German female voice for phone systems and assistants.',
  },
  {
    id: '4ab1ff51-476d-42bb-8019-4d315f7c0c05',
    label: 'Lena - Clear German',
    description: 'Cool German female voice for clear communication.',
  },
  {
    id: '9b4d08b6-0494-4301-ab92-9150f4ee2718',
    label: 'Marlene - Formal German',
    description: 'Refined German female voice for formal announcements.',
  },
  {
    id: '6d4b1416-8d54-4d94-a788-8a802c086544',
    label: 'Sabine - German Newscaster',
    description: 'Soft but commanding German female voice.',
  },
  {
    id: '4ad22058-7cb6-402c-a115-196cbfc25dce',
    label: 'Moritz - German Male',
    description: 'Crisp German male voice for digital assistants.',
  },
] as const

export function isKnownVoiceAgentVoiceId(value: unknown): value is string {
  return typeof value === 'string' && VOICE_AGENT_VOICE_OPTIONS.some((voice) => voice.id === value)
}

function normalizePhraseList(values: string[] | null | undefined, fallback: string[]): string[] {
  const cleaned = (values || [])
    .map((value) => String(value || '').trim())
    .filter(Boolean)
  return cleaned.length > 0 ? cleaned : fallback
}

function normalizeSoundsLike(values: string[] | null | undefined, wakeWord: string): string[] {
  const cleaned = (values || [])
    .map((value) => String(value || '').trim())
    .filter(Boolean)
  if (cleaned.length > 0) return cleaned
  const base = wakeWord.trim()
  return base ? [base, base.toLowerCase()] : ['Frau Peters', 'Peters']
}

export function mapVoiceAgentSettings(row: Record<string, unknown> | null | undefined): VoiceAgentSettings {
  const wakeWord = String(row?.voice_agent_wake_word || 'Frau Peters').trim() || 'Frau Peters'
  const language = String(row?.voice_agent_language || row?.default_recording_language || 'de').trim() || 'de'
  const voiceId = row?.voice_agent_voice_id

  return {
    enabled: Boolean(row?.voice_agent_enabled),
    displayName: String(row?.voice_agent_display_name || 'Frau Peters').trim() || 'Frau Peters',
    wakeWord,
    wakeSoundsLike: normalizeSoundsLike(row?.voice_agent_wake_sounds_like as string[] | undefined, wakeWord),
    dismissPhrase: String(row?.voice_agent_dismiss_phrase || 'Danke, Frau Peters').trim() || 'Danke, Frau Peters',
    ackPhrases: normalizePhraseList(row?.voice_agent_ack_phrases as string[] | undefined, DEFAULT_ACK_PHRASES),
    language: language === 'auto' ? 'de' : language,
    voiceId: isKnownVoiceAgentVoiceId(voiceId) ? voiceId : DEFAULT_VOICE_AGENT_VOICE_ID,
    speechSpeed: normalizeSpeechSpeed(row?.voice_agent_speech_speed),
  }
}

export async function getVoiceAgentSettingsForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<VoiceAgentSettings> {
  const { data, error } = await supabase
    .from('profiles')
    .select(
      'voice_agent_enabled, voice_agent_display_name, voice_agent_wake_word, voice_agent_wake_sounds_like, voice_agent_dismiss_phrase, voice_agent_ack_phrases, voice_agent_language, voice_agent_voice_id, voice_agent_speech_speed, default_recording_language',
    )
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    console.error('[VoiceAgent] Failed to load profile settings:', error.message)
    return mapVoiceAgentSettings(null)
  }

  return mapVoiceAgentSettings(data)
}

export async function isVoiceAgentEnabledForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const settings = await getVoiceAgentSettingsForUser(supabase, userId)
  return settings.enabled
}
