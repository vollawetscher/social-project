import type { SupabaseClient } from '@supabase/supabase-js'

export interface VoiceAgentSettings {
  enabled: boolean
  displayName: string
  wakeWord: string
  wakeSoundsLike: string[]
  dismissPhrase: string
  ackPhrases: string[]
  language: string
}

const DEFAULT_ACK_PHRASES = ['Gerne!', 'Bitte sehr.', 'Gern geschehen.']

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

  return {
    enabled: Boolean(row?.voice_agent_enabled),
    displayName: String(row?.voice_agent_display_name || 'Frau Peters').trim() || 'Frau Peters',
    wakeWord,
    wakeSoundsLike: normalizeSoundsLike(row?.voice_agent_wake_sounds_like as string[] | undefined, wakeWord),
    dismissPhrase: String(row?.voice_agent_dismiss_phrase || 'Danke, Frau Peters').trim() || 'Danke, Frau Peters',
    ackPhrases: normalizePhraseList(row?.voice_agent_ack_phrases as string[] | undefined, DEFAULT_ACK_PHRASES),
    language: language === 'auto' ? 'de' : language,
  }
}

export async function getVoiceAgentSettingsForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<VoiceAgentSettings> {
  const { data, error } = await supabase
    .from('profiles')
    .select(
      'voice_agent_enabled, voice_agent_display_name, voice_agent_wake_word, voice_agent_wake_sounds_like, voice_agent_dismiss_phrase, voice_agent_ack_phrases, voice_agent_language, default_recording_language',
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
