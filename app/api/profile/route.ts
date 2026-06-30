import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  isKnownVoiceAgentVoiceId,
  MIN_VOICE_AGENT_SPEECH_SPEED,
  MAX_VOICE_AGENT_SPEECH_SPEED,
} from '@/lib/services/voice-agent'

function normalizePhone(raw: string): string | null {
  let cleaned = raw.replace(/[\s\-().]/g, '')
  if (cleaned.startsWith('00')) cleaned = `+${cleaned.slice(2)}`
  if (/^\d{7,15}$/.test(cleaned)) cleaned = `+${cleaned}`
  return /^\+[1-9]\d{6,14}$/.test(cleaned) ? cleaned : null
}

export async function GET() {
  try {
    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (error) {
      console.error('Error fetching profile:', error)
      return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 })
    }

    return NextResponse.json(profile)
  } catch (error) {
    console.error('Error in GET /api/profile:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const updates = await request.json()
    
    // Whitelist allowed fields to prevent unauthorized updates
    const allowedFields = [
      'default_recording_language',
      'preferred_report_language',
      'preferred_locale',
      'timezone',
      'after_transcript_action',
      'after_transcript_template_id',
      'auto_generate_reports',
      'phone_number',
      'preferences',
      'default_retention_days',
      'meeting_slug',
      'voice_agent_enabled',
      'voice_agent_display_name',
      'voice_agent_wake_word',
      'voice_agent_wake_sounds_like',
      'voice_agent_dismiss_phrase',
      'voice_agent_ack_phrases',
      'voice_agent_language',
      'voice_agent_voice_id',
      'voice_agent_speech_speed',
    ]
    
    const filteredUpdates = Object.keys(updates)
      .filter(key => allowedFields.includes(key))
      .reduce((obj: any, key) => {
        obj[key] = updates[key]
        return obj
      }, {})

    if ('phone_number' in filteredUpdates) {
      const rawPhone = filteredUpdates.phone_number
      if (rawPhone === null || rawPhone === undefined || String(rawPhone).trim() === '') {
        filteredUpdates.phone_number = null
      } else {
        const normalized = normalizePhone(String(rawPhone))
        if (!normalized) {
          return NextResponse.json(
            { error: 'Invalid phone number. Use international format, e.g. +491701234567' },
            { status: 400 }
          )
        }
        filteredUpdates.phone_number = normalized
      }
    }

    if ('preferred_report_language' in filteredUpdates) {
      const value = filteredUpdates.preferred_report_language
      if (value !== null && value !== undefined && String(value).trim() !== '') {
        const normalized = String(value).trim().toLowerCase()
        if (normalized !== 'session' && !/^[a-z]{2}$/.test(normalized)) {
          return NextResponse.json(
            { error: 'Invalid preferred report language' },
            { status: 400 }
          )
        }
        filteredUpdates.preferred_report_language = normalized
      }
    }

    if ('meeting_slug' in filteredUpdates) {
      const raw = filteredUpdates.meeting_slug
      if (raw !== null && raw !== undefined) {
        const slug = String(raw).trim().toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '')
        if (slug.length < 2 || slug.length > 60) {
          return NextResponse.json(
            { error: 'Meeting slug must be between 2 and 60 characters' },
            { status: 400 }
          )
        }
        filteredUpdates.meeting_slug = slug
      }
    }

    if ('preferences' in filteredUpdates) {
      const value = filteredUpdates.preferences
      if (value !== null && (typeof value !== 'object' || Array.isArray(value))) {
        return NextResponse.json(
          { error: 'Invalid preferences payload' },
          { status: 400 }
        )
      }
    }

    if ('voice_agent_wake_sounds_like' in filteredUpdates) {
      const value = filteredUpdates.voice_agent_wake_sounds_like
      if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) {
        return NextResponse.json({ error: 'Invalid voice agent sounds_like list' }, { status: 400 })
      }
      filteredUpdates.voice_agent_wake_sounds_like = value.map((entry) => String(entry).trim()).filter(Boolean)
    }

    if ('voice_agent_ack_phrases' in filteredUpdates) {
      const value = filteredUpdates.voice_agent_ack_phrases
      if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) {
        return NextResponse.json({ error: 'Invalid voice agent acknowledgement list' }, { status: 400 })
      }
      filteredUpdates.voice_agent_ack_phrases = value.map((entry) => String(entry).trim()).filter(Boolean)
    }

    for (const textField of ['voice_agent_display_name', 'voice_agent_wake_word', 'voice_agent_dismiss_phrase'] as const) {
      if (textField in filteredUpdates) {
        const value = String(filteredUpdates[textField] ?? '').trim()
        if (!value) {
          return NextResponse.json({ error: `Invalid ${textField}` }, { status: 400 })
        }
        filteredUpdates[textField] = value
      }
    }

    if ('voice_agent_language' in filteredUpdates) {
      const value = filteredUpdates.voice_agent_language
      if (value !== null && value !== undefined && String(value).trim() !== '') {
        const normalized = String(value).trim().toLowerCase()
        if (normalized !== 'auto' && !/^[a-z]{2}$/.test(normalized)) {
          return NextResponse.json({ error: 'Invalid voice agent language' }, { status: 400 })
        }
        filteredUpdates.voice_agent_language = normalized
      } else {
        filteredUpdates.voice_agent_language = null
      }
    }

    if ('voice_agent_voice_id' in filteredUpdates) {
      const value = String(filteredUpdates.voice_agent_voice_id || '').trim()
      if (!isKnownVoiceAgentVoiceId(value)) {
        return NextResponse.json({ error: 'Invalid voice agent voice' }, { status: 400 })
      }
      filteredUpdates.voice_agent_voice_id = value
    }

    if ('voice_agent_speech_speed' in filteredUpdates) {
      const value = Number(filteredUpdates.voice_agent_speech_speed)
      if (!Number.isFinite(value) || value < MIN_VOICE_AGENT_SPEECH_SPEED || value > MAX_VOICE_AGENT_SPEECH_SPEED) {
        return NextResponse.json({ error: 'Invalid voice agent speech speed' }, { status: 400 })
      }
      filteredUpdates.voice_agent_speech_speed = Math.round(value * 100) / 100
    }

    if ('voice_agent_enabled' in filteredUpdates) {
      filteredUpdates.voice_agent_enabled = Boolean(filteredUpdates.voice_agent_enabled)
    }

    if (Object.keys(filteredUpdates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const { data: profile, error } = await supabase
      .from('profiles')
      .update(filteredUpdates)
      .eq('id', user.id)
      .select()
      .single()

    if (error) {
      console.error('Error updating profile:', error)
      console.error('Error details:', JSON.stringify(error, null, 2))
      if (error.code === '23505') {
        if ((error.message || '').includes('phone_number')) {
          return NextResponse.json(
            { error: 'This phone number is already used by another account' },
            { status: 409 }
          )
        }
        if ((error.message || '').includes('meeting_slug')) {
          return NextResponse.json(
            { error: 'This meeting link slug is already taken. Please choose another.' },
            { status: 409 }
          )
        }
      }
      return NextResponse.json({ 
        error: 'Failed to update profile', 
        details: error.message,
        hint: error.hint 
      }, { status: 500 })
    }

    return NextResponse.json(profile)
  } catch (error) {
    console.error('Error in PATCH /api/profile:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
