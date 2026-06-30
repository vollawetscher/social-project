import { NextResponse } from 'next/server'
import { requireAuth, handleAuthError } from '@/lib/auth/helpers'
import {
  isKnownVoiceAgentVoiceId,
  normalizeSpeechSpeed,
  speechSpeedToCartesiaRest,
} from '@/lib/services/voice-agent'

const SAMPLE_TEXT = 'Guten Tag, so klinge ich. Wie kann ich Ihnen helfen?'
const CARTESIA_VERSION = '2025-04-16'

/**
 * POST /api/voice-agent/voice-preview
 * Synthesizes a short German sample with the selected voice and speed so the
 * user can hear the assistant before saving. Returns audio/mpeg bytes.
 */
export async function POST(request: Request) {
  try {
    await requireAuth(request)

    const apiKey = process.env.CARTESIA_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Voice preview is not configured' },
        { status: 503 },
      )
    }

    const body = await request.json().catch(() => ({}))
    const voiceId = String(body?.voiceId || '').trim()
    if (!isKnownVoiceAgentVoiceId(voiceId)) {
      return NextResponse.json({ error: 'Invalid voice' }, { status: 400 })
    }

    const speed = normalizeSpeechSpeed(body?.speed)
    const restSpeed = speechSpeedToCartesiaRest(speed)

    const cartesiaResponse = await fetch('https://api.cartesia.ai/tts/bytes', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Cartesia-Version': CARTESIA_VERSION,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model_id: 'sonic-3',
        transcript: SAMPLE_TEXT,
        language: 'de',
        voice: { mode: 'id', id: voiceId },
        output_format: { container: 'mp3', sample_rate: 44100, bit_rate: 128000 },
        generation_config: { speed: restSpeed },
      }),
    })

    if (!cartesiaResponse.ok) {
      const errorText = await cartesiaResponse.text().catch(() => '')
      console.error('[Voice Preview] Cartesia error:', cartesiaResponse.status, errorText)
      return NextResponse.json({ error: 'Failed to generate voice preview' }, { status: 502 })
    }

    const audio = await cartesiaResponse.arrayBuffer()
    return new NextResponse(audio, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    if (error instanceof Error) {
      const authError = handleAuthError(error)
      if (authError.status === 401) {
        return NextResponse.json({ error: authError.message }, { status: 401 })
      }
    }
    console.error('[Voice Preview] Error:', error)
    return NextResponse.json({ error: 'Failed to generate voice preview' }, { status: 500 })
  }
}
